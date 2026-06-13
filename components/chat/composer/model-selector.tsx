"use client";

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
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProviderIcon } from "@/components/provider-icon";
import { useGroupedModels } from "@/lib/api/models";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import {
  BrainIcon,
  BoxIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  EyeIcon,
  WrenchIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function ModelSelector() {
  const [open, setOpen] = useState(false);
  const { groups, isLoading } = useGroupedModels();
  const selectedModel = useUiStore((s) => s.selectedModel);
  const setModel = useUiStore((s) => s.setModel);

  const allModels = useMemo(() => groups.flatMap((g) => g.models), [groups]);
  const current = allModels.find((m) => m.id === selectedModel);

  // default to first model once loaded
  useEffect(() => {
    if (!selectedModel && allModels.length > 0) {
      setModel(allModels[0].id);
    }
  }, [selectedModel, allModels, setModel]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex h-9 max-w-[220px] items-center gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors",
                "hover:bg-accent hover:text-foreground",
              )}
            >
              {current ? (
                <ProviderIcon modelId={current.id} className="size-4" />
              ) : (
                <BoxIcon className="size-4 shrink-0" />
              )}
              <span className="truncate">
                {current?.name ??
                  current?.id ??
                  (isLoading ? "Loading…" : "Select model")}
              </span>
              <ChevronsUpDownIcon className="size-3.5 shrink-0 opacity-60" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Choose model</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-[340px] p-0">
        <Command>
          <CommandInput placeholder="Search models…" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>No models found.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.providerId} heading={group.providerName}>
                {group.models.map((m) => (
                  <CommandItem
                    key={m.id}
                    value={`${m.name ?? ""} ${m.id}`}
                    onSelect={() => {
                      setModel(m.id);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <CheckIcon
                      className={cn(
                        "size-4 shrink-0",
                        selectedModel === m.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <ProviderIcon
                      modelId={m.id}
                      className="size-4 text-muted-foreground"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm">
                        {m.name ?? m.id}
                      </span>
                      <span className="truncate font-mono text-[10px] text-muted-foreground">
                        {m.id}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
                      {m.vision && <EyeIcon className="size-3" />}
                      {m.tools && <WrenchIcon className="size-3" />}
                      {m.reasoning && <BrainIcon className="size-3" />}
                      {m.context_length ? (
                        <Badge
                          variant="secondary"
                          className="rounded px-1 py-0 text-[9px]"
                        >
                          {Math.round(m.context_length / 1000)}k
                        </Badge>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
