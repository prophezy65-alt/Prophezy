import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("newsletter_subscribers")
      .upsert({ email: parsed.data.email, unsubscribed_at: null }, { onConflict: "email" });

    if (error) {
      console.error("newsletter upsert failed", error);
      return NextResponse.json({ error: "Could not subscribe right now. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("newsletter subscribe error", err);
    return NextResponse.json({ error: "Subscription service is temporarily unavailable." }, { status: 503 });
  }
}
