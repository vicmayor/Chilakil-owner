import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope } from "@/lib/location";
import { relativeFromNow } from "@/lib/dates";
import { platformLabel } from "@/lib/format";
import { AlertCard } from "@/components/design/alert-card";
import { RecordCard } from "@/components/design/record-card";
import { TopBar } from "@/components/top-bar";
import { LocationDot } from "@/components/ui";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const reviews = await prisma.review.findMany({
    where: { locationId: { in: ids } },
    orderBy: { reviewedAt: "desc" },
  });

  return (
    <>
      <TopBar title="Reviews" subtitle="Respond before it sits overnight" scope={scope} />
      <main className="grid gap-3 px-4 py-4 md:grid-cols-2 md:px-6">
        {reviews.map((r) => {
          const stars = `${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}`;
          if (r.rating <= 2) {
            return (
              <AlertCard key={r.id} tone="problem" title={`${r.author} · ${stars}`}>
                <span className="mb-1 inline-flex">
                  <LocationDot id={r.locationId} />
                </span>
                <span className="block">{r.text}</span>
                <span className="mt-1 block text-xs">
                  {platformLabel(r.platform)} · {relativeFromNow(r.reviewedAt)}
                  {r.responded ? " · replied" : " · needs a reply"}
                </span>
              </AlertCard>
            );
          }
          return (
            <RecordCard
              key={r.id}
              title={r.author}
              status={r.responded ? "Replied" : "Needs reply"}
              statusTone={r.responded ? "ok" : "pending"}
              kicker={<LocationDot id={r.locationId} />}
              fields={[
                { label: "Rating", value: stars },
                { label: "Platform", value: platformLabel(r.platform) },
                { label: "When", value: relativeFromNow(r.reviewedAt) },
                { label: "Review", value: r.text },
              ]}
            >
              {r.responseText ? <p className="text-sm leading-5 text-muted">{r.responseText}</p> : null}
            </RecordCard>
          );
        })}
      </main>
    </>
  );
}
