/// <reference lib="webworker" />
import Papa from "papaparse";

declare const self: DedicatedWorkerGlobalScope;

// Parse CSV off the main thread so large spreadsheets don't block rendering.
self.onmessage = (e: MessageEvent<string>) => {
  const { data } = Papa.parse<string[]>(e.data, { skipEmptyLines: true });
  self.postMessage(data);
};

export {};
