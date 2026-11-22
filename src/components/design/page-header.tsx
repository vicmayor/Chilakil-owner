import type { ReactNode } from "react";
import Image from "next/image";
import { COMBINED_BANNER, isCombinedScope, type LocationScope } from "@/lib/location";
import { LocationSegmented } from "@/components/design/location-segmented";
import { SyncStatus } from "@/components/design/sync-status";

export function PageHeader({
  title,
  subtitle,
  scope,
  syncLabel,
  syncAction,
  children,
}: {
  title: string;
  subtitle?: string;
  scope: LocationScope;
  syncLabel?: string;
  syncAction?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="bg-chile px-4 pb-5 pt-[max(0.85rem,env(safe-area-inset-top))] text-ink md:px-6">
      <div className="flex items-center gap-2.5">
        <span className="rounded-2xl bg-white p-0.5 ring-2 ring-ink">
          <Image src="/icon-192.png" alt="" width={36} height={36} className="h-9 w-9 rounded-[0.85rem]" />
        </span>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em]">Chilakil / Owner</p>
      </div>
      <h1 className="font-display mt-3 text-[2.7rem] font-black uppercase leading-[0.88] tracking-tight sm:text-6xl">
        {title}
      </h1>
      {subtitle ? <p className="mt-2 max-w-2xl text-sm font-semibold leading-5 text-ink/75">{subtitle}</p> : null}
      <div className="mt-4">
        <LocationSegmented value={scope} />
      </div>
      <p className="mt-3 text-[12px] font-medium leading-4 text-ink/70">
        {isCombinedScope(scope)
          ? COMBINED_BANNER
          : "Showing this location only. The other store is hidden from these numbers."}
      </p>
      {syncLabel ? (
        <div className="mt-3">
          <SyncStatus label={syncLabel} action={syncAction} />
        </div>
      ) : null}
      {children}
    </header>
  );
}
