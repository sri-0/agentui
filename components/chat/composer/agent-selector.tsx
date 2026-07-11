"use client";

import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAgents } from "@/lib/api/agents";
import { modelSupportsTools, useSelectedModel } from "@/lib/api/models";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import {
  BotIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  InfoIcon,
  NetworkIcon,
  SparklesIcon,
} from "lucide-react";
import { memo, useState } from "react";

export const AgentSelector = memo(function AgentSelector() {
  const [open, setOpen] = useState(false);
  const { data: agents = [] } = useAgents();
  const selectedAgentId = useUiStore((s) => s.selectedAgentId);
  const setAgent = useUiStore((s) => s.setAgent);
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  const model = useSelectedModel();

  const isAuto = selectedAgentId === "auto";
  const current = agents.find((a) => a.id === selectedAgentId);

  // Agents drive tool calls — only offer the picker when the model supports them.
  if (!modelSupportsTools(model)) return null;

  const triggerLabel = isAuto ? "Auto" : (current?.name ?? "No agent");
  const active = isAuto || !!current;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex h-9 max-w-[220px] items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-foreground",
                active ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
            >
              {isAuto ? (
                <SparklesIcon className="size-4 shrink-0 text-[var(--ai-from)]" />
              ) : (
                <BotIcon
                  className={cn(
                    "size-4 shrink-0",
                    current && "text-[var(--ai-from)]",
                  )}
                />
              )}
              <span className="truncate">{triggerLabel}</span>
              <ChevronsUpDownIcon className="size-3.5 shrink-0 opacity-60" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Choose agent</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-[320px] p-0">
        <Command>
          <CommandInput placeholder="Search agents…" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>No agents available.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="auto"
                onSelect={() => {
                  setAgent("auto");
                  setOpen(false);
                }}
                className="flex items-start gap-2"
              >
                <CheckIcon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    isAuto ? "opacity-100" : "opacity-0",
                  )}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5 truncate text-sm">
                    <SparklesIcon className="size-3.5 text-[var(--ai-from)]" />
                    Auto
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    Automatically pick the best agent for each message
                  </span>
                </div>
              </CommandItem>
              <CommandItem
                value="no-agent"
                onSelect={() => {
                  setAgent(null);
                  setOpen(false);
                }}
                className="flex items-center gap-2"
              >
                <CheckIcon
                  className={cn(
                    "size-4",
                    selectedAgentId ? "opacity-0" : "opacity-100",
                  )}
                />
                <span className="text-sm">No agent (plain model)</span>
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Agents">
              {agents.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.name} ${a.id}`}
                  onSelect={() => {
                    setAgent(a.id);
                    setOpen(false);
                  }}
                  className="flex items-start gap-2"
                >
                  <CheckIcon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      selectedAgentId === a.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5 truncate text-sm">
                      {a.name}
                      {a.sub_agents && a.sub_agents.length > 0 && (
                        <Badge
                          variant="secondary"
                          className="gap-1 rounded px-1 py-0 text-[9px]"
                        >
                          <NetworkIcon className="size-2.5" />
                          {a.sub_agents.length}
                        </Badge>
                      )}
                    </span>
                    {a.description && (
                      <span className="truncate text-[11px] text-muted-foreground">
                        {a.description}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    title="Agent details"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      openSidepanel({ kind: "agent-details", agentId: a.id });
                      setOpen(false);
                    }}
                    className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <InfoIcon className="size-3.5" />
                  </button>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
