"use client";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type { ChatDataParts } from "@/lib/chat/types";
import { useMutation } from "@tanstack/react-query";
import { CheckIcon, ShieldAlertIcon, XIcon } from "lucide-react";
import { useState } from "react";

type Data = ChatDataParts["tool-interrupt"];

export function ToolInterrupt({ data }: { data: Data }) {
  const [resolved, setResolved] = useState<"approved" | "denied" | null>(null);

  const resume = useMutation({
    mutationFn: (action: "approved" | "denied") =>
      apiFetch("/v1/agent/resume", {
        method: "POST",
        body: JSON.stringify({
          thread_id: data.threadId,
          tool_call_id: data.toolCallId,
          action,
        }),
      }),
    onSuccess: (_r, action) => setResolved(action),
  });

  return (
    <div className="my-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlertIcon className="mt-0.5 size-5 shrink-0 text-amber-500" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium">
            Approval required: <span className="font-mono">{data.toolName}</span>
          </p>
          <p className="text-sm text-muted-foreground">{data.prompt}</p>
          {data.details != null && (
            <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-xs">
              {JSON.stringify(data.details, null, 2)}
            </pre>
          )}
          {resolved ? (
            <p className="text-xs text-muted-foreground">
              {resolved === "approved" ? "Approved." : "Denied."}
            </p>
          ) : (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => resume.mutate("approved")}
                disabled={resume.isPending}
              >
                <CheckIcon className="size-4" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resume.mutate("denied")}
                disabled={resume.isPending}
              >
                <XIcon className="size-4" /> Deny
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
