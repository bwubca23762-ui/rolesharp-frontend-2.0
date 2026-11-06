"use client";

/**
 * Retired (owner decision 2026-10-18: pure workspaces — no upsell slabs
 * under tools). The panel rendered a premium-pitch card under free tools;
 * paying subscribers read their pass status in the nav and dashboard now.
 * The export stays so imports and the shared perk type don't break — it
 * renders nothing.
 */

export type PremiumPerk = {
  title: string;
  detail: string;
};

export default function PremiumPanel(_props?: {
  perks?: readonly PremiumPerk[];
  context?: string;
  heading?: string;
  note?: string;
}) {
  return null;
}
