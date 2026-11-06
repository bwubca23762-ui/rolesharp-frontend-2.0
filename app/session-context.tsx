"use client";

import type { LegalVersionSummary, PendingLegalAcceptance } from "@/lib/legal";
import type { TierFeatures } from "@/lib/tier-features";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type SessionData = {
  loggedIn: boolean;
  userId?: string;
  email?: string;
  emailVerified?: boolean;
  inviteCode?: string;
  inviteUrl?: string;
  hasPassword?: boolean;
  premium?: boolean;
  premiumSource?: string | null;
  premiumUntil?: string | null;
  features?: TierFeatures;
  limit?: number;
  used?: number;
  remaining?: number;
  credits?: number;
  canUseCredit?: boolean;
  period?: string;
  canGenerate?: boolean;
  plans?: Array<{ id: string; label: string; price: number; days: number }>;
  googleEnabled?: boolean;
  legalVersions?: LegalVersionSummary[];
  pendingLegalAcceptances?: PendingLegalAcceptance[];
};

type SessionContextValue = {
  session: SessionData | null;
  loading: boolean;
  error: string;
  refreshSession: () => Promise<SessionData | null>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const wasLoggedIn = useRef(false);
  const inFlight = useRef<Promise<SessionData | null> | null>(null);

  const refreshSession = useCallback(() => {
    if (inFlight.current) return inFlight.current;

    const request = (async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10_000);
      try {
        if (mounted.current) setError("");
        const response = await fetch("/api/me", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Session request failed (${response.status})`);
        const data = (await response.json().catch(() => null)) as SessionData | null;
        if (!data) throw new Error("Session response was invalid");
        if (!mounted.current) return data;

        setSession(data);
        if (data.loggedIn) {
          wasLoggedIn.current = true;
        } else if (wasLoggedIn.current) {
          window.location.href = "/login?timeout=1";
        }
        return data;
      } catch {
        const fallback: SessionData = { loggedIn: false };
        if (mounted.current) {
          setSession(fallback);
          setError("We could not verify your session. Check your connection and try again.");
        }
        return fallback;
      } finally {
        window.clearTimeout(timeout);
        if (mounted.current) setLoading(false);
        inFlight.current = null;
      }
    })();

    inFlight.current = request;
    return request;
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refreshSession();

    const interval = window.setInterval(() => void refreshSession(), 5 * 60 * 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshSession();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mounted.current = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshSession]);

  const value = useMemo(
    () => ({ session, loading, error, refreshSession }),
    [session, loading, error, refreshSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
