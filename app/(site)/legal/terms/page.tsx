import type { Metadata } from "next";
import LegalPageShell from "../LegalPageShell";

export const metadata: Metadata = { title: "Terms of Service — Prophezy" };

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service" updated="August 7, 2026">
      <p>
        These Terms of Service ("Terms") govern your use of Prophezy, including the website, web application, and
        all modules (Study Hub, Research Lab, Resume Studio, Placement Engine, and related features). By creating an
        account or using Prophezy, you agree to these Terms.
      </p>

      <h2>Eligibility and accounts</h2>
      <p>
        You must be at least 13 years old to use Prophezy. You're responsible for maintaining the confidentiality of
        your account credentials and for all activity under your account. Notify us immediately if you suspect
        unauthorized access.
      </p>

      <h2>What Prophezy is — and isn't</h2>
      <p>
        Prophezy provides AI-assisted study tools, research assistance, resume building, and opportunity discovery.
        The Placement Engine surfaces internship and job opportunities from third-party sources; Prophezy is not the
        employer, is not a party to any job or internship you apply for, and does not guarantee any application
        outcome. All applications are completed by you, on the original platform or company career page.
      </p>

      <h2>Your content</h2>
      <p>
        You retain ownership of documents, resumes, notes, and any other content you upload or create ("Your
        Content"). By uploading Your Content, you grant Prophezy a limited license to process, store, and display it
        back to you as necessary to provide the service — including sending it to AI providers to generate summaries,
        quizzes, or resume feedback. This license ends when you delete the content or your account, subject to our{" "}
        <a href="/legal/data-retention">Data Retention Policy</a>.
      </p>
      <p>
        You're responsible for ensuring you have the right to upload any document you submit, and that it doesn't
        infringe someone else's rights or violate any law.
      </p>

      <h2>AI-generated content</h2>
      <p>
        Study material, summaries, resume suggestions, and other AI-generated output may contain errors or
        inaccuracies. You're responsible for reviewing AI-generated content before relying on it academically or
        professionally — for example, verifying a summary against the source material before citing it. See our{" "}
        <a href="/legal/ai-usage">AI Usage Policy</a> for more detail.
      </p>

      <h2>Acceptable use</h2>
      <p>
        You agree not to misuse Prophezy — including attempting to circumvent usage limits, uploading malicious
        files, scraping the service, or using it to generate content that violates our{" "}
        <a href="/legal/acceptable-use">Acceptable Use Policy</a>. We may suspend or terminate accounts that violate
        these Terms.
      </p>

      <h2>Subscriptions and payment</h2>
      <p>
        Paid tiers, where offered, are billed on the cycle shown at checkout. You can cancel at any time from
        Settings; cancellation takes effect at the end of the current billing period.
      </p>

      <h2>Termination</h2>
      <p>
        You may delete your account at any time. We may suspend or terminate access for violations of these Terms,
        non-payment on a paid plan, or extended account inactivity, with notice where reasonably practicable.
      </p>

      <h2>Disclaimers</h2>
      <p>
        Prophezy is provided "as is." We don't guarantee that AI-generated content is error-free, that Placement
        Engine listings are exhaustive or current, or that the service will be uninterrupted. Prophezy is a
        discovery and productivity tool, not a guarantee of academic or career outcomes.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Prophezy is not liable for indirect, incidental, or consequential
        damages arising from your use of the service, including reliance on AI-generated content or third-party
        opportunity listings.
      </p>

      <h2>Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. We'll update the date above and, for material changes, notify
        active users in advance.
      </p>

      <h2>Governing law</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which Prophezy is registered to operate, without
        regard to conflict-of-law principles.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms: <a href="mailto:prophezy65@gmail.com">prophezy65@gmail.com</a>.
      </p>
    </LegalPageShell>
  );
}
