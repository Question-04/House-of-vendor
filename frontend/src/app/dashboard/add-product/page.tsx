"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import VendorFooter from "@/components/vendor-footer";
import { submitProductReview, uploadProductReviewImages } from "@/lib/api";

const CATEGORIES = [
  { id: "sneakers", label: "Sneakers" },
  { id: "apparel", label: "Apparel" },
  { id: "accessories", label: "Accessories" },
  { id: "perfumes", label: "Perfumes" },
  { id: "watches", label: "Watches" },
  { id: "handbags", label: "Handbags" },
];

export default function AddProductPage() {
  const router = useRouter();
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [productLink, setProductLink] = useState("");
  const [description, setDescription] = useState("");
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_IMAGES = 5;
  const MAX_SIZE_MB = 10;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploadError(null);
    const list = Array.from(files).slice(0, MAX_IMAGES);
    const valid: File[] = [];

    for (const f of list) {
      if (!f.type.match(/^image\/(jpeg|jpg|png)$/)) continue;
      if (f.size > MAX_SIZE_MB * 1024 * 1024) continue;
      valid.push(f);
    }

    if (valid.length === 0) {
      setUploadError("Only JPG/PNG up to 10 MB each. Max 5 images.");
      e.target.value = "";
      return;
    }
    if (uploadedUrls.length + valid.length > MAX_IMAGES) {
      setUploadError(`Max ${MAX_IMAGES} images.`);
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const res = await uploadProductReviewImages(valid);
      if (res.success && res.urls?.length) {
        setUploadedUrls((prev) => [...prev, ...res.urls!].slice(0, MAX_IMAGES));
      } else {
        setUploadError(res.message || "Upload failed");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeImage = (index: number) => {
    setUploadedUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const link = productLink.trim();
    const cat = category.trim().toLowerCase();
    if (!link || !cat) return;

    setSubmitting(true);
    try {
      const res = await submitProductReview({
        productName: productName.trim(),
        category: cat,
        productLink: link,
        description: description.trim() || undefined,
        imageUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
      });
      if (res.success) setShowSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveForLater = () => {
    try {
      localStorage.setItem(
        "vendor_draft_product",
        JSON.stringify({ productName, category, productLink, description, uploadedUrls })
      );
    } catch {}
    router.push("/home");
  };

  const labelClass = "mb-1 block font-semibold text-[#1C3040]";
  const labelStyle = { fontFamily: "'Montserrat', Arial, sans-serif", fontSize: 16 };
  const inputStyle = { fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 400 };

  return (
    <div className="w-full px-2 pb-16 pt-6 sm:px-6 lg:px-8">
      {showSuccess && (
        <div className="mb-4 flex items-center gap-3 rounded border border-[#c7e7c8] bg-[#e9f8ea] px-3 py-2 text-sm text-[#16461d] sm:max-w-[520px] sm:px-4">
          <Image src="/Verified screen tag.svg" alt="Form submitted" width={28} height={28} className="h-7 w-7" />
          <div className="flex-1">
            <p className="font-semibold" style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: 13 }}>
              Form submitted
            </p>
            <p className="text-[11px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
              We&apos;ll review your product and update the catalogue within 24–48 hours.
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[900px]">
        <div className="mb-4 flex items-center gap-5">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center border border-[#c7a77b] bg-white"
            aria-label="Go back"
          >
            <BackIcon className="h-5 w-5 shrink-0" />
          </button>
          <div className="min-w-0 flex-1">
            <h1
              className="truncate font-medium text-[#1C3040]"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: 20 }}
            >
              Add Product for Review
            </h1>
            <p
              className="mt-0.5 text-[12px] text-[#72808C] sm:text-[14px]"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 400 }}
            >
              Submit product details. Our team will review and add it to the catalogue within 24–48 hours.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6 sm:mt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} style={labelStyle}>
                Product Name
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Enter full product name"
                className="w-full rounded-none border border-[#DCE1E6] bg-white px-3 py-2.5 text-[16px] text-[#1C3040] placeholder:text-[#72808C] focus:border-[#c7a77b] focus:outline-none sm:text-[14px]"
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                Product Category
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  className="w-full appearance-none rounded-none border border-[#DCE1E6] bg-white py-2.5 pl-3 pr-10 text-[16px] text-[#1C3040] focus:border-[#c7a77b] focus:outline-none sm:text-[14px]"
                  style={inputStyle}
                >
                  <option value="">Select product category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#1C3040]">
                  <DropdownIcon className="h-6 w-6" />
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Image (optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              className="mt-1 min-h-[220px] cursor-pointer rounded-none border-2 border-dashed border-[#DCE1E6] bg-white px-6 py-14 text-center transition-colors hover:border-[#c7a77b] hover:bg-[#faf9f7]"
            >
              <div className="flex justify-center">
                <UploadIcon className="h-8 w-8 text-[#1C3040]" />
              </div>
              <p
                className="mt-3 font-medium text-[#1C3040]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: 13 }}
              >
                {uploading ? "Uploading…" : "Click to upload product images"}
              </p>
              <p
                className="mt-1 text-[#72808C]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: 11, fontWeight: 400 }}
              >
                JPG, PNG up to 10 MB (max 5 images). Stored in R2.
              </p>
              {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
            </div>
            {uploadedUrls.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {uploadedUrls.map((url, i) => (
                  <div key={url} className="relative">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block h-20 w-20 overflow-hidden rounded border border-[#e0e6ed] bg-[#f2f3f4]"
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </a>
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1C3040] text-xs text-white hover:bg-[#2d4555]"
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Or paste product link <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={productLink}
              onChange={(e) => setProductLink(e.target.value)}
              placeholder="Paste available product link"
              required
              className="w-full rounded-none border border-[#DCE1E6] bg-white px-3 py-2.5 text-[16px] text-[#1C3040] placeholder:text-[#72808C] focus:border-[#c7a77b] focus:outline-none sm:text-[14px]"
              style={inputStyle}
            />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Product Description <span className="text-sm font-normal italic text-[#72808C]">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter detailed product description, condition, special, features..."
              rows={4}
              className="w-full rounded-none border border-[#DCE1E6] bg-white px-3 py-2.5 text-[16px] text-[#1C3040] placeholder:text-[#72808C] focus:border-[#c7a77b] focus:outline-none sm:text-[14px]"
              style={inputStyle}
            />
            <p
              className="mt-0.5 text-[#c7a77b]"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: 11, fontWeight: 400 }}
            >
              Detailed descriptions help our review team verify your product faster
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleSaveForLater}
              className="hidden w-full rounded-none border-2 border-[#c7a77b] bg-white px-6 py-3 font-semibold text-[#051f2d] hover:bg-[#c7a77b]/10 sm:block"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: 16 }}
            >
              Save for Later
            </button>
            <button
              type="submit"
              disabled={submitting || !productLink.trim() || !category}
              className="w-full rounded-none bg-[#1C3040] px-6 py-3 font-semibold text-white hover:bg-[#1C3040]/90 disabled:cursor-not-allowed disabled:bg-[#72808C]"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: 16 }}
            >
              {submitting ? "Submitting…" : "Submit for Review"}
            </button>
          </div>
        </form>
      </div>

      <VendorFooter variant="minimal" />
    </div>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#000000" viewBox="0 0 256 256" className={className}>
      <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
    </svg>
  );
}

function DropdownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM93.66,77.66,120,51.31V144a8,8,0,0,0,16,0V51.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,77.66Z" />
    </svg>
  );
}

