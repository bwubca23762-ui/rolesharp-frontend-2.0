"use client";
import { useEffect, useState } from "react";
import { Notice } from "@/components/ui/primitives";

// Market demand alarm (Phase 4): a quiet banner when the user's campaign
// target role is indexed noticeably more this week than last. Framed as
// what it is — RoleSharp's own job index — never a claim about the whole
// market. Absent a signal, the banner renders nothing.

type Signal = { title: string; country: string; current: number; previous: number; multiplier: number };

export default function MarketAlarm() {
  const [signal, setSignal] = useState<Signal | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/market-alarm")
      .then((r) => (r.ok ? r.json() : { signal: null }))
      .then((data: { signal: Signal | null }) => setSignal(data.signal))
      .catch(() => setSignal(null))
      .finally(() => setDone(true));
  }, []);

  if (!done || !signal) return null;

  return (
    <Notice variant="info" className="mb-6" role="status">
      <strong>{signal.title} demand is up in our index</strong> — {signal.current} listings in {signal.country} in the
      last 7 days vs {signal.previous} the week before ({signal.multiplier}×). That is RoleSharp&rsquo;s job index, not
      the whole market — but it is a good week to send applications.{" "}
      <a href={`/jobs?role=${encodeURIComponent(signal.title)}`} className="font-bold underline">
        Search {signal.title} roles →
      </a>
    </Notice>
  );
}
