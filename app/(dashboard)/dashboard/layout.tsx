import { Dock } from "@/components/ui/dock";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-signal-glow bg-pulse-glow">
      <Dock />
      <div className="absolute right-6 top-6 z-40">
        <ThemeToggle />
      </div>
      <main className="mx-auto max-w-6xl px-6 pb-28 pt-10 md:pb-10 md:pl-28">
        {children}
      </main>
    </div>
  );
}
