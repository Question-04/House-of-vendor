"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { generateVouchLink, getOnboardingStatus, getVouchStatus, reapplyAfterRejection } from "@/lib/api";
import { getOnboardingPhone, setOnboardingPhone } from "@/lib/onboarding-session";
import { normalizePhone } from "@/lib/msg91-widget";
import OnboardingLoadingScreen from "@/components/onboarding-loading-screen";
import { useTheme } from "@/contexts/theme-context";

export const dynamic = "force-dynamic";

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

function GetVouchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [vouchCount, setVouchCount] = useState(0);
  const [target, setTarget] = useState(30);
  const [shareUrl, setShareUrl] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [reapplyAfter, setReapplyAfter] = useState<string>("");

  const { isDark, toggleTheme } = useTheme();
  const progressPct = useMemo(() => Math.min(100, Math.round((vouchCount / Math.max(target, 1)) * 100)), [target, vouchCount]);
  const isCompleted = vouchCount >= target;
  const isNearComplete = vouchCount >= 20 && vouchCount < target;

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
      if (!status.success || !status.nextStep) {
        setLoading(false);
        return;
      }
      if (status.nextStep === "profile") {
        router.replace(`/onboarding/profile?phone=${encodeURIComponent(resolvedPhone)}`);
        return;
      }
      if (status.nextStep === "verification") {
        router.replace(`/onboarding/verification?phone=${encodeURIComponent(resolvedPhone)}`);
        return;
      }
      if (status.nextStep === "done") {
        router.replace("/home");
        return;
      }
      const vouch = await getVouchStatus(resolvedPhone);
      if (vouch.success) {
        setVouchCount(vouch.vouchCount || 0);
        setTarget(vouch.target || 30);
        setShareUrl(vouch.shareUrl || "");
        setReviewStatus(vouch.reviewStatus || "pending");
        setReapplyAfter(vouch.reapplyAfter || "");
      } else {
        setError(vouch.message || "Could not load vouch status.");
      }
      setLoading(false);
    };
    void init();
  }, [router, searchParams]);

  const handleGenerateLink = async () => {
    if (!phone) return;
    setBusy(true);
    setError("");
    try {
      const result = await generateVouchLink(phone);
      if (!result.success) {
        setError(result.message || "Could not generate link.");
        return;
      }
      setShareUrl(result.shareUrl || "");
      setVouchCount(result.vouchCount || 0);
      setTarget(result.target || 30);
      setReviewStatus(result.reviewStatus || "pending");
      setReapplyAfter(result.reapplyAfter || "");
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setStatusMessage("Link copied");
    setCopied(true);
    setTimeout(() => setStatusMessage(""), 1800);
    setTimeout(() => setCopied(false), 1000);
  };

  const handleShare = () => {
    if (!shareUrl) return;
    const text = encodeURIComponent(`Please vouch for me as a verified vendor: ${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const handleReapply = async () => {
    if (!phone) return;
    setBusy(true);
    setError("");
    try {
      const result = await reapplyAfterRejection(phone);
      if (!result.success) {
        setError(result.message || "Could not start reapply.");
        return;
      }
      router.push(`/onboarding/verification?phone=${encodeURIComponent(phone)}`);
    } finally {
      setBusy(false);
    }
  };

  const reapplyDate = reapplyAfter ? new Date(reapplyAfter) : null;
  const canReapply = Boolean(reapplyDate && reapplyDate.getTime() <= Date.now());

  if (loading) {
    return <OnboardingLoadingScreen title="Loading vouch progress" subtitle="Checking your current vouch status." />;
  }

  if (reviewStatus === "approved") {
    return <ApprovedScreen />;
  }

  if (reviewStatus === "rejected" && !canReapply) {
    return <RejectedScreen reapplyAfter={reapplyDate} />;
  }

  if (reviewStatus === "rejected" && canReapply) {
    return <ReapplyScreen busy={busy} onReapply={handleReapply} />;
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

        {/* Phone: single step indicator */}
        <div className="mb-6 flex items-center justify-start px-3 sm:hidden">
          <div className="flex items-center">
            <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full border-2 border-[#C7A77B]">
              <span className="text-[20px] font-semibold text-[#C7A77B]">3</span>
            </div>
            <span className="ml-3 text-[20px] font-semibold text-[#C7A77B]">Get Vouch</span>
          </div>
        </div>
        {/* Web: full 3-step indicator */}
        <div className="mb-12 hidden items-center justify-center sm:flex">
          <ProgressStep active={false} number={1} label="Profile" isDark={isDark} />
          <ProgressStep active={false} number={2} label="Verification" isDark={isDark} />
          <ProgressStep active number={3} label="Get Vouch" isLast isDark={isDark} />
        </div>

        <div className="mx-auto w-full max-w-[1034px] px-3 pb-16 sm:px-6">
          <h1 className={`text-[26px] font-semibold leading-tight sm:text-[34px] sm:leading-none ${isDark ? "text-white" : "text-[#1C3040]"}`}>Get Verified</h1>
          <p className={`mt-2 text-[15px] sm:mt-3 sm:text-[17px] ${isDark ? "text-white/80" : "text-[#6F7B86]"}`}>Trusted brands grow together. Each vouch strengthens your access.</p>

          <div className={`mt-6 min-h-[200px] border p-4 shadow-[0_3px_12px_rgba(20,44,65,0.07)] sm:mt-8 sm:min-h-[245px] sm:border sm:p-6 ${isDark ? "border-white/20 bg-white/10" : "border-[#E2E5E8] bg-[#F9F8F8]"}`}>
            <div className="flex items-center justify-between">
              <p className={`flex items-center gap-2 text-[16px] font-semibold sm:text-[17px] ${isDark ? "text-white" : "text-[#1D3140]"}`}>
                <span className={isDark ? "text-white" : "text-[#1D3140]"}><VouchStatusIcon /></span>
                Vouch Status
              </p>
              <p className={`text-[13px] sm:text-[14px] ${isDark ? "text-white/70" : "text-[#8C99A3]"}`}>
                {vouchCount}/{target} Vouches received
              </p>
            </div>
            <div className={`mt-4 h-3 rounded-full sm:mt-5 ${isDark ? "bg-white/20" : "bg-[#E2E5E8]"}`}>
              <div className="h-3 rounded-full bg-[#C7A77B]" style={{ width: `${Math.max(3, progressPct)}%` }} />
            </div>
            {isNearComplete ? (
              <div className="mt-6 inline-block px-4 py-2 text-[14px] font-medium sm:mt-8 sm:bg-[#E6EEF9] sm:text-[#3B73D6] bg-[#E6EEF9]/80 text-[#3B73D6]">
                Each trusted brand/vendors brings you closer to verification. Final review begins at 30.
              </div>
            ) : null}
            {vouchCount < 20 ? <p className={`mt-6 text-[15px] sm:mt-8 sm:text-[16px] ${isDark ? "text-white/70" : "text-[#8B97A1]"}`}>Your next step is community-backed verification.</p> : null}
            {isCompleted ? (
              <div className={`mt-6 inline-block px-4 py-2 text-[14px] font-medium sm:mt-8 ${isDark ? "bg-white/10 text-[#3B73D6]" : "bg-[#E6EEF9] text-[#3B73D6]"}`}>Our team is verifying your documents and brand details.</div>
            ) : null}
          </div>

          {!isCompleted ? (
            <>
              <div className={`mt-6 min-h-[180px] border p-4 shadow-[0_3px_12px_rgba(20,44,65,0.07)] sm:mt-8 sm:min-h-[205px] sm:p-6 ${isDark ? "border-white/20 bg-white/10" : "border-[#E2E5E8] bg-[#F9F8F8]"}`}>
                <p className={`flex items-center gap-2 text-[16px] font-semibold sm:text-[17px] ${isDark ? "text-white" : "text-[#1D3140]"}`}>
                  <span className={isDark ? "text-white" : "text-[#1D3140]"}><ShareLinkIcon /></span>
                  Share Your Vouch Link
                </p>

                {!shareUrl ? (
                  <button
                    type="button"
                    onClick={() => void handleGenerateLink()}
                    disabled={busy}
                    className={`mt-5 h-[50px] w-full text-[16px] font-semibold disabled:cursor-not-allowed disabled:bg-[#BFC5CB] disabled:text-white sm:mt-6 sm:h-[54px] sm:text-[17px] ${
                      isDark ? "bg-white text-[#051F2D] hover:bg-[#051F2D] hover:text-white" : "bg-[#051F2D] text-white hover:brightness-110"
                    }`}
                  >
                    {busy ? "Generating..." : "Generate Vouch Link"}
                  </button>
                ) : (
                  <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:items-center sm:gap-2">
                    <div className={`h-[48px] min-w-0 flex-1 overflow-x-auto border px-3 text-[14px] font-semibold leading-[48px] whitespace-nowrap sm:h-[54px] sm:px-4 sm:text-[16px] sm:leading-[54px] ${isDark ? "border-white/20 bg-white/5 text-white" : "border-[#E2E5E8] bg-[#F9F8F8] text-[#233646]"}`}>{shareUrl}</div>
                    <div className="flex w-full gap-2 sm:w-auto sm:gap-2">
                      <button
                        type="button"
                        onClick={handleShare}
                        className={`flex h-[48px] w-[48px] shrink-0 items-center justify-center sm:h-[54px] sm:w-[54px] ${isDark ? "bg-white text-[#051F2D] hover:bg-[#051F2D] hover:text-white" : "bg-[#051F2D] text-white"}`}
                        aria-label="Share"
                      >
                        <SendIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopy()}
                        className={`h-[48px] min-w-[80px] flex-1 px-4 text-[16px] font-semibold transition-all duration-200 sm:h-[54px] sm:min-w-[98px] sm:flex-none sm:text-[17px] ${
                          copied
                            ? "scale-[1.03] bg-[#0D6B45] text-white"
                            : isDark
                              ? "bg-white text-[#051F2D] hover:bg-[#051F2D] hover:text-white"
                              : "bg-[#051F2D] text-white hover:brightness-110"
                        }`}
                      >
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className={`mt-6 border-t pt-6 sm:mt-8 sm:pt-8 ${isDark ? "border-white/20" : "border-[#DCE1E6]"}`}>
                <h3 className={`text-[20px] font-semibold sm:text-[24px] ${isDark ? "text-white" : "text-[#1D3140]"}`}>Don&apos;t know a verified vendor?</h3>
                <p className={`mt-1.5 text-[14px] sm:mt-2 ${isDark ? "text-white/70" : "text-[#9AA5AE]"}`}>No problem. Our team can verify through an alternative process.</p>

                <div className="mt-10 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
                  <button type="button" className={`group relative overflow-hidden border p-4 text-left shadow-[0_3px_12px_rgba(20,44,65,0.07)] transition-all sm:p-5 ${isDark ? "border-white/20 bg-white/10 hover:bg-white/15" : "border-[#E2E5E8] bg-[#F9F8F8]"}`}>
                    <span className={`absolute inset-0 origin-left scale-x-0 transition-[transform] duration-300 ease-out delay-0 group-hover:delay-200 group-hover:scale-x-100 ${isDark ? "bg-[#051F2D]" : "bg-[#051F2D]"}`} />
                    <p className={`relative z-10 flex items-center gap-2 text-[16px] font-semibold transition-colors duration-300 delay-0 group-hover:delay-200 sm:text-[17px] ${isDark ? "text-white group-hover:text-[#C7A77B]" : "text-[#1D3140] group-hover:text-[#C7A77B]"}`}>
                      <MailIcon />
                      Email Us
                    </p>
                    <p className={`relative z-10 mt-2 text-[15px] sm:mt-3 sm:text-[16px] ${isDark ? "text-white/70" : "text-[#7E8B96]"}`}>
                      <span className="sm:hidden">support@houseofplutus.com</span>
                      <span className="hidden transition-all duration-300 delay-0 group-hover:delay-200 group-hover:-translate-y-1 group-hover:opacity-0 sm:inline">Always available to hear from you</span>
                    </p>
                    <p className="absolute left-4 top-[52px] z-10 hidden text-[15px] font-medium text-white opacity-0 transition-all duration-300 delay-0 group-hover:delay-200 group-hover:translate-y-0 group-hover:opacity-100 sm:left-5 sm:top-[60px] sm:block sm:text-[16px]">
                      support@houseofplutus.com
                    </p>
                  </button>
                  <button type="button" className={`group relative overflow-hidden border p-4 text-left shadow-[0_3px_12px_rgba(20,44,65,0.07)] transition-all sm:p-5 ${isDark ? "border-white/20 bg-white/10 hover:bg-white/15" : "border-[#E2E5E8] bg-[#F9F8F8]"}`}>
                    <span className="absolute inset-0 origin-left scale-x-0 bg-[#051F2D] transition-[transform] duration-300 ease-out delay-0 group-hover:delay-200 group-hover:scale-x-100" />
                    <div className="relative z-10">
                      <p className={`flex items-center gap-2 text-[16px] font-semibold transition-colors duration-300 delay-0 group-hover:delay-200 group-hover:text-[#C7A77B] sm:text-[17px] ${isDark ? "text-white" : "text-[#1D3140]"}`}>
                        <CalendarIcon />
                        Book a Call
                      </p>
                      <p className={`mt-2 text-[15px] sm:mt-3 sm:text-[16px] ${isDark ? "text-white/70" : "text-[#7E8B96]"}`}>
                        <span className="sm:hidden">9899898989</span>
                        <span className="hidden transition-all duration-300 delay-0 group-hover:delay-200 group-hover:-translate-y-1 group-hover:opacity-0 sm:inline">15 min verification call</span>
                      </p>
                      <p className="absolute left-0 top-[34px] z-10 hidden text-[16px] font-medium text-white opacity-0 transition-all duration-300 delay-0 group-hover:delay-200 group-hover:translate-y-0 group-hover:opacity-100 sm:block">
                        9899898989
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-10 text-center sm:py-14">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center text-[#067A50] sm:mb-5 sm:h-16 sm:w-16">
                <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M229.66,90.34l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,201.37,218.34,79a8,8,0,0,1,11.32,11.32Z"></path>
                </svg>
              </div>
              <h2 className={`text-[28px] font-semibold sm:text-[38px] ${isDark ? "text-white" : "text-[#1C3040]"}`}>Vouch completed!</h2>
              <p className={`mt-2 text-[15px] sm:text-[16px] ${isDark ? "text-white/70" : "text-[#93A0AA]"}`}>Our team is verifying your documents and brand details.</p>
            </div>
          )}

          {error ? <p className={`mt-5 text-[14px] ${isDark ? "text-red-300" : "text-[#C24747]"}`}>{error}</p> : null}
          {statusMessage ? <p className="mt-3 text-[14px] text-[#2F8C57]">{statusMessage}</p> : null}
        </div>
      </section>
    </div>
  );
}

