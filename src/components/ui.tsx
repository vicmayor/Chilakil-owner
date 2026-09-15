import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-card p-4 ${className}`}
    >
      {children}
    </section>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "muted";
}) {
  const valueColor =
    tone === "good"
      ? "text-sage"
      : tone === "warn"
        ? "text-warn"
        : tone === "muted"
          ? "text-muted"
          : "text-ink";
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`font-display tabular mt-1 text-[1.65rem] font-semibold leading-none ${valueColor}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function CombinedBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-chile px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-black">
      Combined
    </span>
  );
}

export function LocationDot({ id }: { id: string }) {
  const color = id === "avondale" ? "bg-avondale" : "bg-glendale";
  const label = id === "avondale" ? "Avondale" : "Glendale";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
