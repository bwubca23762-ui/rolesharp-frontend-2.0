"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/app/session-context";
import { Button, Input, Label, Notice, PageHeader, Select } from "@/components/ui/primitives";

type ProfileFacts = {
  desiredTitles?: { text: string }[];
  skills?: { text: string; state?: string }[];
  relevantExperience?: { months?: number };
  seniority?: { level?: string; track?: string };
  acceptedTracks?: string[];
  locationPreferences?: { location: string }[];
  remotePolicies?: string[];
  authorization?: { state?: string };
  workTypes?: { type: string }[];
  compensationFloor?: { amountMinor: number; currency: string; period: string };
};
type Profile = { id: string; version: number; normalized_facts: ProfileFacts };
type Criteria = {
  desiredTitles?: string[]; mustHaveSkills?: string[]; preferredSkills?: string[];
  countries?: string[]; locations?: string[]; remotePolicies?: string[]; workTypes?: string[];
  authorization?: string; compensationFloor?: { amountMinor: number; currency: string; period: string };
  excludedCompanies?: string[]; blockedSources?: string[];
};
type Campaign = {
  id: string; mode: "daily_matches" | "role_apply";
  authorization_mode: "review_each" | "campaign_policy"; status: string;
  profile_version_id: string; criteria: Criteria; timezone: string; daily_time: string;
  daily_limit: number; fit_score_floor: number; confidence_score_floor: number;
  pinned_connection_id?: string | null;
};
type Connection = { id: string; provider: string; verified_sender: string; status: string };

