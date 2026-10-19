"use client";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { LayoutGridIcon, ListIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
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
  heading: ReactNode;
  search: string;
  onSearch: (q: string) => void;
  placeholder?: string;
  actions?: ReactNode;
}) {
  const view = useUiStore((s) => s.libraryView);
  const setView = useUiStore((s) => s.setLibraryView);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="mr-auto flex min-w-0 items-center gap-3 text-2xl font-semibold tracking-tight">{heading}</h1>
      <InputGroup className="w-full sm:w-64">
        <InputGroupInput
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
      {actions}
      <ToggleGroup
        type="single"
        variant="outline"
        aria-label="View"
        value={view}
        onValueChange={(v) => v && setView(v as typeof view)}
      >
        <ToggleGroupItem value="grid" aria-label="Grid" title="Grid">
          <LayoutGridIcon />
        </ToggleGroupItem>
        <ToggleGroupItem value="list" aria-label="List" title="List">
          <ListIcon />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

/** A grid of cards or a list of rows, as the view toggle says. */
export function LibraryItems({ children }: { children: ReactNode }) {
  const view = useUiStore((s) => s.libraryView);
  return (
    <div
      className={cn(
        view === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" : "flex flex-col",
      )}
    >
      {children}
    </div>
  );
}

/** One item, opened at href: a card holding all of it, a preview on top when
 *  there is one (grid), or a row (list). The title is the link, stretched
 *  over the item, so the rest is read as its content; a preview is inert.
 *  Without href the item opens nothing (a file: its actions download it). */
export function LibraryItem({
  href,
  preview,
  icon,
  title,
  subtitle,
  meta,
  actions,
  children,
}: {
  href?: string;
  preview?: ReactNode;
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  /** e.g. a date: the list's right-hand column, the card's foot */
  meta?: ReactNode;
  /** controls over the item, e.g. delete: the card's top corner, the row's end */
  actions?: ReactNode;
  /** more for the card: a description, tags */
  children?: ReactNode;
}) {
  const view = useUiStore((s) => s.libraryView);
  const heading = (
    <div className="flex min-w-0 items-center gap-3">
      {icon}
      <div className="min-w-0 flex-1">
        {href ? (
          <Link href={href} className="block truncate text-sm font-medium outline-none after:absolute after:inset-0">
            {title}
          </Link>
        ) : (
          <span className="block truncate text-sm font-medium">{title}</span>
        )}
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
  const focus = "has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50";
  if (view === "list") {
    return (
      <div
        className={cn(
          "relative flex items-center gap-3 border-b px-2 py-3 transition-colors last:border-b-0 hover:bg-accent/40",
          focus,
        )}
      >
        {heading}
        {meta && <span className="ms-auto shrink-0 text-xs text-muted-foreground">{meta}</span>}
        {actions && <div className="relative z-10 flex shrink-0 gap-1">{actions}</div>}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-foreground/25",
        focus,
      )}
    >
      {preview && (
        <div inert className="flex aspect-[16/9] overflow-hidden border-b bg-muted/30">
          {preview}
        </div>
      )}
      {actions && <div className="absolute top-2 right-2 z-10 flex gap-1">{actions}</div>}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {heading}
        {children}
        {meta && <span className="mt-auto text-xs text-muted-foreground">{meta}</span>}
      </div>
    </div>
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

/** A nav entry: a link that replaces the page's URL, such as a filter. */
export function NavItem({
  icon,
  label,
  count,
  active,
  href,
}: {
  icon?: ReactNode;
  label: string;
  count?: number;
  active: boolean;
  href: string;
}) {
  return (
    <Button
      asChild
      variant={active ? "secondary" : "ghost"}
      className="w-full justify-start gap-2.5 px-2.5 font-normal"
    >
      <Link href={href} replace scroll={false} aria-current={active || undefined}>
        {icon}
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {count != null && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
      </Link>
    </Button>
  );
}
