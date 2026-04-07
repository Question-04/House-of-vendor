import { withAuth } from "next-auth/middleware";
import { isAdminPhoneAllowed } from "@/lib/admin-allowlist";

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      const p = req.nextUrl.pathname;
      if (p === "/admin/sign-in") return true;
      const phone = (token as { phone?: string } | null)?.phone;
      return isAdminPhoneAllowed(phone);
    },
  },
});

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
