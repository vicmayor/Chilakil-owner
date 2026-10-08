import type { ReactNode } from "react";

export function StatPill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "pending" | "ok";
}) {
  const styles =
    tone === "pending"
      ? "bg-chile text-ink"
      : tone === "ok"
        ? "bg-sage-soft text-sage"
        : "bg-paper-2 text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${styles}`}>
      {children}
    </span>
  );
}
