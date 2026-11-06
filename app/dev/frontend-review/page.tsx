import type { Metadata } from "next";
import { PrototypePage } from "./prototype-page";

export const metadata: Metadata = {
  title: "RoleSharp Frontend 2.0 prototype",
  robots: { index: false, follow: false },
};

export default function FrontendReviewPage() {
  return <PrototypePage screen="home" />;
}
