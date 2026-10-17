import { SkillPage } from "@/components/skills/skill-page";
import { Suspense } from "react";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The page reads the list's filters from the URL, to go back to them.
  return (
    <Suspense>
      <SkillPage id={id} />
    </Suspense>
  );
}
