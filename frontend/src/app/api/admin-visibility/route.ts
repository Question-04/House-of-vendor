import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { isAdminPhoneAllowed } from "@/lib/admin-allowlist";

export async function GET() {
  const session = await getServerSession(authOptions);
  const phone = session?.user?.phone;
  return NextResponse.json({ allowed: isAdminPhoneAllowed(phone) });
}

