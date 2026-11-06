import { redirect } from "next/navigation";

// /resumes/[id] is a real page, so users edit the URL down to /resumes and hit
// a 404. The list of saved resumes lives on the workspace. No loading.tsx here
// on purpose -- one under app/billing/ streamed the shell and committed a 200
// before redirect() could issue its 307.
export default function ResumesEntryPage() {
  redirect("/dashboard");
}
