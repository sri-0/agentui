"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageIcon, MessageSquareIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo } from "react";

/** What a new conversation is for: a chat, or images (the images agent). */
export type ChatMode = "chat" | "images";

/** Each mode's new-conversation page. */
const PATHS: Record<ChatMode, string> = { chat: "/chat", images: "/images" };

/**
 * The Chat | Images switch pinned to the top of the new-conversation page: it
 * switches the page's mode, replacing the route so Back leaves the page. A
 * conversation has none; its agent sets its mode. Its parent is relative.
 */
export const ModeToggle = memo(function ModeToggle({ mode }: { mode: ChatMode }) {
  const router = useRouter();
  return (
    <Tabs
      value={mode}
      onValueChange={(m) => router.replace(PATHS[m as ChatMode])}
      className="sm:absolute sm:left-1/2 sm:-translate-x-1/2"
    >
      <TabsList className="h-9 rounded-full p-1">
        <TabsTrigger value="chat" className="rounded-full px-3 sm:px-4 dark:data-active:border-transparent">
          <MessageSquareIcon className="hidden sm:block" /> Chat
        </TabsTrigger>
        <TabsTrigger value="images" className="rounded-full px-3 sm:px-4 dark:data-active:border-transparent">
          <ImageIcon className="hidden sm:block" /> Images
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
});
