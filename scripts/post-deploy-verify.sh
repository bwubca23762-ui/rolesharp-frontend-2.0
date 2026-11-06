#!/usr/bin/env bash
# Post-deploy verification (run from anywhere):
#   BASE=https://rolesharp.com bash scripts/post-deploy-verify.sh
# Proves the three audits' P0 findings are closed on the DEPLOYED build.
# Every check prints PASS/FAIL and the script exits non-zero on any failure.
set -u
BASE="${BASE:-https://rolesharp.com}"
FAILED=0

check() { # name, actual, expected-pattern
  if echo "$2" | grep -qE "$3"; then
    echo "PASS  $1  (got $2)"
  else
    echo "FAIL  $1  (expected /$3/, got $2)"
    FAILED=1
  fi
}

# New-build markers (these prove the deploy landed, independent of auth)
MARKER=$(curl -s --max-time 30 "$BASE/llms.txt" | grep -c "practice partner")
check "new build deployed (llms.txt practice feature)" "$MARKER" "^1$"

# The salaries index only lists role×market pairs whose live sample cleared
# MIN_SAMPLE — non-US markets drop in and out with posting data, so assert the
# pair the index currently serves instead of a data-dependent market.
SALARY=$(curl -s --max-time 30 -o /dev/null -w "%{http_code}" "$BASE/salaries/data-analyst/us")
check "salary detail page live" "$SALARY" "^200$"

# The four audit PoCs — unauthenticated, no cookies, no headers.
# A leaked UUID from the audit reports; any valid id must answer 401/402/404.
AUDIT_UUID="70325213-9e89-417c-b2db-8c20492c3169"

LIST=$(curl -s --max-time 30 -o /dev/null -w "%{http_code}" "$BASE/api/resumes")
check "GET /api/resumes unauthenticated -> 401" "$LIST" "^401$"

ONE=$(curl -s --max-time 30 -o /dev/null -w "%{http_code}" "$BASE/api/resume/$AUDIT_UUID")
check "GET /api/resume/{id} unauthenticated -> 401" "$ONE" "^401$"

DOCX=$(curl -s --max-time 30 -o /dev/null -w "%{http_code}" "$BASE/api/resume/$AUDIT_UUID/docx")
check "GET /api/resume/{id}/docx unauthenticated -> 401" "$DOCX" "^401$"

PDF=$(curl -s --max-time 30 -o /dev/null -w "%{http_code}" "$BASE/api/resume/$AUDIT_UUID/pdf")
check "GET /api/resume/{id}/pdf unauthenticated -> 401" "$PDF" "^401$"

# The Origin header is required to reach the route: mutation requests without
# a same-origin header are rejected 403 by the CSRF middleware before the
# handler's production 404 ever runs. 403-without-origin and 404-with-origin
# together are the correct prod posture.
DEVCONFIRM=$(curl -s --max-time 30 -o /dev/null -w "%{http_code}" -X POST "$BASE/api/pay/crypto/dev-confirm" -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"plan":"monthly"}')
check "POST /api/pay/crypto/dev-confirm in prod -> 404 (with same-origin)" "$DEVCONFIRM" "^404$"

DEVCONFIRM_NOORIGIN=$(curl -s --max-time 30 -o /dev/null -w "%{http_code}" -X POST "$BASE/api/pay/crypto/dev-confirm" -H "Content-Type: application/json" -d '{"plan":"monthly"}')
check "POST /api/pay/crypto/dev-confirm without origin -> 403 CSRF" "$DEVCONFIRM_NOORIGIN" "^403$"

# Body-level proof for the listing route (the audit's exact leak shape):
BODY=$(curl -s --max-time 30 "$BASE/api/resumes")
if echo "$BODY" | grep -q "candidate_name"; then
  echo "FAIL  GET /api/resumes body leaks candidate records"
  FAILED=1
else
  echo "PASS  GET /api/resumes body contains no candidate records"
fi

# CDN cache-poisoning check (the true mechanism behind the audit leaks):
# per-user API responses must be private, no-store — never edge-cacheable.
CACHE_ME=$(curl -s --max-time 30 -D - -o /dev/null "$BASE/api/me" | grep -i "^cache-control:" | tr -d '\r')
check "GET /api/me sends private,no-store" "$CACHE_ME" "private, no-store"

CACHE_LIST=$(curl -s --max-time 30 -D - -o /dev/null "$BASE/api/resumes" | grep -i "^cache-control:" | tr -d '\r')
check "GET /api/resumes sends private,no-store" "$CACHE_LIST" "private, no-store"

echo "---"
if [ "$FAILED" -eq 0 ]; then
  echo "ALL CHECKS PASSED — the audit P0s are closed on the deployed build."
else
  echo "FAILURES PRESENT — the deployed build predates the fixes. Deploy again from a fresh checkout."
  exit 1
fi