export default function GetVouchPage() {
  return (
    <Suspense fallback={<OnboardingLoadingScreen title="Loading next step" subtitle="Checking where your onboarding should continue." />}>
      <GetVouchPageContent />
    </Suspense>
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

function MailIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-96,85.15L52.57,64H203.43ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z"></path>
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-68-76a12,12,0,1,1-12-12A12,12,0,0,1,140,132Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,132ZM96,172a12,12,0,1,1-12-12A12,12,0,0,1,96,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,140,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,172Z"></path>
    </svg>
  );
}

function VouchStatusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z"></path>
    </svg>
  );
}

function ShareLinkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M240,88.23a54.43,54.43,0,0,1-16,37L189.25,160a54.27,54.27,0,0,1-38.63,16h-.05A54.63,54.63,0,0,1,96,119.84a8,8,0,0,1,16,.45A38.62,38.62,0,0,0,150.58,160h0a38.39,38.39,0,0,0,27.31-11.31l34.75-34.75a38.63,38.63,0,0,0-54.63-54.63l-11,11A8,8,0,0,1,135.7,59l11-11A54.65,54.65,0,0,1,224,48,54.86,54.86,0,0,1,240,88.23ZM109,185.66l-11,11A38.41,38.41,0,0,1,70.6,208h0a38.63,38.63,0,0,1-27.29-65.94L78,107.31A38.63,38.63,0,0,1,144,135.71a8,8,0,0,0,16,.45A54.86,54.86,0,0,0,144,96a54.65,54.65,0,0,0-77.27,0L32,130.75A54.62,54.62,0,0,0,70.56,224h0a54.28,54.28,0,0,0,38.64-16l11-11A8,8,0,0,0,109,185.66Z"></path>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M227.32,28.68a16,16,0,0,0-15.66-4.08l-.15,0L19.57,82.84a16,16,0,0,0-2.49,29.8L102,154l41.3,84.87A15.86,15.86,0,0,0,157.74,248q.69,0,1.38-.06a15.88,15.88,0,0,0,14-11.51l58.2-191.94c0-.05,0-.1,0-.15A16,16,0,0,0,227.32,28.68ZM157.83,231.85l-.05.14,0-.07-40.06-82.3,48-48a8,8,0,0,0-11.31-11.31l-48,48L24.08,98.25l-.07,0,.14,0L216,40Z"></path>
    </svg>
  );
}

