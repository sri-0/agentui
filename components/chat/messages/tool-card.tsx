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
import { memo, useEffect, useRef, useState } from "react";

import { useResolveInterrupt } from "../interrupt-context";

type ToolPart = Extract<ChatMessage["parts"][number], { type: "dynamic-tool" }>;
type Interrupt = ChatDataParts["tool-interrupt"];

/**
 * Renders a tool call card, with HITL approval merged in: while the tool part is
 * in the native `approval-requested` state (and not yet resolved) the card shows
 * an amber outline, the params, and Approve/Deny. After resolution it reverts to
 * the normal outline + running/completed state, keeping an Approved/Rejected tag.
 *
 * Memoized on the tool's meaningful state (state transition / resolution), so it
 * doesn't re-render on every streamed token of a sibling text part.
 */
export const ToolCard = memo(function ToolCard({
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
  const approvalRef = useRef<HTMLDivElement>(null);

  // Open the card while it needs approval (so the buttons are visible), then
  // collapse it once the decision is made. After that the user can toggle freely.
  useEffect(() => {
    if (pending) setOpen(true);
    else if (interrupt?.resolved) setOpen(false);
  }, [pending, interrupt?.resolved]);

  // A fresh approval can render below the fold (flush against the composer with
  // no answer text yet) — scroll the Approve/Deny buttons into view so they're
  // always reachable.
  useEffect(() => {
    if (!pending || !open) return;
    const id = requestAnimationFrame(() =>
      approvalRef.current?.scrollIntoView({ block: "nearest" }),
    );
    return () => cancelAnimationFrame(id);
  }, [pending, open]);

  const resolve = async (action: "approved" | "denied") => {
    // Use the tool part's own id (always present) — the interrupt side-channel
    // may be absent; the resolver finds the message + thread id itself.
    if (!resolveInterrupt || submitting) return;
    setSubmitting(true);
    try {
      await resolveInterrupt(part.toolCallId, action);
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
          <div
            ref={approvalRef}
            className="flex flex-wrap items-center justify-between gap-2"
          >
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
},
(a, b) =>
  a.part.state === b.part.state &&
  a.part.toolName === b.part.toolName &&
  ("output" in a.part ? a.part.output : undefined) ===
    ("output" in b.part ? b.part.output : undefined) &&
  a.interrupt?.resolved === b.interrupt?.resolved);
