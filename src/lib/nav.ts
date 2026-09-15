import type { LucideIcon } from "lucide-react";
import {
  Bike,
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Receipt,
  Sparkles,
  Star,
  Truck,
  Users,
  UtensilsCrossed,
  Wheat,
} from "lucide-react";

export type AppModule = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  group: "home" | "money" | "ops" | "people";
};

export const MODULES: AppModule[] = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard, group: "home" },
  { href: "/sales", label: "Sales", shortLabel: "Sales", icon: ClipboardList, group: "money" },
  { href: "/doordash", label: "DoorDash", shortLabel: "Dash", icon: Bike, group: "money" },
  { href: "/ubereats", label: "Uber Eats", shortLabel: "Uber", icon: UtensilsCrossed, group: "money" },
  { href: "/grubhub", label: "Grubhub", shortLabel: "Grub", icon: Truck, group: "money" },
  { href: "/expenses", label: "Expenses", shortLabel: "Spend", icon: Receipt, group: "money" },
  { href: "/food-cost", label: "Food Cost", shortLabel: "COGS", icon: Wheat, group: "ops" },
  { href: "/menu", label: "Menu & Recipes", shortLabel: "Menu", icon: BookOpen, group: "ops" },
  { href: "/messages", label: "Customer Messages", shortLabel: "Inbox", icon: MessageSquare, group: "people" },
  { href: "/reviews", label: "Reviews", shortLabel: "Reviews", icon: Star, group: "people" },
  { href: "/marketing", label: "Marketing", shortLabel: "Ads", icon: Megaphone, group: "ops" },
  { href: "/employees", label: "Employees", shortLabel: "Team", icon: Users, group: "people" },
  { href: "/assistant", label: "AI Assistant", shortLabel: "Ask", icon: Sparkles, group: "home" },
];

export const TAB_HREFS = ["/dashboard", "/sales", "/messages", "/assistant", "/more"] as const;
