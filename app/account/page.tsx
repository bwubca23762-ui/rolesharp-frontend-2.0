import { redirect } from "next/navigation";

export default function AccountEntryPage() {
  redirect("/settings?tab=account");
}
