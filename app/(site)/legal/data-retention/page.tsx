import type { Metadata } from "next";
import LegalPageShell from "../LegalPageShell";

export const metadata: Metadata = { title: "Data Retention Policy — Prophezy" };

export default function DataRetentionPolicyPage() {
  return (
    <LegalPageShell title="Data Retention Policy" updated="August 7, 2026">
      <p>
        This policy explains how long Prophezy keeps different categories of data, and what happens when you delete
        content or your account.
      </p>

      <h2>Active account data</h2>
      <p>
        While your account is active, we retain account information, uploaded documents, generated study material,
        resumes, notes, and usage history for as long as needed to provide the service — effectively, until you
        delete the specific item or your account.
      </p>

      <h2>Deleting individual content</h2>
      <p>
        Deleting a document, resume, note, or flashcard deck from within the app removes it from your active
        account immediately. It may persist briefly in backups (see below) before being fully purged.
      </p>

      <h2>Account deletion</h2>
      <p>
        Deleting your account removes your personal data — profile information, uploaded documents, and generated
        content — from active systems within 30 days. Some data may be retained longer where required for legal,
        security, or fraud-prevention purposes (for example, billing records for tax compliance), retained only for
        as long as that specific purpose requires.
      </p>

      <h2>Backups</h2>
      <p>
        Deleted data may remain in encrypted database backups for up to 30 days after deletion, consistent with our
        standard backup rotation, before being permanently purged. Backups are not accessed except for disaster
        recovery.
      </p>

      <h2>Support and communication records</h2>
      <p>
        Support form submissions and related correspondence are retained for up to 24 months to help us track
        recurring issues and improve the product, after which they're deleted or anonymized.
      </p>

      <h2>Placement Engine and sync data</h2>
      <p>
        Internship and job listings synced from third-party sources are refreshed on a rolling basis; expired or
        stale listings are removed from active display. Your saved/bookmarked opportunities persist until you remove
        them or delete your account.
      </p>

      <h2>Analytics data</h2>
      <p>
        Aggregate, de-identified usage analytics may be retained longer than individual account data, since it's not
        tied back to a specific person once aggregated.
      </p>

      <h2>Your right to request earlier deletion</h2>
      <p>
        You can request deletion of specific data ahead of the standard schedule by contacting{" "}
        <a href="mailto:prophezy65@gmail.com">prophezy65@gmail.com</a>. We'll confirm once the request is completed.
      </p>
    </LegalPageShell>
  );
}
