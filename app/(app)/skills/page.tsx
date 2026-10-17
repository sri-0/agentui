import { SkillsView } from "@/components/skills/skills-view";
import { Suspense } from "react";

export default function SkillsPage() {
  // The view reads the chosen category and source from the URL.
  return (
    <Suspense>
      <SkillsView />
    </Suspense>
  );
}
