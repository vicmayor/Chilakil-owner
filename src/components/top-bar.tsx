import type { ReactNode } from "react";
import { PageHeader } from "@/components/design/page-header";
import type { LocationScope } from "@/lib/location";

export function TopBar({
  title,
  subtitle,
  scope,
  syncLabel,
  syncAction,
}: {
  title: string;
  subtitle?: string;
  scope: LocationScope;
  syncLabel?: string;
  syncAction?: ReactNode;
}) {
  return (
    <PageHeader title={title} subtitle={subtitle} scope={scope} syncLabel={syncLabel} syncAction={syncAction} />
  );
}
