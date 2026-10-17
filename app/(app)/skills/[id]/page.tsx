import { SkillPage } from "@/components/skills/skill-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SkillPage id={id} />;
}
