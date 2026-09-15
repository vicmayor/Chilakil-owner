import Link from "next/link";
import { MODULES } from "@/lib/nav";
import { getLocationScope } from "@/lib/scope";
import { requireSession } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { TopBar } from "@/components/top-bar";
import { prisma } from "@/lib/db";
import { locationIdsForScope } from "@/lib/location";

export const metadata = { title: "More" };

export default async function MorePage() {
  const session = await requireSession();
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const integrations = await prisma.integrationConfig.findMany({
    where: { locationId: { in: ids } },
    orderBy: [{ locationId: "asc" }, { provider: "asc" }],
  });

  return (
    <>
      <TopBar title="More" subtitle={session.name} scope={scope} />
      <main className="space-y-5 px-4 py-4">
        <section>
          <h2 className="mb-2 text-sm font-semibold">All modules</h2>
          <div className="grid grid-cols-3 gap-2">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className="flex min-h-[92px] flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-card px-2 text-center"
                >
                  <Icon size={22} className="text-chile" />
                  <span className="text-[11px] font-semibold leading-4">{mod.label}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Integrations (placeholders)</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {integrations.map((i) => (
              <li key={i.id} className="px-4 py-3 text-sm">
                <p className="font-medium capitalize">
                  {i.locationId} · {i.provider}
                </p>
                <p className="text-xs text-muted">
                  {i.status} · secret ref <span className="text-ink">{i.secretRef}</span>
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-5 text-muted">
            Phase 1 never stores API keys in the database and never calls DoorDash, Uber Eats,
            Grubhub, Square, Meta, or the bank. Put values only in env vars when you are ready.
          </p>
        </section>

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-2xl border border-line bg-card text-sm font-semibold"
          >
            Sign out
          </button>
        </form>
      </main>
    </>
  );
}
