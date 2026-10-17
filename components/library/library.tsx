"use client";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { LayoutGridIcon, ListIcon, SearchIcon } from "lucide-react";
import type { ReactNode } from "react";

/** The page frame of the artifacts and skills pages: a thin top bar, then
 *  the scrolling content, with an optional nav column beside it. `fill` gives
 *  the content the whole area, for an embedded page. */
export function LibraryPage({
  title,
  nav,
  fill,
  children,
}: {
  title: string;
  nav?: ReactNode;
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <SidebarTrigger className="text-muted-foreground" />
        <span className="text-sm font-semibold">{title}</span>
      </header>
      {fill ? (
        <main className="flex min-h-0 flex-1 flex-col gap-4 p-4">{children}</main>
      ) : (
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-screen-2xl flex-col gap-8 px-4 py-8 sm:px-8 md:flex-row md:gap-12">
            {nav && (
              <nav className="shrink-0 md:w-60">
                <div className="flex flex-col gap-5 md:sticky md:top-8">{nav}</div>
              </nav>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
          </div>
        </main>
      )}
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
          className="pl-9"
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
    <ButtonGroup aria-label="View">
      {(
        [
          ["grid", LayoutGridIcon, "Grid"],
          ["list", ListIcon, "List"],
        ] as const
      ).map(([value, Icon, label]) => (
        <Button
          key={value}
          variant={view === value ? "secondary" : "outline"}
          size="icon"
          aria-pressed={view === value}
          aria-label={label}
          title={label}
          onClick={() => setView(value)}
        >
          <Icon />
        </Button>
      ))}
    </ButtonGroup>
  );
}

/** A grid of cards or a list of rows, as the view toggle says. */
export function LibraryItems({ children }: { children: ReactNode }) {
  const view = useUiStore((s) => s.libraryView);
  return (
    <div
      className={cn(view === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" : "flex flex-col")}
    >
      {children}
    </div>
  );
}

/** One item: a card holding all of it, a preview on top when there is one
 *  (grid), or a row (list). */
export function LibraryItem({
  preview,
  icon,
  title,
  subtitle,
  meta,
  children,
  onOpen,
}: {
  preview?: ReactNode;
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  /** e.g. a date: the list's right-hand column, the card's foot */
  meta?: ReactNode;
  /** more for the card: a description, tags */
  children?: ReactNode;
  onOpen: () => void;
}) {
  const view = useUiStore((s) => s.libraryView);
  const heading = (
    <span className="flex min-w-0 items-center gap-3">
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </span>
  );
  if (view === "list") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-3 border-b px-2 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/40"
      >
        <span className="min-w-0 flex-1">{heading}</span>
        {meta && <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-colors hover:border-foreground/25"
    >
      {preview && <span className="flex aspect-[16/9] overflow-hidden border-b bg-muted/30">{preview}</span>}
      <span className="flex flex-1 flex-col gap-3 p-4">
        {heading}
        {children}
        {meta && <span className="mt-auto text-xs text-muted-foreground">{meta}</span>}
      </span>
    </button>
  );
}

/** A nav section: a muted label and its entries. */
export function NavSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">{label}</span>}
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
    <Button
      variant={active ? "secondary" : "ghost"}
      onClick={onClick}
      aria-current={active || undefined}
      className="w-full justify-start gap-2.5 px-2.5 font-normal"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {count != null && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
    </Button>
  );
}
