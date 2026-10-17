/** A colour for a free-form value such as a skill's category: a set of whole
 *  Tailwind class names, so Tailwind finds them. */
export type Color = { dot: string; gradient: string; text: string; badge: string };

/** Well-apart hues, warm and cool in turn, so neighbours differ. */
const PALETTE: Color[] = [
  { dot: "bg-blue-500", gradient: "from-sky-400 to-blue-600", text: "text-blue-600 dark:text-blue-400", badge: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  { dot: "bg-amber-500", gradient: "from-yellow-400 to-amber-600", text: "text-amber-600 dark:text-amber-400", badge: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { dot: "bg-emerald-500", gradient: "from-green-400 to-emerald-600", text: "text-emerald-600 dark:text-emerald-400", badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { dot: "bg-rose-500", gradient: "from-pink-400 to-rose-600", text: "text-rose-600 dark:text-rose-400", badge: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  { dot: "bg-violet-500", gradient: "from-purple-400 to-violet-600", text: "text-violet-600 dark:text-violet-400", badge: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  { dot: "bg-orange-500", gradient: "from-amber-400 to-orange-600", text: "text-orange-600 dark:text-orange-400", badge: "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  { dot: "bg-teal-500", gradient: "from-cyan-400 to-teal-600", text: "text-teal-600 dark:text-teal-400", badge: "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300" },
  { dot: "bg-fuchsia-500", gradient: "from-pink-400 to-fuchsia-600", text: "text-fuchsia-600 dark:text-fuchsia-400", badge: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300" },
  { dot: "bg-lime-500", gradient: "from-lime-400 to-green-600", text: "text-lime-700 dark:text-lime-400", badge: "border-lime-500/25 bg-lime-500/10 text-lime-700 dark:text-lime-300" },
  { dot: "bg-cyan-500", gradient: "from-sky-400 to-cyan-600", text: "text-cyan-600 dark:text-cyan-400", badge: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300" },
];

/** The neutral colour of no value. */
const NO_COLOR: Color = { dot: "bg-muted-foreground/40", gradient: "from-zinc-400 to-zinc-600", text: "text-muted-foreground", badge: "" };

/** The colours of a set of values, such as every category of the library,
 *  in its order: each value its own while there are no more than the
 *  palette's ten. Nothing is configured; a value added before another in the
 *  order moves that one's colour along. */
export function colorsOf(values: string[]): (value?: string) => Color {
  return (value) => {
    const i = value ? values.indexOf(value) : -1;
    return i < 0 ? NO_COLOR : PALETTE[i % PALETTE.length];
  };
}
