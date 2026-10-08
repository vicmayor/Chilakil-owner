import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type SectionTab = {
  id: string;
  href: string;
  label: string;
  icon?: LucideIcon;
  active: boolean;
};

export function SectionTabs({ ariaLabel, tabs }: { ariaLabel: string; tabs: SectionTab[] }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-1 overflow-x-auto rounded-2xl bg-ink p-1.5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={tab.active}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-extrabold ${
              tab.active ? "bg-chile text-ink" : "text-white"
            }`}
          >
            {Icon ? <Icon size={16} aria-hidden /> : null}
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
