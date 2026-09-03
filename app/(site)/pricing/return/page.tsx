"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type PollStatus = "checking" | "paid" | "pending" | "failed" | "cancelled" | "not_found";

/**
 * /pricing/return?order_id=...
 *
 * Cashfree redirects here after checkout (success, drop, or cancel all
 * land here — Cashfree Web Checkout does not distinguish them at the
 * redirect level, which is exactly why this page NEVER grants anything
 * from the redirect itself). It polls GET /api/payments/status/:orderId,
 * which only reflects what the server-verified webhook has already
 * recorded in payment_orders. If the webhook hasn't landed yet, this page
 * keeps polling for a short window rather than showing a false negative.
 */
function PricingReturnContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const [status, setStatus] = useState<PollStatus>("checking");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!orderId) {
      setStatus("not_found");
      return;
    }

    let cancelled = false;
    const MAX_ATTEMPTS = 10;

    async function poll() {
      try {
        const res = await fetch(`/api/payments/status/${encodeURIComponent(orderId!)}`, {
          cache: "no-store",
        });
        const body = await res.json();
        if (cancelled) return;

        if (!res.ok || !body.ok) {
          setStatus("not_found");
          return;
        }

        const { status: orderStatus, processed } = body.data as {
          status: string;
          processed: boolean;
        };

        if (orderStatus === "paid" && processed) {
          setStatus("paid");
          return;
        }
        if (orderStatus === "failed") {
          setStatus("failed");
          return;
        }
        if (orderStatus === "cancelled") {
          setStatus("cancelled");
          return;
        }

        // Still pending / webhook not yet delivered — keep polling.
        setAttempts((prev) => {
          const next = prev + 1;
          if (next < MAX_ATTEMPTS) {
            setTimeout(poll, 2000);
          } else {
            setStatus("pending");
          }
          return next;
        });
      } catch {
        if (!cancelled) setStatus("not_found");
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const copy: Record<PollStatus, { title: string; body: string }> = {
    checking: {
      title: "Confirming your payment…",
      body: "This usually takes a few seconds. Please don't close this page.",
    },
    paid: {
      title: "Payment confirmed",
      body: "Your plan has been upgraded and your credits are ready to use.",
    },
    pending: {
      title: "Still confirming",
      body:
        "We haven't received final confirmation from Cashfree yet. This can take a couple of minutes — refresh this page shortly, or check your plan in Settings.",
    },
    failed: {
      title: "Payment failed",
      body: "Your payment did not go through. No amount has been charged for this attempt. You can try again from the pricing page.",
    },
    cancelled: {
      title: "Payment cancelled",
      body: "You cancelled the checkout before completing payment. Your plan hasn't changed.",
    },
    not_found: {
      title: "We couldn't find that order",
      body: "If you completed a payment, check your plan in Settings — it may still be confirming.",
    },
  };

  const { title, body } = copy[status];

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <h1 className="text-2xl font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-white/60">{body}</p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/pricing"
          className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-white"
        >
          Back to pricing
        </Link>
        {status === "paid" && (
          <Link
            href="/app"
            className="rounded-full bg-[#5ff2ff] px-5 py-2.5 text-sm font-medium text-[#050505]"
          >
            Go to app
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * useSearchParams() opts the subtree into client-side rendering for the
 * query string, which Next.js requires to be wrapped in a Suspense
 * boundary during static prerendering (otherwise the build fails with
 * "useSearchParams() should be wrapped in a suspense boundary" — exactly
 * what happened before this wrapper was added). The fallback is only ever
 * visible for a very brief instant while the client bundle hydrates.
 */
export default function PricingReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
          <p className="text-sm text-white/60">Loading…</p>
        </div>
      }
    >
      <PricingReturnContent />
    </Suspense>
  );
}
