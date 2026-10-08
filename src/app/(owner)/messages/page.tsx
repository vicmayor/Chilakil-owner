import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope } from "@/lib/location";
import { relativeFromNow } from "@/lib/dates";
import { RecordCard } from "@/components/design/record-card";
import { StatPill } from "@/components/design/stat-pill";
import { TopBar } from "@/components/top-bar";
import { LocationDot } from "@/components/ui";
import { MessageLangToggle } from "@/components/message-lang-toggle";

export const metadata = { title: "Customer Messages" };

const COPY = {
  en: {
    subtitle: "AI may draft. You approve anything sensitive before send.",
    sensitive: "Sensitive",
    approval: "Needs you",
    draft: "Draft ready",
  },
  es: {
    subtitle: "La IA puede redactar. Tú apruebas lo sensible antes de enviar.",
    sensitive: "Sensible",
    approval: "Requiere dueño",
    draft: "Borrador listo",
  },
};

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang: langParam } = await searchParams;
  const lang = langParam === "es" ? "es" : "en";
  const copy = COPY[lang];
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const messages = await prisma.customerMessage.findMany({
    where: { locationId: { in: ids } },
    orderBy: { receivedAt: "desc" },
  });

  return (
    <>
      <TopBar title={lang === "es" ? "Mensajes" : "Messages"} subtitle={copy.subtitle} scope={scope} />
      <main className="grid gap-3 px-4 py-4 md:grid-cols-2 md:px-6">
        <div className="md:col-span-2">
          <MessageLangToggle lang={lang} />
        </div>
        {messages.map((m) => {
          const pending = m.requiresOwnerApproval && m.status !== "sent" && m.status !== "rejected";
          return (
            <RecordCard
              key={m.id}
              title={m.customerName}
              kicker={<LocationDot id={m.locationId} />}
              status={m.status.replaceAll("_", " ")}
              statusTone={pending ? "pending" : "muted"}
              href={`/messages/${m.id}?lang=${lang}`}
              fields={[
                { label: "Channel", value: m.platform },
                { label: "When", value: relativeFromNow(m.receivedAt) },
                { label: "Language", value: m.language },
                { label: "Preview", value: m.body },
              ]}
            >
              <div className="flex flex-wrap gap-1.5">
                {m.sensitive ? <StatPill tone="pending">{copy.sensitive}</StatPill> : null}
                {pending ? <StatPill tone="pending">{copy.approval}</StatPill> : null}
                {m.draftReply && m.status === "pending_approval" ? <StatPill tone="ok">{copy.draft}</StatPill> : null}
              </div>
            </RecordCard>
          );
        })}
      </main>
    </>
  );
}
