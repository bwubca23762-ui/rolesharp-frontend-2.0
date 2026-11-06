export const runtime = "nodejs";
export const dynamic = "force-static";

// Google Search Console site-ownership verification file.
// Served at https://rolesharp.com/google8576d39464fd29f8.html
export function GET() {
  return new Response("google-site-verification: google8576d39464fd29f8.html", {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
