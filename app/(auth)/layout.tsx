import type { ReactNode } from "react";

// AuthCard (rendered by each page's form component) is a complete,
// self-contained page — its own background, wordmark, and card. This
// layout used to also render AuthHero + its own dark wrapper here, which
// is what caused the leftover "readiness ring" panel to show up behind
// every version of the auth card. Nothing else needs to live at this
// level, so it's just a pass-through now.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
