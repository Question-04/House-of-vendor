import { SignJWT } from "jose";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions, isAdminPhoneAllowed } from "@/lib/auth-options";

const defaultApi = "http://localhost:8080";

async function mintAdminJWT(phone: string): Promise<string> {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("ADMIN_JWT_SECRET must be set (min 16 chars) and match the Go API");
  }
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ phone })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(key);
}

async function proxy(req: NextRequest, method: string, pathSegments: string[]) {
  const session = await getServerSession(authOptions);
  const phone = session?.user?.phone;
  if (!phone || !isAdminPhoneAllowed(phone)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  let token: string;
  try {
    token = await mintAdminJWT(phone);
  } catch (e) {
    console.error("[admin-backend]", e);
    return NextResponse.json({ success: false, message: "Server misconfigured" }, { status: 500 });
  }

  const base = (process.env.INTERNAL_VENDOR_API_URL || process.env.NEXT_PUBLIC_API_URL || defaultApi).replace(/\/$/, "");
  const subpath = pathSegments.join("/");
  const target = new URL(req.url);
  const dest = `${base}/api/admin/${subpath}${target.search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const ct = req.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };
  if (method !== "GET" && method !== "HEAD") {
    const body = await req.text();
    if (body) init.body = body;
  }

  const res = await fetch(dest, init);
  const text = await res.text();
  const out = new NextResponse(text, { status: res.status });
  const outCt = res.headers.get("content-type");
  if (outCt) out.headers.set("Content-Type", outCt);
  return out;
}

type RouteCtx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, "GET", path || []);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, "POST", path || []);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, "PATCH", path || []);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxy(req, "DELETE", path || []);
}

