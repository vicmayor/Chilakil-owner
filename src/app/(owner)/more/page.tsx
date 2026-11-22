import { MoreScreen } from "@/components/more-screen";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";

export const metadata = { title: "More" };

export default async function MorePage() {
  const session = await requireSession();
  const scope = await getLocationScope();
  const passkeys = await prisma.passkey.count({ where: { userId: session.id } });
  return <MoreScreen name={session.name} scope={scope} faceIdEnabled={passkeys > 0} />;
}
