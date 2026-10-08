import type { ReactNode } from "react";
import { requireSession } from "@/lib/auth";
import { getLocationScope } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { locationIdsForScope } from "@/lib/location";
import { BottomNav } from "@/components/bottom-nav";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireSession();
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const inboxCount = await prisma.customerMessage.count({
    where: {
      locationId: { in: ids },
      status: { in: ["pending_approval", "new"] },
      requiresOwnerApproval: true,
    },
  });

  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto min-h-dvh w-full max-w-lg md:max-w-3xl lg:max-w-5xl">{children}</div>
      <div className="h-20" style={{ height: "calc(4.25rem + env(safe-area-inset-bottom))" }} />
      <BottomNav inboxCount={inboxCount} />
    </div>
  );
}
