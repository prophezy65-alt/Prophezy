"use client";

import { ResearchToastProvider } from "@/components/research/ResearchToast";
import { ResearchPageClient } from "@/components/research/ResearchPageClient";

export default function ResearchPapersPage() {
  return (
    <ResearchToastProvider>
      <div className="w-full px-4 py-8 lg:px-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-medium text-ink">Research AI</h1>
          <p className="mt-1 text-sm text-mist">
            Upload papers for OCR, summaries, and citation extraction — search academic sources, explore a topic, and
            chat with your library grounded in the actual text.
          </p>
        </div>
        <ResearchPageClient />
      </div>
    </ResearchToastProvider>
  );
}
