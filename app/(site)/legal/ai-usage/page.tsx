import type { Metadata } from "next";
import LegalPageShell from "../LegalPageShell";

export const metadata: Metadata = { title: "AI Usage Policy — Prophezy" };

export default function AiUsagePolicyPage() {
  return (
    <LegalPageShell title="AI Usage Policy" updated="August 7, 2026">
      <p>
        This policy explains how Prophezy uses artificial intelligence, what data is sent to AI providers, and the
        limitations you should keep in mind when relying on AI-generated output.
      </p>

      <h2>Which AI we use</h2>
      <p>
        AI-generated features — quiz and flashcard generation, document summarization, research chat, and resume
        content suggestions — are powered by Google Gemini. OCR for scanned documents uses Tesseract.js, running as
        part of our own processing pipeline rather than sending images to a third party for text extraction.
      </p>

      <h2>What's sent to the AI provider</h2>
      <p>
        When you use an AI feature, the relevant content — the text extracted from your uploaded document, your
        resume content, or your research question — is sent to Gemini along with a task-specific prompt, so the
        response is grounded in your actual material rather than generated from general knowledge alone. We do not
        send your entire account or unrelated documents as part of a single request — only what's relevant to the
        feature you're using.
      </p>

      <h2>Training and data retention by AI providers</h2>
      <p>
        We use Google's API under terms that do not permit using your content to train their general-purpose models.
        Your uploaded documents and generated content remain governed by Prophezy's own storage and retention rules
        — see our <a href="/legal/data-retention">Data Retention Policy</a> — not by the AI provider's separate
        consumer products.
      </p>

      <h2>Accuracy and limitations</h2>
      <p>
        AI-generated content can be incomplete, out of date, or incorrect — this is a known limitation of current
        language models, not specific to Prophezy. Specifically:
      </p>
      <ul>
        <li>Summaries may omit nuance present in the original document.</li>
        <li>Quiz questions are generated from extracted text and can occasionally misstate a detail from the source.</li>
        <li>Resume suggestions reflect general best practices and ATS patterns, not a guarantee of how any specific employer's system will parse your resume.</li>
        <li>Placement Engine match scores are a relevance estimate, not a hiring prediction.</li>
      </ul>
      <p>
        You should review AI-generated content — especially anything you plan to submit academically, cite as a
        source, or send to an employer — before relying on it.
      </p>

      <h2>Human oversight</h2>
      <p>
        AI output in Prophezy is generated automatically and is not reviewed by a human before being shown to you.
        You remain responsible for how you use it, including compliance with your institution's academic integrity
        policies when using study tools.
      </p>

      <h2>No autonomous actions on your behalf</h2>
      <p>
        Prophezy's AI does not submit job applications, send messages, or take other irreversible actions on your
        behalf without your explicit action. The Placement Engine discovers and ranks opportunities; you always
        complete the application yourself, on the original platform.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        As the AI providers or features we use change, we'll update this page and the date above.
      </p>
    </LegalPageShell>
  );
}
