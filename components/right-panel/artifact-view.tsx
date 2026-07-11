"use client";

import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import {
  type ArtifactData,
  downloadArtifact,
  findArtifact,
} from "@/lib/chat/artifacts";
import type { ChatMessage } from "@/lib/chat/types";
import { DownloadIcon, ExternalLinkIcon, FileIcon } from "lucide-react";

import { useParsedCsv } from "./use-csv";

export function ArtifactView({
  messages,
  artifactId,
}: {
  messages: ChatMessage[];
  artifactId: string;
}) {
  const artifact = findArtifact(messages, artifactId);
  if (!artifact) {
    return <p className="text-sm text-muted-foreground">Artifact not found.</p>;
  }
  return <ArtifactBody artifact={artifact} />;
}

function ArtifactBody({ artifact }: { artifact: ArtifactData }) {
  const { kind, content, language } = artifact;
  if (kind === "file") return <FileCard artifact={artifact} />;
  if (kind === "csv") return <CsvTable content={content} />;
  if (kind === "html") {
    // Sandboxed (no scripts) — static HTML/CSS renders, nothing executes.
    return (
      <iframe
        title="artifact-preview"
        sandbox=""
        srcDoc={content}
        className="h-[70vh] w-full rounded-md border bg-white"
      />
    );
  }
  // markdown / code / json all go through Streamdown (markdown), fencing the
  // code/json so they get syntax highlighting.
  const md =
    kind === "code"
      ? `\`\`\`${language ?? ""}\n${content}\n\`\`\``
      : kind === "json"
        ? `\`\`\`json\n${content}\n\`\`\``
        : content;
  return (
    <div className="text-sm">
      <MessageResponse>{md}</MessageResponse>
    </div>
  );
}

/** Human-readable byte size, e.g. 24576 → "24 KB". */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Friendly label for a mime/extension (pptx/docx/xlsx → "PowerPoint" etc.). */
function fileTypeLabel(a: ArtifactData): string {
  const name = (a.filename ?? a.title ?? "").toLowerCase();
  const mime = (a.mime ?? "").toLowerCase();
  if (name.endsWith(".pptx") || mime.includes("presentation"))
    return "PowerPoint presentation";
  if (name.endsWith(".docx") || mime.includes("wordprocessing"))
    return "Word document";
  if (name.endsWith(".xlsx") || mime.includes("spreadsheet"))
    return "Excel spreadsheet";
  return a.mime || "File";
}

/**
 * Download card for binary file artifacts (office docs). No inline preview —
 * pptx/docx/xlsx can't be rendered in-browser, so we surface a clean card with
 * filename, type, size and a prominent download + open-in-new-tab.
 */
function FileCard({ artifact }: { artifact: ArtifactData }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-6">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-background">
          <FileIcon className="size-6 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {artifact.filename ?? artifact.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {fileTypeLabel(artifact)}
            {artifact.size != null ? ` · ${formatSize(artifact.size)}` : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="gap-2"
          onClick={() => downloadArtifact(artifact)}
          disabled={!artifact.url}
        >
          <DownloadIcon className="size-4" />
          Download
        </Button>
        {artifact.url && (
          <Button size="sm" variant="outline" className="gap-2" asChild>
            <a href={artifact.url} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon className="size-4" />
              Open in new tab
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

function CsvTable({ content }: { content: string }) {
  const rows = useParsedCsv(content);
  if (rows === null) {
    return <p className="text-sm text-muted-foreground">Parsing spreadsheet…</p>;
  }
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
              <th
                key={i}
                className="whitespace-nowrap px-3 py-2 text-left font-medium"
              >
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
