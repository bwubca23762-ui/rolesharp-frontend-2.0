import { redirect } from "next/navigation";

export default function BillingEntryPage() {
  redirect("/settings?tab=billing");
}
