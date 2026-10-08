import Link from "next/link";
import type { ReactNode } from "react";
import { StatPill } from "@/components/design/stat-pill";

export type RecordField = { label: string; value: ReactNode };

export function RecordCard({
  title,
  kicker,
  status,
  statusTone = "muted",
  fields,
  href,
  detailsLabel = "View details",
  children,
}: {
  title: string;
  kicker?: ReactNode;
  status?: string;
  statusTone?: "muted" | "pending" | "ok";
  fields?: RecordField[];
  href?: string;
  detailsLabel?: string;
  children?: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-card">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {kicker ? <div className="mb-1 text-xs text-muted">{kicker}</div> : null}
            <h3 className="text-base font-extrabold leading-5">{title}</h3>
          </div>
          {status ? <StatPill tone={statusTone}>{status}</StatPill> : null}
        </div>
        {fields && fields.length > 0 ? (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            {fields.map((field) => (
              <div key={field.label} className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{field.label}</dt>
                <dd className="mt-0.5 break-words text-sm font-extrabold leading-5">{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="flex min-h-12 items-center justify-between border-t border-line px-4 text-sm font-bold text-ink"
        >
          <span>{detailsLabel}</span>
          <span aria-hidden>&gt;</span>
        </Link>
      ) : null}
    </article>
  );
}
