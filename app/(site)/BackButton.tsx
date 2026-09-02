"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white"
      style={{ fontFamily: "var(--font-mono)" }}
      aria-label="Go back"
    >
      <ArrowLeft size={14} />
      Back
    </button>
  );
}
