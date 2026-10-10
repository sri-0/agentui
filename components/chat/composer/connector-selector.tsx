"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConnectors } from "@/lib/api/connectors";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { InfoIcon, PlugIcon } from "lucide-react";
import { memo, useState } from "react";

import { ConnectorIcon } from "./connector-icon";

/** Switch the thread's connectors (tool groups) on and off. The choice is
 *  sent with each message and remembered on the thread by the backend. */
export const ConnectorSelector = memo(function ConnectorSelector() {
  const [open, setOpen] = useState(false);
  const { data: connectors = [] } = useConnectors();
  const selected = useUiStore((s) => s.selectedConnectors);
  const setConnectors = useUiStore((s) => s.setConnectors);
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  if (connectors.length === 0) return null;

  const enabled = new Set(selected ?? connectors.map((c) => c.id));
  const toggle = (id: string, on: boolean) => {
    const next = new Set(enabled);
    if (on) next.add(id);
    else next.delete(id);
    // Everything on is stored as "all", so new connectors join automatically.
    setConnectors(next.size === connectors.length ? null : [...next]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Connectors"
              className={cn(
                "flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent",
                selected !== null && "text-foreground",
              )}
            >
              <PlugIcon className="size-4" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Connectors</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-64 p-1">
        {connectors.map((c) => {
          const on = enabled.has(c.id);
          return (
            <div
              key={c.id}
              role="switch"
              aria-checked={on}
              tabIndex={0}
              onClick={() => toggle(c.id, !on)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  toggle(c.id, !on);
                }
              }}
              className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
            >
              <ConnectorIcon name={c.icon} className={cn("size-4 shrink-0", on ? "text-foreground" : "text-muted-foreground")} />
              <span className={cn("flex-1 truncate", !on && "text-muted-foreground")}>{c.name}</span>
              <button
                type="button"
                aria-label={`About ${c.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  openSidepanel({ kind: "connector", connectorId: c.id });
                }}
                className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <InfoIcon className="size-3.5" />
              </button>
              <Switch
                size="sm"
                checked={on}
                onClick={(e) => e.stopPropagation()}
                onCheckedChange={(next) => toggle(c.id, next)}
                className="data-checked:bg-emerald-500"
              />
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
});
