"use client";

import { useEffect, useState } from "react";

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

/**
 * Reads the response body as text first and only then tries to parse it as
 * JSON. Calling res.json() directly crashed with "Unexpected end of JSON
 * input" whenever the server returned an empty or non-JSON body (a cold
 * function timeout, a proxy error page, etc.) — that crash happened INSIDE
 * the try block before the 401-redirect check could run, so a person got
 * stuck on a raw error instead of being sent to log in. This never throws;
 * a body that isn't valid JSON becomes { ok: false, error: { message } }
 * instead of blowing up the whole flow.
 */
async function safeParseJson(res: Response): Promise<{ ok: boolean; data?: any; error?: { message: string } }> {
  const text = await res.text().catch(() => "");
  if (!text) {
    return { ok: false, error: { message: `Server returned an empty response (status ${res.status}).` } };
  }
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: { message: `Unexpected response from server (status ${res.status}).` } };
  }
}

interface CheckoutButtonProps {
  planTier: "pro" | "premium";
  label: string;
  className?: string;
  disabledClassName?: string;
  style?: React.CSSProperties;
  /**
   * When true, skip the initial "tap to start" click and go straight to
   * the phone-number step on mount. Used by /pricing when a person is
   * routed back here right after signing up or logging in (see the
   * `?plan=` query param handling in app/(site)/pricing/page.tsx) so
   * upgrading doesn't require finding and re-clicking the same button a
   * second time right after authenticating.
   */
  autoStart?: boolean;
}

/**
 * Drop-in checkout trigger used both on the marketing homepage pricing
 * section and the in-app /pricing page. Only sends `planTier` to the
 * server — the charged amount is decided server-side
 * (lib/payments/plans.ts), never by this component. On click:
 *   1. collects the customer's real phone number (required by Cashfree),
 *   2. POSTs /api/payments/create-order,
 *   3. hands the returned payment_session_id to the Cashfree Web
 *      Checkout SDK, which redirects to Cashfree's hosted payment page
 *      (UPI/QR, cards, netbanking — all Cashfree's own hosted UI).
 *
 * Not signed in: redirected to /login carrying `redirectTo=/pricing?plan=
 * <planTier>`. /login is used rather than /signup because there's no way
 * to know from here whether this browser belongs to someone who already
 * has an account (just signed out) or a first-time visitor — the login
 * page itself offers a "sign up" link for the latter case, so either path
 * lands back on /pricing with the same `plan` param afterward, and the
 * page auto-resumes this component at the phone-number step via
 * `autoStart` — no second click needed, and no assumption made about
 * which case they were.
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
  autoStart,
}: CheckoutButtonProps) {
  const [phase, setPhase] = useState<"idle" | "collecting-phone" | "loading">(
    autoStart ? "collecting-phone" : "idle"
  );
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Covers the case where this component re-renders with autoStart
  // flipping to true (e.g. the parent re-reads the URL after a
  // client-side navigation) rather than only handling a fresh mount.
  useEffect(() => {
    if (autoStart) setPhase((p) => (p === "idle" ? "collecting-phone" : p));
  }, [autoStart]);

  async function startCheckout(customerPhone: string) {
    setError(null);
    setPhase("loading");
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier, customerPhone }),
      });

      if (res.status === 401) {
        const target = `/pricing?plan=${planTier}`;
        window.location.href = `/login?redirectTo=${encodeURIComponent(target)}`;
        return;
      }

      const body = await safeParseJson(res);
      if (!res.ok || !body.ok) {
        throw new Error(body?.error?.message || "Could not start checkout. Please try again.");
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

  if (phase === "collecting-phone" || phase === "loading") {
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
          placeholder="Your 10-digit phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-white/[0.12] bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
          maxLength={10}
          disabled={phase === "loading"}
          autoFocus
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button type="submit" className={className} style={style} disabled={phase === "loading"}>
          {phase === "loading" ? "Starting checkout…" : "Continue to payment"}
        </button>
      </form>
    );
  }

  return (
    <div className="w-full">
      <button type="button" onClick={() => setPhase("collecting-phone")} className={className} style={style}>
        {label}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
