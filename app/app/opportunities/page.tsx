import { Suspense } from "react";
import { OpportunitiesView } from "@/components/internships/OpportunitiesView";

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={null}>
      <OpportunitiesView />
    </Suspense>
  );
}
