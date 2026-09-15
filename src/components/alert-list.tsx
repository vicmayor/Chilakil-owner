import Link from "next/link";
import { LocationDot } from "@/components/ui";
import type { Alert } from "@prisma/client";

export function AlertList({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-card px-4 py-6 text-sm text-muted">
        No alerts in this location scope.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {alerts.map((alert) => {
        const tone =
          alert.severity === "critical"
            ? "border-danger/30 bg-danger-soft"
            : alert.severity === "warning"
              ? "border-warn/30 bg-warn-soft"
              : "border-line bg-card";
        const inner = (
          <>
            <div className="flex items-center justify-between gap-2">
              <LocationDot id={alert.locationId} />
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                {alert.severity}
              </span>
            </div>
            <p className="mt-1 text-[15px] font-semibold leading-5">{alert.title}</p>
            <p className="mt-1 text-sm leading-5 text-muted">{alert.body}</p>
          </>
        );
        return (
          <li key={alert.id}>
            {alert.href ? (
              <Link href={alert.href} className={`block min-h-0 rounded-2xl border px-4 py-3 ${tone}`}>
                {inner}
              </Link>
            ) : (
              <div className={`rounded-2xl border px-4 py-3 ${tone}`}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
