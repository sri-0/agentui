"use client";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThreadIdContext } from "@/lib/chat/thread-context";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { CheckIcon, ChevronsUpDownIcon, LockIcon, ShieldIcon } from "lucide-react";
import { memo, useContext, useState } from "react";

/** The control sets a conversation can be made under. */
const CONTROLSETS = Array.from({ length: 21 }, (_, i) => `C${1000 + i}`);

/** Picks the control set a new conversation is made under; every request
 *  carries it (`currentControlset`). A thread's is fixed when it is created,
 *  so in a thread it shows the thread's, locked. */
export const ControlsetSelector = memo(function ControlsetSelector() {
  const [open, setOpen] = useState(false);
  const inThread = useContext(ThreadIdContext) !== null;
  const selected = useUiStore((s) => (inThread ? s.threadControlset : s.selectedControlset));
  const setControlset = useUiStore((s) => s.setControlset);

  return (
    <Popover open={open} onOpenChange={inThread ? undefined : setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Control set: ${selected ?? "none"}`}
              aria-disabled={inThread}
              className={cn(
                "flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors",
                selected ? "text-foreground" : "text-muted-foreground",
                !inThread && "hover:bg-accent hover:text-foreground",
              )}
            >
              <ShieldIcon className="size-4 shrink-0" />
              <span className="truncate">{selected ?? "Control set"}</span>
              {inThread ? (
                <LockIcon className="size-3.5 shrink-0 opacity-60" />
              ) : (
                <ChevronsUpDownIcon className="size-3.5 shrink-0 opacity-60" />
              )}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{inThread ? "Control set, fixed when the conversation was created" : "Choose control set"}</TooltipContent>
      </Tooltip>
      {open && (
        <PopoverContent align="start" className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search control sets…" />
            <CommandList className="max-h-[320px]">
              <CommandEmpty>No control sets found.</CommandEmpty>
              <CommandGroup>
                {CONTROLSETS.map((id) => (
                  <CommandItem
                    key={id}
                    value={id}
                    onSelect={() => {
                      setControlset(id);
                      setOpen(false);
                    }}
                    className="gap-2"
                  >
                    <CheckIcon className={cn("size-4 shrink-0", selected === id ? "opacity-100" : "opacity-0")} />
                    {id}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      )}
    </Popover>
  );
});
