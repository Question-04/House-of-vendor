/** Single source for titles, meta, OG, JSON-LD, web manifest — keep in sync. */

export const BUSINESS_NAME = "House of Vendor";

/** Line above the main name on share images / positioning. */
export const MARKETPLACE_TAGLINE = "Marketplace for Plutians";

/** Default document title (search + browser tab). */
export const SITE_TITLE_DEFAULT = `${BUSINESS_NAME} | ${MARKETPLACE_TAGLINE} — vendor login`;

/** Short hook for og:title / twitter:title (can match or slightly shorten). */
export const SHARE_TITLE = `${BUSINESS_NAME} — ${MARKETPLACE_TAGLINE}`;

/**
 * Meta description: primary input for Google snippet (may still be rewritten).
 * ~155 chars — lead with marketplace + vendor value, end with a wink.
 */
export const META_DESCRIPTION =
  "Marketplace for Plutians: vendor login, listings, and inventory in one place. OTP sign-in—because passwords are so last aeon. House of Vendor.";

/** Longer copy for Organization schema and Open Graph body text. */
export const ORGANIZATION_DESCRIPTION =
  "House of Vendor is the vendor-side marketplace for Plutians: secure OTP sign-in, onboarding, product listings, and inventory—built for sellers who ship the goods while someone else names the constellations.";

/** One-liner on generated social images (under the main title). */
export const SHARE_HUMOR_LINE =
  "Vendor HQ for Plutians—OTP in, chaos optional.";

export const SITE_KEYWORDS = [
  "House of Vendor",
  "Plutians",
  "vendor marketplace",
  "vendor login",
  "seller portal",
  "OTP login",
  "India",
  "inventory",
  "vendor onboarding",
];

export const SITE_AUTHOR = { name: BUSINESS_NAME };
