"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

export default function BlogSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set("q", value.trim());
    else params.delete("q");
    router.push(`/blog?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="relative w-full max-w-sm">
      <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search articles…"
        className="w-full rounded-full border border-white/[0.08] bg-white/[0.02] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
      />
    </form>
  );
}
