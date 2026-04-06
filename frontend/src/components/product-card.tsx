"use client";

import Link from "next/link";
import { ProductCardImage } from "@/components/product-card-image";
import type { ProductCard as ProductCardType } from "@/lib/api";
import styles from "./ProductCard.module.css";

function productLink(category: string, id: string): string {
  const cat = encodeURIComponent((category || "").trim().toLowerCase());
  const idEnc = encodeURIComponent(String(id).trim());
  return `/dashboard/product/${idEnc}${cat ? `?category=${cat}` : ""}`;
}

/** Strip brand from the start of product name (case-insensitive), then return up to maxWords. No ellipsis. */
function nameWithoutBrand(name: string, brand: string, maxWords: number = 5): string {
  let rest = String(name).trim();
  const brandTrim = String(brand).trim();
  if (brandTrim) {
    const re = new RegExp(`^\\s*${brandTrim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i");
    rest = rest.replace(re, "").trim();
  }
  const words = rest.split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

function truncateWords(value: string, maxWords: number): string {
  const words = String(value).trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value;
  return `${words.slice(0, maxWords).join(" ")}…`;
}

type Props = {
  product: ProductCardType;
  category?: string;
};

/**
 * Product card matching SneakerProductGrid (sneaker listing page).
 * Uses ProductCard.module.css: card, imageContainer, image, content, infoText, brand, name, price.
 */
export function ProductCard({ product, category: categoryProp }: Props) {
  const category = categoryProp ?? product.category ?? "";
  const href = productLink(category, product.id);
  const baseName = nameWithoutBrand(
    product.name,
    product.brand ?? "",
    category === "perfumes" ? 7 : 5,
  );
  const isWatch = category === "watches";
  const mobileMaxWords = isWatch ? 8 : 4;
  const mobileName = isWatch ? baseName : truncateWords(baseName, mobileMaxWords);

  return (
    <Link className={styles.card} href={href}>
      <div className={styles.imageContainer}>
        <div className={styles.imageWrapper}>
          <ProductCardImage
            src={product.image}
            alt={product.name}
            sizes="320px"
            imageClassName={styles.image}
          />
        </div>
      </div>
      <div className={styles.content}>
        <div className={styles.infoText}>
          <div className={styles.brand}>{product.brand}</div>
          <div className={`${styles.name} ${isWatch ? styles.clampTwoMobile : ""}`}>
            <span className="hidden sm:inline">{baseName}</span>
            <span className="inline sm:hidden">{mobileName}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
