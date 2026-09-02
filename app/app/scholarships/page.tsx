"use client";
import { Award } from "lucide-react";
import EmptyState from "@/components/dashboard/EmptyState";

export default function ScholarshipsPage() {
  return <EmptyState icon={Award} title="Scholarships" description="AI-matched scholarships based on your eligibility profile." />;
}
