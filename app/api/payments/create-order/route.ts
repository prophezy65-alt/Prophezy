import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, ok, fail, HttpError } from "@/lib/payments/http";
import { createOrderForUser } from "@/lib/payments/payment.service";
import { isPayablePlan } from "@/lib/payments/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  // Only a plan IDENTIFIER is accepted from the client — never an amount.
  // The server looks up the authoritative price from lib/payments/plans.ts.
  planTier: z.enum(["pro", "premium"]),
  // Cashfree requires a customer phone number on the order. Collected from
  // the client because profiles has no phone column today; validated
  // server-side as a defense against garbage input, not trusted for
  // anything beyond passing through to Cashfree's customer_details.
  customerPhone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "Enter a 10-digit phone number."),
});

/**
 * POST /api/payments/create-order
 *
 * Requirements enforced here:
 *  - server-side order creation only (this route is the only caller of
 *    createCashfreeOrder in the whole codebase)
 *  - the client sends `planTier`, never an amount — getPlanPrice() inside
 *    createOrderForUser() is the sole source of the charged amount
 *  - the authenticated Supabase user id is attached to the order (both in
 *    payment_orders.user_id and in Cashfree's order_tags/customer_id)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_REQUEST", parsed.error.issues[0]?.message ?? "Invalid request.");
    }
    if (!isPayablePlan(parsed.data.planTier)) {
      throw new HttpError(400, "INVALID_PLAN", "Unknown plan.");
    }

    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;

    const result = await createOrderForUser({
      userId: user.id,
      userEmail: user.email,
      planTier: parsed.data.planTier,
      customerPhone: parsed.data.customerPhone,
      appBaseUrl,
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
