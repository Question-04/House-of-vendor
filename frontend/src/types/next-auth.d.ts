import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      image?: string | null;
    };
  }
}

