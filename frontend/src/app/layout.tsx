import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/contexts/theme-context";
import {
  BUSINESS_NAME,
  META_DESCRIPTION,
  ORGANIZATION_DESCRIPTION,
  SHARE_TITLE,
  SITE_AUTHOR,
  SITE_KEYWORDS,
  SITE_TITLE_DEFAULT,
} from "@/lib/site-branding";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const siteUrlRaw = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
const metadataBase = (() => {
  try {
    return new URL(siteUrlRaw.endsWith("/") ? siteUrlRaw.slice(0, -1) : siteUrlRaw);
  } catch {
    return new URL("http://localhost:3000");
  }
})();

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: SITE_TITLE_DEFAULT,
    template: `%s | ${BUSINESS_NAME}`,
  },
  description: META_DESCRIPTION,
  applicationName: BUSINESS_NAME,
  authors: [SITE_AUTHOR],
  keywords: SITE_KEYWORDS,
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/favicon-48x48.png",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: metadataBase,
    siteName: BUSINESS_NAME,
    title: SHARE_TITLE,
    description: META_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: META_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: BUSINESS_NAME,
  url: metadataBase.toString(),
  description: ORGANIZATION_DESCRIPTION,
  logo: new URL("/favicon-48x48.png", metadataBase).toString(),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem("vendor-theme");document.documentElement.classList.toggle("dark",t==="dark");})();`,
          }}
        />
      </head>
      <body className={`${montserrat.variable} antialiased`}>
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
