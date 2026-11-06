import JsonLd from "./json-ld";
import { breadcrumbLd } from "@/lib/seo";

type GuideBreadcrumbProps = {
  toolName: string;
  toolPath: string;
  guideName: string;
  guidePath: string;
};

export default function GuideBreadcrumb({ toolName, toolPath, guideName, guidePath }: GuideBreadcrumbProps) {
  return (
    <JsonLd
      data={breadcrumbLd([
        { name: "Home", item: "/" },
        { name: toolName, item: toolPath },
        { name: guideName, item: guidePath },
      ])}
    />
  );
}
