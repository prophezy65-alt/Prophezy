/**
 * lib/credits/errors.ts
 *
 * Shared error types for the credit system. Kept separate from
 * credit.service.ts for the same reason lib/ai/utils/errors.ts is separate
 * from lib/ai/config/client.ts.
 */

/** Thrown by spendCredits()/spendCreditsForFeature() when the DB-level
 * atomic check (public.spend_credits, SQLSTATE P0001) rejects the debit.
 * The balance was NOT touched — safe to catch and return an
 * application-level INSUFFICIENT_CREDITS response without any cleanup.
 * `code` is fixed so a route handler can do
 * `NextResponse.json(err.toJSON(), { status: 402 })` directly. */
export class InsufficientCreditsError extends Error {
  readonly code = "INSUFFICIENT_CREDITS" as const;
  feature?: string;
  /** Balance at the moment of the failed spend attempt (from the DB's atomic check, not re-queried). */
  balance?: number;
  /** Credits the operation actually required. */
  requested?: number;

  constructor(
    message = "Not enough credits for this action.",
    opts: { feature?: string; balance?: number; requested?: number } = {}
  ) {
    super(message);
    this.name = "InsufficientCreditsError";
    this.feature = opts.feature;
    this.balance = opts.balance;
    this.requested = opts.requested;
  }

  /** Shape a route handler can return directly as the response body. */
  toJSON() {
    return {
      error: this.code,
      feature: this.feature ?? null,
      requiredCredits: this.requested ?? null,
      remainingCredits: this.balance ?? null,
      message: this.message,
    };
  }
}

/** Thrown when a credit-system RPC fails for a reason other than
 * insufficient balance (missing balance row, auth.uid() null, etc). */
export class CreditSystemError extends Error {
  override cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "CreditSystemError";
    this.cause = cause;
  }
}
