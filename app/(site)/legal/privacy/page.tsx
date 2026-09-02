import type { Metadata } from "next";
import LegalPageShell from "../LegalPageShell";

export const metadata: Metadata = { title: "Privacy Policy — Prophezy" };

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Privacy Policy" updated="August 7, 2026">
      <p>
        This Privacy Policy explains what information Prophezy ("we," "us," "Prophezy") collects when you use the
        application, how it's used, and the choices you have. It applies to prophezy.app and the Prophezy web
        application, including the Study Hub, Research Lab, Resume Studio, and Placement Engine modules.
      </p>

      <h2>Information we collect</h2>
      <p>
        <strong>Account information:</strong> name, email address, and authentication details when you sign up, via
        Supabase Auth.
      </p>
      <p>
        <strong>Content you provide:</strong> documents you upload (lecture notes, research papers, resumes),
        generated study material, resume content and version history, and any notes or messages you create inside
        the app.
      </p>
      <p>
        <strong>Usage data:</strong> which features you use, timestamps, and general interaction data, used to
        maintain and improve the product.
      </p>
      <p>
        <strong>Support submissions:</strong> the email address, subject, and message content you provide through
        the Support form.
      </p>

      <h2>How we use your information</h2>
      <ul>
        <li>To operate core features — generating study material, resume scoring, and opportunity matching from your uploaded content and profile.</li>
        <li>To maintain your account and authenticate you across sessions.</li>
        <li>To respond to support requests and bug reports.</li>
        <li>To monitor system health, prevent abuse, and debug issues.</li>
        <li>To send service-related notifications (e.g. internship deadline alerts you've opted into).</li>
      </ul>
      <p>
        We do not sell your personal information. We do not use your uploaded documents to train third-party
        foundation models — see our{" "}
        <a href="/legal/ai-usage">AI Usage Policy</a> for details on how AI features process your content.
      </p>

      <h2>Where your data is stored</h2>
      <p>
        Account data, uploaded documents, and generated content are stored in Supabase (Postgres and object storage).
        AI-generated content is produced by Google Gemini, which processes the relevant content at the time of
        generation but does not retain it as part of our data storage.
      </p>

      <h2>Sharing your information</h2>
      <p>
        We share information only with the service providers necessary to operate Prophezy (Supabase for storage and
        authentication, Google for AI processing), under their respective data-processing terms, and only to the
        extent needed to provide the feature you're using. We do not share your content with other users unless you
        explicitly choose to (for example, if a future feature allows sharing a resume link).
      </p>
      <p>
        We may disclose information if required by law, to protect the rights and safety of Prophezy or our users, or
        in connection with a merger, acquisition, or sale of assets, subject to standard confidentiality obligations.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>Access and export your data from Settings inside the app.</li>
        <li>Delete individual documents, resumes, or notes at any time.</li>
        <li>Delete your account, which removes your personal data subject to the retention rules in our <a href="/legal/data-retention">Data Retention Policy</a>.</li>
        <li>Opt out of non-essential notifications from your account settings.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Prophezy uses cookies for authentication and session management. See our{" "}
        <a href="/legal/cookies">Cookie Policy</a> for the full list and how to manage them.
      </p>

      <h2>Children's privacy</h2>
      <p>
        Prophezy is intended for students generally 13 years of age and older. We do not knowingly collect
        information from children under 13. If you believe a child under 13 has created an account, contact us and
        we will remove it.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We'll update the "last updated" date above when this policy changes, and notify active users of material
        changes via email or an in-app notice.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy questions or requests, email{" "}
        <a href="mailto:prophezy65@gmail.com">prophezy65@gmail.com</a> or use the{" "}
        <a href="/support">Support</a> page.
      </p>
    </LegalPageShell>
  );
}
