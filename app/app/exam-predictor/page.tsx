import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ExamPredictorClient from "@/components/exam-predictor/ExamPredictorClient";

export default async function ExamPredictorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <ExamPredictorClient />;
}