function ApprovedScreen() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#051F2D]" : "bg-[#F7F8F8]"}`}>
      <div className={`relative left-1/2 w-screen -translate-x-1/2 border-b ${isDark ? "border-white/20 bg-[#051F2D]" : "border-[#DCE1E6] bg-white"}`}>
        <div className="mx-auto flex h-[76px] w-full max-w-[1400px] items-center justify-between gap-3 pl-2 pr-4 sm:mx-0 sm:max-w-none sm:px-0 sm:pl-3 sm:pr-6 lg:pl-4 lg:pr-8">
          <Image
            src={isDark ? "/House of vendors white.svg" : "/House of vendors blue.svg"}
            alt="Vendors"
            width={270}
            height={82}
            className="h-auto w-[190px] sm:w-[220px]"
          />
          <DayNightToggle isDark={isDark} onToggle={toggleTheme} disabled disabledMessage="Feature will be available soon" />
        </div>
      </div>

      <div className="mx-auto max-w-[1034px] px-6 pb-16 pt-10 text-center">
        <Image
          src="/Verified screen tag.svg"
          alt="Verified"
          width={118}
          height={118}
          className="mx-auto h-[80px] w-[80px] sm:h-[110px] sm:w-[110px] md:h-[118px] md:w-[118px]"
        />
        <h1
          className={`mt-6 text-[22px] font-semibold leading-tight sm:text-[32px] md:text-[36px] ${
            isDark ? "text-white" : "text-[#1C3040]"
          }`}
        >
          You&apos;re Verified
        </h1>
        <p
          className={`mt-3 text-[15px] font-medium sm:text-[17px] ${
            isDark ? "text-white/80" : "text-[#93A0AA]"
          }`}
        >
          Welcome to the House of Plutus Standard
        </p>

        <div
          className={`mx-auto mt-10 max-w-[760px] border px-7 py-9 text-left shadow-[0_4px_18px_rgba(20,44,65,0.08)] ${
            isDark ? "border-white/15 bg-white/10" : "border-[#E2E5E8] bg-[#F9F8F8]"
          }`}
        >
          <h2
            className={`text-[20px] font-semibold leading-none sm:text-[24px] ${
              isDark ? "text-white" : "text-[#1C3040]"
            }`}
          >
            What you can do now:
          </h2>
          <ul
            className={`mt-6 space-y-4 text-[15px] font-medium leading-[2.5] sm:text-[16px] ${
              isDark ? "text-white/90" : "text-[#657480]"
            }`}
          >
            <li><span className="mr-2 text-[#C7A77B]">✓</span>Search and list verified products.</li>
            <li><span className="mr-2 text-[#C7A77B]">✓</span>Manage orders & payouts.</li>
            <li><span className="mr-2 text-[#C7A77B]">✓</span>Track inventory and sales.</li>
            <li><span className="mr-2 text-[#C7A77B]">✓</span>Vouch for other vendors you trust.</li>
          </ul>
          <button
            type="button"
            onClick={() => router.push("/home")}
            className={`group mt-8 h-[56px] w-full px-6 text-[18px] font-semibold leading-none ${
              isDark ? "bg-white text-[#051F2D]" : "bg-[#051F2D] text-white"
            }`}
          >
            <span className="inline-flex items-center gap-3">
              Enter Your Dashboard
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="23"
                height="23"
                fill={isDark ? "#051F2D" : "#ffffff"}
                viewBox="0 0 256 256"
                className="transition-transform duration-200 group-hover:translate-x-1"
              >
                <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"></path>
              </svg>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectedScreen({ reapplyAfter }: { reapplyAfter: Date | null }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#051F2D]" : "bg-[#F7F8F8]"}`}>
      <div className={`relative left-1/2 w-screen -translate-x-1/2 border-b ${isDark ? "border-white/20 bg-[#051F2D]" : "border-[#DCE1E6] bg-white"}`}>
        <div className="mx-auto flex h-[76px] w-full max-w-[1400px] items-center justify-between gap-3 pl-2 pr-4 sm:mx-0 sm:max-w-none sm:px-0 sm:pl-3 sm:pr-6 lg:pl-4 lg:pr-8">
          <Image
            src={isDark ? "/House of vendors white.svg" : "/House of vendors blue.svg"}
            alt="Vendors"
            width={270}
            height={82}
            className="h-auto w-[190px] sm:w-[220px]"
          />
          <DayNightToggle isDark={isDark} onToggle={toggleTheme} disabled disabledMessage="Feature will be available soon" />
        </div>
      </div>

      <div className="mx-auto max-w-[1034px] px-6 pb-12 pt-11 text-center">
        <Image
          src="/Vendor rejection screen tag.svg"
          alt="Not verified"
          width={118}
          height={118}
          className="mx-auto h-[80px] w-[80px] sm:h-[100px] sm:w-[100px]"
        />
        <h1
          className={`mt-6 text-[22px] font-semibold leading-tight sm:text-[32px] md:text-[34px] ${
            isDark ? "text-white" : "text-[#1C3040]"
          }`}
        >
          Verification Unsuccessful
        </h1>
        <p
          className={`mx-auto mt-3 max-w-[700px] text-[15px] font-medium leading-[1.5] sm:text-[16px] ${
            isDark ? "text-white/80" : "text-[#8F9AA4]"
          }`}
        >
          Your application didn&apos;t meet our current standards. You can reapply in 90 days with additional details.
        </p>

        <div className="mx-auto mt-8 max-w-[900px] space-y-7 text-left">
          <div
            className={`border px-4 py-7 shadow-[0_3px_12px_rgba(20,44,65,0.07)] sm:px-6 ${
              isDark ? "border-white/15 bg-white/10" : "border-[#E2E5E8] bg-[#F2F3F4]"
            }`}
          >
            <p className="text-[20px] font-semibold leading-none text-[#C7A77B] sm:text-[22px]">What this means</p>
            <p
              className={`mt-3 max-w-[760px] text-[15px] font-medium leading-[1.6] sm:text-[16px] ${
                isDark ? "text-white/85" : "text-[#5F6F7B]"
              }`}
            >
              We couldn&apos;t approve your brand at this time because one or more of our verification criteria weren&apos;t met. This may include insufficient vouches, incomplete documentation,
              or issues with brand authenticity or compliance. You&apos;re welcome to reapply in 90 days with updated information.
            </p>
          </div>
          <div
            className={`border px-4 py-7 shadow-[0_3px_12px_rgba(20,44,65,0.07)] sm:px-6 ${
              isDark ? "border-white/15 bg-white/10" : "border-[#E2E5E8] bg-[#F2F3F4]"
            }`}
          >
            <p className="text-[20px] font-semibold leading-none text-[#C7A77B] sm:text-[22px]">Why we need this</p>
            <p
              className={`mt-3 max-w-[760px] text-[15px] font-medium leading-[1.6] sm:text-[16px] ${
                isDark ? "text-white/85" : "text-[#5F6F7B]"
              }`}
            >
              Your brand didn&apos;t meet our current verification criteria. You may reapply in 90 days with updated details.
            </p>
          </div>
        </div>

        <p
          className={`mt-15 text-[15px] font-medium sm:text-[16px] ${
            isDark ? "text-white" : "text-[#1C3040]"
          }`}
        >
          Need clarity? Our team can help explain what&apos;s needed for reapplication.
        </p>
        <p
          className={`mt-5 text-[18px] sm:text-[20px] ${
            isDark ? "text-white/85" : "text-[#8E98A2]"
          }`}
        >
          <span className="font-semibold text-[#C7A77B]">Email Us:</span> support@houseofplutus.com
        </p>
        {reapplyAfter ? (
          <p
            className={`mt-3 text-[13px] ${
              isDark ? "text-white/70" : "text-[#A2ACB5]"
            }`}
          >
            Reapply available after: {reapplyAfter.toLocaleDateString()}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ReapplyScreen({ busy, onReapply }: { busy: boolean; onReapply: () => void }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#051F2D]" : "bg-[#F7F8F8]"}`}>
      <div className={`relative left-1/2 w-screen -translate-x-1/2 border-b ${isDark ? "border-white/20 bg-[#051F2D]" : "border-[#DCE1E6] bg-white"}`}>
        <div className="mx-auto flex h-[76px] w-full max-w-[1400px] items-center justify-between gap-3 pl-2 pr-4 sm:mx-0 sm:max-w-none sm:px-0 sm:pl-3 sm:pr-6 lg:pl-4 lg:pr-8">
          <Image
            src={isDark ? "/House of vendors white.svg" : "/House of vendors blue.svg"}
            alt="Vendors"
            width={270}
            height={82}
            className="h-auto w-[190px] sm:w-[220px]"
          />
          <DayNightToggle isDark={isDark} onToggle={toggleTheme} disabled disabledMessage="Feature will be available soon" />
        </div>
      </div>
      <div className="mx-auto max-w-[960px] px-6 pb-20 pt-16">
        <div
          className={`p-3 pt-5 pb-5 text-center shadow-[0_6px_24px_rgba(20,44,65,0.09)] sm:p-10 ${
            isDark ? "border border-white/15 bg-white/10" : "border border-[#E2E5E8] bg-[#F2F3F4]"
          }`}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#D8E0E7] bg-white text-[#C7A77B]">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 256 256">
              <path d="M144,157.68a68,68,0,1,0-71.9,0c-20.65,6.76-39.23,19.39-54.17,37.17a8,8,0,0,0,12.25,10.3C50.25,181.19,77.91,168,108,168s57.75,13.19,77.87,37.15a8,8,0,0,0,12.25-10.3C183.18,177.07,164.6,164.44,144,157.68ZM56,100a52,52,0,1,1,52,52A52.06,52.06,0,0,1,56,100Zm197.66,33.66-32,32a8,8,0,0,1-11.32,0l-16-16a8,8,0,0,1,11.32-11.32L216,148.69l26.34-26.35a8,8,0,0,1,11.32,11.32Z"></path>
            </svg>
          </div>
          <h1
            className={`text-[22px] font-semibold leading-tight sm:text-[32px] md:text-[34px] ${
              isDark ? "text-white" : "text-[#1C3040]"
            }`}
          >
            Reapply is now available
          </h1>
          <p
            className={`mx-auto mt-4 max-w-[700px] text-[15px] font-medium sm:text-[17px] ${
              isDark ? "text-white/80" : "text-[#72808C]"
            }`}
          >
            You can now submit updated verification documents and complete vouching again. Your profile remains saved.
          </p>

          <div
            className={`mx-auto mt-6 max-w-[760px] border p-5 text-left ${
              isDark ? "border-white/15 bg-white/10" : "border-[#E3E7EB] bg-[#F2F3F4]"
            }`}
          >
            <p
              className={`text-[18px] font-semibold ${
                isDark ? "text-white" : "text-[#1C3040]"
              }`}
            >
              What happens next
            </p>
            <ul
              className={`mt-4 space-y-3 text-[15px] leading-[2] ${
                isDark ? "text-white/85" : "text-[#647481]"
              }`}
            >
              <li>1. Upload Aadhaar and PAN again (Step 2).</li>
              <li>2. Collect fresh vouches from trusted vendors (Step 3).</li>
              <li>3. Team review starts after 30 vouches.</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={onReapply}
            disabled={busy}
            className={`mt-8 h-[56px] min-w-[290px] px-6 text-[18px] font-semibold shadow-[0_4px_14px_rgba(5,31,45,0.22)] transition hover:translate-y-[-1px] disabled:bg-[#BFC5CB] ${
              isDark ? "bg-white text-[#051F2D]" : "bg-[#051F2D] text-white"
            }`}
          >
            {busy ? "Processing..." : "Restart Verification"}
          </button>
        </div>
      </div>
    </div>
  );
}
