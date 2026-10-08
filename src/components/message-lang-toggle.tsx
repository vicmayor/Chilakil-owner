"use client";

import { SectionTabs } from "@/components/design/section-tabs";

export function MessageLangToggle({ lang }: { lang: "en" | "es" }) {
  return (
    <SectionTabs
      ariaLabel="Message language"
      tabs={[
        { id: "en", href: "/messages?lang=en", label: "English", active: lang === "en" },
        { id: "es", href: "/messages?lang=es", label: "Español", active: lang === "es" },
      ]}
    />
  );
}