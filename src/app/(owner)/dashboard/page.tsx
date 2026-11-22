import { getLocationScope } from "@/lib/scope";
import { getAlerts, getDashboardData } from "@/lib/metrics";
import { formatLongDate } from "@/lib/dates";
import { formatSyncStamp } from "@/components/design/sync-status";
import { TopBar } from "@/components/top-bar";
import { DashboardMetrics } from "@/components/dashboard-metrics";
import { AlertList } from "@/components/alert-list";
import { InventoryWatch } from "@/components/inventory-watch";
import { FaceIdOffer } from "@/components/face-id-offer";
import { loadInventoryWatch } from "@/lib/team-inventory-load";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireSession();
  const scope = await getLocationScope();
  const data = await getDashboardData(scope);
  const alerts = await getAlerts(scope, data.date);
  const inventory = await loadInventoryWatch(scope);
  const passkeys = await prisma.passkey.count({ where: { userId: session.id } });

  return (
    <>
      <TopBar
        title="Today"
        subtitle={formatLongDate(data.date)}
        scope={scope}
        syncLabel={
          data.updatedAt
            ? `Last synced: ${formatSyncStamp(new Date(data.updatedAt))}`
            : "No daily sales import for this date"
        }
      />
      <main className="space-y-5 px-4 py-4 md:px-6">
        <FaceIdOffer enabled={passkeys > 0} />
        <DashboardMetrics data={data} />
        <InventoryWatch rows={inventory} />
        <section>
          <h2 className="mb-2 text-base font-extrabold">Alerts</h2>
          <AlertList alerts={alerts} />
        </section>
      </main>
    </>
  );
}
