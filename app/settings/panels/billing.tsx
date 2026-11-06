"use client";
import { useEffect, useState } from "react";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { Badge, Button, Notice } from "@/components/ui/primitives";
import { Coins, CreditCard } from "../../icons";
import Skeleton from "@/components/ui/Skeleton";
import FeatureSection from "../feature-section";
import { trackProductEvent } from "@/app/product-analytics";

type BillingPayment = {
  order_id: string;
  plan: string | null;
  status: string;
  price_amount: string | null;
  pay_currency: string | null;
  created_at: string;
  provider?: "crypto" | "razorpay";
};

type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayCheckout = {
  open: () => void;
  on: (event: "payment.failed", listener: () => void) => void;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { email?: string };
  theme?: { color: string };
  handler: (payment: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckout;
  }
}

function BillingHistory() {
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPayments() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/account/billing", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error("billing_unavailable");
      setPayments(Array.isArray(data.payments) ? data.payments : []);
    } catch {
      setError("Payment history is temporarily unavailable. Your active plan is not affected.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPayments(); }, []);

  return (
    <FeatureSection icon={<CreditCard size={20} />} title="Payment history" description="Every charge, currency, and status — paid once, never auto-renewed.">
      {loading ? (
        <div className="grid gap-2" aria-busy="true">
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
        </div>
      ) : error ? (
        <div role="alert">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
          <Button className="mt-3" variant="outline" size="sm" onClick={loadPayments}>Retry</Button>
        </div>
      ) : payments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-5 dark:border-[var(--color-dark-border)]">
          <p className="font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">No payments yet</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Transaction statuses appear here, and every completed payment gets a downloadable PDF invoice.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] dark:border-[var(--color-dark-border)]">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-[var(--color-primary-50)] text-xs uppercase tracking-wide text-[var(--color-text-muted)] dark:bg-[var(--color-dark-surface-2)] dark:text-[var(--color-dark-text-muted)]">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Invoice</th></tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.order_id} className="border-t border-[var(--color-border)] text-[var(--color-text)] dark:border-[var(--color-dark-border)] dark:text-[var(--color-dark-text)]">
                  <td className="whitespace-nowrap px-4 py-3">{new Date(payment.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 capitalize">{payment.plan || "Premium"}</td>
                  <td className="px-4 py-3">{payment.price_amount ? new Intl.NumberFormat(undefined, { style: "currency", currency: payment.provider === "razorpay" ? (payment.pay_currency?.trim() || "INR") : "USD" }).format(Number(payment.price_amount)) : "—"}{payment.pay_currency ? <span className="ml-1 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">— {payment.pay_currency.toUpperCase()}</span> : null}</td>
                  <td className="px-4 py-3"><PaymentStatus status={payment.status} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">…{payment.order_id.slice(-8)}</td>
                  <td className="px-4 py-3">
                    {PAID_STATUSES.includes(payment.status) ? (
                      <a
                        className="font-semibold text-[var(--color-primary)] underline underline-offset-2"
                        href={`/api/account/invoice/${encodeURIComponent(payment.order_id)}`}
                      >
                        Download
                      </a>
                    ) : (
                      // Only a completed payment has an invoice. Showing a dead
                      // link on a pending row reads as a broken download.
                      <span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FeatureSection>
  );
}

// Mirrors isPaid() in lib/nowpay.ts. A client component cannot import that
// module (it reads process.env at load), so the two lists are kept in step by
// an assertion in tests/security-remediation.test.ts.
const PAID_STATUSES = ["finished", "confirmed", "paid"];

function PaymentStatus({ status }: { status: string }) {
  const complete = PAID_STATUSES.includes(status);
  const failed = ["failed", "expired", "refunded"].includes(status);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${complete ? "bg-[var(--color-success-bg)] text-[var(--color-success)]" : failed ? "bg-[var(--color-danger-bg)] text-[var(--color-danger)]" : "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"}`}>{status.replaceAll("_", " ")}</span>;
}

function AccessAndBilling({ me, onChange }: any) {
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState<"monthly" | "yearly" | null>(null);
  const [razorpayBusy, setRazorpayBusy] = useState<"monthly" | "yearly" | null>(null);
  const [msg, setMsg] = useState<any>(null);
  // Set while the browser is navigating to the hosted checkout page: the
  // spinner alone is not enough because a slow redirect looks identical to
  // nothing happening.
  const [redirecting, setRedirecting] = useState(false);
  async function upgrade(plan: "monthly" | "yearly", promoCode?: string) {
    setBusy(plan);
    setMsg(null);
    trackProductEvent("checkout_provider_selected", { context: `billing:crypto:${plan}`, authState: "authenticated" });
    const body = JSON.stringify({ plan, ...(promoCode ? { promoCode } : {}) });
    try {
      const order = await fetch("/api/pay/crypto/create", { method: "POST", headers: { "Content-Type": "application/json" }, body }).then((r) => r.json());
      if (order.error) {
        trackProductEvent("checkout_failed", { context: `billing:crypto:${plan}`, authState: "authenticated" });
        setMsg({ t: order.error === "payment_not_configured" ? "Payments are not configured yet." : "Checkout is unavailable right now." });
      } else if (order.devMode) {
        await fetch("/api/pay/crypto/dev-confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body });
        await onChange();
        trackProductEvent("checkout_verified", { context: `billing:crypto:${plan}`, authState: "authenticated" });
        setMsg({ ok: 1, t: "Premium activated (dev mode)." });
      } else if (order.invoiceUrl) {
        trackProductEvent("checkout_started", { context: `billing:crypto:${plan}`, authState: "authenticated" });
        setRedirecting(true);
        window.location.href = order.invoiceUrl;
        return;
      } else {
        trackProductEvent("checkout_failed", { context: `billing:crypto:${plan}`, authState: "authenticated" });
        setMsg({ t: "Payment checkout is unavailable right now." });
      }
    } catch {
      trackProductEvent("checkout_failed", { context: `billing:crypto:${plan}`, authState: "authenticated" });
      setMsg({ t: "Network error. Please try again." });
    } finally {
      setBusy(null);
    }
  }
  async function upgradeWithRazorpay(plan: "monthly" | "yearly") {
    if (!window.Razorpay) {
      setMsg({ t: "Secure checkout is still loading. Please try again in a moment." });
      return;
    }
    setRazorpayBusy(plan);
    setMsg(null);
    trackProductEvent("checkout_provider_selected", { context: `billing:razorpay:${plan}`, authState: "authenticated" });
    let checkoutOpened = false;
    try {
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const order = await response.json().catch(() => null);
      if (!response.ok || !order?.order_id || !order?.key_id) {
        trackProductEvent("checkout_failed", { context: `billing:razorpay:${plan}`, authState: "authenticated" });
        setMsg({ t: order?.error === "payment_not_configured" ? "Razorpay is not configured for this site yet." : "Secure checkout is unavailable right now." });
        return;
      }
      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "RoleSharp",
        description: `${plan === "monthly" ? "30-day" : "365-day"} Premium pass`,
        order_id: order.order_id,
        prefill: { email: order.email },
        theme: { color: "#4f46e5" },
        modal: {
          ondismiss: () => {
            setRazorpayBusy(null);
            trackProductEvent("checkout_cancelled", { context: `billing:razorpay:${plan}`, authState: "authenticated" });
            setMsg({ t: "Checkout was cancelled. No payment was made." });
          },
        },
        handler: async (payment) => {
          try {
            const verified = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payment),
            });
            const result = await verified.json().catch(() => null);
            if (verified.status === 202 && result?.pending) {
              setMsg({ t: "Razorpay has authorized your payment. Premium will activate once the payment is captured. Check your payment history shortly." });
              return;
            }
            if (!verified.ok || !result?.ok) {
              trackProductEvent("checkout_failed", { context: `billing:razorpay:${plan}`, authState: "authenticated" });
              setMsg({ t: "We could not verify that payment. Please contact support with your payment reference." });
              return;
            }
            await onChange();
            trackProductEvent("checkout_verified", { context: `billing:razorpay:${plan}`, authState: "authenticated" });
            setMsg({ ok: 1, t: "Payment verified. Premium access is active." });
          } catch {
            trackProductEvent("checkout_failed", { context: `billing:razorpay:${plan}`, authState: "authenticated" });
            setMsg({ t: "Payment completed but verification could not finish. Please contact support with your payment reference." });
          } finally {
            setRazorpayBusy(null);
          }
        },
      });
      checkout.on("payment.failed", () => {
        setRazorpayBusy(null);
        trackProductEvent("checkout_failed", { context: `billing:razorpay:${plan}`, authState: "authenticated" });
        setMsg({ t: "Payment failed. No Premium access was granted." });
      });
      checkout.open();
      checkoutOpened = true;
      trackProductEvent("checkout_started", { context: `billing:razorpay:${plan}`, authState: "authenticated" });
    } catch {
      trackProductEvent("checkout_failed", { context: `billing:razorpay:${plan}`, authState: "authenticated" });
      setMsg({ t: "Network error. Please try again." });
    } finally {
      if (!checkoutOpened) setRazorpayBusy(null);
    }
  }
  const requestedPlan = searchParams.get("plan");
  const requestedPromo = searchParams.get("promo")?.trim().slice(0, 24) || "";
  const requestedPlanId = requestedPlan === "monthly" || requestedPlan === "yearly" ? requestedPlan : null;
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");
  useEffect(() => {
    if (requestedPlanId) setSelectedPlan(requestedPlanId);
  }, [requestedPlanId]);
  const mo = me?.plans?.find((p: any) => p.id === "monthly");
  const yr = me?.plans?.find((p: any) => p.id === "yearly");
  const premiumUntil = me?.premiumUntil ? new Date(me.premiumUntil) : null;
  const premiumUntilLabel = premiumUntil && !isNaN(premiumUntil.getTime()) ? premiumUntil.toLocaleDateString() : "—";
  return (
    <FeatureSection icon={<Coins size={20} />} title="Premium access & billing" description="Your current pass, what it unlocks, and when it ends.">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <Notice variant="neutral" className="mb-5">
        Premium is a fixed-term pass paid once. It never auto-renews. Your separate rolling generation allowance continues to reset during access, and your account returns to Free when the pass ends.
      </Notice>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={me?.premium ? "premium" : "default"}>{me?.premium ? "Premium" : "Free"}</Badge>
          <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            {me?.premium
              ? <>Access through <b className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{premiumUntilLabel}</b> · {me?.remaining ?? 0}/{me?.limit ?? 10} resumes left</>
              : <>{me?.remaining ?? 0}/{me?.limit ?? 3} resumes left in the current rolling allowance.</>}
          </p>
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
          {me?.premium
            ? "Premium includes DOCX export, watermark-free PDFs, templates, cover letters, interview prep, and LinkedIn tools. A new pass extends access; it never starts a subscription."
            : "Premium adds stronger writing, DOCX export, watermark-free PDFs, templates, cover letters, interview prep, and LinkedIn tools. Saved resumes always remain yours."}
        </p>
      </div>
      <div className="mt-5 border-t border-[var(--color-border)] pt-5 dark:border-[var(--color-dark-border)]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Choose your pass</p>
          <span className="text-xs font-semibold text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">One payment · no auto-renewal</span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2" role="group" aria-label="Premium pass duration">
          {([
            { id: "monthly" as const, days: mo?.days ?? 30, price: mo?.price ?? 12, label: "30-day pass" },
            { id: "yearly" as const, days: yr?.days ?? 365, price: yr?.price ?? 79, label: "365-day pass" },
          ]).map((option) => {
            const selected = selectedPlan === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedPlan(option.id)}
                className={`rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${selected ? "border-[var(--color-primary)] bg-[var(--color-primary-50)] dark:bg-[var(--color-dark-surface-2)]" : "border-[var(--color-border)] hover:border-[var(--color-primary)]/50 dark:border-[var(--color-dark-border)]"}`}
              >
                <span className="flex items-center justify-between gap-3"><span className="font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{option.label}</span><span className="text-base font-extrabold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">${option.price}</span></span>
                <span className="mt-1 block text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{option.days} days of access · pay once</span>
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Choose a secure payment method</p>
          <span className="text-xs font-semibold text-[var(--color-primary)]">{selectedPlan === "yearly" ? "365-day" : "30-day"} pass selected</span>
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
          Crypto checkout is quoted in USD. Card and UPI checkout is quoted in INR. The exact amount and currency are confirmed by the selected provider before payment.
        </p>
        {requestedPromo ? <p className="mt-2 text-xs font-semibold text-[var(--color-success)]" role="status">Promo code {requestedPromo.toUpperCase()} will be validated for crypto checkout.</p> : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--color-border)] p-4 dark:border-[var(--color-dark-border)]">
            <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Crypto</p><span className="rounded-full bg-[var(--color-surface-2)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] dark:bg-[var(--color-dark-surface-2)] dark:text-[var(--color-dark-text-muted)]">USD</span></div>
            <p className="mt-1 min-h-10 text-xs leading-5 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Pay with a supported cryptocurrency through NOWPayments.</p>
            <Button className="mt-3 w-full" variant="outline" size="sm" disabled={busy !== null || razorpayBusy !== null} isLoading={busy === selectedPlan} onClick={() => upgrade(selectedPlan, requestedPromo || undefined)}>
              Continue with crypto
            </Button>
          </div>
          <div className="rounded-xl border border-[var(--color-primary)]/35 bg-[var(--color-primary-50)]/45 p-4 dark:border-[var(--color-primary)]/35 dark:bg-[var(--color-dark-surface-2)]">
            <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Card or UPI</p><span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-primary)]">INR · Razorpay</span></div>
            <p className="mt-1 min-h-10 text-xs leading-5 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Pay securely by card or UPI. Razorpay confirms the final INR amount before payment.</p>
            <Button className="mt-3 w-full" size="sm" disabled={busy !== null || razorpayBusy !== null} isLoading={razorpayBusy === selectedPlan} onClick={() => upgradeWithRazorpay(selectedPlan)}>
              Continue to secure payment
            </Button>
          </div>
        </div>
      </div>
      {redirecting && (
        <p className="mt-4 text-sm font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]" role="status">
          Redirecting to secure checkout — this can take a few seconds. Do not close the page.
        </p>
      )}
      {msg && (
        <p
          className={`mt-4 text-sm font-semibold ${msg.ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}
          role={msg.ok ? "status" : "alert"}
        >
          {msg.t}
        </p>
      )}
    </FeatureSection>
  );
}

// One default export per tab keeps the lazy boundary in page.tsx to a single
// dynamic() call instead of one per component.
export default function BillingPanel({ me, onChange }: any) {
  return (<><AccessAndBilling me={me} onChange={onChange} /><BillingHistory /></>);
}
