import type { Metadata } from "next";
import LegalPageShell from "../LegalPageShell";

export const metadata: Metadata = { title: "Cookie Policy — Prophezy" };

export default function CookiePolicyPage() {
  return (
    <LegalPageShell title="Cookie Policy" updated="August 7, 2026">
      <p>
        This Cookie Policy explains what cookies and similar technologies Prophezy uses, and why. It should be read
        alongside our <a href="/legal/privacy">Privacy Policy</a>.
      </p>

      <h2>What cookies we use</h2>
      <p>
        <strong>Strictly necessary cookies:</strong> used by Supabase Auth to keep you signed in and to maintain a
        secure session across requests (set and refreshed via our authentication middleware). Without these, you'd
        need to sign in again on every page.
      </p>
      <p>
        <strong>Preference cookies:</strong> remember interface preferences such as light/dark theme so you don't
        need to reset them each visit.
      </p>
      <p>
        <strong>Analytics cookies:</strong> where enabled, help us understand aggregate feature usage so we can
        prioritize what to build next. These do not identify you individually to third parties.
      </p>
      <p>We do not use third-party advertising cookies or trackers.</p>

      <h2>Why we use them</h2>
      <ul>
        <li>To keep you authenticated between requests without re-entering credentials.</li>
        <li>To remember your interface preferences.</li>
        <li>To understand, in aggregate, how the product is used so we can improve it.</li>
      </ul>

      <h2>Managing cookies</h2>
      <p>
        Most browsers let you block or delete cookies through their settings. Because our authentication cookies are
        strictly necessary, blocking them will prevent you from staying signed in to Prophezy. Preference and
        analytics cookies can generally be disabled without affecting core functionality.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If the cookies we use change materially, we'll update this page and the date above.
      </p>
    </LegalPageShell>
  );
}
