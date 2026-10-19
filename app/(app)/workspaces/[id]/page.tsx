import { WorkspaceView } from "@/components/workspaces/workspace-view";
import { Suspense } from "react";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The view reads the open tab from the URL.
  return (
    <Suspense>
      <WorkspaceView id={id} />
    </Suspense>
  );
}
