"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { getDeviceId } from "./deviceId";

const ACCENT = "#5ff2ff";

export default function LikeButton({ slug, initialCount }: { slug: string; initialCount: number }) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const deviceId = getDeviceId();
    const supabase = getBrowserSupabase();
    (supabase.rpc as any)("get_blog_like_state", { p_slug: slug, p_device_id: deviceId })
      .then(({ data }: { data: any }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          setLiked(Boolean(row.liked));
          setCount(row.like_count ?? initialCount);
        }
      })
      .catch(() => {
        /* non-critical — like state just won't be pre-checked */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    const deviceId = getDeviceId();
    const supabase = getBrowserSupabase();

    // Optimistic update
    setLiked((prev) => !prev);
    setCount((prev) => prev + (liked ? -1 : 1));

    const { data, error } = await (supabase.rpc as any)("toggle_blog_like", { p_slug: slug, p_device_id: deviceId });
    if (!error && data) {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setLiked(Boolean(row.liked));
        setCount(row.like_count ?? count);
      }
    }
    setBusy(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-full border border-white/[0.08] px-3.5 py-1.5 text-xs transition-colors hover:border-white/20 disabled:opacity-60"
      style={{ fontFamily: "var(--font-mono)" }}
      aria-pressed={liked}
    >
      <Heart size={13} fill={liked ? ACCENT : "none"} stroke={liked ? ACCENT : "currentColor"} />
      <span className={liked ? "" : "text-white/60"} style={liked ? { color: ACCENT } : undefined}>
        {count}
      </span>
    </button>
  );
}