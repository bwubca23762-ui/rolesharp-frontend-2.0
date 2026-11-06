import type { ReactNode } from "react";
import { EmptyState as PrimitiveEmptyState } from "@/components/ui/primitives/EmptyState";

// Compatibility adapter for legacy call sites. New code should import the
// shared primitive directly; keeping this adapter avoids breaking old props.
export default function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return <PrimitiveEmptyState icon={icon} title={title} description={body} actions={action} />;
}
