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
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { BotIcon, CheckIcon, ChevronsUpDownIcon, NetworkIcon } from "lucide-react";
import { useState } from "react";

export function AgentSelector() {
  const [open, setOpen] = useState(false);
  const { data: agents = [] } = useAgents();
  const selectedAgentId = useUiStore((s) => s.selectedAgentId);
  const setAgent = useUiStore((s) => s.setAgent);

  const current = agents.find((a) => a.id === selectedAgentId);

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
                current ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
            >
              <BotIcon
                className={cn(
                  "size-4 shrink-0",
                  current && "text-[var(--ai-from)]",
                )}
              />
              <span className="truncate">{current?.name ?? "No agent"}</span>
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
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
