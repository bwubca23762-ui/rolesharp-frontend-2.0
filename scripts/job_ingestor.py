#!/usr/bin/env python3
"""Incrementally ingest fresh jobs into RoleSharp's bounded Postgres cache.

Multi-board ingestion: each search profile resolves to the highest-volume
boards for its country ("auto"), every board call is isolated in its own
try/except so one rate-limited board never stops the others, and results are
deduplicated across boards by (country, company, title) with the winning
board's provider attribution preserved.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import re
import signal
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

import psycopg
from jobspy import scrape_jobs


DATABASE_URL = os.environ["DATABASE_URL"]
POLL_SECONDS = max(30, int(os.getenv("JOB_INGEST_POLL_SECONDS", "90")))
RESULTS_PER_SOURCE = max(5, min(100, int(os.getenv("JOB_RESULTS_PER_SOURCE", "25"))))
HOURS_OLD = max(24, min(720, int(os.getenv("JOB_HOURS_OLD", "168"))))
RETENTION_DAYS = max(7, min(60, int(os.getenv("JOB_RETENTION_DAYS", "30"))))
ENABLE_LINKEDIN = os.getenv("JOBSPY_ENABLE_LINKEDIN", "false").lower() == "true"
PROXIES = [x.strip() for x in os.getenv("JOBSPY_PROXIES", "").split(",") if x.strip()]
MAX_WORKERS = max(2, min(6, int(os.getenv("JOB_INGEST_MAX_WORKERS", "4"))))

# ── Multi-board routing (JobSpy boards) ──────────────────────────────────────
# Global core boards every country gets in "auto" mode, plus the highest-volume
# local board per market. A board JobSpy does not support in the installed
# version (e.g. bdjobs) fails its isolated call and is logged, never fatal.

GLOBAL_CORE_BOARDS = ["indeed", "linkedin", "glassdoor", "google"]

COUNTRY_EXTRA_BOARDS = {
    "IN": ["naukri"],
    "AE": ["bayt"], "SA": ["bayt"], "QA": ["bayt"], "KW": ["bayt"],
    "BH": ["bayt"], "OM": ["bayt"], "EG": ["bayt"],
    "US": ["zip_recruiter"], "CA": ["zip_recruiter"],
    "BD": ["bdjobs"],
}

# Board priority when several boards return the same (country, company, title):
# earlier boards win ties; otherwise the row with the longer description and
# the fresher date keeps the attribution.
BOARD_PRIORITY = {b: i for i, b in enumerate(
    ["indeed", "linkedin", "glassdoor", "google", "naukri", "bayt", "zip_recruiter", "bdjobs"]
)}


def resolve_sources(requested: list[str], country_code: str) -> list[str]:
    """Map a profile's provider list to concrete boards.

    "auto" (or an empty list) expands to the global core boards plus the
    country's local board. Explicit lists pass through unchanged (legacy
    profiles pinned to ["indeed"] keep working).
    """
    requested = [str(p).strip().lower() for p in requested if str(p).strip()]
    if requested and "auto" not in requested:
        return requested
    boards = list(GLOBAL_CORE_BOARDS)
    for extra in COUNTRY_EXTRA_BOARDS.get(country_code.upper(), []):
        if extra not in boards:
            boards.append(extra)
    return boards

COUNTRY_NAMES = {
    "AR": "Argentina",
    "AT": "Austria",
    "AU": "Australia",
    "AE": "United Arab Emirates",
    "BD": "Bangladesh",
    "BE": "Belgium",
    "BG": "Bulgaria",
    "BH": "Bahrain",
    "BR": "Brazil",
    "CA": "Canada",
    "CH": "Switzerland",
    "CL": "Chile",
    "CN": "China",
    "CO": "Colombia",
    "CR": "Costa Rica",
    "CY": "Cyprus",
    "CZ": "Czech Republic",
    "DE": "Germany",
    "DK": "Denmark",
    "EC": "Ecuador",
    "EE": "Estonia",
    "EG": "Egypt",
    "ES": "Spain",
    "FI": "Finland",
    "FR": "France",
    "GB": "UK",
    "GR": "Greece",
    "HK": "Hong Kong",
    "HR": "Croatia",
    "HU": "Hungary",
    "ID": "Indonesia",
    "IE": "Ireland",
    "IL": "Israel",
    "IN": "India",
    "IT": "Italy",
    "JP": "Japan",
    "KR": "South Korea",
    "KW": "Kuwait",
    "LT": "Lithuania",
    "LU": "Luxembourg",
    "LV": "Latvia",
    "MA": "Morocco",
    "MT": "Malta",
    "MX": "Mexico",
    "MY": "Malaysia",
    "NG": "Nigeria",
    "NL": "Netherlands",
    "NO": "Norway",
    "NZ": "New Zealand",
    "OM": "Oman",
    "PA": "Panama",
    "PE": "Peru",
    "PH": "Philippines",
    "PK": "Pakistan",
    "PL": "Poland",
    "PT": "Portugal",
    "QA": "Qatar",
    "RO": "Romania",
    "SA": "Saudi Arabia",
    "SE": "Sweden",
    "SG": "Singapore",
    "SI": "Slovenia",
    "SK": "Slovakia",
    "TH": "Thailand",
    "TR": "Turkey",
    "TW": "Taiwan",
    "UA": "Ukraine",
    "US": "USA",
    "UY": "Uruguay",
    "VE": "Venezuela",
    "VN": "Vietnam",
    "ZA": "South Africa",
}

logging.basicConfig(level=os.getenv("JOB_INGEST_LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("rolesharp.jobs")
running = True


def stop(_signum: int, _frame: Any) -> None:
    global running
    running = False


def interruptible_sleep(seconds: int) -> None:
    deadline = time.monotonic() + seconds
    while running:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return
        time.sleep(min(remaining, 1))


signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)


def clean_text(value: Any, limit: int) -> str | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    text = re.sub(r"\x00", "", str(value)).strip()
    return text[:limit] or None


def value(row: dict[str, Any], key: str) -> Any:
    item = row.get(key)
    if item is None or (isinstance(item, float) and math.isnan(item)):
        return None
    return item.value if hasattr(item, "value") else item


def number(item: Any) -> float | None:
    try:
        val = float(item)
        return val if math.isfinite(val) else None
    except (TypeError, ValueError):
        return None


def posted_at(item: Any) -> datetime | None:
    if item is None:
        return None
    if hasattr(item, "to_pydatetime"):
        item = item.to_pydatetime()
    if isinstance(item, datetime):
        return item.replace(tzinfo=item.tzinfo or timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(item).replace("Z", "+00:00"))
        return parsed.replace(tzinfo=parsed.tzinfo or timezone.utc)
    except ValueError:
        return None


def external_id(provider: str, row: dict[str, Any], url: str) -> str:
    raw = clean_text(row.get("id"), 250)
    if raw:
        return raw
    return hashlib.sha256(f"{provider}:{url}".encode()).hexdigest()


def upsert_job(cur: psycopg.Cursor[Any], row: dict[str, Any], country_code: str) -> bool:
    provider = clean_text(value(row, "site"), 40) or "unknown"
    url = clean_text(value(row, "job_url_direct") or value(row, "job_url"), 1500)
    title = clean_text(value(row, "title"), 300)
    company = clean_text(value(row, "company"), 300)
    if not url or not title or not company:
        return False
    # Scraped data is untrusted: only http(s) apply links may reach the UI.
    if not url.lower().startswith(("http://", "https://")):
        return False

    location = clean_text(value(row, "location"), 300)
    if not location:
        parts = [clean_text(value(row, key), 120) for key in ("city", "state")]
        location = ", ".join(x for x in parts if x) or None
    metadata = {
        key: value(row, key)
        for key in ("job_level", "job_function", "company_industry", "skills", "experience_range", "work_from_home_type")
        if value(row, key) is not None
    }
    cur.execute(
        """
        insert into jobs (
          provider, external_id, title, company, country_code, location, city, state_region,
          is_remote, job_type, description, apply_url, source_url, company_url,
          salary_min, salary_max, salary_currency, salary_interval, date_posted,
          last_seen_at, expires_at, metadata
        ) values (
          %(provider)s,%(external_id)s,%(title)s,%(company)s,%(country_code)s,%(location)s,%(city)s,%(state)s,
          %(remote)s,%(job_type)s,%(description)s,%(apply_url)s,%(source_url)s,%(company_url)s,
          %(salary_min)s,%(salary_max)s,%(currency)s,%(interval)s,%(date_posted)s,
          now(),now() + (%(retention)s || ' days')::interval,%(metadata)s::jsonb
        )
        on conflict (provider, external_id) do update set
          title=excluded.title, company=excluded.company, country_code=excluded.country_code,
          location=excluded.location, city=excluded.city, state_region=excluded.state_region,
          is_remote=excluded.is_remote, job_type=excluded.job_type,
          description=coalesce(excluded.description, jobs.description),
          apply_url=excluded.apply_url, source_url=excluded.source_url,
          company_url=coalesce(excluded.company_url, jobs.company_url),
          salary_min=excluded.salary_min, salary_max=excluded.salary_max,
          salary_currency=excluded.salary_currency, salary_interval=excluded.salary_interval,
          date_posted=coalesce(excluded.date_posted, jobs.date_posted),
          last_seen_at=now(), expires_at=excluded.expires_at, metadata=excluded.metadata
        """,
        {
            "provider": provider,
            "external_id": external_id(provider, row, url),
            "title": title,
            "company": company,
            "country_code": country_code,
            "location": location,
            "city": clean_text(value(row, "city"), 120),
            "state": clean_text(value(row, "state"), 120),
            "remote": bool(value(row, "is_remote") or False),
            "job_type": clean_text(value(row, "job_type"), 40),
            "description": clean_text(value(row, "description"), 40_000),
            "apply_url": url,
            "source_url": clean_text(value(row, "job_url"), 1500),
            "company_url": clean_text(value(row, "company_url"), 1500),
            "salary_min": number(value(row, "min_amount")),
            "salary_max": number(value(row, "max_amount")),
            "currency": clean_text(value(row, "currency"), 12),
            "interval": clean_text(value(row, "interval"), 30),
            "date_posted": posted_at(value(row, "date_posted")),
            "retention": RETENTION_DAYS,
            "metadata": json.dumps(metadata, default=str),
        },
    )
    return True


def claim_profile(conn: psycopg.Connection[Any]) -> dict[str, Any] | None:
    with conn.transaction(), conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        cur.execute(
            """
            select id, country_code, country_name, location, search_term, providers, refresh_hours
            from job_search_profiles
            where enabled and next_run_at <= now()
            order by next_run_at, id
            for update skip locked limit 1
            """
        )
        profile = cur.fetchone()
        if not profile:
            return None
        cur.execute(
            "update job_search_profiles set last_started_at=now(), next_run_at=now() + interval '30 minutes' where id=%s",
            (profile["id"],),
        )
        return dict(profile)


def dedup_key(country_code: str, row: dict[str, Any]) -> tuple[str, str, str]:
    company = str(clean_text(value(row, "company"), 300) or "").lower()
    title = str(clean_text(value(row, "title"), 300) or "").lower()
    return (country_code.lower(), company, title)


def pick_best(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Choose the representative row for one dedup key: prefer the longer
    description, then the fresher date, then board priority order. The winner's
    own provider attribution is preserved by upsert_job."""
    def rank(row: dict[str, Any]) -> tuple[int, Any, int]:
        description = str(value(row, "description") or "")
        posted = value(row, "date_posted")
        posted_ts = 0
        if posted is not None and hasattr(posted, "timestamp"):
            try:
                posted_ts = posted.timestamp()
            except Exception:
                posted_ts = 0
        provider = str(value(row, "site") or "").lower()
        return (len(description), posted_ts, -BOARD_PRIORITY.get(provider, 99))

    return max(rows, key=rank)


