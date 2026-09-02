import { Card } from "@/components/ui/card";
import type { LiveAnalyticsData } from "@/lib/settings/types";

export function AnalyticsSection({ analytics }: { analytics: LiveAnalyticsData }) {
  const items: { label: string; value: string }[] = [
    { label: "Today's requests", value: String(analytics.requestsToday) },
    { label: "Monthly requests", value: String(analytics.requestsThisMonth) },
    { label: "Tokens this month", value: analytics.tokensThisMonth.toLocaleString() },
    { label: "Projects generated", value: String(analytics.projectsGenerated) },
    { label: "Assignments generated", value: String(analytics.assignmentsGenerated) },
    { label: "Research generated", value: String(analytics.researchGenerated) },
    { label: "Quiz generated", value: String(analytics.quizGenerated) },
    { label: "Interview sessions", value: String(analytics.interviewSessions) },
    { label: "Resume scans", value: String(analytics.resumeScans) },
    { label: "Bookmarks", value: String(analytics.bookmarks) },
    { label: "Study hours (7d)", value: analytics.studyHours.toFixed(1) },
  ];

  return (
    <Card>
      <h2 className="font-display text-lg font-medium text-ink">Live Analytics</h2>
      <p className="mt-1 text-xs text-mist">Calculated directly from your data — nothing here is estimated.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-border/60 bg-ink/[0.02] p-4">
            <p className="font-display text-2xl text-ink">{item.value}</p>
            <p className="mt-0.5 text-xs text-mist">{item.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
