// Job clipper (Phase 4): a bookmarklet that carries a job posting from any
// careers page into the RoleSharp workspace. The bookmarklet runs on the
// JOB SITE's origin, so it cannot touch rolesharp's localStorage — it hands
// the posting over as a base64url URL param, and useWorkspaceDraft imports
// it on the /build page and strips the param from the address bar.

export type JobClip = { t: string; u: string; s: string };

export const CLIP_PARAM = "clip";
export const CLIP_MAX_CHARS = 8_000;

// The bookmarklet source shown to the user (and copied to their clipboard).
// One self-contained expression; SITE_URL is substituted at render time.
export function bookmarkletSource(siteUrl: string): string {
  const target = `${siteUrl.replace(/\/+$/u, "")}/build`;
  return `javascript:(function(){var t=document.title||'';var u=location.href;var s=(window.getSelection?String(window.getSelection()):'')||document.body.innerText||'';s=s.replace(/[ \\t]+/g,' ').replace(/\\n{3,}/g,'\\n\\n').trim().slice(0,${CLIP_MAX_CHARS});var p=btoa(unescape(encodeURIComponent(JSON.stringify({t:t,u:u,s:s}))));window.open('${target}?${CLIP_PARAM}='+encodeURIComponent(p),'_blank');})();`;
}

export function encodeClip(clip: JobClip): string {
  // Node-side encoding for tests; the bookmarklet uses the same shape.
  return Buffer.from(unescape(encodeURIComponent(JSON.stringify(clip))), "binary").toString("base64url");
}

export function decodeClip(raw: string): JobClip | null {
  try {
    const json = decodeURIComponent(escape(Buffer.from(raw, "base64url").toString("binary")));
    const parsed = JSON.parse(json) as Partial<JobClip>;
    if (typeof parsed.s !== "string" || parsed.s.trim().length < 40) return null;
    return {
      t: typeof parsed.t === "string" ? parsed.t.slice(0, 300) : "",
      u: typeof parsed.u === "string" && /^https?:\/\//u.test(parsed.u) ? parsed.u : "",
      s: parsed.s.slice(0, CLIP_MAX_CHARS),
    };
  } catch {
    return null;
  }
}
