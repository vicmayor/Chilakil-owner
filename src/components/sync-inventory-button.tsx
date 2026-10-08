"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
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
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={sync}
        disabled={pending}
        className="inline-flex items-center justify-center gap-1.5 text-sm font-extrabold text-ink disabled:opacity-60"
      >
        <RefreshCw size={15} className={pending ? "animate-spin" : ""} aria-hidden />
        {pending ? "Syncing…" : "Sync now"}
      </button>
      {message ? <p className="text-xs font-bold text-ink">{message}</p> : null}
    </div>
  );
}
