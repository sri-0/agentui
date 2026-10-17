"use client";

import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { LayoutGridIcon, ListIcon, SearchIcon } from "lucide-react";
import type { ReactNode } from "react";

/** The page frame of the artifacts and skills pages: a thin top bar, then
 *  an optional nav column and the scrolling content. */
export function LibraryPage({ title, nav, children }: { title: string; nav?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <SidebarTrigger className="text-muted-foreground" />
        <span className="text-sm font-semibold">{title}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {nav && (
          <nav className="shrink-0 overflow-y-auto border-b p-3 md:w-60 md:border-r md:border-b-0">{nav}</nav>
        )}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** The heading row: the page's title, then search, actions and the view toggle. */
export function LibraryToolbar({
  heading,
  search,
  onSearch,
  placeholder = "Search",
  actions,
}: {
  heading: string;
  search: string;
  onSearch: (q: string) => void;
  placeholder?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="mr-auto text-2xl font-semibold tracking-tight">{heading}</h1>
      <div className="relative w-full sm:w-64">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="rounded-full pl-9"
        />
      </div>
      {actions}
      <ViewToggle />
    </div>
  );
}

function ViewToggle() {
  const view = useUiStore((s) => s.libraryView);
  const setView = useUiStore((s) => s.setLibraryView);
  return (
    <div role="radiogroup" aria-label="View" className="flex rounded-full border p-0.5">
      {(
        [
          ["grid", LayoutGridIcon, "Grid"],
          ["list", ListIcon, "List"],
        ] as const
      ).map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={view === value}
          aria-label={label}
          title={label}
          onClick={() => setView(value)}
          className={cn(
            "rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground",
            view === value && "bg-accent text-foreground",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}

/** A grid of cards or a list of rows, as the view toggle says. */
export function LibraryItems({ children }: { children: ReactNode }) {
  const view = useUiStore((s) => s.libraryView);
  return (
    <div
      className={cn(
        view === "grid" ? "grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "flex flex-col",
      )}
    >
      {children}
    </div>
  );
}

/** One item: a card with a preview above its title (grid), or a row (list). */
export function LibraryItem({
  preview,
  icon,
  title,
  subtitle,
  meta,
  onOpen,
}: {
  preview: ReactNode;
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  /** the list's right-hand columns, e.g. a date */
  meta?: ReactNode;
  onOpen: () => void;
}) {
  const view = useUiStore((s) => s.libraryView);
  if (view === "list") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-3 border-b px-2 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/40"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
        </span>
        {meta && <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>}
      </button>
    );
  }
  return (
    <button type="button" onClick={onOpen} className="group flex flex-col gap-2 text-left">
      <span className="flex aspect-[16/10] overflow-hidden rounded-xl border bg-muted/30 transition-colors group-hover:border-foreground/25">
        {preview}
      </span>
      <span className="px-0.5 text-center">
        <span className="block truncate text-sm font-medium">{title}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </button>
  );
}

/** A nav section: a muted label and its entries. */
export function NavSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 pb-3">
      {label && <span className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">{label}</span>}
      {children}
    </div>
  );
}

export function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active || undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/50",
        active && "bg-accent font-medium",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
    </button>
  );
}
