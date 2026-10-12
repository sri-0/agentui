"use client";

import Papa from "papaparse";

import { Markdown } from "@/components/chat/messages/markdown";
import { useArtifactBody } from "@/lib/api/artifacts";
import type { Artifact } from "@/lib/chat/types";
import dayjs from "@/lib/dayjs";
import { useUiStore } from "@/stores/ui-store";
import { AppWindowIcon, FileTextIcon } from "lucide-react";
import { useMemo } from "react";

/** One artifact: a url artifact embeds its page; any other kind renders its
 *  body. Both reload when the artifact's refresh counter is bumped. */
export function ArtifactView({ threadId, artifact }: { threadId: string; artifact: Artifact }) {
  const refresh = useUiStore((s) => s.artifactRefresh[artifact.id] ?? 0);
  if (artifact.kind === "url") {
    return (
      <iframe
        key={refresh}
        title={artifact.title}
        src={artifact.url}
        // Another origin, so it cannot reach this app; it may not navigate it either.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
        className="size-full flex-1 border-0 bg-white"
      />
    );
  }
  return <ArtifactBody threadId={threadId} artifact={artifact} refresh={refresh} />;
}

function ArtifactBody({ threadId, artifact, refresh }: { threadId: string; artifact: Artifact; refresh: number }) {
  const { data, error } = useArtifactBody(threadId, artifact, refresh);
  const body = artifact.content ?? data;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (body == null) return <p className="text-sm text-muted-foreground">Loading…</p>;
  switch (artifact.kind) {
    case "csv":
      return <CsvTable content={body} />;
    case "html":
      // Sandboxed without scripts: static HTML and CSS render, nothing runs.
      return (
        <iframe title={artifact.title} sandbox="" srcDoc={body} className="h-[70vh] w-full rounded-md border bg-white" />
      );
    case "code":
    case "json":
      return (
        <div className="text-sm">
          <Markdown>{`\`\`\`${artifact.kind === "json" ? "json" : (artifact.language ?? "")}\n${body}\n\`\`\``}</Markdown>
        </div>
      );
    default:
      return (
        <div className="text-sm">
          <Markdown>{body}</Markdown>
        </div>
      );
  }
}

/** The conversation's artifacts, newest first. */
export function ArtifactList({ artifacts }: { artifacts: Artifact[] }) {
  const openSidepanel = useUiStore((s) => s.openSidepanel);
  if (artifacts.length === 0) return <p className="text-sm text-muted-foreground">No artifacts yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {artifacts.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => openSidepanel({ kind: "artifact", artifactId: a.id })}
            className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
          >
            {a.kind === "url" ? (
              <AppWindowIcon className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{a.title}</span>
              <span className="text-xs text-muted-foreground">
                {a.kind}
                {a.version && a.version > 1 ? ` · version ${a.version}` : ""}
                {a.updated_at ? ` · ${dayjs(a.updated_at).fromNow()}` : ""}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function CsvTable({ content }: { content: string }) {
  // Artifacts are small; papaparse handles them synchronously.
  const rows = useMemo(() => Papa.parse<string[]>(content, { skipEmptyLines: true }).data, [content]);
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Empty spreadsheet.</p>;
  }
  const [header, ...body] = rows;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            {header.map((cell, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2 text-left font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r} className="border-b last:border-0">
              {header.map((_, c) => (
                <td key={c} className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                  {row[c] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
