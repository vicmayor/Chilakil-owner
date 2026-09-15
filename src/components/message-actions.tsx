"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { approveMessage, rejectMessage, saveDraft } from "@/app/actions/messages";

function BusyButton({
  children,
  className,
  formAction,
}: {
  children: React.ReactNode;
  className: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" formAction={formAction} disabled={pending} className={className}>
      {pending ? "…" : children}
    </button>
  );
}

export function MessageActions({
  id,
  initialReply,
  lang,
}: {
  id: string;
  initialReply: string;
  lang: "en" | "es";
}) {
  const [reply, setReply] = useState(initialReply);
  const t =
    lang === "es"
      ? { approve: "Aprobar y enviar", edit: "Guardar borrador", reject: "Rechazar", reply: "Respuesta" }
      : { approve: "Approve & send", edit: "Save draft", reject: "Reject", reply: "Reply" };

  return (
    <form className="mt-3 space-y-3">
      <input type="hidden" name="id" value={id} />
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t.reply}</span>
        <textarea
          name="reply"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          required
          className="mt-1 w-full rounded-2xl border border-line bg-paper px-3 py-3 text-[15px] leading-6 outline-none ring-chile/30 focus:ring-2"
        />
      </label>
      <BusyButton
        formAction={approveMessage}
        className="flex w-full items-center justify-center rounded-2xl bg-chile text-sm font-semibold text-white"
      >
        {t.approve}
      </BusyButton>
      <BusyButton
        formAction={saveDraft}
        className="flex w-full items-center justify-center rounded-2xl border border-line bg-card text-sm font-semibold"
      >
        {t.edit}
      </BusyButton>
      <BusyButton
        formAction={rejectMessage}
        className="flex w-full items-center justify-center rounded-2xl bg-danger-soft text-sm font-semibold text-danger"
      >
        {t.reject}
      </BusyButton>
    </form>
  );
}
