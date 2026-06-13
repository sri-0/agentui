"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type ReasoningEffort, useUiStore } from "@/stores/ui-store";
import { CheckIcon, ChevronDownIcon, GaugeIcon } from "lucide-react";

const OPTIONS: { value: ReasoningEffort; label: string; hint: string }[] = [
  { value: "off", label: "No reasoning", hint: "Fastest, no extended thinking" },
  { value: "low", label: "Low", hint: "A little thinking" },
  { value: "medium", label: "Medium", hint: "Balanced" },
  { value: "high", label: "High", hint: "Deepest reasoning" },
];

export function ReasoningEffortSelector() {
  const effort = useUiStore((s) => s.reasoningEffort);
  const setEffort = useUiStore((s) => s.setReasoningEffort);
  const active = OPTIONS.find((o) => o.value === effort) ?? OPTIONS[0];
  const on = effort !== "off";

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-foreground",
                on ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
            >
              <GaugeIcon
                className={cn("size-4", on && "text-[var(--ai-from)]")}
              />
              <span className="hidden sm:inline">
                {on ? `Reasoning: ${active.label}` : "Reasoning"}
              </span>
              <ChevronDownIcon className="size-3.5 opacity-60" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Reasoning effort</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Reasoning effort</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onSelect={() => setEffort(o.value)}
            className="flex items-start gap-2"
          >
            <CheckIcon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                effort === o.value ? "opacity-100" : "opacity-0",
              )}
            />
            <div className="flex flex-col">
              <span className="text-sm">{o.label}</span>
              <span className="text-xs text-muted-foreground">{o.hint}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
