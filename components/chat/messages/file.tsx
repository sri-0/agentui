"use client";

import { FileKindIcon } from "@/components/files/file-icon";
import { fileContentUrl } from "@/lib/api/files";
import type { FileUse } from "@/lib/chat/types";
import { memo } from "react";

/** A file a #id gave the model in its turn (the `file` activity), linking
 *  to the file itself. */
export const FileRead = memo(function FileRead({ data }: { data: FileUse }) {
  return (
    <div className="my-0.5 flex items-center gap-2 px-1.5 py-1 text-xs text-muted-foreground">
      <FileKindIcon mediaType={data.mediaType} className="size-3.5 shrink-0" />
      <span className="truncate">
        Read file{" "}
        <a
          href={fileContentUrl(data.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {data.name}
        </a>
      </span>
    </div>
  );
});
