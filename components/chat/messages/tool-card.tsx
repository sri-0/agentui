"use client";

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChatDataParts, ChatMessage } from "@/lib/chat/types";
import {
  CheckIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useResolveInterrupt } from "../interrupt-context";

type ToolPart = Extract<ChatMessage["parts"][number], { type: "dynamic-tool" }>;
type Interrupt = ChatDataParts["tool-interrupt"];

/**
 * Renders a tool call card, with HITL approval merged in: while the tool part is
 * in the native `approval-requested` state (and not yet resolved) the card shows
 * an amber outline, the params, and Approve/Deny. After resolution it reverts to
 * the normal outline + running/completed state, keeping an Approved/Rejected tag.
 */
export function ToolCard({
  part,
  interrupt,
}: {
  part: ToolPart;
  interrupt?: Interrupt;
}) {
  const resolveInterrupt = useResolveInterrupt();
  const pending = part.state === "approval-requested" && !interrupt?.resolved;
  const [open, setOpen] = useState(pending);
  const [submitting, setSubmitting] = useState(false);

  // Open the card while it needs approval (so the buttons are visible), then
  // collapse it once the decision is made. After that the user can toggle freely.
  useEffect(() => {
    if (pending) setOpen(true);
    else if (interrupt?.resolved) setOpen(false);
  }, [pending, interrupt?.resolved]);

  const resolve = async (action: "approved" | "denied") => {
    if (!resolveInterrupt || !interrupt || submitting) return;
    setSubmitting(true);
    try {
      await resolveInterrupt(
        interrupt.toolCallId,
        interrupt.threadId ?? "",
        action,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resolved = interrupt?.resolved;
  const extraBadge = resolved ? (
    <Badge variant="secondary" className="gap-1 rounded-full text-xs">
      {resolved === "approved" ? (
        <>
          <ShieldCheckIcon className="size-3 text-emerald-500" /> Approved
        </>
      ) : (
        <>
          <ShieldXIcon className="size-3 text-destructive" /> Rejected
        </>
      )}
    </Badge>
  ) : null;

  const hasOutput =
    ("output" in part && part.output != null) ||
    ("errorText" in part && part.errorText);

  return (
    <Tool needsApproval={pending} open={open} onOpenChange={setOpen}>
      <ToolHeader
        type="dynamic-tool"
        state={part.state}
        toolName={part.toolName}
        extraBadge={extraBadge}
      />
      <ToolContent>
        {"input" in part && part.input != null && (
          <ToolInput input={part.input} />
        )}
        {pending && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <ShieldAlertIcon className="size-3.5" />
              {interrupt?.prompt || "Review the parameters, then approve or deny."}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => resolve("approved")}
                disabled={submitting}
              >
                <CheckIcon className="size-4" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolve("denied")}
                disabled={submitting}
              >
                <XIcon className="size-4" /> Deny
              </Button>
            </div>
          </div>
        )}
        {hasOutput && (
          <ToolOutput
            output={"output" in part ? part.output : undefined}
            errorText={"errorText" in part ? part.errorText : undefined}
          />
        )}
      </ToolContent>
    </Tool>
  );
}
