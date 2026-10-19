import { ArtifactsView } from "@/components/artifacts/artifacts-view";
import { Suspense } from "react";

export default function ArtifactsPage() {
  // The view reads the open artifact from the URL.
  return (
    <Suspense>
      <ArtifactsView />
    </Suspense>
  );
}
