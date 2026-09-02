import type { Metadata } from "next";
import LegalPageShell from "../LegalPageShell";

export const metadata: Metadata = { title: "Refund Policy — Prophezy" };

export default function RefundPolicyPage() {
  return (
    <LegalPageShell title="Refund Policy" updated="August 7, 2026">
      <p>
        This policy explains how refunds work for paid Prophezy plans. It applies to subscription charges made
        directly through Prophezy's checkout.
      </p>

      <h2>Free tier</h2>
      <p>
        Prophezy's core study tools are available on a free tier with usage limits. No payment means no refund
        question applies — you can use the free tier indefinitely within its limits.
      </p>

      <h2>Subscription cancellations</h2>
      <p>
        You can cancel a paid plan at any time from Settings. Cancelling stops future billing but does not
        automatically refund the current billing period — you retain access to paid features until the end of the
        period you've already paid for.
      </p>

      <h2>Refund eligibility</h2>
      <p>
        We offer a refund of your most recent charge if requested within 7 days of that charge, provided the paid
        features weren't substantially used during that period (for example, exporting a large number of AI-scored
        resumes or generating a high volume of AI content). This is assessed case by case — contact Support and we'll
        review your usage and respond within 5 business days.
      </p>
      <p>
        Outside the 7-day window, charges are generally non-refundable, except where required by applicable consumer
        protection law in your jurisdiction.
      </p>

      <h2>Billing errors</h2>
      <p>
        If you're charged in error — for example, double-billed, or billed after a cancellation that should have
        taken effect — contact Support with your account email and the charge date, and we'll correct it promptly.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Email <a href="mailto:billing@prophezy.app">billing@prophezy.app</a> or use the{" "}
        <a href="/support">Support</a> form with the "General question" option, including your account email and the
        date of the charge in question.
      </p>

      <h2>Changes to this policy</h2>
      <p>We'll update this page and the date above if our refund terms change.</p>
    </LegalPageShell>
  );
}
