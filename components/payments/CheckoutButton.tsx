"use client";

import { useState } from "react";

declare global {
  interface Window {
    Cashfree?: (config: { mode: "production" | "sandbox" }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget?: "_self" | "_blank" | "_modal";
      }) => Promise<unknown>;
    };
  }
}

const CASHFREE_SDK_SRC = "https://sdk.cashfree.com/js/v3/cashfree.js";

function loadCashfreeSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Cashfree) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CASHFREE_SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Cashfree SDK")));
      return;
    }
    const script = document.createElement("script");
    script.src = CASHFREE_SDK_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
    document.head.appendChild(script);
  });
}

interface CheckoutButtonProps {
  planTier: "pro" | "premium";
  label: string;
  className?: string;
  disabledClassName?: string;
  style?: React.CSSProperties;
}

// Cashfree requires a customer_phone on every order. The app doesn't
// collect/store a phone number anywhere today, so a fixed placeholder is
// sent automatically instead of prompting the user for one — this value
// is never shown to the user and has no effect on payment routing/amount.
const PLACEHOLDER_PHONE = "9999999999";

/**
 * Drop-in checkout trigger used both on the marketing homepage pricing
 * section and the in-app /pricing page. Only sends `planTier` to the
 * server — the charged amount is decided server-side
 * (lib/payments/plans.ts), never by this component. On click:
 *   1. POSTs /api/payments/create-order (with a placeholder phone number,
 *      since Cashfree requires one but the app doesn't collect it),
 *   2. hands the returned payment_session_id to the Cashfree Web
 *      Checkout SDK, which redirects to Cashfree's hosted payment page
 *      (Cashfree's own UI offers UPI/QR, cards, netbanking — nothing
 *      QR-specific is built here, it's Cashfree's hosted checkout).
 *
 * Credits/plan are NEVER granted from this component or from the
 * redirect back — only the server-verified webhook does that.
 */
export default function CheckoutButton({
  planTier,
  label,
  className,
  disabledClassName,
  style,
}: CheckoutButtonProps) {
  const [phase, setPhase] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(customerPhone: string) {
    setError(null);
    setPhase("loading");
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier, customerPhone }),
      });
      const body = await res.json();
      if (res.status === 401) {
        const back = typeof window !== "undefined" ? window.location.pathname : "/pricing";
        window.location.href = `/login?redirectTo=${encodeURIComponent(back)}`;
        return;
      }
      if (!res.ok || !body.ok) {
        throw new Error(body?.error?.message || "Could not start checkout.");
      }

      await loadCashfreeSdk();
      const mode = body.data.environment === "production" ? "production" : "sandbox";
      const cashfree = window.Cashfree!({ mode });
      await cashfree.checkout({
        paymentSessionId: body.data.paymentSessionId,
        redirectTarget: "_self",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        disabled={phase === "loading"}
        onClick={() => void startCheckout(PLACEHOLDER_PHONE)}
        className={phase === "loading" ? disabledClassName ?? className : className}
        style={style}
      >
        {phase === "loading" ? "Starting checkout…" : label}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
