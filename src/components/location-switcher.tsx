"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocationScope } from "@/app/actions/location";
import type { LocationScope } from "@/lib/location";

const OPTIONS: { id: LocationScope; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "glendale", label: "GLENDALE" },
  { id: "avondale", label: "AVONDALE" },
];

export function LocationSwitcher({ value }: { value: LocationScope }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function select(scope: LocationScope) {
    if (scope === value) return;
    start(async () => {
      await setLocationScope(scope);
      router.refresh();
    });
  }

  return (
    <div
      role="tablist"
      aria-label="Location"
      className={`grid grid-cols-3 gap-1 rounded-2xl bg-paper-2 p-1 ${pending ? "opacity-70" : ""}`}
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => select(opt.id)}
            className={`flex min-h-11 items-center justify-center rounded-xl px-1 text-[11px] font-bold tracking-wide ${
              active
                ? "bg-card text-ink shadow-sm"
                : "text-muted"
            }`}
          >
            {opt.id !== "all" ? (
              <span
                className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                  opt.id === "glendale" ? "bg-glendale" : "bg-avondale"
                }`}
              />
            ) : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
