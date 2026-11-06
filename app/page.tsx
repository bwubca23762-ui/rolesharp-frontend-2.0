import FirstVisitCountry from "./first-visit-country";
import { RoleSharpLanding } from "@/components/marketing/RoleSharpLanding";
import { MarketingShell } from "@/components/ui/primitives";

export default function Home() {
  return (
    <MarketingShell>
      <div>
        <FirstVisitCountry />
        <RoleSharpLanding />
      </div>
    </MarketingShell>
  );
}
