import { getLocationScope } from "@/lib/scope";
import { getAlerts, getDashboardData } from "@/lib/metrics";
import { formatLongDate } from "@/lib/dates";
import { TopBar } from "@/components/top-bar";
import { DashboardMetrics } from "@/components/dashboard-metrics";
import { AlertList } from "@/components/alert-list";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const scope = await getLocationScope();
  const data = await getDashboardData(scope);
  const alerts = await getAlerts(scope, data.date);

  return (
    <>
      <TopBar title="Today" subtitle={formatLongDate(data.date)} scope={scope} />
      <main className="space-y-5 px-4 py-4">
        <DashboardMetrics data={data} />
        <section>
          <h2 className="mb-2 text-sm font-semibold">Alerts</h2>
          <AlertList alerts={alerts} />
        </section>
      </main>
    </>
  );
}
