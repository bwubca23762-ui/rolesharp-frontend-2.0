import { permanentRedirect } from "next/navigation";

// The workspace's first tab is labelled "Overview"/"Dashboard" on different
// surfaces, and visitors guess the URL from the label they saw. Serve the
// dashboard instead of a 404.
export default function OverviewEntryPage() {
  permanentRedirect("/dashboard");
}
