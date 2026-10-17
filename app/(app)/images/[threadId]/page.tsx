import { ImagesView } from "@/components/images/images-view";

export default async function ImagesThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  return <ImagesView key={threadId} threadId={threadId} />;
}
