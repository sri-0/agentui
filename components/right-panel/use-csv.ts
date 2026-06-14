"use client";

import { useEffect, useState } from "react";

/**
 * Parse CSV content in a Web Worker (papaparse), so parsing never blocks the
 * main thread. Returns null while parsing. (Document/CSV parsing runs off-thread;
 * streamed markdown/code render directly via Streamdown.)
 */
export function useParsedCsv(content: string): string[][] | null {
  const [rows, setRows] = useState<string[][] | null>(null);

  useEffect(() => {
    let active = true;
    setRows(null);
    const worker = new Worker(new URL("./csv-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<string[][]>) => {
      if (active) setRows(e.data);
    };
    worker.postMessage(content);
    return () => {
      active = false;
      worker.terminate();
    };
  }, [content]);

  return rows;
}
