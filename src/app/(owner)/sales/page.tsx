import { SalesDashboard } from "@/components/sales-dashboard";
import { getSalesView } from "@/lib/sales";
import { getLocationScope } from "@/lib/scope";

export const metadata = { title: "Sales" };
export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const scope = await getLocationScope();
  const view = await getSalesView(scope);
  return <SalesDashboard view={view} scope={scope} />;
}
