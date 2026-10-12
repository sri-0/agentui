import type { ToolPart } from "@/lib/chat/types";
import type { ComponentType } from "react";

import { SlidesCall } from "./slides-call";

/** UI renderers for tool calls, by the name the backend puts on the call
 *  (toolx Spec.UI, or `ui:` per tool in mcp.yaml). A call with no renderer,
 *  or one waiting for approval, renders as the plain ToolLine. */
export const toolRenderers: Record<string, ComponentType<{ part: ToolPart }>> = {
  slides: SlidesCall,
};
