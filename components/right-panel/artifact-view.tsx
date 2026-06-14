"use client";

import { MessageResponse } from "@/components/ai-elements/message";
import { type ArtifactData, findArtifact } from "@/lib/chat/artifacts";
import type { ChatMessage } from "@/lib/chat/types";

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
  return (
    <ArtifactBody
      kind={artifact.kind}
      content={artifact.content}
      language={artifact.language}
    />
  );
}

function ArtifactBody({
  kind,
  content,
  language,
}: {
  kind: ArtifactData["kind"];
  content: string;
  language?: string;
}) {
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
