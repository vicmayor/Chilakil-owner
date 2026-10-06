"use client";

import Link from "next/link";

export function MessageLangToggle({ lang }: { lang: "en" | "es" }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-full bg-paper-2 p-1">
      <Link
        href="/messages?lang=en"
        className={`flex items-center justify-center rounded-full text-sm font-bold ${
          lang === "en" ? "bg-chile text-ink shadow-sm" : "text-muted"
        }`}
      >
        English
      </Link>
      <Link
        href="/messages?lang=es"
        className={`flex items-center justify-center rounded-full text-sm font-bold ${
          lang === "es" ? "bg-chile text-ink shadow-sm" : "text-muted"
        }`}
      >
        Español
      </Link>
    </div>
  );
}
