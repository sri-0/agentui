"use client";

import { ConnectorIcon } from "@/components/chat/composer/connector-icon";
import { Badge } from "@/components/ui/badge";
import { useConnectors } from "@/lib/api/connectors";
import type { Source } from "@/lib/api/sources";
import dayjs from "@/lib/dayjs";
import { ExternalLinkIcon } from "lucide-react";

/** One source: what it is, where it came from, and the metadata the system
 *  attached to it, exactly as recorded. */
export function SourceDetails({ source: s }: { source: Source }) {
  const cites = s.cited_in?.length ?? 0;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-start gap-2">
        <Badge variant="secondary" className="shrink-0 rounded px-1.5 tabular-nums">
          {s.number}
        </Badge>
        <div className="min-w-0 flex-1">
          {s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">
              <span className="break-words">{s.title || s.url}</span>
              <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground" />
            </a>
          ) : (
            <span className="font-medium">{s.title || "Untitled"}</span>
          )}
          <p className="text-xs text-muted-foreground">
            <SourceSystem system={s.system} iconClassName="size-3" /> · {s.tool} · retrieved {dayjs(s.retrieved_at).fromNow()}
            {cites > 0 && ` · cited ${cites === 1 ? "once" : `${cites} times`}`}
          </p>
        </div>
      </div>
      {s.metadata && Object.keys(s.metadata).length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs">
          {Object.entries(s.metadata).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-all font-mono">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** The system a source came from: its connector's icon and name, or the bare
 *  id when no connector has it. */
export function SourceSystem({ system, iconClassName }: { system: string; iconClassName?: string }) {
  const { data: connectors } = useConnectors();
  const c = connectors?.find((c) => c.id === system);
  return (
    <span className="inline-flex min-w-0 items-center gap-1 align-middle">
      <ConnectorIcon name={c?.icon} className={iconClassName} />
      <span className="truncate">{c?.name ?? system}</span>
    </span>
  );
}
