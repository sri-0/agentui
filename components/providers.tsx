"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // react-scan: render-performance overlay, development only. Its toolbar's
  // toggle is what react-scan remembers (localStorage's react-scan-options);
  // switched off there, it is not loaded on the next reload, toolbar included.
  // To bring it back, remove that key and reload (AGENTS.md §8). The dynamic
  // import lives inside the NODE_ENV guard so it never reaches the production
  // bundle.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    try {
      const saved = JSON.parse(localStorage.getItem("react-scan-options") ?? "{}") as { enabled?: boolean };
      if (saved.enabled === false) return;
    } catch {
      // nothing saved that can be read: load it
    }
    void import("react-scan").then(({ scan }) => scan({ enabled: true }));
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
