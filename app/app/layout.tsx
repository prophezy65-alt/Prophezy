import type { ReactNode } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";
import MobileNavigation from "@/components/dashboard/MobileNavigation";
import CommandPalette from "@/components/dashboard/CommandPalette";
import ProphezyAssistant from "@/components/dashboard/ProphezyAssistant";
import SessionGuard from "@/components/auth/SessionGuard";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <SessionGuard />
      <Sidebar />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar />

        <main className="flex-1 px-5 pb-24 pt-6 lg:px-10 lg:pb-10 lg:pt-8">{children}</main>
      </div>

      <MobileNavigation />
      <CommandPalette />
      <ProphezyAssistant />
    </div>
  );
}
