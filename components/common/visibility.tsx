"use client";

import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { LockIcon, UsersIcon } from "lucide-react";
import { useId } from "react";

/**
 * Who can see a conversation, a workspace or a file (agentlite docs/AUTH.md,
 * Visibility; the record's `is_shared`): Public, everyone with access to its
 * control set, or Only me, its creator alone.
 */

/** The form control: Only me or Public, and what that means here. */
export function VisibilityField({
  value,
  onChange,
  disabled,
  label = "Who can see it",
}: {
  value: boolean;
  onChange: (shared: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  const id = useId();
  const controlset = useUiStore((s) => s.threadControlset ?? s.selectedControlset);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium" id={id}>
        {label}
      </span>
      <ToggleGroup
        type="single"
        variant="outline"
        value={value ? "public" : "private"}
        onValueChange={(v) => v && onChange(v === "public")}
        disabled={disabled}
        aria-labelledby={id}
        className="w-full"
      >
        <ToggleGroupItem value="private" className="flex-1">
          <LockIcon /> Only me
        </ToggleGroupItem>
        <ToggleGroupItem value="public" className="flex-1">
          <UsersIcon /> Public
        </ToggleGroupItem>
      </ToggleGroup>
      <p className="text-xs text-muted-foreground">
        {value ? `Everyone with access to ${controlset ?? "the control set"} can see it.` : "Only you can see it."}
      </p>
    </div>
  );
}

/** The badge on a card or a page, when there is something to say: Only me
 *  (a lock), or shared by someone else. Public and the user's own is the
 *  usual case, and says nothing. */
export function VisibilityBadge({
  shared,
  mine,
  by,
  className,
}: {
  shared: boolean;
  mine: boolean;
  by?: string;
  className?: string;
}) {
  if (shared && mine) return null;
  return (
    <Badge variant="outline" className={cn("gap-1 text-muted-foreground", className)}>
      {shared ? <UsersIcon /> : <LockIcon />}
      {shared ? `Shared by ${by ?? "someone"}` : "Only me"}
    </Badge>
  );
}
