import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-line bg-card p-4 ${className}`}>
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
      <p className={`font-display tabular mt-1 text-[1.65rem] font-extrabold leading-none ${valueColor}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function SampleBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warn">
      Sample
    </span>
  );
}

export function CombinedBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-paper-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
      Combined
    </span>
  );
}

export function LocationDot({ id }: { id: string }) {
  const avondale = id === "avondale";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        avondale ? "bg-avondale text-ink ring-1 ring-ink" : "bg-glendale text-white"
      }`}
    >
      {avondale ? "Avondale" : "Glendale"}
    </span>
  );
}
