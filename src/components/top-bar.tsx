import { COMBINED_BANNER, isCombinedScope, type LocationScope } from "@/lib/location";
import { LocationSwitcher } from "@/components/location-switcher";

export function TopBar({
  title,
  subtitle,
  scope,
}: {
  title: string;
  subtitle?: string;
  scope: LocationScope;
}) {
  return (
    <header
      className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 px-4 pb-3 backdrop-blur-md"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div className="mx-auto max-w-lg">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-chile">
          Chilakil Owner
        </p>
        <h1 className="font-display mt-0.5 text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
        <div className="mt-3">
          <LocationSwitcher value={scope} />
        </div>
        {isCombinedScope(scope) ? (
          <p className="mt-2 text-[12px] leading-4 text-muted">{COMBINED_BANNER}</p>
        ) : (
          <p className="mt-2 text-[12px] leading-4 text-muted">
            Showing this location only. The other store is hidden from these numbers.
          </p>
        )}
      </div>
    </header>
  );
}
