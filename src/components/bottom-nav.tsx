"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Grid2X2, Home, MessageSquare, ClipboardList, Sparkles } from "lucide-react";

const TABS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/sales", label: "Sales", icon: ClipboardList },
  { href: "/messages", label: "Inbox", icon: MessageSquare },
  { href: "/assistant", label: "Ask", icon: Sparkles },
  { href: "/more", label: "More", icon: Grid2X2 },
];

export function BottomNav({ inboxCount = 0 }: { inboxCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-black/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((tab) => {
          const active =
            tab.href === "/more"
              ? pathname === "/more" ||
                ![
                  "/dashboard",
                  "/sales",
                  "/messages",
                  "/assistant",
                ].some((h) => pathname === h || pathname.startsWith(`${h}/`))
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                  active ? "text-chile" : "text-muted"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                {tab.href === "/messages" && inboxCount > 0 ? (
                  <span className="absolute right-[18%] top-1.5 min-w-4 rounded-full bg-chile px-1 text-[10px] font-extrabold leading-4 text-black">
                    {inboxCount}
                  </span>
                ) : null}
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