def scrape_one_board(board: str, profile: dict[str, Any]) -> list[dict[str, Any]]:
    """One isolated board call. Any failure — rate limit, timeout, unsupported
    board — is logged and returned as an empty list so the remaining boards
    still ingest cleanly."""
    kwargs: dict[str, Any] = {
        "site_name": [board],
        "search_term": profile["search_term"],
        "location": profile["location"],
        "results_wanted": RESULTS_PER_SOURCE,
        "hours_old": HOURS_OLD,
        "country_indeed": COUNTRY_NAMES.get(profile["country_code"], profile["country_name"]),
        "description_format": "markdown",
        "linkedin_fetch_description": False,
        "verbose": 1,
    }
    if PROXIES:
        kwargs["proxies"] = PROXIES
    try:
        frame = scrape_jobs(**kwargs)
        records = frame.to_dict(orient="records") if frame is not None else []
        log.info("board=%s profile=%s/%s fetched=%s", board, profile["country_code"], profile["search_term"], len(records))
        return records
    except Exception as exc:
        message = clean_text(exc, 300) or "unknown board error"
        log.warning("board=%s profile=%s/%s failed: %s", board, profile["country_code"], profile["search_term"], message)
        return []


def run_profile(conn: psycopg.Connection[Any], profile: dict[str, Any]) -> None:
    boards = resolve_sources(list(profile["providers"]), profile["country_code"])
    if ENABLE_LINKEDIN and "linkedin" not in boards:
        boards.append("linkedin")
    with conn.transaction(), conn.cursor() as cur:
        cur.execute(
            """insert into job_ingestion_runs (profile_id,country_code,search_term,providers)
               values (%s,%s,%s,%s) returning id""",
            (profile["id"], profile["country_code"], profile["search_term"], boards),
        )
        run_id = cur.fetchone()[0]

    try:
        # Concurrent per-board calls, each isolated: one board's rate limit or
        # timeout never blocks the others.
        with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(boards))) as pool:
            futures = [(board, pool.submit(scrape_one_board, board, profile)) for board in boards]
            fetched = 0
            by_key: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
            for board, future in futures:
                try:
                    records = future.result(timeout=300)
                except Exception as exc:
                    log.warning("board=%s future failed: %s", board, clean_text(exc, 300) or "unknown")
                    records = []
                fetched += len(records)
                for row in records:
                    by_key.setdefault(dedup_key(profile["country_code"], row), []).append(row)

        records = [pick_best(rows) for rows in by_key.values()]
        stored = 0
        with conn.transaction(), conn.cursor() as cur:
            for row in records:
                stored += int(upsert_job(cur, row, profile["country_code"]))
            cur.execute(
                """update job_ingestion_runs set status='success', fetched_count=%s, stored_count=%s, finished_at=now()
                   where id=%s""",
                (fetched, stored, run_id),
            )
            cur.execute(
                """update job_search_profiles set last_success_at=now(), last_error=null, consecutive_failures=0,
                   next_run_at=now() + (refresh_hours || ' hours')::interval where id=%s""",
                (profile["id"],),
            )
            cur.execute("delete from jobs where expires_at < now()")
            cur.execute("delete from job_ingestion_runs where started_at < now() - interval '30 days'")
        log.info(
            "profile=%s/%s boards=%s fetched=%s unique=%s stored=%s",
            profile["country_code"], profile["search_term"], boards, fetched, len(records), stored,
        )
    except Exception as exc:
        message = clean_text(exc, 1500) or "unknown ingestion error"
        with conn.transaction(), conn.cursor() as cur:
            cur.execute("update job_ingestion_runs set status='failed', error=%s, finished_at=now() where id=%s", (message, run_id))
            cur.execute(
                """update job_search_profiles set last_error=%s, consecutive_failures=consecutive_failures+1,
                   next_run_at=now() + (least(24, power(2, least(consecutive_failures+1,4))::int) || ' hours')::interval
                   where id=%s""",
                (message, profile["id"]),
            )
        log.exception("profile=%s/%s failed", profile["country_code"], profile["search_term"])


def main() -> None:
    log.info("job ingestor starting poll=%ss results/source=%s boards=auto(%s)+country workers=%s linkedin=%s",
             POLL_SECONDS, RESULTS_PER_SOURCE, ",".join(GLOBAL_CORE_BOARDS), MAX_WORKERS, ENABLE_LINKEDIN)
    while running:
        try:
            with psycopg.connect(DATABASE_URL, autocommit=False) as conn:
                while running:
                    profile = claim_profile(conn)
                    if profile:
                        run_profile(conn, profile)
                    else:
                        interruptible_sleep(POLL_SECONDS)
        except Exception:
            log.exception("database loop failed; reconnecting")
            interruptible_sleep(min(POLL_SECONDS, 30))
    log.info("job ingestor stopped")


if __name__ == "__main__":
    main()
