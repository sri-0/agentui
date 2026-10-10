"use client";

import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { PlugIcon } from "lucide-react";

/** A connector's icon by its lucide name, with a plug as the fallback. */
export function ConnectorIcon({ name, className }: { name?: string; className?: string }) {
  if (!name) return <PlugIcon className={className} />;
  return <DynamicIcon name={name as IconName} className={className} fallback={() => <PlugIcon className={className} />} />;
}
