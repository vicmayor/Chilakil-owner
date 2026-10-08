import { MoreScreen } from "@/components/more-screen";
import { requireSession } from "@/lib/auth";
import { getLocationScope } from "@/lib/scope";

export const metadata = { title: "More" };

export default async function MorePage() {
  const session = await requireSession();
  const scope = await getLocationScope();
  return <MoreScreen name={session.name} scope={scope} />;
}
