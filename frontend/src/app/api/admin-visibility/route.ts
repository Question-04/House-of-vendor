import { NextRequest, NextResponse } from "next/server";
import { normalizePhone } from "@/lib/msg91-widget";

function parseAllowlist(): Set<string> {
  const raw = process.env.ADMIN_HOV_PHONE_ALLOWLIST || "";
  const out = new Set<string>();
  for (const part of raw.split(",")) {
    const n = normalizePhone(part.trim());
    if (n) out.add(n);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const phoneRaw = url.searchParams.get("phone") || "";
  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return NextResponse.json({ allowed: false });
  }
  return NextResponse.json({ allowed: parseAllowlist().has(phone) });
}

