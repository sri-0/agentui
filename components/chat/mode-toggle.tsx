"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageIcon, MessageSquareIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { memo } from "react";

/** What a conversation is for: a chat, or images (the images agent). */
export type ChatMode = "chat" | "images";

/** Each mode's new-conversation page. */
const PATHS: Record<ChatMode, string> = { chat: "/chat", images: "/images" };

/**
 * The Chat | Images switch, pinned to the top of the chat screens. On a
 * new-conversation page it switches the page's mode (replacing the route, so
 * Back leaves the page); in a conversation it shows the conversation's mode,
 * and the other one starts a new conversation in it. Its parent is relative.
 */
export const ModeToggle = memo(function ModeToggle({ mode }: { mode: ChatMode }) {
  const router = useRouter();
  const onNewPage = Object.values(PATHS).includes(usePathname());
  const go = (m: string) => {
    const path = PATHS[m as ChatMode];
    if (onNewPage) router.replace(path);
    else router.push(path);
  };
  return (
    <Tabs value={mode} onValueChange={go} className="sm:absolute sm:left-1/2 sm:-translate-x-1/2">
      <TabsList className="h-9 rounded-full p-1">
        <TabsTrigger value="chat" className="rounded-full px-3 sm:px-4">
          <MessageSquareIcon className="hidden sm:block" /> Chat
        </TabsTrigger>
        <TabsTrigger value="images" className="rounded-full px-3 sm:px-4">
          <ImageIcon className="hidden sm:block" /> Images
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
});
