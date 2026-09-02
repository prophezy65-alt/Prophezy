"use client";

import { use } from "react";
import { InternshipDetailView } from "@/components/internships/InternshipDetailView";

export default function InternshipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <InternshipDetailView internshipId={id} />;
}
