"use client";

import Link from "next/link";

export function MessageLangToggle({ lang }: { lang: "en" | "es" }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-paper-2 p-1">
      <Link
        href="/messages?lang=en"
        className={`flex items-center justify-center rounded-xl text-sm font-semibold ${
          lang === "en" ? "bg-card shadow-sm" : "text-muted"
        }`}
      >
        English
      </Link>
      <Link
        href="/messages?lang=es"
        className={`flex items-center justify-center rounded-xl text-sm font-semibold ${
          lang === "es" ? "bg-card shadow-sm" : "text-muted"
        }`}
      >
        Español
      </Link>
    </div>
  );
}
