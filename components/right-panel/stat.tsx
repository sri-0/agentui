/** Small labelled stat cell, shared by the usage and model panels. */
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}
