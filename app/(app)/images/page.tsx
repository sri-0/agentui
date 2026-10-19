import { LandingView } from "@/components/chat/landing-view";
import { Suspense } from "react";

export default function ImagesPage() {
  // The new-conversation page in its images mode; it reads a draft prompt from the URL.
  return (
    <Suspense>
      <LandingView mode="images" />
    </Suspense>
  );
}
