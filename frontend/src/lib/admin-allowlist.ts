import { normalizePhone } from "@/lib/msg91-widget";

export function parseAdminPhoneAllowlist(): Set<string> {
  const raw = process.env.ADMIN_HOV_PHONE_ALLOWLIST || "";
  const out = new Set<string>();
  for (const part of raw.split(",")) {
    const n = normalizePhone(part.trim());
    if (n) out.add(n);
  }
  return out;
}

export function isAdminPhoneAllowed(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  return parseAdminPhoneAllowlist().has(normalized);
}
