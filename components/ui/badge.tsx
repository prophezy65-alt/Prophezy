import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        signal: "bg-signal/10 text-signal",
        pulse: "bg-pulse/15 text-pulse",
        success: "bg-success/10 text-success",
        danger: "bg-danger/10 text-danger",
        neutral: "bg-ink/5 text-mist",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
