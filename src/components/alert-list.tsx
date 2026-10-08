import { AlertCard } from "@/components/design/alert-card";
import { LocationDot } from "@/components/ui";
import type { Alert } from "@prisma/client";

export function AlertList({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line bg-card px-4 py-6 text-sm text-muted">
        No alerts in this location scope.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {alerts.map((alert) => (
        <li key={alert.id}>
          <AlertCard
            tone={alert.severity === "info" ? "notice" : "problem"}
            title={alert.title}
            href={alert.href ?? undefined}
          >
            <span className="mb-1 inline-flex">
              <LocationDot id={alert.locationId} />
            </span>
            <span className="block">{alert.body}</span>
          </AlertCard>
        </li>
      ))}
    </ul>
  );
}
