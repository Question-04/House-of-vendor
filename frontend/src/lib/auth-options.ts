import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyToken } from "@/lib/api";
import { normalizePhone } from "@/lib/msg91-widget";

function parsePhoneAllowlist(): Set<string> {
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
  return parsePhoneAllowlist().has(normalized);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "AdminCredentials",
      credentials: {
        phone: { label: "Phone", type: "text" },
        accessToken: { label: "MSG91 access token", type: "text" },
      },
      async authorize(credentials) {
        const rawPhone = String(credentials?.phone || "");
        const accessToken = String(credentials?.accessToken || "");

        const phone = normalizePhone(rawPhone);
        if (!phone || !accessToken) return null;

        // Block anyone not in allowlist before even calling backend.
        if (!isAdminPhoneAllowed(phone)) return null;

        // Verify MSG91 access token server-side.
        const result = await verifyToken(accessToken, phone);
        if (!result?.success) return null;

        return { phone };
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/admin/sign-in",
  },

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      if (user && (user as any).phone) {
        (token as any).phone = (user as any).phone;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).phone = (token as any).phone;
      } else {
        (session as any).user = { phone: (token as any).phone };
      }
      return session;
    },
  },
};

