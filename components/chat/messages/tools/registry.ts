import type { ToolPart } from "@/lib/chat/types";
import type { ComponentType } from "react";

import { ImageCall } from "./image-call";
import { SlidesCall } from "./slides-call";

/** UI renderers for tool calls, by the name the backend puts on the call
 *  (toolx Spec.UI, or `ui:` per tool in mcp.yaml). A renderer shows a call
 *  that is running or done; any other call, or one with no renderer,
 *  renders as the plain ToolLine. */
export const toolRenderers: Record<string, ComponentType<{ part: ToolPart }>> = {
  slides: SlidesCall,
  generate_image: ImageCall,
};
