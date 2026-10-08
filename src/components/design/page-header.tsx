import type { ReactNode } from "react";
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
    <header className="px-4 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))] md:px-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-muted">Chilakil / Owner</p>
      <h1 className="font-display mt-1 text-[3.15rem] font-black uppercase leading-[0.86] tracking-tight text-ink sm:text-6xl md:text-7xl">
        {title}
      </h1>
      {subtitle ? <p className="mt-3 max-w-2xl text-sm leading-5 text-muted">{subtitle}</p> : null}
      <div className="mt-5">
        <LocationSegmented value={scope} />
      </div>
      <p className="mt-3 text-[12px] leading-4 text-muted">
        {isCombinedScope(scope)
          ? COMBINED_BANNER
          : "Showing this location only. The other store is hidden from these numbers."}
      </p>
      {syncLabel ? (
        <div className="mt-4">
          <SyncStatus label={syncLabel} action={syncAction} />
        </div>
      ) : null}
      {children}
    </header>
  );
}
