import type { ReactNode } from "react";
import { requireSession } from "@/lib/auth";
import { getLocationScope } from "@/lib/scope";
import { prisma } from "@/lib/db";
import { locationIdsForScope } from "@/lib/location";
import { BottomNav } from "@/components/bottom-nav";

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
    <div className="mx-auto min-h-dvh max-w-lg bg-paper">
      {children}
      <div className="h-20" style={{ height: "calc(4.25rem + env(safe-area-inset-bottom))" }} />
      <BottomNav inboxCount={inboxCount} />
    </div>
  );
}
