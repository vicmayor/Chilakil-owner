"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ClipboardList, Grid2X2, Home, MessageSquare, RefreshCw, Sparkles } from "lucide-react";
import { hrefWithoutRefreshParam, REFRESH_NAV_LABEL, refreshInstalledApp } from "@/lib/refresh-app";

const TABS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/sales", label: "Sales", icon: ClipboardList },
  { href: "/messages", label: "Inbox", icon: MessageSquare },
  { href: "/assistant", label: "Ask", icon: Sparkles },
  { href: "/more", label: "More", icon: Grid2X2 },
];

const itemClass =
  "relative flex min-h-14 min-w-0 w-full flex-col items-center justify-center gap-0.5 px-0.5 text-[9px] font-bold leading-none tracking-tight min-[360px]:text-[10px] min-[390px]:text-[11px]";

export function BottomNav({ inboxCount = 0 }: { inboxCount?: number }) {
  const pathname = usePathname();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const next = hrefWithoutRefreshParam(window.location.href);
    if (!next) return;
    window.history.replaceState(window.history.state, "", next);
  }, []);

  async function onRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshInstalledApp();
    } catch {
      window.location.reload();
    }
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-6">
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
            <li key={tab.href} className="min-w-0">
              <Link
                href={tab.href}
                className={`${itemClass} ${active ? "text-ink" : "text-muted"}`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 1.8} className="shrink-0" />
                {tab.href === "/messages" && inboxCount > 0 ? (
                  <span className="absolute right-0.5 top-1 min-w-4 rounded-full bg-chile px-1 text-[10px] font-bold leading-4 text-ink">
                    {inboxCount}
                  </span>
                ) : null}
                <span className="max-w-full truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="min-w-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-busy={refreshing}
            aria-label={REFRESH_NAV_LABEL}
            className={`${itemClass} ${refreshing ? "text-ink" : "text-muted"}`}
          >
            <RefreshCw
              size={20}
              strokeWidth={refreshing ? 2.4 : 1.8}
              aria-hidden
              className={`shrink-0 ${refreshing ? "animate-spin" : ""}`}
            />
            <span className="max-w-full truncate">{REFRESH_NAV_LABEL}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
