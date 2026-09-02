import type { Compensation, WorkMode, EmploymentType } from "@/lib/internships/types";

export function formatStipend(comp: Compensation): string {
  if (comp.isUnpaid) return "Unpaid";
  if (comp.normalizedMonthlyInr) {
    const amount = comp.normalizedMonthlyInr;
    const display = amount >= 1000 ? `₹${Math.round(amount / 1000)}k` : `₹${Math.round(amount)}`;
    return `${display}/mo`;
  }
  if (comp.raw) return comp.raw;
  return "Stipend not disclosed";
}

export function formatDeadline(deadlineAt: string | null): { label: string; urgent: boolean; expired: boolean } {
  if (!deadlineAt) return { label: "No deadline listed", urgent: false, expired: false };

  const days = Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: "Deadline passed", urgent: false, expired: true };
  if (days === 0) return { label: "Deadline today", urgent: true, expired: false };
  if (days === 1) return { label: "1 day left", urgent: true, expired: false };
  if (days <= 5) return { label: `${days} days left`, urgent: true, expired: false };
  return { label: `${days} days left`, urgent: false, expired: false };
}

export function formatPostedAt(postedAt: string | null): string {
  if (!postedAt) return "";
  const days = Math.floor((Date.now() - new Date(postedAt).getTime()) / 86_400_000);
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 7) return `Posted ${days}d ago`;
  if (days < 30) return `Posted ${Math.floor(days / 7)}w ago`;
  return `Posted ${Math.floor(days / 30)}mo ago`;
}

export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
};

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  internship: "Internship",
  apprenticeship: "Apprenticeship",
  co_op: "Co-op",
  trainee: "Traineeship",
  fellowship: "Fellowship",
  part_time: "Part-time",
  full_time: "Full-time",
  contract: "Contract",
  volunteer: "Volunteer",
};

export function formatLocation(location: { city: string | null; state: string | null; country: string | null; raw: string | null }): string {
  const parts = [location.city, location.state, location.country].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return location.raw ?? "Location not specified";
}

export function matchScoreTone(score: number): "success" | "signal" | "neutral" {
  if (score >= 80) return "success";
  if (score >= 50) return "signal";
  return "neutral";
}
