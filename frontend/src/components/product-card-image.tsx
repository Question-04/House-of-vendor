"use client";

import Image from "next/image";
import { useState } from "react";

/** Same logo as in the navbar — used when product image is missing or fails to load. */
const FALLBACK_LOGO = "/House of vendors blue.svg";

type Props = {
  src: string | undefined;
  alt: string;
  sizes?: string;
  /** Optional class for the image element (e.g. UniversalProductGrid .image styles). */
  imageClassName?: string;
};

/** True if URL is external (any CDN); use native <img> so we don't need next.config hostnames. */
function isExternalUrl(url: string): boolean {
  const trimmed = String(url).trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

/**
 * Renders the product image for a card. If the image URL is missing, empty, or fails to load
 * (e.g. 404, broken link, CORS), we show the House of Vendors logo.
 * External URLs use a native <img> so any CDN works without configuring next.config images.
 */
const defaultImageClass = "absolute inset-0 h-full w-full object-contain p-2";

export function ProductCardImage({ src, alt, sizes = "25vw", imageClassName }: Props) {
  const [failed, setFailed] = useState(false);
  const showLogo = !src || !String(src).trim() || failed;
  const imgClass = imageClassName ?? defaultImageClass;

  if (showLogo) {
    return (
      <Image
        src={FALLBACK_LOGO}
        alt="Vendors"
        fill
        className={imageClassName ?? "object-contain p-6"}
        sizes={sizes}
      />
    );
  }

  // External URLs (any CDN): use native <img> so we never need to add hostnames to next.config
  if (isExternalUrl(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={imgClass}
        onError={() => setFailed(true)}
      />
    );
  }

  // Local paths: use next/image for optimization
  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={imgClass}
      sizes={sizes}
      onError={() => setFailed(true)}
    />
  );
}
