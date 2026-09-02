import { createClient } from "@/lib/supabase/server";
import { getLiveUserContext } from "@/lib/dashboard/live-context";
import AppHomeClient from "./AppHomeClient";

export default async function AppHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const ctx = await getLiveUserContext(supabase, userId);

  return (
    <AppHomeClient
      firstName={ctx.fullName?.split(" ")[0] ?? null}
      streak={ctx.streak}
      resumeStats={ctx.resumeStats}
      interviewStats={ctx.interviewStats}
      cardsDue={ctx.cardsDue}
      researchCount={ctx.researchCount}
      assignmentsCount={ctx.assignmentsCount}
      projectStats={ctx.projectStats}
      weeklyActivity={ctx.weeklyActivity}
      recentActivity={ctx.recentActivity}
      nextAction={ctx.nextAction}
    />
  );
}
