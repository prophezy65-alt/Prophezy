import { NextResponse } from "next/server";
import { z } from "zod";

// Single destination for every Contact submission, regardless of the
// selected reason. Not a secret — just where mail is routed — so it's safe
// as a literal (same pattern already used in /api/support and ContactCard).
const NOTIFY_EMAIL = "prophezy65@gmail.com";

const REASON_LABEL: Record<string, string> = {
  general: "General",
  support: "Support",
  partnership: "Partnership",
  feedback: "Feedback",
  bug: "Bug Report",
  business: "Business",
};

const contactRequestSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().trim().email("A valid email is required."),
  subject: z.string().trim().min(1, "Subject is required.").max(150),
  message: z.string().trim().min(10, "Message is too short.").max(3000),
  reason: z.enum(["general", "support", "partnership", "feedback", "bug", "business"]).default("general"),
  pageUrl: z.string().url().optional(),
});

// Sends the notification email via Resend (https://resend.com), the same
// provider already wired up for /api/support. Requires RESEND_API_KEY in
// the environment — this route treats a missing key or a failed send as a
// genuine failure (unlike /api/support's silent no-op) because email is the
// *only* delivery path for Contact, so the user must never be told
// "sent" when it wasn't.
//
// FROM ADDRESS: Resend rejects sends from an unverified domain. Until a
// custom domain is verified in the Resend dashboard, the only address that
// works is their built-in sandbox sender `onboarding@resend.dev` — so that's
// the default here. Once a real domain is verified, set RESEND_FROM_EMAIL
// (e.g. "Prophezy <contact@yourdomain.com>") and no code change is needed.
async function sendContactEmail(payload: {
  name: string;
  email: string;
  subject: string;
  message: string;
  reason: string;
  pageUrl?: string;
  timestamp: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL || "Prophezy <onboarding@resend.dev>";
  const reasonLabel = REASON_LABEL[payload.reason] ?? payload.reason;

  const text = [
    `From: ${payload.name} <${payload.email}>`,
    `Reason: ${reasonLabel}`,
    `Subject: ${payload.subject}`,
    payload.pageUrl ? `Page: ${payload.pageUrl}` : null,
    `Sent: ${payload.timestamp}`,
    "",
    payload.message,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddress,
      to: [NOTIFY_EMAIL],
      reply_to: payload.email,
      subject: `[Contact — ${reasonLabel}] ${payload.subject}`,
      text,
    }),
  });

  if (!res.ok) {
    // Read Resend's actual error body so it lands in the server logs —
    // this is what tells you *why* (bad key, unverified domain, invalid
    // recipient, etc). Never sent to the client.
    const errorBody = await res.text().catch(() => "");
    return { sent: false, reason: `Resend responded ${res.status}: ${errorBody}` };
  }
  return { sent: true };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = contactRequestSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? "Please check the form and try again." },
      { status: 400 },
    );
  }

  const { name, email, subject, message, reason, pageUrl } = parsed.data;
  const timestamp = new Date().toISOString();

  try {
    const result = await sendContactEmail({ name, email, subject, message, reason, pageUrl, timestamp });

    if (!result.sent) {
      console.error("contact email failed to send", result.reason);
      return NextResponse.json(
        { error: "Couldn't send your message. Please try again in a moment." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("contact route error", err);
    return NextResponse.json(
      { error: "Couldn't send your message. Please try again in a moment." },
      { status: 503 },
    );
  }
}
