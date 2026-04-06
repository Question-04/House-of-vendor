import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      const p = req.nextUrl.pathname;
      if (p === "/admin/sign-in") return true;
      return !!token;
    },
  },
});

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
