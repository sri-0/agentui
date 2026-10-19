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
import { hasCapability, type ModelUse, useGroupedModels } from "@/lib/api/models";
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
import { memo, useEffect, useMemo, useState } from "react";

/** Picks the chat's model, or with use "image" the model images are made with. */
export const ModelSelector = memo(function ModelSelector({ use = "chat" }: { use?: ModelUse }) {
  const [open, setOpen] = useState(false);
  const { groups, isLoading } = useGroupedModels(use);
  const selectedModel = useUiStore((s) => (use === "image" ? s.selectedImageModel : s.selectedModel));
  const setModel = useUiStore((s) => (use === "image" ? s.setImageModel : s.setModel));

  const allModels = useMemo(() => groups.flatMap((g) => g.models), [groups]);
  const current = allModels.find((m) => m.id === selectedModel);

  // Default to the first model once loaded; a persisted selection the backend
  // no longer serves is replaced the same way.
  useEffect(() => {
    if (allModels.length > 0 && !current) {
      setModel(allModels[0].id);
    }
  }, [current, allModels, setModel]);

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
        <TooltipContent>{use === "image" ? "Choose image model" : "Choose model"}</TooltipContent>
      </Tooltip>
      {/* Only build the (large) model list while the popover is open — when
          closed this whole subtree is skipped, so renders stay cheap. */}
      {open && (
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
                      {hasCapability(m, "vision") && <EyeIcon className="size-3" />}
                      {hasCapability(m, "tool_calling") && <WrenchIcon className="size-3" />}
                      {hasCapability(m, "reasoning") && <BrainIcon className="size-3" />}
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
      )}
    </Popover>
  );
});
