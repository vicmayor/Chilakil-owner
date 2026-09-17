export function money(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function moneyExact(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function pct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function number(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function channelLabel(channel: string): string {
  switch (channel) {
    case "in_store":
      return "In-store";
    case "doordash":
      return "DoorDash";
    case "ubereats":
      return "Uber Eats";
    case "grubhub":
      return "Grubhub";
    default:
      return channel;
  }
}

export function platformLabel(platform: string): string {
  switch (platform) {
    case "doordash":
      return "DoorDash";
    case "ubereats":
      return "Uber Eats";
    case "grubhub":
      return "Grubhub";
    case "google":
      return "Google";
    case "google_ads":
      return "Google Ads";
    case "google_business":
      return "Google Business";
    case "search":
      return "Search";
    case "maps":
      return "Maps";
    case "youtube":
      return "YouTube";
    case "tiktok":
      return "TikTok";
    case "yelp":
      return "Yelp";
    case "instagram":
      return "Instagram";
    case "facebook":
      return "Facebook";
    case "sms":
      return "SMS";
    case "email":
      return "Email";
    case "phone":
      return "Phone";
    case "square":
      return "Square";
    case "meta":
      return "Meta";
    case "banking":
      return "Banking";
    default:
      return platform;
  }
}

export function campaignStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "ended":
      return "Ended";
    case "draft":
      return "Draft";
    case "scheduled":
      return "Scheduled";
    default:
      return status;
  }
}

export function resultTypeLabel(resultType: string | null | undefined): string {
  switch (resultType) {
    case "purchases":
      return "Purchases";
    case "leads":
      return "Leads";
    case "messages":
      return "Messages";
    case "link_clicks":
      return "Link clicks";
    case "reach":
      return "Reach";
    case "video_views":
      return "Video views";
    default:
      return resultType ? resultType.replace(/_/g, " ") : "Results";
  }
}

export function expenseCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    meat: "Meat",
    produce: "Produce",
    dairy: "Dairy",
    dry_goods: "Dry goods",
    packaging: "Packaging",
    utilities: "Utilities",
    propane: "Propane",
    repairs: "Repairs",
    marketing: "Marketing",
    supplies: "Supplies",
    other: "Other",
  };
  return map[category] ?? category;
}
