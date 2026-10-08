"use client";

import { useState, type ReactNode } from "react";
import { StatPill } from "@/components/design/stat-pill";

export function Accordion({
  title,
  count,
  pending = 0,
  children,
  defaultOpen = false,
}: {
  title: string;
  count: number;
  pending?: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-3xl border border-line bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate text-base font-extrabold">{title}</span>
          <span className="text-xs font-semibold text-muted">
            {count} {count === 1 ? "item" : "items"}
          </span>
        </span>
        {pending > 0 ? <StatPill tone="pending">{pending} pending</StatPill> : null}
      </button>
      {open ? <div className="border-t border-line px-4 py-3">{children}</div> : null}
    </section>
  );
}
