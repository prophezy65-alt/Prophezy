import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StudyHubClient from "@/components/dashboard/study-hub/StudyHubClient";

export default async function StudyHubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

  return <StudyHubClient firstName={(profile?.full_name ?? "").split(" ")[0] || null} />;
}
