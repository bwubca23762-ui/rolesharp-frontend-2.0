"use client";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";

/** Animates a number from `from` to `to` once it scrolls into view.
 *  Respects prefers-reduced-motion (jumps straight to the final value). */
export default function CountUp({
  from,
  to,
  prefix = "",
  duration = 1400,
}: {
  from: number;
  to: number;
  prefix?: string;
  duration?: number;
}) {
  return <AnimatedCounter from={from} to={to} prefix={prefix} duration={duration} className="tabular" />;
}
