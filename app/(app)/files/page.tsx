import { FilesView } from "@/components/files/files-view";
import { Suspense } from "react";

export default function FilesPage() {
  // The view reads the chosen workspace from the URL.
  return (
    <Suspense>
      <FilesView />
    </Suspense>
  );
}
