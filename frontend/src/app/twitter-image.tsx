import { ImageResponse } from "next/og";
import { SocialShareOgImage } from "@/lib/social-share-image";
import { SHARE_TITLE } from "@/lib/site-branding";

export const alt = SHARE_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(<SocialShareOgImage />, { ...size });
}
