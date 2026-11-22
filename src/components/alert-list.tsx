import { AlertCard } from "@/components/design/alert-card";
import { EmptyState } from "@/components/design/empty-state";
import { LocationDot } from "@/components/ui";
import type { Alert } from "@prisma/client";

export function AlertList({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <EmptyState title="No alerts in this location scope." />
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
