"use client";

import type { ReactNode } from "react";

export default function Template({ children }: { children: ReactNode }) {
  return <div className="rs-page-enter">{children}</div>;
}
