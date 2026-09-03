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
}

/**
 * Drop-in replacement for the disabled "Coming soon" button on the
 * pricing page. Only sends `planTier` to the server — the charged amount
 * is decided server-side (lib/payments/plans.ts), never by this
 * component. On click:
 *   1. collects a phone number (required by Cashfree, not currently
 *      stored on the profile),
 *   2. POSTs /api/payments/create-order,
 *   3. hands the returned payment_session_id to the Cashfree Web
 *      Checkout SDK, which redirects to Cashfree's hosted payment page.
 *
 * Credits/plan are NEVER granted from this component or from the
 * redirect back — only the server-verified webhook does that.
 */
export default function CheckoutButton({
  planTier,
  label,
  className,
  disabledClassName,
}: CheckoutButtonProps) {
  const [phase, setPhase] = useState<"idle" | "collecting-phone" | "loading">("idle");
  const [phone, setPhone] = useState("");
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
        window.location.href = `/login?redirectTo=${encodeURIComponent("/pricing")}`;
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
      setPhase("collecting-phone");
    }
  }

  if (phase === "collecting-phone") {
    return (
      <form
        className="flex w-full flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const digits = phone.replace(/\D/g, "");
          if (digits.length !== 10) {
            setError("Enter a valid 10-digit phone number.");
            return;
          }
          void startCheckout(digits);
        }}
      >
        <input
          type="tel"
          inputMode="numeric"
          placeholder="10-digit phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-white/[0.12] bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
          maxLength={10}
          autoFocus
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button type="submit" className={className}>
          Continue to payment
        </button>
      </form>
    );
  }

  return (
    <div className="w-full">
      <button
        type="button"
        disabled={phase === "loading"}
        onClick={() => setPhase("collecting-phone")}
        className={phase === "loading" ? disabledClassName ?? className : className}
      >
        {phase === "loading" ? "Starting checkout…" : label}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
