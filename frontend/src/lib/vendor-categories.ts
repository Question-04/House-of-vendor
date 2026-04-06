/** Must stay in sync with backend allowedVendorProfileCategories. */
export const PRIMARY_SELLING_CATEGORY_OPTIONS = [
  "Sneakers",
  "Handbags",
  "Watches",
  "Apparel",
  "Perfumes",
  "Accessories",
] as const;

export type PrimarySellingCategory = (typeof PRIMARY_SELLING_CATEGORY_OPTIONS)[number];

/** Normalize API profile.otherCategories (new: string[], legacy: string). */
export function parseOtherCategoriesFromProfile(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      /* legacy free text or comma-separated */
    }
    if (value.includes(",")) {
      return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [value.trim()];
  }
  return [];
}
