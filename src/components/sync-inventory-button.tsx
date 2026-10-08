"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncInventoryAction } from "@/app/actions/inventory";

export function SyncInventoryButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function sync() {
    setMessage(null);
    start(async () => {
      const result = await syncInventoryAction();
      if (!result.connected) {
        setMessage("Not connected");
        router.refresh();
        return;
      }
      if (!result.ok) {
        setMessage(result.error ?? "Couldn't sync inventory.");
        router.refresh();
        return;
      }
      setMessage("Synced");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={sync}
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-chile px-4 text-sm font-bold text-ink disabled:opacity-60"
      >
        {pending ? "Syncing…" : "Sync now"}
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
