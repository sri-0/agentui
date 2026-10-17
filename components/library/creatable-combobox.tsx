"use client";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

/** A field whose value is one of the options, or a new one typed in: the
 *  shadcn combobox (Popover + Command) with a "Create" entry. */
export function CreatableCombobox({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const typed = query.trim();
  const known = options.some((o) => o.toLowerCase() === typed.toLowerCase());
  const pick = (v: string) => {
    onChange(v);
    setQuery("");
    setOpen(false);
  };
  return (
    <Popover
      modal // inside a dialog, so its list scrolls
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value || <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search or create…" />
          <CommandList>
            <CommandEmpty>Type a name to create it.</CommandEmpty>
            <CommandGroup>
              {value && <CommandItem onSelect={() => pick("")}>None</CommandItem>}
              {options.map((o) => (
                <CommandItem key={o} value={o} onSelect={() => pick(o)}>
                  <CheckIcon className={cn(value !== o && "opacity-0")} />
                  {o}
                </CommandItem>
              ))}
              {typed && !known && (
                <CommandItem forceMount value={`create ${typed}`} onSelect={() => pick(typed)}>
                  <PlusIcon /> Create “{typed}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
