import Link from "next/link";
import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope } from "@/lib/location";
import { relativeFromNow } from "@/lib/dates";
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
      <main className="space-y-3 px-4 py-4">
        <MessageLangToggle lang={lang} />
        {messages.map((m) => (
          <Link
            key={m.id}
            href={`/messages/${m.id}?lang=${lang}`}
            className="block rounded-2xl border border-line bg-card px-4 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <LocationDot id={m.locationId} />
              <span className="text-[11px] font-bold uppercase text-muted">
                {m.language} · {m.platform}
              </span>
            </div>
            <p className="mt-1 font-semibold">{m.customerName}</p>
            <p className="line-clamp-2 text-sm leading-5 text-muted">{m.body}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {m.sensitive ? (
                <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold uppercase text-danger">
                  {copy.sensitive}
                </span>
              ) : null}
              {m.requiresOwnerApproval && m.status !== "sent" && m.status !== "rejected" ? (
                <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-bold uppercase text-warn">
                  {copy.approval}
                </span>
              ) : null}
              {m.draftReply && m.status === "pending_approval" ? (
                <span className="rounded-full bg-sage-soft px-2 py-0.5 text-[10px] font-bold uppercase text-sage">
                  {copy.draft}
                </span>
              ) : null}
              <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                {m.status.replace("_", " ")}
              </span>
              <span className="text-[11px] text-muted">{relativeFromNow(m.receivedAt)}</span>
            </div>
          </Link>
        ))}
      </main>
    </>
  );
}
