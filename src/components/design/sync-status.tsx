import type { ReactNode } from "react";
import { BUSINESS_TZ } from "@/lib/dates";

/** "Oct 8 at 3:41 AM" in Phoenix. Display only. */
export function formatSyncStamp(date: Date): string {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    month: "short",
    day: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${day} at ${time}`;
}

export function SyncStatus({ label, action }: { label: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="flex min-w-0 items-center gap-2 text-sm text-muted">
        <span className="h-2 w-2 shrink-0 rounded-full bg-sage" aria-hidden />
        <span className="truncate">{label}</span>
      </p>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
