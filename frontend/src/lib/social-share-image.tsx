import {
  BUSINESS_NAME,
  MARKETPLACE_TAGLINE,
  SHARE_HUMOR_LINE,
} from "@/lib/site-branding";

/** JSX subtree for `next/og` ImageResponse (WhatsApp / social previews). */
export function SocialShareOgImage() {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(145deg, #0f2744 0%, #1a4a6e 45%, #2563a8 100%)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 600,
            color: "rgba(255,255,255,0.88)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {MARKETPLACE_TAGLINE}
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 68,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {BUSINESS_NAME}
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 28,
            fontWeight: 400,
            color: "rgba(255,255,255,0.82)",
            maxWidth: 920,
            lineHeight: 1.35,
          }}
        >
          {SHARE_HUMOR_LINE}
        </div>
      </div>
    </div>
  );
}
