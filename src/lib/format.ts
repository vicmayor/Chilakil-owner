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
