import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope } from "@/lib/location";
import { formatTime, relativeFromNow } from "@/lib/dates";
import { TopBar } from "@/components/top-bar";
import { Card, LocationDot } from "@/components/ui";
import { MessageActions } from "@/components/message-actions";

export const metadata = { title: "Message" };

const LABELS = {
  en: {
    title: "Message",
    original: "Customer",
    draft: "AI draft — not sent",
    sent: "Sent after owner approval",
    rejected: "Rejected — do not send",
    gate: "Owner approval required before send",
    sensitive: "Sensitive",
  },
  es: {
    title: "Mensaje",
    original: "Cliente",
    draft: "Borrador de IA — no enviado",
    sent: "Enviado con aprobación del dueño",
    rejected: "Rechazado — no enviar",
    gate: "Requiere aprobación del dueño antes de enviar",
    sensitive: "Sensible",
  },
};

export default async function MessageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { lang: langParam } = await searchParams;
  const lang = langParam === "es" ? "es" : "en";
  const t = LABELS[lang];
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const message = await prisma.customerMessage.findUnique({ where: { id } });
  if (!message || !ids.includes(message.locationId as "glendale" | "avondale")) {
    notFound();
  }

  const flags: string[] = JSON.parse(message.sensitivityFlags || "[]");

  return (
    <>
      <TopBar title={t.title} subtitle={`${message.platform} · ${relativeFromNow(message.receivedAt)}`} scope={scope} />
      <main className="space-y-4 px-4 py-4">
        <Card>
          <div className="flex items-center justify-between">
            <LocationDot id={message.locationId} />
            <span className="text-[11px] font-bold uppercase text-muted">{message.language}</span>
          </div>
          <p className="mt-2 text-lg font-semibold">{message.customerName}</p>
          <p className="text-xs text-muted">{formatTime(message.receivedAt)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.sensitive ? (
              <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold uppercase text-danger">
                {t.sensitive}
              </span>
            ) : null}
            {message.requiresOwnerApproval ? (
              <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-bold uppercase text-warn">
                {t.gate}
              </span>
            ) : null}
            <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
              {message.category}
            </span>
            {flags.map((f) => (
              <span key={f} className="rounded-full bg-paper-2 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                {f.replace("_", " ")}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t.original}</p>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-6">{message.body}</p>
        </Card>

        {message.status === "sent" && message.approvedReply ? (
          <Card className="border-sage/30 bg-sage-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-sage">{t.sent}</p>
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-6">{message.approvedReply}</p>
          </Card>
        ) : null}

        {message.status === "rejected" ? (
          <Card className="border-danger/30 bg-danger-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-danger">{t.rejected}</p>
            {message.ownerNote ? <p className="mt-2 text-sm">{message.ownerNote}</p> : null}
          </Card>
        ) : null}

        {message.status !== "sent" && message.status !== "rejected" ? (
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t.draft}</p>
            {message.requiresOwnerApproval ? (
              <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
                {t.gate}. Complaints, refunds, allergy questions, and large catering never send
                on a draft alone.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Routine message — still a good habit to glance at the draft.
              </p>
            )}
            <MessageActions
              id={message.id}
              initialReply={message.draftReply ?? ""}
              lang={lang}
            />
          </Card>
        ) : null}
      </main>
    </>
  );
}
