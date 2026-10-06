import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope } from "@/lib/location";
import { relativeFromNow } from "@/lib/dates";
import { platformLabel } from "@/lib/format";
import { TopBar } from "@/components/top-bar";
import { Card, LocationDot } from "@/components/ui";

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
      <main className="space-y-3 px-4 py-4">
        {reviews.map((r) => (
          <Card key={r.id} className={r.rating <= 2 ? "border-danger/30" : ""}>
            <div className="flex items-center justify-between">
              <LocationDot id={r.locationId} />
              <span className="text-xs font-semibold text-muted">{platformLabel(r.platform)}</span>
            </div>
            <p className="mt-1 text-lg font-semibold tracking-wide">
              {"★".repeat(r.rating)}
              <span className="text-mesa">{"★".repeat(5 - r.rating)}</span>
            </p>
            <p className="text-sm font-medium">{r.author}</p>
            <p className="mt-1 text-[15px] leading-6">{r.text}</p>
            <p className="mt-2 text-xs text-muted">
              {relativeFromNow(r.reviewedAt)}
              {r.responded ? " · replied" : " · needs a reply"}
            </p>
            {r.responseText ? (
              <p className="mt-2 rounded-xl bg-paper-2 px-3 py-2 text-sm text-muted">{r.responseText}</p>
            ) : null}
          </Card>
        ))}
      </main>
    </>
  );
}
