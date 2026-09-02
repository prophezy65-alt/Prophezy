import type { Metadata } from "next";
import LegalPageShell from "../LegalPageShell";

export const metadata: Metadata = { title: "Acceptable Use Policy — Prophezy" };

export default function AcceptableUsePolicyPage() {
  return (
    <LegalPageShell title="Acceptable Use Policy" updated="August 7, 2026">
      <p>
        This Acceptable Use Policy sets out what you can and can't do when using Prophezy. It applies to every
        module — Study Hub, Research Lab, Resume Studio, Placement Engine, and any feature we add over time.
      </p>

      <h2>You agree not to</h2>
      <ul>
        <li>Upload malicious files, malware, or content designed to exploit our systems or other users.</li>
        <li>Attempt to circumvent usage limits, rate limits, or paid-tier restrictions through automation or multiple accounts.</li>
        <li>Scrape, reverse-engineer, or systematically extract data from Prophezy outside normal product use.</li>
        <li>Use AI features to generate content that is illegal, harassing, hateful, or intended to deceive (for example, fabricated credentials or plagiarized academic work submitted as your own without disclosure, where that violates your institution's policy).</li>
        <li>Upload documents you don't have the right to upload, including copyrighted material without permission or another person's personal data without consent.</li>
        <li>Use the Placement Engine or any part of Prophezy to scrape or republish third-party job listings at scale for a competing product.</li>
        <li>Interfere with the availability or integrity of the service — including attempting denial-of-service activity, or probing for vulnerabilities without authorization.</li>
        <li>Impersonate another person or misrepresent your affiliation with an institution or employer.</li>
      </ul>

      <h2>Academic integrity</h2>
      <p>
        Prophezy's study tools are designed to help you learn from your own material — summarizing, quizzing, and
        reinforcing content you're studying. You're responsible for using AI-generated study material in a way that
        complies with your institution's academic integrity policies, particularly for graded work.
      </p>

      <h2>Reporting misuse</h2>
      <p>
        If you encounter content or behavior on Prophezy that violates this policy, report it through{" "}
        <a href="/support">Support</a>. Security-specific issues should go to{" "}
        <a href="mailto:prophezy65@gmail.com">prophezy65@gmail.com</a>.
      </p>

      <h2>Enforcement</h2>
      <p>
        Violations of this policy may result in content removal, feature restrictions, or account suspension or
        termination, depending on severity, consistent with our{" "}
        <a href="/legal/terms">Terms of Service</a>.
      </p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy as new features are added. Material changes will be reflected in the date above.</p>
    </LegalPageShell>
  );
}
