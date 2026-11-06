"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/admin/sonner";

// Module scope (not a per-render client): each /admin/* route renders its own
// <AdminPanel>, so the query cache must survive client-side navigation between
// sections. It is still dropped by any hard reload (sign-in / sign-out), which
// is exactly when a fresh cache is wanted.
let queryClientSingleton: QueryClient | null = null;

function getQueryClient(): QueryClient {
  const defaultOptions = {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: typeof window !== "undefined",
      throwOnError: false,
    },
  };
  if (typeof window === "undefined") return new QueryClient({ defaultOptions });
  if (!queryClientSingleton) queryClientSingleton = new QueryClient({ defaultOptions });
  return queryClientSingleton;
}

/** Thrown when an admin API returns a non-2xx response. Carries the HTTP status. */
export class AdminFetchError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminFetchError";
    this.status = status;
  }
}

/**
 * fetch + JSON with a hard timeout and same-origin credentials. Every admin
 * read goes through this so a hung request can never leave a spinner up forever:
 * it aborts after `timeoutMs` (default 10s) and rejects with an AdminFetchError.
 */
export async function fetchJson<T = unknown>(
  input: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 10_000, signal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onExternalAbort, { once: true });
  }
  try {
    const response = await fetch(input, {
      credentials: "same-origin",
      cache: "no-store",
      ...rest,
      signal: controller.signal,
    });
    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      try {
        const body = (await response.json()) as { error?: unknown };
        if (typeof body?.error === "string" && body.error) message = body.error;
      } catch {
        // Non-JSON error body — keep the status-based message.
      }
      throw new AdminFetchError(response.status, message);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onExternalAbort);
  }
}

/**
 * The one way admin views read data: strict timeout + retry limit, and the
 * `isPending` / `isSuccess` / `isError` / `refetch` states the DataTable needs to
 * show skeletons, an empty state, or an error-with-retry instead of a spinner.
 */
export function useAdminQuery<TData>(
  key: readonly (string | number)[],
  queryFn: (signal: AbortSignal) => Promise<TData>,
  options: { staleTime?: number; enabled?: boolean; refetchInterval?: number | false } = {},
) {
  return useQuery<TData, Error>({
    queryKey: key,
    queryFn: ({ signal }) => queryFn(signal),
    staleTime: options.staleTime ?? 30_000,
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval ?? false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}

/** Global "Refresh data" — invalidates every admin query so all open views refetch. */
export function useAdminRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

export function AdminProviders({ children }: { children: React.ReactNode }) {
  const client = getQueryClient();
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
