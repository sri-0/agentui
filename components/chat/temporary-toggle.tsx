"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { MessageCircleDashedIcon } from "lucide-react";

/** Temporary-chat toggle, shown in the top nav bar. */
export function TemporaryToggle() {
  const temporary = useUiStore((s) => s.temporary);
  const setTemporary = useUiStore((s) => s.setTemporary);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setTemporary(!temporary)}
          aria-pressed={temporary}
          className={cn(
            "size-9 rounded-full text-muted-foreground",
            temporary && "bg-accent text-foreground",
          )}
        >
          <MessageCircleDashedIcon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {temporary ? "Temporary chat is on" : "Temporary chat"}
      </TooltipContent>
    </Tooltip>
  );
}
