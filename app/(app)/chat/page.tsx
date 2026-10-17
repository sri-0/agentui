import { LandingView } from "@/components/chat/landing-view";
import { Suspense } from "react";

export default function ChatLandingPage() {
  // The view reads a draft prompt from the URL.
  return (
    <Suspense>
      <LandingView />
    </Suspense>
  );
}
