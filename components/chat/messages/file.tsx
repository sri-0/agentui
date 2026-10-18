"use client";

import { FileKindIcon } from "@/components/files/file-icon";
import type { FileUse } from "@/lib/chat/types";
import { memo } from "react";

/** A file a #id gave the model in its turn (the `file` activity), by name:
 *  files aren't opened in the browser (the Files page downloads them). */
export const FileRead = memo(function FileRead({ data }: { data: FileUse }) {
  return (
    <div className="my-0.5 flex items-center gap-2 px-1.5 py-1 text-xs text-muted-foreground">
      <FileKindIcon mediaType={data.mediaType} className="size-3.5 shrink-0" />
      <span className="truncate">
        Read file{" "}
        <span className="font-medium text-foreground">{data.name}</span>
      </span>
    </div>
  );
});
