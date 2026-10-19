import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** The gradients a workspace's avatar is drawn in, one picked by its id so it
 *  keeps its colours when renamed. */
const GRADIENTS = [
  "from-rose-500 to-orange-400",
  "from-violet-500 to-fuchsia-400",
  "from-sky-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-amber-500 to-pink-500",
  "from-indigo-500 to-sky-400",
];

/** Sizes: lg for a card or a heading, sm for a menu or a picker, xs for a
 *  line of small text. */
const SIZES = {
  lg: "size-9 rounded-lg text-xs after:rounded-lg",
  sm: "size-5 rounded-[5px] text-[9px] after:rounded-[5px]",
  xs: "size-4 rounded-[4px] text-[7px] after:rounded-[4px]",
};

/** A workspace's name as letters: the first letter of each of its first two
 *  words ("Pet Project" → PP), or of its only word. */
export function initials(name: string) {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** A workspace's icon: its initials on a gradient, in a rounded square (shadcn
 *  Avatar). */
export function WorkspaceAvatar({
  workspace,
  size = "lg",
  className,
}: {
  workspace: { id: string; name: string };
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const sum = [...workspace.id].reduce((n, c) => n + c.charCodeAt(0), 0);
  return (
    <Avatar className={cn(SIZES[size], className)} aria-hidden>
      <AvatarFallback
        className={cn(
          "rounded-[inherit] bg-linear-to-br font-semibold text-white",
          GRADIENTS[sum % GRADIENTS.length],
          SIZES[size],
        )}
      >
        {initials(workspace.name)}
      </AvatarFallback>
    </Avatar>
  );
}
