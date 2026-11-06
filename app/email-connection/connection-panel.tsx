"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/app/session-context";
import { Badge, Button, Notice } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type Connection = {
  id: string;
  provider: "google" | "microsoft";
  verified_sender: string;
  granted_scopes: string[];
  status: "active" | "needs_user" | "disabled";
  revocation_result: string | null;
};

type ProviderReadiness = Record<"google" | "microsoft", { configured: boolean }>;

export default function ConnectionPanel() {
  const { session, loading: sessionLoading } = useSession();
  const loggedOut = !sessionLoading && !session?.loggedIn;
  const [connections, setConnections] = useState<Connection[]>([]);
  const [providers, setProviders] = useState<ProviderReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pendingDisconnect, setPendingDisconnect] = useState<Connection | null>(null);

  const load = useCallback(async () => {
    if (sessionLoading) return;
    if (!session?.loggedIn) {
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/mail-connections", { cache: "no-store" });
      if (response.status === 401) { setError("Your session expired. Log in again before connecting a mailbox."); return; }
      if (!response.ok) throw new Error("connections_unavailable");
      const data = await response.json();
      setConnections(data.connections ?? []);
      setProviders(data.providers ?? null);
      setError("");
    } catch {
      setError("Email connections are temporarily unavailable. No credentials were changed.");
    } finally {
      setLoading(false);
    }
  }, [session?.loggedIn, sessionLoading]);

  useEffect(() => { void load(); }, [load]);

  async function connect(provider: "gmail" | "microsoft", promptConsent = false) {
    setBusy(provider);
    setError("");
    try {
      const response = await fetch(`/api/mail-connections/${provider}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(provider === "gmail" ? { promptConsent } : {}),
      });
      const data = await response.json();
      if (!response.ok || !data.authorizationUrl) throw new Error(data.error || "connect_failed");
      window.location.assign(data.authorizationUrl);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "connect_failed";
      setError(code === "mailbox_provider_not_configured"
        ? `${provider === "gmail" ? "Gmail" : "Outlook"} connections are not configured yet. No mailbox or message was accessed.`
        : `${provider === "gmail" ? "Gmail" : "Outlook"} connection could not start. Check the provider configuration and try again.`);
      setBusy(null);
    }
  }

  async function disconnect(connection: Connection) {
    setBusy(connection.id);
    setError("");
    try {
      const provider = connection.provider === "google" ? "gmail" : "microsoft";
      const response = await fetch(`/api/mail-connections/${provider}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: connection.id }),
      });
      if (!response.ok) throw new Error("disconnect_failed");
      await load();
    } catch {
      setError("The connection could not be updated. Check its current status before trying again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="mailbox-heading" className="space-y-5">
      <div>
        <h2 id="mailbox-heading" className="mt-2 text-2xl font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Email connection</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
          Connect Gmail or Outlook to send approved applications from your address. The separate send-only permission cannot read, search, or modify your inbox.
        </p>
      </div>

      {loggedOut && (
        <Notice
          title="Sign in when you are ready to connect"
          variant="neutral"
          actions={<Button as="a" href="/login?next=/email-connection" size="sm">Log in securely</Button>}
        >
          Your RoleSharp account never grants sending access to a mailbox. Connect one separately when you are ready.
        </Notice>
      )}
      {error && <Notice variant="danger" role="alert">{error}</Notice>}
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">
          <Skeleton variant="card" height="9rem" />
          <Skeleton variant="card" height="9rem" />
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {(["google", "microsoft"] as const).map((provider) => {
            const connection = connections.find((item) => item.provider === provider && item.status !== "disabled");
            const gmail = provider === "google";
            const providerConfigured = providers?.[provider]?.configured ?? false;
            return (
              <article key={provider} className="py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold!">{gmail ? "Gmail" : "Microsoft Outlook"}</h3>
                    <p className="mt-1 text-sm text-[var(--muted-fg)]">Send email and verify your sender address.</p>
                  </div>
                  {/* DESIGN.md §5 connection status names exactly three labels —
                      "Connected", "Reconnect required", "Disconnected". This
                      panel had drifted to "Reconnect" and "Not connected", which
                      both read as milder than the state they describe: a needs_user
                      connection sends nothing until it is reauthorized. */}
                  <Badge variant={connection?.status === "active" ? "success" : connection?.status === "needs_user" ? "warning" : "neutral"}>
                    {connection?.status === "active" ? "Connected" : connection?.status === "needs_user" ? "Reconnect required" : "Disconnected"}
                  </Badge>
                </div>
                {connection ? (
                  <div className="mt-4 space-y-3">
                    <p className="break-all text-sm"><strong>Sender:</strong> {connection.verified_sender}</p>
                    <details className="text-sm">
                      <summary className="min-h-11 cursor-pointer py-2 font-semibold focus-visible:outline-2 focus-visible:outline-[var(--ring)]">Exact granted scopes</summary>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {connection.granted_scopes.map((scope) => <li className="break-all" key={scope}>{scope}</li>)}
                      </ul>
                    </details>
                    <div className="flex flex-wrap gap-2">
                      {connection.status === "needs_user" && (
                        <Button disabled={busy !== null} isLoading={busy === (gmail ? "gmail" : "microsoft")} onClick={() => connect(gmail ? "gmail" : "microsoft", true)}>Reconnect</Button>
                      )}
                      {/* danger, not outline: this cancels pending pre-send
                          work and erases the local refresh credential, and it
                          sat visually identical to Reconnect beside it. */}
                      <Button variant="danger" disabled={busy !== null} isLoading={busy === connection.id} onClick={() => setPendingDisconnect(connection)}>
                        {busy === connection.id ? "Disconnecting…" : "Disconnect and erase locally"}
                      </Button>
                    </div>
                  </div>
                ) : loggedOut ? (
                  <Button as="a" href="/login?next=/email-connection" variant="outline" className="mt-5">Log in to connect</Button>
                ) : !providerConfigured ? (
                  <p className="mt-3 text-sm text-[var(--muted-fg)]">Connecting to this provider is currently unavailable.</p>
                ) : (
                  <Button className="mt-5" disabled={busy !== null} isLoading={busy === (gmail ? "gmail" : "microsoft")} onClick={() => connect(gmail ? "gmail" : "microsoft")}>
                    {busy === (gmail ? "gmail" : "microsoft") ? "Opening provider…" : `Connect ${gmail ? "Gmail" : "Outlook"}`}
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      )}
      {pendingDisconnect && (
        <ConfirmDialog
          title="Disconnect this mailbox?"
          body={`${pendingDisconnect.verified_sender} will stop sending. Pending pre-send work is canceled and the local refresh credential is erased before any provider revocation is attempted.`}
          confirmLabel="Disconnect and erase"
          destructive
          onConfirm={async () => { const target = pendingDisconnect; setPendingDisconnect(null); await disconnect(target); }}
          onCancel={() => setPendingDisconnect(null)}
        />
      )}
      <p className="text-xs leading-5 text-[var(--color-text-muted)]">Disconnect is local-first: credentials are erased and pending sends are canceled before any best-effort provider revocation. Microsoft does not expose an equivalent per-token revocation endpoint, so local erasure remains authoritative.</p>
    </section>
  );
}
