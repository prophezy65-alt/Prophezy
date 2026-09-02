import { Mail, Phone, MessageCircle } from "lucide-react";

const ACCENT = "#5ff2ff";
export const CONTACT_EMAIL = "prophezy65@gmail.com";
export const CONTACT_PHONE = "+91 92589 03072";
export const CONTACT_PHONE_TEL = "+919258903072";

export default function ContactCard({
  heading = "Talk to us directly",
  body = "No forms required — reach the team by email or phone and we'll get back to you.",
}: {
  heading?: string;
  body?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] p-8 sm:p-10">
      <h2 className="text-2xl font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
        {heading}
      </h2>
      <p className="mt-3 max-w-md text-sm text-white/60">{body}</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="flex items-center gap-3 rounded-xl border border-white/[0.08] px-5 py-4 transition-colors hover:border-white/20"
        >
          <span
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${ACCENT}1a` }}
          >
            <Mail size={16} style={{ color: ACCENT }} />
          </span>
          <div className="text-left">
            <div className="text-[11px] uppercase tracking-[0.1em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
              Email
            </div>
            <div className="text-sm text-white/85">{CONTACT_EMAIL}</div>
          </div>
        </a>

        <a
          href={`tel:${CONTACT_PHONE_TEL}`}
          className="flex items-center gap-3 rounded-xl border border-white/[0.08] px-5 py-4 transition-colors hover:border-white/20"
        >
          <span
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${ACCENT}1a` }}
          >
            <Phone size={16} style={{ color: ACCENT }} />
          </span>
          <div className="text-left">
            <div className="text-[11px] uppercase tracking-[0.1em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
              Phone
            </div>
            <div className="text-sm text-white/85">{CONTACT_PHONE}</div>
          </div>
        </a>
      </div>

      <a
        href="/support"
        className="mt-5 inline-flex items-center gap-1.5 text-xs"
        style={{ color: ACCENT, fontFamily: "var(--font-mono)" }}
      >
        <MessageCircle size={13} />
        Or send a message through Support →
      </a>
    </div>
  );
}
