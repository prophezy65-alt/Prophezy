import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CareerGuidanceClient from "@/components/dashboard/career/CareerGuidanceClient";

export default async function CareerGuidancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <CareerGuidanceClient />;
}
