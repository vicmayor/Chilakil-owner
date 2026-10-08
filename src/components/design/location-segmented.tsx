"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocationScope } from "@/app/actions/location";
import type { LocationScope } from "@/lib/location";

const OPTIONS: { id: LocationScope; label: string; sub: string }[] = [
  { id: "all", label: "Both", sub: "All" },
  { id: "glendale", label: "Restaurant", sub: "Glendale" },
  { id: "avondale", label: "Trailer", sub: "Avondale" },
];

/** Three-way location control. ALL still means both stores, shown apart. */
export function LocationSegmented({ value }: { value: LocationScope }) {
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
      className={`grid grid-cols-3 gap-2 ${pending ? "opacity-70" : ""}`}
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
            className={`flex min-h-[4.5rem] flex-col items-start justify-center rounded-2xl px-3 py-2 text-left ${
              active ? "bg-ink text-white" : "bg-paper-2 text-ink"
            }`}
          >
            <span className="text-[15px] font-extrabold leading-tight tracking-tight">{opt.label}</span>
            <span className={`mt-0.5 text-[11px] font-semibold leading-4 ${active ? "text-white/70" : "text-muted"}`}>
              {opt.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}
