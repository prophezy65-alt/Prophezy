import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const NOTIFY_EMAIL = "prophezy65@gmail.com";

// Sends the actual notification email via Resend (https://resend.com).
// Requires RESEND_API_KEY in the environment — without it, this silently
// no-ops and the request still succeeds via the Supabase insert below, so
// nothing breaks if the key isn't set yet. Once RESEND_API_KEY is added,
// every submission is emailed to NOTIFY_EMAIL with no other code changes.
async function notifyByEmail(payload: { kind: string; email: string; subject: string; message: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY not configured" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Prophezy Support <support@resend.dev>",
      to: [NOTIFY_EMAIL],
      reply_to: payload.email,
      subject: `[${payload.kind}] ${payload.subject}`,
      text: `From: ${payload.email}\nType: ${payload.kind}\n\n${payload.message}`,
    }),
  });

  if (!res.ok) return { sent: false, reason: `Resend responded ${res.status}` };
  return { sent: true };
}

const supportRequestSchema = z.object({
  kind: z.enum(["bug", "feature", "general"]),
  email: z.string().email(),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(5000),
  pageUrl: z.string().url().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = supportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }

  const { kind, email, subject, message, pageUrl } = parsed.data;
  const userAgent = request.headers.get("user-agent") ?? undefined;

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("support_requests").insert({
      kind,
      email,
      subject,
      message,
      page_url: pageUrl ?? null,
      user_agent: userAgent ?? null,
    });

    if (error) {
      console.error("support_requests insert failed", error);
      return NextResponse.json({ error: "Could not save your request. Please try again." }, { status: 500 });
    }

    const emailResult = await notifyByEmail({ kind, email, subject, message }).catch((err) => {
      console.error("email notify failed", err);
      return { sent: false, reason: "notify threw" };
    });

    return NextResponse.json({ ok: true, emailed: emailResult.sent }, { status: 201 });
  } catch (err) {
    console.error("support request error", err);
    return NextResponse.json({ error: "Support service is temporarily unavailable." }, { status: 503 });
  }
}
