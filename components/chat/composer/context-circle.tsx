"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

/**
 * opencode-style context quota ring. Hover shows quick stats (tokens / usage /
 * cost); clicking opens the full usage breakdown sidepanel.
 */
export function ContextCircle({
  used,
  total,
  cost,
  onClick,
}: {
  used: number;
  total: number;
  cost?: number;
  onClick?: () => void;
}) {
  const pct = total > 0 ? Math.min(used / total, 1) : 0;
  const r = 7;
  const c = 2 * Math.PI * r;
  const danger = pct > 0.9;
  const warn = pct > 0.75;

  return (
    <HoverCard openDelay={120} closeDelay={60}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label="Context usage"
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <svg viewBox="0 0 18 18" className="size-[19px] -rotate-90">
            {/* filled disc so the control is visible even at 0% */}
            <circle cx="9" cy="9" r="8.25" className="fill-muted" />
            {/* track ring */}
            <circle
              cx="9"
              cy="9"
              r={r}
              fill="none"
              strokeWidth="2.5"
              className="stroke-muted-foreground/30"
            />
            {/* progress ring */}
            <circle
              cx="9"
              cy="9"
              r={r}
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
              className={cn(
                "transition-[stroke-dashoffset] duration-500",
                danger
                  ? "stroke-destructive"
                  : warn
                    ? "stroke-amber-500"
                    : "stroke-primary",
              )}
            />
          </svg>
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-44 p-3">
        <dl className="space-y-1.5 text-sm">
          <Row label="Tokens" value={used.toLocaleString()} />
          <Row label="Usage" value={`${Math.round(pct * 100)}%`} />
          {typeof cost === "number" && (
            <Row label="Cost" value={`$${cost.toFixed(2)}`} />
          )}
        </dl>
        <p className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">
          Click for full breakdown
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}