const split = (value: string) => [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
const join = (values?: readonly string[]) => values?.join(", ") ?? "";
const activeCampaign = (campaign: Campaign) => !["canceled", "expired"].includes(campaign.status);

const seniorityOptions = ["intern", "entry", "mid", "senior", "staff_or_lead", "principal"];
const remoteOptions = ["remote", "hybrid", "onsite"];
const workTypeOptions = ["full_time", "part_time", "contract", "internship", "temporary"];

export default function CampaignSettingsClient() {
  const { session, loading: sessionLoading } = useSession();
  const localTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [titles, setTitles] = useState("Product Designer");
  const [skills, setSkills] = useState("");
  const [mustHaveSkills, setMustHaveSkills] = useState("");
  const [preferredSkills, setPreferredSkills] = useState("");
  const [locations, setLocations] = useState("");
  const [countries, setCountries] = useState("");
  const [excludedCompanies, setExcludedCompanies] = useState("");
  const [blockedSources, setBlockedSources] = useState("");
  const [timezone, setTimezone] = useState(localTimezone);
  const [dailyTime, setDailyTime] = useState("08:00");
  const [dailyLimit, setDailyLimit] = useState(5);
  const [dailyMatchesLimit, setDailyMatchesLimit] = useState(10);
  const [dailyMatchesCap, setDailyMatchesCap] = useState(10);
  const [relevantExperienceMonths, setRelevantExperienceMonths] = useState("");
  const [seniority, setSeniority] = useState("mid");
  const [careerTrack, setCareerTrack] = useState("individual");
  const [remotePolicies, setRemotePolicies] = useState<string[]>(["remote", "hybrid"]);
  const [workTypes, setWorkTypes] = useState<string[]>(["full_time"]);
  const [authorization, setAuthorization] = useState("unknown");
  const [compensationAmount, setCompensationAmount] = useState("");
  const [compensationCurrency, setCompensationCurrency] = useState("USD");
  const [compensationPeriod, setCompensationPeriod] = useState("annual");
  const [dailyFitFloor, setDailyFitFloor] = useState(70);
  const [dailyConfidenceFloor, setDailyConfidenceFloor] = useState(60);
  const [applyFitFloor, setApplyFitFloor] = useState(85);
  const [applyConfidenceFloor, setApplyConfidenceFloor] = useState(80);
  const [dailyEnabled, setDailyEnabled] = useState(true);
  const [applyEnabled, setApplyEnabled] = useState(false);
  const authorizationMode = "review_each" as const;
  const consent = false;
  const [connectionId, setConnectionId] = useState("");
  const [previewFingerprint, setPreviewFingerprint] = useState("");
  // Mirrors previewCampaign() in lib/jobs-workflow/campaigns.ts. It was typed
  // unknown[], which is what let the UI get away with dumping it as JSON.
  const [preview, setPreview] = useState<{
    effectiveDailyLimit: number;
    scoreFloors: { fit: number; confidence: number };
    authorizationDurationHours: number;
    emailApplicationsOnly: boolean;
  }[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyCampaignId, setBusyCampaignId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (sessionLoading) return;
    if (!session?.loggedIn) {
      setError("Log in to configure Jobs workflows.");
      return;
    }
    try {
      const [profileResponse, campaignResponse, connectionResponse, accessResponse] = await Promise.all([
        fetch("/api/career-profiles", { cache: "no-store" }),
        fetch("/api/campaigns", { cache: "no-store" }),
        fetch("/api/mail-connections", { cache: "no-store" }),
        fetch("/api/feature-access", { cache: "no-store" }),
      ]);
      if (profileResponse.status === 401) { setError("Log in to configure Jobs workflows."); return; }
      if (!profileResponse.ok || !campaignResponse.ok || !connectionResponse.ok || !accessResponse.ok) throw new Error("settings_unavailable");
      const profileData = await profileResponse.json();
      const campaignData = await campaignResponse.json();
      const connectionData = await connectionResponse.json();
      const accessData = await accessResponse.json();
      const loadedProfiles = (profileData.profiles ?? []) as Profile[];
      const loadedCampaigns = (campaignData.campaigns ?? []) as Campaign[];
      const activeConnections = (connectionData.connections ?? []).filter((item: Connection) => item.status === "active") as Connection[];
      setProfiles(loadedProfiles); setCampaigns(loadedCampaigns); setConnections(activeConnections);

      const currentDaily = loadedCampaigns.find((item) => item.mode === "daily_matches" && activeCampaign(item));
      const currentApply = loadedCampaigns.find((item) => item.mode === "role_apply" && activeCampaign(item));
      const dailyAccess = (accessData.grants ?? []).find((item: { featureKey: string }) => item.featureKey === "daily_matches");
      const matchesCap = dailyAccess?.active ? dailyAccess.dailyCap ?? 10 : 10;
      setDailyMatchesCap(matchesCap);
      setDailyMatchesLimit(Math.min(currentDaily?.daily_limit ?? matchesCap, matchesCap));
      const settingsCampaign = currentApply ?? currentDaily;
      const currentProfile = loadedProfiles.find((item) => item.id === settingsCampaign?.profile_version_id) ?? loadedProfiles[0];
      const facts = currentProfile?.normalized_facts;
      const criteria = settingsCampaign?.criteria;
      if (facts || criteria) {
        setTitles(join(criteria?.desiredTitles ?? facts?.desiredTitles?.map(({ text }) => text)));
        setSkills(join(facts?.skills?.filter(({ state }) => state !== "not_possessed").map(({ text }) => text)));
        setMustHaveSkills(join(criteria?.mustHaveSkills)); setPreferredSkills(join(criteria?.preferredSkills));
        setLocations(join(criteria?.locations ?? facts?.locationPreferences?.map(({ location }) => location)));
        setCountries(join(criteria?.countries)); setExcludedCompanies(join(criteria?.excludedCompanies));
        setBlockedSources(join(criteria?.blockedSources));
        setRelevantExperienceMonths(facts?.relevantExperience?.months?.toString() ?? "");
        setSeniority(facts?.seniority?.level ?? "mid"); setCareerTrack(facts?.seniority?.track ?? "individual");
        setRemotePolicies(criteria?.remotePolicies ?? facts?.remotePolicies ?? []);
        setWorkTypes(criteria?.workTypes ?? facts?.workTypes?.map(({ type }) => type) ?? []);
        setAuthorization(criteria?.authorization === "either" ? "unknown" : criteria?.authorization ?? facts?.authorization?.state ?? "unknown");
        const compensation = criteria?.compensationFloor ?? facts?.compensationFloor;
        setCompensationAmount(compensation ? String(compensation.amountMinor / 100) : "");
        setCompensationCurrency(compensation?.currency ?? "USD"); setCompensationPeriod(compensation?.period ?? "annual");
      }
      setDailyEnabled(Boolean(currentDaily)); setApplyEnabled(Boolean(currentApply));
      if (currentDaily) {
        setTimezone(currentDaily.timezone); setDailyTime(currentDaily.daily_time);
        setDailyFitFloor(currentDaily.fit_score_floor); setDailyConfidenceFloor(currentDaily.confidence_score_floor);
      } else if (settingsCampaign) { setTimezone(settingsCampaign.timezone); setDailyTime(settingsCampaign.daily_time); }
      if (currentApply) {
        setDailyLimit(Math.min(currentApply.daily_limit, 5));
        setApplyFitFloor(currentApply.fit_score_floor); setApplyConfidenceFloor(currentApply.confidence_score_floor);
        if (currentApply.pinned_connection_id) setConnectionId(currentApply.pinned_connection_id);
      } else if (activeConnections[0]?.id) {
        setConnectionId((value) => value || activeConnections[0].id);
      }
    } catch {
      setError("Campaign settings are temporarily unavailable. No consent or settings were changed.");
    }
  }, [session?.loggedIn, sessionLoading]);
  useEffect(() => { void load(); }, [load]);

  async function request(url: string, method: string, body: unknown) {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "request_failed");
    return data;
  }

  function toggle(value: string, values: string[], setValues: (next: string[]) => void) {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  function draftPayload(profileVersionId: string) {
    const desiredTitles = split(titles);
    if (!desiredTitles.length) throw new Error("Add at least one desired title.");
    if (!remotePolicies.length) throw new Error("Choose at least one remote or on-site policy.");
    if (!workTypes.length) throw new Error("Choose at least one work type.");
    if (applyEnabled && !connectionId) throw new Error("Connect Gmail or Outlook before activating Auto Apply.");
    const effectiveAuthorizationMode = "review_each" as const;
    const compensation = compensationAmount.trim() ? {
      amountMinor: Math.round(Number(compensationAmount) * 100),
      currency: compensationCurrency.trim().toUpperCase(), period: compensationPeriod,
    } : undefined;
    if (compensation && (!Number.isFinite(compensation.amountMinor) || compensation.amountMinor < 0)) {
      throw new Error("Enter a valid non-negative compensation floor.");
    }
    const criteria = {
      desiredTitles, mustHaveSkills: split(mustHaveSkills), preferredSkills: split(preferredSkills),
      countries: split(countries).map((value) => value.toUpperCase()), locations: split(locations),
      remotePolicies, workTypes, authorization, ...(compensation ? { compensationFloor: compensation } : {}),
      excludedCompanies: split(excludedCompanies), blockedSources: split(blockedSources),
    };
    const profile = {
      desiredTitles, skills: split(skills).map((name) => ({ name, state: "possessed" })),
      ...(relevantExperienceMonths === "" ? {} : { relevantExperienceMonths: Number(relevantExperienceMonths) }),
      seniority: { level: seniority, track: careerTrack }, acceptedTracks: [careerTrack],
      locations: split(locations), remotePolicies, authorization, workTypes,
      ...(compensation ? { compensationFloor: compensation } : {}),
    };
    const daily = {
      mode: "daily_matches", authorizationMode: "review_each", status: "active",
      profileVersionId, criteria, timezone, dailyTime, dailyLimit: dailyMatchesLimit,
      fitScoreFloor: dailyFitFloor, confidenceScoreFloor: dailyConfidenceFloor,
    };
    const apply = {
      mode: "role_apply", authorizationMode: effectiveAuthorizationMode, status: "active",
      profileVersionId, criteria, timezone, dailyTime, dailyLimit,
      fitScoreFloor: applyFitFloor, confidenceScoreFloor: applyConfidenceFloor,
      pinnedConnectionId: connectionId,
      consentConfirmed: false,
    };
    return { profile, criteria, daily, apply, effectiveAuthorizationMode };
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const placeholderProfileId = profiles[0]?.id ?? "00000000-0000-4000-8000-000000000001";
      const draft = draftPayload(placeholderProfileId);
      const fingerprint = JSON.stringify({ ...draft, consent: Boolean(consent) });
      if (previewFingerprint !== fingerprint) {
        const previews = [];
        if (dailyEnabled) previews.push((await request("/api/campaigns/preview", "POST", draft.daily)).preview);
        if (applyEnabled) previews.push((await request("/api/campaigns/preview", "POST", draft.apply)).preview);
        setPreview(previews); setPreviewFingerprint(fingerprint);
        setMessage("Preview ready. Review the summary below, then confirm to save this immutable version.");
        return;
      }

      const profileResponse = await request("/api/career-profiles", "POST", draft.profile);
      const profileId = profileResponse.profile.id as string;
      const saved = draftPayload(profileId);
      await request("/api/application-send-policy", "PUT", { timezone, userLimit: dailyLimit });
      const existingDaily = campaigns.find((item) => item.mode === "daily_matches" && activeCampaign(item));
      const existingApply = campaigns.find((item) => item.mode === "role_apply" && activeCampaign(item));
      if (dailyEnabled) {
        if (existingDaily) await request(`/api/campaigns/${existingDaily.id}`, "PATCH", {
          profileVersionId: profileId, criteria: saved.criteria, timezone, dailyTime, dailyLimit: dailyMatchesLimit,
          fitScoreFloor: dailyFitFloor, confidenceScoreFloor: dailyConfidenceFloor,
        });
        else await request("/api/campaigns", "POST", saved.daily);
      } else if (existingDaily?.status === "active") {
        await request(`/api/campaigns/${existingDaily.id}`, "PATCH", { action: "pause" });
      }
      if (applyEnabled) {
        if (existingApply) await request(`/api/campaigns/${existingApply.id}`, "PATCH", {
          profileVersionId: profileId, criteria: saved.criteria, timezone, dailyTime, dailyLimit,
          fitScoreFloor: applyFitFloor, confidenceScoreFloor: applyConfidenceFloor,
          pinnedConnectionId: connectionId,
        });
        else await request("/api/campaigns", "POST", saved.apply);
      } else if (existingApply?.status === "active") {
        await request(`/api/campaigns/${existingApply.id}`, "PATCH", { action: "pause" });
      }
      setPreview([]); setPreviewFingerprint("");      setMessage("Saved a new immutable career-profile version. Material edits invalidate stale unsent packages.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Campaign settings could not be saved.");
    } finally { setBusy(false); }
  }

  async function changeState(campaign: Campaign, action: "pause" | "resume" | "cancel") {
    setBusyCampaignId(campaign.id);
    try { await request(`/api/campaigns/${campaign.id}`, "PATCH", { action }); await load(); }
    catch { setError(`Campaign could not ${action}.`); }
    finally { setBusyCampaignId(null); }
  }

  return <div className="space-y-8">
    <PageHeader
      eyebrow="Versioned rules"
      title="Career profile & campaign settings"
      description="Set the job criteria RoleSharp should match, choose when matches arrive, and preview your rules before saving."
      compact
    />
    {(!sessionLoading && !session?.loggedIn) ? (
      <Notice
        title="Log in to configure private workflow rules"
        variant="neutral"
        actions={<Button as="a" href="/login?next=/campaign-settings" size="sm">Continue to login</Button>}
      >
        Career-profile versions, campaign thresholds, consent state, and sender selection are private account data.
      </Notice>
    ) : error ? <Notice variant="danger" role="alert">{error}</Notice> : null}
    {message && <Notice variant="success" role="status">{message}</Notice>}
    <section aria-labelledby="campaign-status-heading" className="border-y border-[var(--border)] py-5">
      <h2 id="campaign-status-heading" className="text-xl font-bold!">Current workflow status</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {campaigns.filter(activeCampaign).map((campaign) => (
          <article key={campaign.id} className="min-w-0 border-s-2 border-[var(--border)] py-2 ps-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-base font-semibold!">{campaign.mode === "daily_matches" ? "Daily Matches" : "Auto Apply"}</h3>
              <span className="text-sm capitalize text-[var(--muted-fg)]">{campaign.status.replaceAll("_", " ")}</span>
            </div>
            <p className="mt-1 text-sm text-[var(--muted-fg)]">{campaign.authorization_mode.replaceAll("_", " ")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {campaign.status === "active" ? (
                <Button type="button" variant="outline" size="sm" onClick={() => changeState(campaign, "pause")} isLoading={busyCampaignId === campaign.id}>Pause</Button>
              ) : ["paused", "needs_user"].includes(campaign.status) && (
                <Button type="button" variant="outline" size="sm" onClick={() => changeState(campaign, "resume")} isLoading={busyCampaignId === campaign.id}>Resume</Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => changeState(campaign, "cancel")} isLoading={busyCampaignId === campaign.id}>Cancel</Button>
            </div>
          </article>
        ))}
        {campaigns.filter(activeCampaign).length === 0 && <p className="text-sm text-[var(--muted-fg)]">No campaign configured yet.</p>}
      </div>
    </section>
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold!">Profile evidence</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted-fg)]">Enter job-related details and separate multiple values with commas. RoleSharp saves the profile you confirm here.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div><Label htmlFor="cs-desired-titles">Desired titles</Label><Input id="cs-desired-titles" required value={titles} onChange={(event) => setTitles(event.target.value)} /></div>
        <div><Label htmlFor="cs-skills-you-currently-possess">Skills you currently possess</Label><Input id="cs-skills-you-currently-possess" value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="Figma, user research" /></div>
        <div><Label htmlFor="cs-must-have-job-skills">Must-have job skills</Label><Input id="cs-must-have-job-skills" value={mustHaveSkills} onChange={(event) => setMustHaveSkills(event.target.value)} /></div>
        <div><Label htmlFor="cs-preferred-job-skills">Preferred job skills</Label><Input id="cs-preferred-job-skills" value={preferredSkills} onChange={(event) => setPreferredSkills(event.target.value)} /></div>
        <div><Label htmlFor="cs-relevant-experience-months">Relevant experience (months)</Label><Input id="cs-relevant-experience-months" type="number" min="0" max="1200" value={relevantExperienceMonths} onChange={(event) => setRelevantExperienceMonths(event.target.value)} /></div>
        <div><Label htmlFor="cs-seniority">Seniority</Label><Select id="cs-seniority" value={seniority} onChange={(event) => setSeniority(event.target.value)}>{seniorityOptions.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</Select></div>
        <div><Label htmlFor="cs-career-track">Career track</Label><Select id="cs-career-track" value={careerTrack} onChange={(event) => setCareerTrack(event.target.value)}><option value="individual">Individual contributor</option><option value="management">People management</option></Select></div>
        <div><Label htmlFor="cs-locations">Locations</Label><Input id="cs-locations" value={locations} onChange={(event) => setLocations(event.target.value)} placeholder="Tokyo, Remote" /></div>
        <div><Label htmlFor="cs-countries-two-letter-codes">Countries (two-letter codes)</Label><Input id="cs-countries-two-letter-codes" value={countries} onChange={(event) => setCountries(event.target.value)} placeholder="JP, US" /></div>
        <div><Label htmlFor="cs-work-authorization">Work authorization</Label><Select id="cs-work-authorization" value={authorization} onChange={(event) => setAuthorization(event.target.value)}><option value="unknown">Not specified</option><option value="authorized">Already authorized</option><option value="needs_sponsorship">Needs sponsorship</option></Select></div>
        <div><Label htmlFor="cs-excluded-companies">Excluded companies</Label><Input id="cs-excluded-companies" value={excludedCompanies} onChange={(event) => setExcludedCompanies(event.target.value)} /></div>
        <div><Label htmlFor="cs-blocked-job-sources">Blocked job sources</Label><Input id="cs-blocked-job-sources" value={blockedSources} onChange={(event) => setBlockedSources(event.target.value)} /></div>
      </div>
      <fieldset className="rounded-xl border border-[var(--color-border)] p-4"><legend className="px-2 font-bold">Remote policy</legend><div className="flex flex-wrap gap-5">{remoteOptions.map((option) => <label key={option} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={remotePolicies.includes(option)} onChange={() => toggle(option, remotePolicies, setRemotePolicies)} />{option}</label>)}</div></fieldset>
      <fieldset className="rounded-xl border border-[var(--color-border)] p-4"><legend className="px-2 font-bold">Work type</legend><div className="flex flex-wrap gap-5">{workTypeOptions.map((option) => <label key={option} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={workTypes.includes(option)} onChange={() => toggle(option, workTypes, setWorkTypes)} />{option.replaceAll("_", " ")}</label>)}</div></fieldset>
      <fieldset className="rounded-xl border border-[var(--color-border)] p-4"><legend className="px-2 font-bold">Compensation floor (optional)</legend><div className="grid gap-4 md:grid-cols-3"><div><Label htmlFor="cs-amount">Amount</Label><Input id="cs-amount" inputMode="decimal" value={compensationAmount} onChange={(event) => setCompensationAmount(event.target.value)} /></div><div><Label htmlFor="cs-currency">Currency</Label><Input id="cs-currency" maxLength={3} value={compensationCurrency} onChange={(event) => setCompensationCurrency(event.target.value.toUpperCase())} /></div><div><Label htmlFor="cs-period">Period</Label><Select id="cs-period" value={compensationPeriod} onChange={(event) => setCompensationPeriod(event.target.value)}>{["hourly", "daily", "weekly", "monthly", "annual"].map((option) => <option key={option}>{option}</option>)}</Select></div></div></fieldset>
      <div className="border-t border-[var(--border)] pt-5">
        <h2 className="text-xl font-bold!">Schedule and delivery</h2>
        <p className="mt-1 text-sm text-[var(--muted-fg)]">Set your local processing time and choose which workflows to run.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2"><div><Label htmlFor="cs-timezone">Timezone</Label><Input id="cs-timezone" required value={timezone} onChange={(event) => setTimezone(event.target.value)} /></div><div><Label htmlFor="cs-daily-processing-time">Daily processing time</Label><Input id="cs-daily-processing-time" type="time" required value={dailyTime} onChange={(event) => setDailyTime(event.target.value)} /></div></div>
      <fieldset className="space-y-4 rounded-xl border border-[var(--color-border)] p-4"><legend className="px-2 font-bold">Daily Matches</legend><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={dailyEnabled} onChange={(event) => setDailyEnabled(event.target.checked)} />A daily job-match digest to my verified RoleSharp account email.</label>{dailyEnabled && <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="cs-daily-matches-limit">Matches per day (maximum {dailyMatchesCap})</Label><Input id="cs-daily-matches-limit" type="number" min="1" max={dailyMatchesCap} value={dailyMatchesLimit} onChange={(event) => setDailyMatchesLimit(Math.max(1, Math.min(dailyMatchesCap, Number(event.target.value) || 1)))} /></div><div><Label htmlFor="cs-minimum-fit">Minimum fit</Label><Input id="cs-minimum-fit" type="number" min="70" max="100" value={dailyFitFloor} onChange={(event) => setDailyFitFloor(Number(event.target.value))} /></div><div><Label htmlFor="cs-minimum-evidence-confidence">Minimum evidence confidence</Label><Input id="cs-minimum-evidence-confidence" type="number" min="60" max="100" value={dailyConfidenceFloor} onChange={(event) => setDailyConfidenceFloor(Number(event.target.value))} /></div></div>}</fieldset>
      <fieldset className="space-y-4 rounded-xl border border-[var(--color-border)] p-4"><legend className="px-2 font-bold">Auto Apply — email applications only</legend><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={applyEnabled} onChange={(event) => setApplyEnabled(event.target.checked)} />Prepare only when the stored posting explicitly says to email a CV and contains the recipient.</label>{applyEnabled && <div className="grid gap-4 md:grid-cols-2"><div><Label htmlFor="cs-authorization-mode">Authorization mode</Label><Select id="cs-authorization-mode" value={authorizationMode} disabled><option value="review_each">Daily batch review — 24 hours</option></Select></div><div><Label htmlFor="cs-pinned-sender">Pinned sender</Label><Select id="cs-pinned-sender" required value={connectionId} onChange={(event) => setConnectionId(event.target.value)}><option value="">Choose a connected mailbox</option>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.verified_sender} ({connection.provider})</option>)}</Select></div><div><Label htmlFor="cs-daily-email-limit">Daily email limit: {dailyLimit} (maximum 5)</Label><input id="cs-daily-email-limit" className="w-full" type="range" min="1" max="5" value={dailyLimit} onChange={(event) => setDailyLimit(Number(event.target.value))} /></div><div><Label htmlFor="cs-apply-minimum-fit">Minimum fit</Label><Input id="cs-apply-minimum-fit" type="number" min={75} max="100" value={applyFitFloor} onChange={(event) => setApplyFitFloor(Number(event.target.value))} /></div><div><Label htmlFor="cs-apply-minimum-evidence-confidence">Minimum evidence confidence</Label><Input id="cs-apply-minimum-evidence-confidence" type="number" min={65} max="100" value={applyConfidenceFloor} onChange={(event) => setApplyConfidenceFloor(Number(event.target.value))} /></div>{false && <label className="flex items-start gap-3 text-sm"><input className="mt-1 h-5 w-5" type="checkbox" checked={consent} readOnly /><span>I authorize this pinned sender and deterministic template for 30 days. Material changes return to review.</span></label>}</div>}{!connections.length && applyEnabled && <p className="text-sm text-[var(--muted-fg)]"><a className="font-semibold text-[var(--fg)] underline underline-offset-2" href="/email-connection">Connect Gmail or Outlook</a> to enable email applications. You can use your existing mailbox.</p>}</fieldset>
      <div className="rounded-xl bg-[var(--color-surface-3)] p-4 text-sm text-[var(--color-text)]"><strong>How to read the preview:</strong> fit measures evidence-backed compatibility, not hiring probability. Confidence measures how complete and reliable that evidence is. Hard conflicts always block automation.</div>
      {/* This was a raw JSON.stringify dump of the API response. The preview is
          the last thing a user reads before saving an immutable version that
          governs automated email sending, so it has to be legible: the one
          field they cannot set directly is effectiveDailyLimit, which silently
          clamps their request to the admin cap. Say so in words when it bites. */}
      {preview.length > 0 && (
        <section aria-labelledby="campaign-preview-heading" className="rounded-xl border border-[var(--color-border)] p-4">
          <h3 id="campaign-preview-heading" className="font-bold!">Rule preview</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {preview.map((rule, index) => (
              <dl key={index} className="rounded-lg bg-[var(--color-surface-2)] p-3 text-sm">
                <dt className="font-semibold">{rule.emailApplicationsOnly ? "Auto Apply" : "Daily Matches"}</dt>
                <dd className="mt-2 grid gap-1 text-[var(--color-text-muted)]">
                  <span>Minimum fit: <strong className="text-[var(--color-text)]">{rule.scoreFloors.fit}</strong></span>
                  <span>Minimum evidence confidence: <strong className="text-[var(--color-text)]">{rule.scoreFloors.confidence}</strong></span>
                  {rule.emailApplicationsOnly && (
                    <>
                      <span>Emails per day: <strong className="text-[var(--color-text)]">{rule.effectiveDailyLimit}</strong>{rule.effectiveDailyLimit < dailyLimit && <> — capped from {dailyLimit} by the current account limit</>}</span>
                      <span>Approval window: <strong className="text-[var(--color-text)]">{rule.authorizationDurationHours} hours</strong></span>
                    </>
                  )}
                </dd>
              </dl>
            ))}
          </div>
        </section>
      )}
      {/* type="submit" is load-bearing: the Button primitive defaults to
          type="button", so without it this — the form's only control — never
          fires onSubmit, and preview and save were both dead. The other four
          onSubmit forms in the repo all set it. */}
      <Button type="submit" disabled={busy} isLoading={busy}>{busy ? "Checking rules…" : previewFingerprint ? "Confirm and save immutable version" : "Preview campaign rules"}</Button>
    </form>
    <p className="text-xs text-[var(--color-text-muted)]">Saved profile versions: {profiles.length}. Builder data is never imported silently; facts must be visibly confirmed here.</p>
  </div>;
}
