import Link from "next/link";

export function DoorDashSectionTabs({ active }: { active: "overview" | "pricing" }) {
  const tabs = [
    { id: "overview" as const, href: "/doordash", label: "Overview" },
    { id: "pricing" as const, href: "/doordash?view=pricing", label: "Pricing" },
  ];

  return (
    <div className="px-4 pt-3">
      <div
        role="tablist"
        aria-label="DoorDash sections"
        className="grid grid-cols-2 gap-1 rounded-full bg-paper-2 p-1"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              role="tab"
              aria-selected={selected}
              className={`flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-bold ${
                selected ? "bg-chile text-ink" : "text-muted"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
