"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type ChangeEvent,
  type RefObject,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getOnboardingStatus,
  getVerification,
  removeVerificationDoc,
  submitVerification,
  uploadVerificationFiles,
  type VerificationFileSlot,
} from "@/lib/api";
import { getOnboardingPhone, setOnboardingPhone } from "@/lib/onboarding-session";
import { normalizePhone } from "@/lib/msg91-widget";
import OnboardingLoadingScreen from "@/components/onboarding-loading-screen";
import { useTheme } from "@/contexts/theme-context";

export const dynamic = "force-dynamic";

const MAX_KYC_FILES = 2;
const ACCEPT_KYC = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";

function formatFileSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function revokeObjectUrlList(urls: string[]) {
  urls.forEach((u) => {
    if (u) {
      try {
        URL.revokeObjectURL(u);
      } catch {
        /* ignore */
      }
    }
  });
}

/** Stored refs may be public https URLs, or private refs like r2://bucket/key (not loadable in an img src). */
function isBrowserLoadableImageUrl(url: string): boolean {
  const u = (url || "").trim();
  return /^https?:\/\//i.test(u) || u.startsWith("blob:");
}

function looksLikeImageDoc(doc: VerificationFileSlot): boolean {
  const m = (doc.mime || "").toLowerCase();
  if (m.startsWith("image/")) return true;
  return /\.(jpe?g|png)$/i.test(doc.fileName || "");
}

function looksLikePdfDoc(doc: VerificationFileSlot): boolean {
  const m = (doc.mime || "").toLowerCase();
  if (m === "application/pdf") return true;
  return /\.pdf$/i.test(doc.fileName || "");
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className={className} aria-hidden>
      <path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className={className} aria-hidden>
      <path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23Z" />
    </svg>
  );
}

function DayNightToggle({
  isDark,
  onToggle,
  disabled = false,
  disabledMessage = "Feature will be available soon",
}: {
  isDark: boolean;
  onToggle: () => void;
  disabled?: boolean;
  disabledMessage?: string;
}) {
  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={`relative flex h-10 w-[88px] items-center rounded-full border-[#DCE1E6] bg-[#E4E7EA] transition-colors dark:border-white/20 dark:bg-[#2a3540] ${
          disabled ? "cursor-not-allowed opacity-70" : ""
        }`}
      >
        <span
          className={`absolute top-1 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
            isDark ? "left-1 text-white" : "left-1 bg-[#051F2D] text-white"
          }`}
          style={isDark ? { background: "transparent" } : undefined}
        >
          <SunIcon className="h-5 w-5" />
        </span>
        <span
          className={`absolute top-1 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
            isDark ? "right-1 bg-[#051F2D] text-white" : "right-1 text-[#6B7A8D]"
          }`}
        >
          <MoonIcon className="h-5 w-5" />
        </span>
      </button>
      {disabled ? (
        <span className="pointer-events-none absolute -bottom-8 left-1/2 z-20 -translate-x-1/2 rounded bg-[#1C3040] px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          {disabledMessage}
        </span>
      ) : null}
    </div>
  );
}

function ProgressStep({
  active,
  number,
  label,
  isLast = false,
  isDark = false,
}: {
  active: boolean;
  number: 1 | 2 | 3;
  label: string;
  isLast?: boolean;
  isDark?: boolean;
}) {
  return (
    <div className="flex items-center">
      <div
        className={`flex h-[44px] w-[44px] items-center justify-center rounded-full border-2 ${
          active ? "border-[#C7A77B]" : isDark ? "border-white/30" : "border-[#CDD2D5]"
        }`}
      >
        <span className={`text-[20px] font-semibold ${active ? "text-[#C7A77B]" : isDark ? "text-white/50" : "text-[#CDD2D5]"}`}>{number}</span>
      </div>
      <span className={`ml-3 text-[20px] font-semibold ${active ? "text-[#C7A77B]" : isDark ? "text-white/50" : "text-[#CDD2D5]"}`}>{label}</span>
      {!isLast && <span className={`mx-5 h-[2px] w-[140px] ${isDark ? "bg-white/30" : "bg-[#CDD2D5]"}`} />}
    </div>
  );
}

function VerificationStepPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aadhaarInputRef = useRef<HTMLInputElement | null>(null);
  const panInputRef = useRef<HTMLInputElement | null>(null);
  const aadhaarBlobsRef = useRef<string[]>([]);
  const panBlobsRef = useRef<string[]>([]);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<"" | "aadhaar" | "pan">("");
  const [error, setError] = useState("");
  const [aadhaarDocs, setAadhaarDocs] = useState<VerificationFileSlot[]>([]);
  const [panDocs, setPanDocs] = useState<VerificationFileSlot[]>([]);
  /** In-memory previews when the server stores a private ref (e.g. r2://) that the browser cannot fetch. */
  const [aadhaarBlobPreviews, setAadhaarBlobPreviews] = useState<string[]>([]);
  const [panBlobPreviews, setPanBlobPreviews] = useState<string[]>([]);

  const { isDark, toggleTheme } = useTheme();

  const applyVerification = useCallback((v: { aadhaarDocuments: VerificationFileSlot[]; panDocuments: VerificationFileSlot[] }) => {
    setAadhaarDocs(v.aadhaarDocuments ?? []);
    setPanDocs(v.panDocuments ?? []);
  }, []);

  const canSubmit = useMemo(
    () => Boolean(aadhaarDocs.length > 0 && panDocs.length > 0 && !uploadingDoc && !submitting),
    [aadhaarDocs.length, panDocs.length, uploadingDoc, submitting]
  );

  useEffect(() => {
    const phoneFromUrl = searchParams.get("phone") || "";
    const fromSession = getOnboardingPhone();
    const resolvedPhone = normalizePhone(phoneFromUrl || fromSession);

    if (!resolvedPhone) {
      router.replace("/");
      return;
    }

    setPhone(resolvedPhone);
    setOnboardingPhone(resolvedPhone);

    const init = async () => {
      const status = await getOnboardingStatus(resolvedPhone);
      if (status.success && status.nextStep) {
        if (status.nextStep === "profile") {
          router.replace(`/onboarding/profile?phone=${encodeURIComponent(resolvedPhone)}`);
          return;
        }
        if (status.nextStep === "get_vouch" || status.nextStep === "done") {
          router.replace(`/onboarding/get-vouch?phone=${encodeURIComponent(resolvedPhone)}`);
          return;
        }
      }

      const verification = await getVerification(resolvedPhone);
      if (verification.success) {
        setAadhaarBlobPreviews((prev) => {
          revokeObjectUrlList(prev);
          return [];
        });
        setPanBlobPreviews((prev) => {
          revokeObjectUrlList(prev);
          return [];
        });
        applyVerification(verification.verification);
      }
      setLoading(false);
    };
    void init();
  }, [router, searchParams, applyVerification]);

  useEffect(() => {
    aadhaarBlobsRef.current = aadhaarBlobPreviews;
  }, [aadhaarBlobPreviews]);
  useEffect(() => {
    panBlobsRef.current = panBlobPreviews;
  }, [panBlobPreviews]);
  useEffect(() => {
    return () => {
      revokeObjectUrlList(aadhaarBlobsRef.current);
      revokeObjectUrlList(panBlobsRef.current);
    };
  }, []);

  const validateFiles = (files: FileList | File[]): string | null => {
    const list = Array.from(files);
    if (list.length === 0) return "No files selected.";
    if (list.length > MAX_KYC_FILES) return `You can upload at most ${MAX_KYC_FILES} files at once.`;
    const allowed = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    for (const f of list) {
      if (f.size > 5 * 1024 * 1024) return "Each file must be 5MB or smaller.";
      if (!allowed.includes(f.type)) return "Only JPG, PNG or PDF files are allowed.";
    }
    return null;
  };

  const onMultiUpload = async (docType: "aadhaar" | "pan", event: ChangeEvent<HTMLInputElement>) => {
    setError("");
    const picked = event.target.files;
    if (!picked?.length || !phone) {
      event.target.value = "";
      return;
    }
    const msg = validateFiles(picked);
    if (msg) {
      setError(msg);
      event.target.value = "";
      return;
    }

    const files = Array.from(picked).slice(0, MAX_KYC_FILES);
    const freshBlobs = files.map((f) => URL.createObjectURL(f));
    if (docType === "aadhaar") {
      setAadhaarBlobPreviews((prev) => {
        revokeObjectUrlList(prev);
        return freshBlobs;
      });
    } else {
      setPanBlobPreviews((prev) => {
        revokeObjectUrlList(prev);
        return freshBlobs;
      });
    }

    setUploadingDoc(docType);
    try {
      const result = await uploadVerificationFiles({
        phone,
        docType,
        files,
      });
      if (!result.success) {
        revokeObjectUrlList(freshBlobs);
        if (docType === "aadhaar") {
          setAadhaarBlobPreviews([]);
        } else {
          setPanBlobPreviews([]);
        }
        setError(result.message || "Upload failed. Please try again.");
        return;
      }
      const docs = docType === "aadhaar" ? result.verification.aadhaarDocuments : result.verification.panDocuments;
      const nextBlobs = docs.map((d, i) => {
        if (!looksLikeImageDoc(d)) {
          if (freshBlobs[i]) URL.revokeObjectURL(freshBlobs[i]);
          return "";
        }
        if (isBrowserLoadableImageUrl(d.url)) {
          if (freshBlobs[i]) URL.revokeObjectURL(freshBlobs[i]);
          return "";
        }
        return freshBlobs[i] ?? "";
      });
      if (docType === "aadhaar") {
        setAadhaarBlobPreviews(nextBlobs);
      } else {
        setPanBlobPreviews(nextBlobs);
      }
      applyVerification(result.verification);
    } catch {
      revokeObjectUrlList(freshBlobs);
      if (docType === "aadhaar") {
        setAadhaarBlobPreviews([]);
      } else {
        setPanBlobPreviews([]);
      }
      setError("Upload failed. Please try again.");
    } finally {
      setUploadingDoc("");
      event.target.value = "";
    }
  };

  const onRemoveAt = async (docType: "aadhaar" | "pan", index: number) => {
    if (!phone) return;
    setError("");
    setUploadingDoc(docType);
    try {
      const result = await removeVerificationDoc({ phone, docType, index });
      if (!result.success) {
        setError(result.message || "Could not remove file.");
        return;
      }
      if (docType === "aadhaar") {
        setAadhaarBlobPreviews((prev) => {
          const next = [...prev];
          if (next[index]) URL.revokeObjectURL(next[index]);
          next.splice(index, 1);
          return next;
        });
      } else {
        setPanBlobPreviews((prev) => {
          const next = [...prev];
          if (next[index]) URL.revokeObjectURL(next[index]);
          next.splice(index, 1);
          return next;
        });
      }
      applyVerification(result.verification);
    } catch {
      setError("Could not remove file.");
    } finally {
      setUploadingDoc("");
    }
  };

  const onSubmit = async () => {
    if (!phone || !canSubmit) {
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const result = await submitVerification(phone);
      if (!result.success) {
        setError(result.message || "Could not submit verification.");
        return;
      }
      const next = result.nextStep || "get_vouch";
      if (next === "get_vouch" || next === "done") {
        router.push(`/onboarding/get-vouch?phone=${encodeURIComponent(phone)}`);
        return;
      }
      router.push(`/onboarding/verification?phone=${encodeURIComponent(phone)}`);
    } catch {
      setError("Could not submit verification.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <OnboardingLoadingScreen title="Preparing verification step" subtitle="Checking your progress and loading uploaded document state." />;
  }

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#051F2D]" : "bg-[#F7F8F8]"}`}>
      <section className="w-full">
        <div className={`relative left-1/2 mb-6 w-screen -translate-x-1/2 border-b sm:mb-8 ${isDark ? "border-white/20 bg-[#051F2D]" : "border-[#DCE1E6]"}`}>
          <div className="mx-auto flex h-[76px] w-full max-w-[1400px] items-center justify-between gap-3 pl-2 pr-4 sm:mx-0 sm:max-w-none sm:px-0 sm:pl-3 sm:pr-6 lg:pl-4 lg:pr-8">
            <Image
              src={isDark ? "/House of vendors white.svg" : "/House of vendors blue.svg"}
              alt="House of Vendors"
              width={270}
              height={82}
              className="h-auto w-[190px] -ml-1 sm:ml-0 sm:w-[240px]"
            />
            <DayNightToggle isDark={isDark} onToggle={toggleTheme} disabled disabledMessage="Feature will be available soon" />
          </div>
        </div>

        <div className="mb-6 flex items-center justify-start px-3 sm:hidden">
          <div className="flex items-center">
            <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full border-2 border-[#C7A77B]">
              <span className="text-[20px] font-semibold text-[#C7A77B]">2</span>
            </div>
            <span className="ml-3 text-[20px] font-semibold text-[#C7A77B]">Verification</span>
          </div>
        </div>
        <div className="mb-16 hidden items-center justify-center sm:flex">
          <ProgressStep active={false} number={1} label="Profile" isDark={isDark} />
          <ProgressStep active number={2} label="Verification" isDark={isDark} />
          <ProgressStep active={false} number={3} label="Get Vouch" isLast isDark={isDark} />
        </div>

        <div className="mx-auto w-full max-w-[980px] px-3 pb-16 sm:px-6">
          <h1 className={`text-[24px] font-semibold leading-tight tracking-[-0.01em] sm:text-[44px] sm:leading-[1.12] ${isDark ? "text-white" : "text-[#1C3040]"}`}>
            Upload Aadhaar &amp; PAN Card
          </h1>
          <p className={`mt-2 text-[13px] sm:text-[15px] ${isDark ? "text-white/85" : "text-[#7A8792]"}`}>
            We require Aadhaar and PAN verification for all vendors to ensure compliance.
          </p>

          <div aria-live="polite" className="sr-only">
            {uploadingDoc ? `Uploading ${uploadingDoc} documents` : ""}
          </div>

          <KycDocDropzone
            isDark={isDark}
            inputId="kyc-aadhaar-input"
            hintId="kyc-aadhaar-hint"
            groupLabelId="kyc-aadhaar-heading"
            title="Aadhaar card"
            hint="Upload one or two files: front and back of your Aadhaar (JPG, PNG, or PDF, up to 5 MB each, maximum 2 files)."
            docs={aadhaarDocs}
            blobPreviewUrls={aadhaarBlobPreviews}
            busy={uploadingDoc === "aadhaar"}
            canAddMore={aadhaarDocs.length < MAX_KYC_FILES}
            inputRef={aadhaarInputRef}
            onFileChange={(e) => void onMultiUpload("aadhaar", e)}
            onRemove={(index) => void onRemoveAt("aadhaar", index)}
          />

          <KycDocDropzone
            isDark={isDark}
            inputId="kyc-pan-input"
            hintId="kyc-pan-hint"
            groupLabelId="kyc-pan-heading"
            title="PAN card"
            hint="Upload one or two files for your PAN if needed (JPG, PNG, or PDF, up to 5 MB each, maximum 2 files)."
            docs={panDocs}
            blobPreviewUrls={panBlobPreviews}
            busy={uploadingDoc === "pan"}
            canAddMore={panDocs.length < MAX_KYC_FILES}
            inputRef={panInputRef}
            onFileChange={(e) => void onMultiUpload("pan", e)}
            onRemove={(index) => void onRemoveAt("pan", index)}
          />

          <div
            className={`mt-7 rounded-lg border p-5 backdrop-blur-md sm:p-5 ${
              isDark ? "border-white/20 bg-white/10" : "border-[#E6E8EA] bg-[#F2F3F4]"
            }`}
          >
            <p className="text-[18px] font-medium text-[#C7A77B]">Why we need this</p>
            <p className="mt-2 text-[14px] leading-[1.55] text-[#8C98A2]">
              We use your PAN and Aadhaar to verify your business identity, prevent fraud, and meet legal requirements. Your details are encrypted, and
              used only for compliance and verification.
            </p>
          </div>

          {error ? (
            <p className="mt-4 text-[14px] text-[#D04343]" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-8 flex flex-row items-center gap-3 sm:mt-10 sm:gap-5">
            <button
              type="button"
              className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center border border-[#C7A77B] sm:h-[54px] sm:w-auto sm:min-w-[200px] sm:px-6 sm:text-[17px] sm:font-semibold ${
                isDark ? "bg-[#051F2D] text-white" : "bg-white text-[#1D2F3E]"
              }`}
              onClick={() => router.push(`/onboarding/profile?phone=${encodeURIComponent(phone)}`)}
              aria-label="Back to profile"
            >
              <span className="sm:hidden">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
                  <path d="M224,128a8,8,0,0,0-8-8H59.31l58.35-58.34a8,8,0,0,0-11.32-11.32l-72,72a8,8,0,0,0,0,11.32l72,72a8,8,0,0,0,11.32-11.32L59.31,136H216A8,8,0,0,0,224,128Z" />
                </svg>
              </span>
              <span className="hidden sm:inline">← Back</span>
            </button>
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={!canSubmit}
              className={`h-[52px] min-w-0 flex-1 px-4 text-[15px] font-semibold leading-none disabled:cursor-not-allowed sm:h-[54px] sm:min-w-[510px] sm:px-8 sm:text-[17px] ${
                !canSubmit
                  ? "bg-[#BFC5CB] text-white"
                  : isDark
                    ? "bg-white text-[#051F2D]"
                    : "bg-[#051F2D] text-white"
              }`}
            >
              {submitting ? "Submitting..." : "Submit for Verification  →"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function VerificationStepPage() {
  return (
    <Suspense fallback={<OnboardingLoadingScreen />}>
      <VerificationStepPageContent />
    </Suspense>
  );
}

function KycThumb({
  doc,
  index,
  blobPreviewUrls,
  isDark,
}: {
  doc: VerificationFileSlot;
  index: number;
  blobPreviewUrls: string[];
  isDark: boolean;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  const blob = (blobPreviewUrls[index] || "").trim();
  const remote =
    looksLikeImageDoc(doc) && isBrowserLoadableImageUrl(doc.url) ? doc.url.trim() : "";
  const src = blob || remote;

  useEffect(() => {
    setImgBroken(false);
  }, [src]);

  if (looksLikeImageDoc(doc) && src && !imgBroken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={doc.fileName ? `Preview: ${doc.fileName}` : "Image preview"}
        className="h-full w-full object-cover"
        onError={() => setImgBroken(true)}
      />
    );
  }

  const label = looksLikePdfDoc(doc) ? "PDF" : looksLikeImageDoc(doc) ? "IMG" : "FILE";
  return <span className={`text-[11px] font-semibold ${isDark ? "text-white/70" : "text-[#7C8A96]"}`}>{label}</span>;
}

function KycDocDropzone({
  isDark,
  inputId,
  hintId,
  groupLabelId,
  title,
  hint,
  docs,
  blobPreviewUrls = [],
  busy,
  canAddMore,
  inputRef,
  onFileChange,
  onRemove,
}: {
  isDark: boolean;
  inputId: string;
  hintId: string;
  groupLabelId: string;
  title: string;
  hint: string;
  docs: VerificationFileSlot[];
  blobPreviewUrls?: string[];
  busy: boolean;
  canAddMore: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (index: number) => void;
}) {
  const openPicker = () => {
    if (!busy && canAddMore) {
      inputRef.current?.click();
    }
  };

  return (
    <div
      className="mt-6 sm:mt-8"
      role="group"
      aria-labelledby={groupLabelId}
      aria-describedby={hintId}
    >
      <h2 id={groupLabelId} className={`text-[17px] font-semibold sm:text-[18px] ${isDark ? "text-white" : "text-[#223544]"}`}>
        {title}
      </h2>
      <p id={hintId} className={`mt-1 text-[13px] leading-snug sm:text-[14px] ${isDark ? "text-white/75" : "text-[#6D7A85]"}`}>
        {hint}
      </p>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT_KYC}
        multiple
        className="sr-only"
        onChange={onFileChange}
        disabled={busy || !canAddMore}
        aria-label={`${title}: choose up to ${MAX_KYC_FILES} files, JPG, PNG, or PDF`}
      />

      {docs.length > 0 ? (
        <ul className="mt-4 grid list-none grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {docs.map((doc, index) => (
            <li
              key={`${doc.url}-${index}`}
              className={`flex gap-3 border-2 border-dotted p-3 sm:p-4 ${
                isDark ? "border-white/30 bg-white/5" : "border-[#829497] bg-[#F7F8F8]"
              }`}
            >
              <div
                className={`flex h-[72px] w-[76px] shrink-0 items-center justify-center overflow-hidden border sm:h-[84px] sm:w-[88px] ${
                  isDark ? "border-white/20 bg-white/10" : "border-[#D7DDE2] bg-white"
                }`}
              >
                <KycThumb doc={doc} index={index} blobPreviewUrls={blobPreviewUrls} isDark={isDark} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[14px] font-medium sm:text-[15px] ${isDark ? "text-white" : "text-[#223544]"}`}>{doc.fileName || "Document"}</p>
                <p className={`mt-0.5 text-[12px] ${isDark ? "text-white/65" : "text-[#9AA5AE]"}`}>{formatFileSize(doc.size)}</p>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  disabled={busy}
                  className={`mt-2 text-[13px] font-semibold underline underline-offset-2 disabled:opacity-50 ${isDark ? "text-[#C7A77B]" : "text-[#1D2F3E]"}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={openPicker}
        disabled={busy || !canAddMore}
        className={`mt-4 flex min-h-[120px] w-full flex-col items-center justify-center border-2 border-dotted px-4 py-6 text-center disabled:cursor-not-allowed sm:min-h-[100px] ${
          isDark ? "border-white/40 bg-white/5" : "border-[#829497] bg-[#F7F8F8]"
        }`}
        aria-controls={inputId}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          fill={isDark ? "currentColor" : "#1A2F3E"}
          viewBox="0 0 256 256"
          aria-hidden
          className={isDark ? "text-white" : ""}
        >
          <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM93.66,77.66,120,51.31V144a8,8,0,0,0,16,0V51.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,77.66Z" />
        </svg>
        <span className={`mt-3 text-[15px] font-medium sm:text-[16px] ${isDark ? "text-white" : "text-[#223544]"}`}>
          {busy ? "Uploading…" : canAddMore ? `Add files (${docs.length}/${MAX_KYC_FILES})` : "Maximum files reached"}
        </span>
        <span className={`mt-1 text-[12px] sm:text-[13px] ${isDark ? "text-white/70" : "text-[#95A0AA]"}`}>
          Tap to choose from your device — you can select up to {MAX_KYC_FILES} at once
        </span>
      </button>

      <label htmlFor={inputId} className="sr-only">
        {title} file upload
      </label>
    </div>
  );
}
