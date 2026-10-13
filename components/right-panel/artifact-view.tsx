"use client";

import Papa from "papaparse";

import { MessageResponse } from "@/components/ai-elements/message";
import { Markdown } from "@/components/chat/messages/markdown";
import { Button } from "@/components/ui/button";
import { useArtifactBody } from "@/lib/api/artifacts";
import { downloadArtifact } from "@/lib/chat/artifacts";
import type { Artifact } from "@/lib/chat/types";
import dayjs from "@/lib/dayjs";
import { useUiStore } from "@/stores/ui-store";
import { useQueryClient } from "@tanstack/react-query";
import { AppWindowIcon, DownloadIcon, ExternalLinkIcon, FileTextIcon, RotateCwIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";

/** A url artifact's page, reloaded whenever its refresh counter is bumped.
 *  Only a page on another origin is embedded: there the sandbox's script
 *  permissions cannot reach this app. The page loads in the app's theme and
 *  is sent every change after (open-slide's embed contract: `?theme=` and an
 *  `open-slide:theme` message), so switching does not reload it. */
export function EmbeddedPage({ artifact }: { artifact: Artifact }) {
  // Callers key it by artifact, so each page loads in the theme of the moment.
  const refresh = useUiStore((s) => s.artifactRefresh[artifact.id] ?? 0);
  const { resolvedTheme } = useTheme();
  const [loadTheme] = useState(resolvedTheme);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => postTheme(frame.current, resolvedTheme), [resolvedTheme]);

  if (!embeddable(artifact.url)) {
    return <p className="p-6 text-sm text-muted-foreground">This page cannot be shown here.</p>;
  }
  return (
    <iframe
      key={refresh}
      ref={frame}
      title={artifact.title}
      src={withTheme(artifact.url, loadTheme)}
      onLoad={() => postTheme(frame.current, resolvedTheme)}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
      className="size-full flex-1 border-0 bg-background"
    />
  );
}

function withTheme(url: string, theme?: string): string {
  const u = new URL(url);
  if (theme) u.searchParams.set("theme", theme);
  return u.toString();
}

// Any origin may receive it: the message is only a theme name, and before the
// page loads the frame still holds about:blank, whose origin is this app's.
function postTheme(frame: HTMLIFrameElement | null, theme?: string) {
  if (frame?.contentWindow && theme) frame.contentWindow.postMessage({ type: "open-slide:theme", theme }, "*");
}

/** An artifact's icon: a page or a document. */
export function ArtifactIcon({ kind, className }: { kind: Artifact["kind"]; className?: string }) {
  return kind === "url" ? <AppWindowIcon className={className} /> : <FileTextIcon className={className} />;
}

/** What an artifact is, its version and when it last changed. */
export function artifactDetails(a: Artifact): string {
  const version = a.version && a.version > 1 ? `version ${a.version}` : "";
  return [a.kind, version, a.updated_at ? dayjs(a.updated_at).fromNow() : ""].filter(Boolean).join(" · ");
}

function embeddable(url?: string): url is string {
  try {
    const u = new URL(url ?? "");
    return (u.protocol === "https:" || u.protocol === "http:") && u.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/** An artifact's body, rendered by kind. */
export function ArtifactBody({ threadId, artifact }: { threadId: string; artifact: Artifact }) {
  const { body, error } = useArtifactBody(threadId, artifact);
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (body == null) return <p className="text-sm text-muted-foreground">Loading…</p>;
  switch (artifact.kind) {
    case "csv":
      return <CsvTable content={body} />;
    case "code":
    case "json":
      // Code is shown as written: no citation chips inside it.
      return (
        <div className="text-sm">
          <MessageResponse mode="static">{`\`\`\`${artifact.kind === "json" ? "json" : (artifact.language ?? "")}\n${body}\n\`\`\``}</MessageResponse>
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
            <ArtifactIcon kind={a.kind} className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{a.title}</span>
              <span className="text-xs text-muted-foreground">{artifactDetails(a)}</span>
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

/** Reload the artifact; open a page in a new tab, or download a body. */
export function ArtifactActions({ threadId, artifact }: { threadId: string; artifact: Artifact }) {
  const refreshArtifact = useUiStore((s) => s.refreshArtifact);
  const queryClient = useQueryClient();
  const { body } = useArtifactBody(threadId, artifact);
  const reload = () => {
    if (artifact.kind === "url") refreshArtifact(artifact.id);
    else void queryClient.invalidateQueries({ queryKey: ["artifact-body", threadId, artifact.id] });
  };
  return (
    <>
      {artifact.content == null && (
        <Button variant="ghost" size="icon-sm" title="Refresh" onClick={reload}>
          <RotateCwIcon className="size-4" />
        </Button>
      )}
      {artifact.kind === "url" ? (
        <Button variant="ghost" size="icon-sm" title="Open in a new tab" asChild>
          <a href={artifact.url} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon className="size-4" />
          </a>
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon-sm"
          title="Download"
          disabled={body == null}
          onClick={() => body != null && downloadArtifact(artifact, body)}
        >
          <DownloadIcon className="size-4" />
        </Button>
      )}
    </>
  );
}
