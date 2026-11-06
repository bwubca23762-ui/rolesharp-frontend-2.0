import { redirect } from "next/navigation";

export default function SecurityEntryPage() {
  redirect("/settings?tab=security");
}
