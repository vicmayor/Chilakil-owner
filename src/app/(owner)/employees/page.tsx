import { EmployeeHoursScreen } from "@/components/employee-hours-view";
import { loadEmployeeHoursView } from "@/lib/employee-hours";
import { getLocationScope } from "@/lib/scope";

export const metadata = { title: "Employees" };
export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const scope = await getLocationScope();
  const view = await loadEmployeeHoursView(scope);
  return <EmployeeHoursScreen view={view} scope={scope} />;
}
