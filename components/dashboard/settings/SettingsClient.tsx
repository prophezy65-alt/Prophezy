"use client";

import { AlertTriangle, LogOut, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";
import type { CreditSummary } from "@/lib/credits";

// Dark grey palette
const INK = "#EDEBF2";
const MUTED = "#9694A8";
const MAGENTA = "#FF006E";
const GOLD = "#FFD60A";
const ACCENT_GRADIENT = `linear-gradient(135deg, ${MAGENTA}, ${GOLD})`;

interface SettingsClientProps {
  profile: { fullName: string; email: string };
  /** Real value from lib/credits' getCreditSummary(userId) — server-fetched
   * in app/app/settings/page.tsx using the authenticated session, never a
   * client-supplied user id. null means either the row doesn't exist yet
   * (brand-new account edge case, the DB trigger normally prevents this) or
   * the credit_system migrations haven't been applied to this Supabase
   * project yet — the UI tells those two cases apart below rather than
   * silently showing zeros. */
  creditSummary: CreditSummary | null;
  /** Internship application unlock allowance/status for this billing
   * period. Both fields are null for plans with no cap (Premium today) —
   * render that as "Unlimited", never as 0 or a placeholder number. */
  applicationUnlocks: { allowance: number | null; remaining: number | null };
}

export default function SettingsClient({ profile, creditSummary, applicationUnlocks }: SettingsClientProps) {
  return (
    <div
      className="min-h-screen w-full p-5 sm:p-8"
      style={{ background: "linear-gradient(160deg, #201F29 0%, #1C1B24 50%, #18171F 100%)" }}
    >
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: INK }}>
            Settings
          </h1>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>
            Your account and plan.
          </p>
        </div>

        {/* Profile */}
        <GlassCard>
          <SectionHeading title="Profile" description="Your account details." />
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3.5">
              <div
                className="flex shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
                style={{ background: ACCENT_GRADIENT, width: 52, height: 52 }}
              >
                {profile.fullName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-medium" style={{ color: INK }}>
                  {profile.fullName}
                </p>
                <p className="truncate text-sm" style={{ color: MUTED }}>
                  {profile.email}
                </p>
              </div>
            </div>
            <LogoutButton className="flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-[#4A4858] bg-[#3A3846]/80 px-4 !text-sm font-medium !text-[#EDEBF2] transition-all hover:!text-white hover:shadow-md hover:!bg-[#2B2A4C] hover:!border-transparent">
              <LogOut size={13} /> Log out
            </LogoutButton>
          </div>
        </GlassCard>

        {/* Plan + Credits */}
        <GlassCard>
          <div className="flex items-center justify-between">
            <SectionHeading title="Plan & Credit Usage" description="Your real plan and usage — nothing estimated." />
            {creditSummary && (
              <span className="rounded-full px-3 py-1 text-xs font-medium capitalize text-white" style={{ background: ACCENT_GRADIENT }}>
                {creditSummary.planName}
              </span>
            )}
          </div>

          {creditSummary ? (
            <>
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <StatBlock label="Remaining" value={creditSummary.creditsRemaining} />
                <StatBlock label="Used" value={creditSummary.creditsUsedThisPeriod} />
                <StatBlock label="Allowance" value={creditSummary.monthlyCredits} />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs" style={{ color: MUTED }}>
                  <span>Usage this period</span>
                  <span>{creditSummary.usagePercentage}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, creditSummary.usagePercentage)}%`, background: ACCENT_GRADIENT }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs" style={{ color: MUTED }}>
                <span className="capitalize">Status: {creditSummary.subscriptionStatus}</span>
                <span>{creditSummary.currentPeriodEnd ? `Renews ${new Date(creditSummary.currentPeriodEnd).toLocaleDateString()}` : "No renewal date set"}</span>
              </div>

              {creditSummary.planId === "premium" ? (
                <Link
                  href="/#pricing"
                  className="group flex items-center justify-between gap-3 rounded-xl border border-[#4A4858] bg-[#3A3846]/60 px-4 py-3 transition-colors hover:border-[#5A5868]"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles size={15} style={{ color: MUTED }} />
                    <p className="text-xs" style={{ color: MUTED }}>
                      You&apos;re on Premium — the highest plan, with the full platform unlocked.
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium" style={{ color: INK }}>
                    View plans
                    <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ) : (
                <Link
                  href="/#pricing"
                  className="group flex items-center justify-between gap-3 rounded-xl p-4 text-white transition-transform hover:-translate-y-0.5"
                  style={{ background: ACCENT_GRADIENT }}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                      <Sparkles size={16} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">
                        {creditSummary.planId === "free" ? "Upgrade your plan" : "You're one step from Premium"}
                      </p>
                      <p className="text-xs text-white/80">
                        {creditSummary.planId === "free"
                          ? "More credits, the full research library, and priority AI — from ₹75/month."
                          : "Unlimited internship unlocks and the full platform, unlocked — from ₹100/month."}
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={17} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-[#4A4858] bg-[#3A3846]/60 p-3.5">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: MUTED }} />
              <div className="text-sm">
                <p style={{ color: INK }}>Couldn&apos;t load your credit balance.</p>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: MUTED }}>
                  The credit system exists in code, but no data came back for your account. This usually means the
                  <code className="mx-1 rounded bg-white/10 px-1 py-0.5">credit_system_*</code>
                  migrations haven&apos;t been applied to this Supabase project yet — check Table Editor for
                  <code className="mx-1 rounded bg-white/10 px-1 py-0.5">credit_balances</code> and
                  <code className="mx-1 rounded bg-white/10 px-1 py-0.5">credit_summary</code>.
                </p>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Application Unlocks */}
        <GlassCard>
          <SectionHeading title="Application Unlocks" description="Internship applications you can unlock this period." />
          <div className="grid grid-cols-2 gap-2.5 text-center">
            <div className="rounded-xl border border-[#4A4858]/60 bg-[#3A3846]/70 py-2.5">
              <p className="text-lg font-semibold" style={{ color: INK }}>
                {applicationUnlocks.remaining === null ? "Unlimited" : applicationUnlocks.remaining.toLocaleString()}
              </p>
              <p className="text-[11px]" style={{ color: MUTED }}>
                Remaining
              </p>
            </div>
            <div className="rounded-xl border border-[#4A4858]/60 bg-[#3A3846]/70 py-2.5">
              <p className="text-lg font-semibold" style={{ color: INK }}>
                {applicationUnlocks.allowance === null ? "Unlimited" : applicationUnlocks.allowance.toLocaleString()}
              </p>
              <p className="text-[11px]" style={{ color: MUTED }}>
                Allowance
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#4A4858]/60 bg-[#3A3846]/70 py-2.5">
      <p className="text-lg font-semibold" style={{ color: INK }}>
        {value.toLocaleString()}
      </p>
      <p className="text-[11px]" style={{ color: MUTED }}>
        {label}
      </p>
    </div>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="space-y-3.5 rounded-2xl border border-[#4A4858]/60 bg-[#33313E]/85 p-5 backdrop-blur-xl sm:p-6"
      style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }}
    >
      {children}
    </div>
  );
}

function AccentDot() {
  return <span className="inline-block h-3.5 w-1 rounded-full" style={{ background: ACCENT_GRADIENT }} />;
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <AccentDot />
      <div>
        <h2 className="text-[15px] font-semibold" style={{ color: INK }}>
          {title}
        </h2>
        <p className="mt-0.5 text-xs" style={{ color: MUTED }}>
          {description}
        </p>
      </div>
    </div>
  );
}
