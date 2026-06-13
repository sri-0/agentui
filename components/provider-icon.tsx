import { cn } from "@/lib/utils";
import { providerForModel } from "@/lib/providers";

/**
 * Monochrome, theme-aware provider icon. Renders the brand SVG as a CSS mask
 * filled with currentColor so it's always visible in light/dark and inherits
 * the surrounding text color.
 */
export function ProviderIcon({
  modelId,
  providerKey,
  className,
}: {
  modelId?: string;
  providerKey?: string;
  className?: string;
}) {
  const key = providerKey ?? providerForModel(modelId).key;
  const url = `/providers/${key}.svg`;
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        WebkitMaskImage: `url(${url})`,
        maskImage: `url(${url})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
