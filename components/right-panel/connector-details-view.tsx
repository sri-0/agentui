"use client";

import { ConnectorIcon } from "@/components/chat/composer/connector-icon";
import { Badge } from "@/components/ui/badge";
import { useConnector } from "@/lib/api/connectors";

/** Everything about a connector: kind, where it lives, and the tools it
 *  gives the agent (an MCP server's tools are read live). */
export function ConnectorDetailsView({ connectorId }: { connectorId: string }) {
  const { data: c, isLoading, error } = useConnector(connectorId);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error || !c) return <p className="text-sm text-muted-foreground">Connector not found.</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <ConnectorIcon name={c.icon} className="size-6 text-muted-foreground" />
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{c.name}</div>
          <div className="truncate font-mono text-xs text-muted-foreground">{c.id}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="font-normal">
          {c.type === "mcp" ? "MCP server" : "Toolset"}
        </Badge>
        {c.status && (
          <Badge variant={c.status === "ok" ? "secondary" : "destructive"} className="font-normal">
            {c.status}
          </Badge>
        )}
      </div>
      {c.description && <p className="text-sm leading-relaxed text-muted-foreground">{c.description}</p>}
      {c.url && (
        <div className="space-y-1">
          <span className="text-sm font-medium text-muted-foreground">URL</span>
          <p className="break-all font-mono text-xs">{c.url}</p>
        </div>
      )}
      {c.error && <p className="text-sm text-destructive">{c.error}</p>}
      <div className="space-y-2">
        <span className="text-sm font-medium text-muted-foreground">Tools ({c.tools?.length ?? 0})</span>
        <ul className="flex flex-wrap gap-1.5">
          {(c.tools ?? []).map((t) => (
            <li key={t.name} className="rounded-md border bg-card px-2 py-1 font-mono text-xs">
              {t.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
