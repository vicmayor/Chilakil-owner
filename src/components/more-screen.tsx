import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { TopBar } from "@/components/top-bar";
import { LOCATIONS, type LocationScope } from "@/lib/location";
import { MODULES, type AppModule } from "@/lib/nav";

const SECTIONS: { title: string; hrefs: string[] }[] = [
  { title: "Sales & Delivery", hrefs: ["/sales", "/doordash", "/ubereats", "/grubhub"] },
  { title: "Kitchen & Costs", hrefs: ["/expenses", "/food-cost", "/menu"] },
  { title: "Customers & Marketing", hrefs: ["/messages", "/reviews", "/marketing"] },
  { title: "Team", hrefs: ["/employees", "/assistant"] },
];

const CONNECTED_APPS: { name: string; connected: boolean }[] = [
  { name: "Square", connected: true },
  { name: "DoorDash", connected: true },
  { name: "Uber Eats", connected: true },
  { name: "Chilakil Team", connected: true },
  { name: "Grubhub", connected: false },
  { name: "Meta", connected: false },
];

const TILE_STYLES = [
  { card: "border-line bg-card text-ink", badge: "bg-chile text-ink" },
  { card: "border-line bg-card text-ink", badge: "bg-ink text-chile" },
  { card: "border-chile bg-chile text-ink", badge: "bg-ink text-chile" },
] as const;

export function MoreScreen({ name, scope }: { name: string; scope: LocationScope }) {
  const byHref = new Map(MODULES.map((mod) => [mod.href, mod]));
  const dashboard = byHref.get("/dashboard");

  return (
    <>
      <TopBar title="More" subtitle={name} scope={scope} />
      <main className="space-y-7 px-4 py-5">
        <article className="flex items-center gap-4 rounded-[1.75rem] bg-ink p-4 text-white shadow-[0_18px_40px_-24px_rgba(0,0,0,0.55)]">
          <span
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-chile text-lg font-extrabold tracking-tight text-ink"
          >
            {initials(name)}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-chile">Owner</p>
            <p className="truncate text-xl font-extrabold leading-tight">{name}</p>
            <p className="mt-0.5 text-xs leading-5 text-white/70">{scopeLine(scope)}</p>
          </div>
        </article>

        {dashboard ? <ModuleTile mod={dashboard} wide styleIndex={2} kicker="Today" /> : null}

        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">{section.title}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {section.hrefs.map((href, index) => {
                const mod = byHref.get(href);
                if (!mod) return null;
                return <ModuleTile key={href} mod={mod} styleIndex={index} />;
              })}
            </div>
          </section>
        ))}

        <section>
          <h2 className="px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Connected apps</h2>
          <ul className="mt-3 overflow-hidden rounded-[1.75rem] border border-line bg-card shadow-[0_16px_40px_-24px_rgba(0,0,0,0.35)]">
            {CONNECTED_APPS.map((app) => (
              <li
                key={app.name}
                className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <span className="text-sm font-extrabold">{app.name}</span>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    app.connected ? "bg-chile text-ink" : "bg-paper-2 text-muted"
                  }`}
                >
                  {app.connected ? "Connected" : "Not yet"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <form action={logoutAction} className="pb-2">
          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-full text-sm font-semibold text-muted"
          >
            Sign out
          </button>
        </form>
      </main>
    </>
  );
}

function ModuleTile({
  mod,
  styleIndex,
  wide = false,
  kicker,
}: {
  mod: AppModule;
  styleIndex: number;
  wide?: boolean;
  kicker?: string;
}) {
  const Icon = mod.icon;
  const style = TILE_STYLES[styleIndex % TILE_STYLES.length];
  return (
    <Link
      href={mod.href}
      className={`flex justify-between rounded-[1.35rem] border p-4 shadow-[0_12px_32px_-20px_rgba(0,0,0,0.28)] ${style.card} ${
        wide ? "min-h-24 flex-row items-center gap-4" : "min-h-[108px] flex-col"
      }`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${style.badge}`}>
        <Icon size={22} strokeWidth={2.4} aria-hidden />
      </span>
      <span className={wide ? "min-w-0" : ""}>
        {kicker ? (
          <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-ink/70">{kicker}</span>
        ) : null}
        <span className={`block font-extrabold leading-5 ${wide ? "text-lg" : "text-sm"}`}>{mod.label}</span>
      </span>
    </Link>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function scopeLine(scope: LocationScope): string {
  if (scope === "all") return "Glendale restaurant · Avondale trailer";
  const place = LOCATIONS[scope];
  return `${place.shortName} ${place.typeLabel.toLowerCase()}`;
}
