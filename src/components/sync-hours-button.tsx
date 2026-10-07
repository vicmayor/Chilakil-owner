"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncEmployeeHoursAction } from "@/app/actions/employee-hours";

export function SyncHoursButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function sync() {
    setMessage(null);
    start(async () => {
      const result = await syncEmployeeHoursAction();
      if (!result.connected) {
        setMessage("Not connected");
        router.refresh();
        return;
      }
      if (!result.ok) {
        setMessage("Couldn't sync hours.");
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
        className="inline-flex items-center justify-center rounded-full bg-chile px-4 text-sm font-bold text-ink disabled:opacity-60"
      >
        {pending ? "Syncing…" : "Sync now"}
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
