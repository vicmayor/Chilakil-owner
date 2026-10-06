import { DeliveryPlatformPage } from "@/components/delivery-platform-page";
import { DoorDashPricingView } from "@/components/doordash-pricing-view";
import { DoorDashSectionTabs } from "@/components/doordash-section-tabs";

export const metadata = { title: "DoorDash" };

export default async function DoorDashPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.view;
  const view = (Array.isArray(raw) ? raw[0] : raw) === "pricing" ? "pricing" : "overview";
  const tabs = <DoorDashSectionTabs active={view} />;

  if (view === "pricing") {
    return <DoorDashPricingView tabs={tabs} />;
  }

  return <DeliveryPlatformPage platform="doordash" belowHeader={tabs} />;
}
