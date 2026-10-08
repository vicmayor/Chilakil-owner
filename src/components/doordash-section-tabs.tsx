import { Bike, Tags } from "lucide-react";
import { SectionTabs } from "@/components/design/section-tabs";

export function DoorDashSectionTabs({ active }: { active: "overview" | "pricing" }) {
  return (
    <div className="px-4 pt-3 md:px-6">
      <SectionTabs
        ariaLabel="DoorDash sections"
        tabs={[
          { id: "overview", href: "/doordash", label: "Overview", icon: Bike, active: active === "overview" },
          {
            id: "pricing",
            href: "/doordash?view=pricing",
            label: "Pricing",
            icon: Tags,
            active: active === "pricing",
          },
        ]}
      />
    </div>
  );
}