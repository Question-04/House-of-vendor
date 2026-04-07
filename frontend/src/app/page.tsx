"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { MultiCategorySelectLight } from "@/components/multi-category-select";
import { saveProfile, verifyToken } from "@/lib/api";
import { isAdminPhoneAllowed } from "@/lib/admin-allowlist";
import { PRIMARY_SELLING_CATEGORY_OPTIONS } from "@/lib/vendor-categories";
import { setOnboardingPhone } from "@/lib/onboarding-session";
import { loadMSG91Widget, normalizePhone } from "@/lib/msg91-widget";
import { useTheme } from "@/contexts/theme-context";
import type { MSG91VerifySuccess } from "@/types/msg91";

const LOGO_WIDTH = 190;

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

function DayNightToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative flex h-10 w-[88px] items-center rounded-full border-[#DCE1E6] bg-[#E4E7EA] transition-colors dark:border-white/20 dark:bg-[#2a3540]"
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
  );
}

type Step = "phone" | "otp" | "verified" | "profile_setup";
type ProfileForm = {
  fullName: string;
  email: string;
  primarySellingCategory: string;
  otherCategories: string[];
  city: string;
  state: string;
  fullAddress: string;
  pincode: string;
  gstRegistered: "yes" | "no";
  gstNumber: string;
  registeredFirmName: string;
};

const OTP_LENGTH = 6;
const OTP_BOX_LIGHT =
  "h-[53px] w-[53px] min-w-[44px] border border-[#B6BDC4] bg-white text-center text-[20px] font-medium text-[#051F2D] outline-none focus:border-[#051F2D] sm:h-[58px] sm:w-[58px] sm:min-w-[58px] sm:text-[24px]";
const OTP_BOX_DARK =
  "h-[53px] w-[53px] min-w-[44px] border border-[#B6BDC4] bg-white/10 text-center text-[20px] font-medium text-[#828f96] outline-none focus:border-[#B6BDC4] focus:bg-white/15 focus:text-[#828f96] [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_rgba(255,255,255,0.1)_inset] [&:-webkit-autofill]:![-webkit-text-fill-color:#828f96] sm:h-[58px] sm:w-[58px] sm:min-w-[58px] sm:text-[24px]";

const cityOptions = [
  "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Ahmedabad", "Chennai", "Kolkata", "Surat", "Pune", "Jaipur",
  "Lucknow", "Kanpur", "Nagpur", "Indore", "Thane", "Bhopal", "Visakhapatnam", "Pimpri-Chinchwad", "Patna", "Vadodara",
  "Ghaziabad", "Ludhiana", "Agra", "Nashik", "Faridabad", "Meerut", "Rajkot", "Kalyan-Dombivli", "Vasai-Virar", "Varanasi",
  "Srinagar", "Aurangabad", "Dhanbad", "Amritsar", "Navi Mumbai", "Prayagraj", "Ranchi", "Howrah", "Coimbatore", "Jabalpur",
  "Gwalior", "Vijayawada", "Jodhpur", "Madurai", "Raipur", "Kota", "Guwahati", "Chandigarh", "Solapur", "Hubli-Dharwad",
  "Mysuru", "Tiruchirappalli", "Bareilly", "Aligarh", "Tiruppur", "Moradabad", "Jalandhar", "Bhubaneswar", "Salem", "Warangal",
  "Mira-Bhayandar", "Jalgaon", "Gurgaon", "Noida", "Bhiwandi", "Thiruvananthapuram", "Gorakhpur", "Bikaner", "Amravati", "Nanded",
  "Kolhapur", "Ajmer", "Akola", "Gulbarga", "Jamnagar", "Ujjain", "Loni", "Siliguri", "Jhansi", "Ulhasnagar",
  "Nellore", "Jammu", "Sangli-Miraj-Kupwad", "Belagavi", "Mangaluru", "Ambattur", "Tirunelveli", "Malegaon", "Gaya", "Jalna"
];
const stateOptions = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
  "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];
const gstOptions = [
  { label: "Yes, GST Registered", value: "yes" as const },
  { label: "Not Yet", value: "no" as const },
];

function getTokenFromWidget(data: MSG91VerifySuccess): string {
  return (
    (typeof data?.message === "string" ? data.message : "") ||
    data?.token ||
    data?.accessToken ||
    (data as { access_token?: string })?.access_token ||
    ""
  );
}

function getReqIdFromWidgetData(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  const value = record.reqId ?? record.request_id ?? record.requestId;
  return typeof value === "string" ? value : "";
}

async function syncAdminSessionIfNeeded(phone: string, accessToken: string): Promise<void> {
  if (!isAdminPhoneAllowed(phone)) return;
  await signIn("credentials", {
    phone,
    accessToken,
    redirect: false,
  });
}

function ProgressStep({
  active,
  number,
  label,
  isLast = false,
}: {
  active: boolean;
  number: 1 | 2 | 3;
  label: string;
  isLast?: boolean;
}) {
  return (
    <div className="flex items-center">
      <div className="relative h-[44px] w-[44px]">
        <Image
          src={active ? "/Progress steps Active.svg" : "/Progress steps disabled.svg"}
          alt={label}
          fill
          className="object-contain"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`text-[20px] font-semibold ${active ? "text-[#C7A77B]" : "text-[#CDD2D5]"}`}
            style={{ textShadow: "0 0 3px #F7F8F8" }}
          >
            {number}
          </span>
        </div>
      </div>
      <span className={`ml-3 text-[20px] font-semibold ${active ? "text-[#C7A77B]" : "text-[#CDD2D5]"}`}>{label}</span>
      {!isLast && <span className="mx-5 h-[2px] w-[140px] bg-[#CDD2D5]" />}
    </div>
  );
}

function SelectField({
  label,
  placeholder,
  value,
  options,
  onChange,
  optional = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <label className="mb-2 block text-[18px] font-semibold text-[#223544]">
        {label} {optional && <span className="font-medium italic text-[#223544]">(optional)</span>}
      </label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-[56px] w-full items-center justify-between border border-[#C7CDD3] bg-white px-4 text-left text-[16px] text-[#6D7A85]"
      >
        <span className={value ? "text-[#51616E]" : "text-[#A8B0B7]"}>{value || placeholder}</span>
        <span className={`text-[#8B97A1] transition-transform ${open ? "rotate-180" : ""}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
            <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path>
          </svg>
        </span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-[220px] w-full overflow-y-auto border border-[#AEB8C1] bg-white">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className={`block w-full px-4 py-2 text-left text-[16px] ${
                value === option ? "bg-[#C7A77B] text-[#051F2D]" : "text-[#34495A] hover:bg-[#F4F6F8]"
              }`}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VendorLoginPage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ""));
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [verifyPhase, setVerifyPhase] = useState<"otp" | "server">("otp");
  const [error, setError] = useState("");
  const [otpInfo, setOtpInfo] = useState("");
  const [widgetReady, setWidgetReady] = useState(false);
  const [widgetError, setWidgetError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(30);
  const [otpRequestId, setOtpRequestId] = useState("");
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    fullName: "",
    email: "",
    primarySellingCategory: "",
    otherCategories: [],
    city: "",
    state: "",
    fullAddress: "",
    pincode: "",
    gstRegistered: "no",
    gstNumber: "",
    registeredFirmName: "",
  });

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const widgetId = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID ?? "";
  const tokenAuth = process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH ?? "";

  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);
  const otp = otpDigits.join("");
  const isPhoneValid = Boolean(normalizedPhone);
  const isProfileValid =
    profileForm.fullName.trim() &&
    profileForm.email.trim() &&
    profileForm.primarySellingCategory.trim() &&
    profileForm.city.trim() &&
    profileForm.state.trim() &&
    profileForm.fullAddress.trim() &&
    profileForm.pincode.trim() &&
    (profileForm.gstRegistered === "no" || (profileForm.gstNumber.trim() && profileForm.registeredFirmName.trim()));

  useEffect(() => {
    if (!widgetId || !tokenAuth) {
      setWidgetError("MSG91 widget not configured. Set NEXT_PUBLIC_MSG91_WIDGET_ID and NEXT_PUBLIC_MSG91_TOKEN_AUTH.");
      return;
    }

    loadMSG91Widget({ widgetId, tokenAuth })
      .then(() => setWidgetReady(true))
      .catch((e) => setWidgetError(`Failed to load OTP widget. ${e instanceof Error ? e.message : ""}`));
  }, [widgetId, tokenAuth]);

  useEffect(() => {
    if (step !== "otp" || resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, resendCountdown]);

  const clearOtp = useCallback(() => {
    setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
    requestAnimationFrame(() => {
      otpRefs.current[0]?.focus();
    });
  }, []);

  const handleGetOTP = useCallback(() => {
    setError("");

    if (!phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }
    if (!isPhoneValid) {
      setError("Enter a valid phone number.");
      return;
    }
    if (!window.sendOtp) {
      setError("OTP widget not ready. Please refresh.");
      return;
    }

    setSendingOtp(true);
    window.sendOtp(
      normalizedPhone,
      (data) => {
        setStep("otp");
        setResendCountdown(30);
        setOtpInfo("We've sent a 6-digit OTP to your number.");
        setOtpRequestId(getReqIdFromWidgetData(data));
        clearOtp();
        setSendingOtp(false);
      },
      (err) => {
        setError(typeof err === "string" ? err : "Could not send OTP. Please try again.");
        setSendingOtp(false);
      }
    );
  }, [clearOtp, isPhoneValid, normalizedPhone, phone]);

  const handleOtpChange = (index: number, rawValue: string) => {
    setError("");
    const value = rawValue.replace(/\D/g, "").slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    if (value && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, key: string) => {
    if (key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (key === "ArrowLeft" && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (key === "ArrowRight" && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, OTP_LENGTH).split("");
    if (!digits.length) return;
    setOtpDigits((prev) => {
      const next = [...prev];
      digits.forEach((digit, idx) => {
        next[idx] = digit;
      });
      return next;
    });
    const target = Math.min(digits.length, OTP_LENGTH - 1);
    requestAnimationFrame(() => {
      otpRefs.current[target]?.focus();
    });
  };

  const handleVerifyOTP = useCallback(() => {
    setError("");

    if (otp.length !== OTP_LENGTH) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }
    if (!window.verifyOtp) {
      setError("OTP widget not ready. Please refresh.");
      return;
    }

    setVerifyPhase("otp");
    setVerifyingOtp(true);

    window.verifyOtp(
      otp,
      async (data: MSG91VerifySuccess) => {
        const token = getTokenFromWidget(data);
        const reqIdFromResponse = getReqIdFromWidgetData(data);
        if (reqIdFromResponse) {
          setOtpRequestId(reqIdFromResponse);
        }
        if (!token) {
          setError("Verification failed: token not received.");
          clearOtp();
          setVerifyingOtp(false);
          return;
        }

        setVerifyPhase("server");
        try {
          const result = await verifyToken(token, normalizedPhone);
          if (result.success) {
            await syncAdminSessionIfNeeded(normalizedPhone, token);
          }
          if (result.success && (!result.nextStep || result.nextStep === "profile")) {
            setOnboardingPhone(normalizedPhone);
            setStep("verified");
            setOtpInfo("");
            return;
          }
          if (result.success && result.nextStep === "verification") {
            setOnboardingPhone(normalizedPhone);
            router.push(`/onboarding/verification?phone=${encodeURIComponent(normalizedPhone)}`);
            setOtpInfo("");
            return;
          }
          if (result.success && (result.nextStep === "get_vouch" || result.nextStep === "vouch_rejected" || result.nextStep === "verification_reapply")) {
            setOnboardingPhone(normalizedPhone);
            router.push(`/onboarding/get-vouch?phone=${encodeURIComponent(normalizedPhone)}`);
            setOtpInfo("");
            return;
          }
          if (result.success && result.nextStep === "done") {
            setOnboardingPhone(normalizedPhone);
            router.push("/home");
            setOtpInfo("");
            return;
          }
          setError(result.message || "Verification failed. Please enter OTP again.");
          clearOtp();
        } catch {
          setError("Server verification failed. Please try again.");
          clearOtp();
        } finally {
          setVerifyingOtp(false);
        }
      },
      (err) => {
        setError(typeof err === "string" ? err : "Invalid OTP. Please try again.");
        clearOtp();
        setVerifyingOtp(false);
      },
      otpRequestId || undefined
    );
  }, [clearOtp, normalizedPhone, otp, otpRequestId, router]);

  const handleResendOTP = useCallback(() => {
    if (resendCountdown > 0) return;
    setError("");
    setOtpInfo("");
    if (!window.retryOtp && !window.sendOtp) {
      setError("OTP widget not ready. Please refresh.");
      return;
    }
    setResendingOtp(true);
    const handleResendSuccess = (data?: unknown) => {
      const reqId = getReqIdFromWidgetData(data);
      if (reqId) {
        setOtpRequestId(reqId);
      }
      setResendCountdown(30);
      clearOtp();
      setOtpInfo("A new OTP has been sent to your number.");
      setResendingOtp(false);
    };
    const handleResendFailure = (err: unknown) => {
      // Some MSG91 widget integrations require sendOtp for resend if reqId is missing.
      if (window.sendOtp) {
        window.sendOtp(
          normalizedPhone,
          (data) => handleResendSuccess(data),
          (sendErr) => {
            setError(typeof sendErr === "string" ? sendErr : "Could not resend OTP.");
            setResendingOtp(false);
          }
        );
        return;
      }
      setError(typeof err === "string" ? err : "Could not resend OTP.");
      setResendingOtp(false);
    };

    if (window.retryOtp) {
      window.retryOtp("text", handleResendSuccess, handleResendFailure, otpRequestId || undefined);
      return;
    }

    if (!window.sendOtp) {
      setError("OTP widget not ready. Please refresh.");
      setResendingOtp(false);
      return;
    }

    window.sendOtp(
      normalizedPhone,
      (data) => handleResendSuccess(data),
      (err) => {
        setError(typeof err === "string" ? err : "Could not resend OTP.");
        setResendingOtp(false);
      }
    );
  }, [clearOtp, normalizedPhone, otpRequestId, resendCountdown]);

  const handleContinueToProfile = async () => {
    setOnboardingPhone(normalizedPhone);
    router.push(`/onboarding/profile?phone=${encodeURIComponent(normalizedPhone)}`);
  };

  const handleSaveProfile = async () => {
    setError("");
    if (!isProfileValid) {
      setError("Please complete all required fields.");
      return;
    }
    setSavingProfile(true);
    try {
      const result = await saveProfile({
        phone: normalizedPhone,
        fullName: profileForm.fullName,
        email: profileForm.email,
        primarySellingCategory: profileForm.primarySellingCategory,
        otherCategories: profileForm.otherCategories,
        city: profileForm.city,
        state: profileForm.state,
        fullAddress: profileForm.fullAddress,
        pincode: profileForm.pincode,
        gstRegistered: profileForm.gstRegistered === "yes",
        gstNumber: profileForm.gstNumber,
        registeredFirmName: profileForm.registeredFirmName,
      });
      if (!result.success) {
        setError(result.message || "Could not save profile.");
        return;
      }
      router.push(`/onboarding/verification?phone=${encodeURIComponent(normalizedPhone)}`);
    } catch {
      setError("Could not save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (widgetError) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#EEF0F2] p-4">
        <div className="w-full max-w-[620px] border border-[#d8dce0] bg-white p-8 text-[#051F2D]">
          <h1 className="text-[28px] font-semibold">Configuration needed</h1>
          <p className="mt-3 text-[18px] leading-[28px]">{widgetError}</p>
        </div>
      </div>
    );
  }

  const useOnboardingPlainBg = step === "profile_setup";
  const isAuthScreen = step === "phone" || step === "otp" || step === "verified";
  const useDarkAuthBg = isDark && isAuthScreen;
  const authFullBleedShell = !useOnboardingPlainBg;
  const mainColumnPadding =
    step === "profile_setup"
      ? "px-3 py-0 sm:px-6 md:px-8 md:pt-12 lg:px-14"
      : step === "verified"
        ? "px-3 py-6 sm:px-6 md:px-8 md:pt-12 lg:px-14 lg:py-8"
        : "px-3 pt-[max(5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-10 sm:pb-8 md:px-8 md:pt-12 lg:px-14 lg:py-14";

  return (
    <div
      className={`${authFullBleedShell ? "fixed inset-0 z-[1] flex flex-col overflow-hidden" : "relative min-h-[100dvh] overflow-hidden"} ${useOnboardingPlainBg ? "bg-[#F7F8F8]" : "bg-[#E9EDF0]"} ${useDarkAuthBg ? "dark" : ""}`}
    >
      {!useOnboardingPlainBg && (
        <Image
          src={useDarkAuthBg ? "/Authentication step 1.png" : "/Login Screen Background light theme.png"}
          alt="Background"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      )}

      <div
        className={`relative z-10 mx-auto flex w-full max-w-[1400px] flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain ${authFullBleedShell ? "min-h-0 flex-1" : "min-h-[100dvh]"} ${mainColumnPadding}`}
      >
        {(step === "phone" || step === "otp" || step === "verified") && (
          <header className="mb-6 flex w-full max-w-[918px] items-center justify-between gap-3 self-center sm:mb-8 lg:mb-10">
            <Image
              src={isDark ? "/House of vendors white.svg" : "/House of vendors blue.svg"}
              alt="House of Vendors"
              width={263}
              height={79}
              priority
              className="h-auto w-[190px] shrink-0 sm:w-[263px] sm:-ml-7"
            />
            <DayNightToggle isDark={isDark} onToggle={toggleTheme} />
          </header>
        )}

        {step === "phone" || step === "otp" ? (
          <section
            className={`mx-auto mt-8 flex w-full max-w-[918px] flex-none flex-col px-3 pt-12 pb-30 sm:mt-0 sm:px-6 sm:pt-8 sm:pb-8 md:px-8 lg:min-h-[543px] lg:px-[46px] lg:pt-[56px] lg:pb-[56px] ${
              isDark
                ? "border border-white/20 bg-white/10 shadow-xl backdrop-blur-md"
                : "border border-[#E4E7EA] bg-white"
            }`}
          >
            <h1
              className={`text-[20px] font-medium leading-tight sm:text-[28px] sm:font-medium ${
                isDark ? "text-white" : "text-[#051F2D]"
              }`}
            >
              Join the Vendor Circle
            </h1>
            <p
              className={`mt-4 max-w-[729px] text-[14px] font-normal leading-snug sm:mt-5 sm:text-[18px] sm:font-medium sm:leading-[28px] ${isDark ? "text-white" : "text-[#5C6D7A]"}`}
            >
              <span className="hidden sm:inline">
                Every brand here is reviewed for quality, authenticity, and cultural fit.
                <br />
                Let&apos;s begin your verification.
              </span>
              <span className="sm:hidden">Enter your mobile number to begin your onboarding.</span>
            </p>

            {step === "phone" && (
              <div className="mt-15 sm:mt-10 lg:mt-[70px]">
                <label
                  htmlFor="phone-input"
                  className={`mb-4 block text-[16px] font-semibold leading-none sm:text-[18px] ${isDark ? "text-white" : "text-[#051F2D]"}`}
                >
                  Phone Number
                </label>
                <div className="flex flex-col gap-10 sm:flex-row sm:items-center sm:gap-[10px]">
                  <div className="flex min-w-0 gap-2 sm:flex-1">
                    <div
                      className={`flex h-[65px] w-[60px] shrink-0 items-center justify-center border border-[#B6BDC4] text-[17px] font-medium sm:h-[56px] ${
                        isDark ? "bg-white/10 text-[#9BA5AB]" : "bg-white text-[#5C6D7A]"
                      }`}
                    >
                      +91
                    </div>
                    <input
                      id="phone-input"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="123456789"
                      disabled={sendingOtp || !widgetReady}
                      className={`h-[65px] min-w-0 flex-1 border border-[#B6BDC4] px-4 text-[16px] font-medium outline-none focus:border-[#051F2D] sm:h-[56px] sm:text-[18px] ${
                        isDark
                          ? "bg-white/10 text-[#828f96] placeholder:text-[#9BA5AB] focus:bg-white/15 focus:text-[#828f96] [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_rgba(255,255,255,0.1)_inset] [&:-webkit-autofill]:![-webkit-text-fill-color:#828f96]"
                          : "bg-white text-[#051F2D] placeholder:text-[#95A1AB]"
                      }`}
                    />
                  </div>
                  <button
                    onClick={handleGetOTP}
                    disabled={sendingOtp || !widgetReady || !isPhoneValid}
                    className="h-[60px] w-full shrink-0 whitespace-nowrap px-4 text-[17px] font-semibold leading-none transition disabled:cursor-not-allowed sm:h-[56px] sm:min-w-[152px] sm:w-auto sm:px-6 sm:text-[20px]"
                    style={
                      isDark
                        ? {
                            backgroundColor: sendingOtp || !widgetReady || !isPhoneValid ? "rgba(255,255,255,0.15)" : "#ffffff",
                            color: sendingOtp || !widgetReady || !isPhoneValid ? "#9BA5AB" : "#051F2D",
                          }
                        : {
                            backgroundColor: sendingOtp || !widgetReady || !isPhoneValid ? "#CDD2D5" : "#051F2D",
                            color: "#fff",
                          }
                    }
                  >
                    {sendingOtp ? "Sending..." : "Send Code"}
                  </button>
                </div>
              </div>
            )}

            {step === "otp" && (
              <div className="mt-15 sm:mt-10 lg:mt-[56px]">
                <label
                  className={`mb-7 block text-[16px] font-semibold leading-none sm:text-[18px] ${isDark ? "text-white" : "text-[#051F2D]"}`}
                >
                  Enter Verification Code
                </label>
                <div className="flex flex-col gap-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-8 lg:flex-nowrap lg:gap-[12px]">
                  <div className="flex justify-between gap-1 sm:gap-2 lg:gap-[12px]">
                    {otpDigits.map((digit, index) => (
                      <input
                        key={`otp-${index}`}
                        ref={(el) => {
                          otpRefs.current[index] = el;
                        }}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e.key)}
                        onPaste={(e) => {
                          e.preventDefault();
                          handleOtpPaste(e.clipboardData.getData("text"));
                        }}
                        inputMode="numeric"
                        maxLength={1}
                        disabled={verifyingOtp}
                        className={isDark ? OTP_BOX_DARK : OTP_BOX_LIGHT}
                      />
                    ))}
                  </div>
                  <button
                    onClick={handleVerifyOTP}
                    disabled={verifyingOtp || otp.length !== OTP_LENGTH}
                    className="h-[52px] w-full shrink-0 whitespace-nowrap px-4 text-[17px] font-semibold leading-none transition disabled:cursor-not-allowed sm:mt-0 sm:h-[56px] sm:min-w-[170px] sm:w-auto sm:px-6 sm:text-[20px] lg:ml-10"
                    style={
                      isDark
                        ? {
                            backgroundColor: verifyingOtp || otp.length !== OTP_LENGTH ? "rgba(255,255,255,0.2)" : "#ffffff",
                            color: verifyingOtp || otp.length !== OTP_LENGTH ? "#9BA5AB" : "#052f2d",
                          }
                        : {
                            backgroundColor: verifyingOtp || otp.length !== OTP_LENGTH ? "#CDD2D5" : "#051F2D",
                            color: "#fff",
                          }
                    }
                  >
                    {verifyingOtp ? (verifyPhase === "otp" ? "Checking..." : "Verifying...") : "Verify"}
                  </button>
                </div>
                <p className="mt-5 text-[14px] leading-[24px] text-[#c7a77b] sm:text-[16px]">
                  Didn&apos;t receive the code?{" "}
                  <button
                    onClick={handleResendOTP}
                    disabled={resendingOtp || resendCountdown > 0}
                    className="border-b border-[#c7a77b] leading-none text-[#c7a77b] disabled:border-transparent disabled:opacity-60"
                  >
                    {resendingOtp ? "Sending..." : resendCountdown > 0 ? `Resend ${resendCountdown}s` : "Resend"}
                  </button>
                </p>
                {otpInfo && (
                  <p className={`mt-3 text-[14px] ${isDark ? "text-[#c7a77b]" : "text-[#7E8B95]"}`}>{otpInfo}</p>
                )}
              </div>
            )}

            {!widgetReady && (
              <p className={`mt-4 text-[16px] ${isDark ? "text-[#9BA5AB]" : "text-[#6E7B86]"}`}>Loading OTP service...</p>
            )}
            {error && (
              <p className="mt-4 text-[16px] font-medium text-[#B04A42]">{error}</p>
            )}
          </section>
        ) : step === "verified" ? (
          <section className="mx-auto mt-0 flex w-full max-w-[920px] flex-col items-center">
            <Image
              src="/Account created.svg"
              alt="Account created"
              width={136}
              height={136}
              className="h-[80px] w-[80px] sm:h-[120px] sm:w-[120px] md:h-[136px] md:w-[136px]"
            />
            <h1
              className={`mt-4 text-center text-[20px] font-semibold leading-tight sm:text-[36px] md:text-[44px] ${isDark ? "text-white" : "text-[#051F2D]"}`}
            >
              Account Created
            </h1>
            <p
              className={`mt-3 text-center text-[15px] font-medium sm:text-[18px] ${isDark ? "text-white/90" : "text-[#7B8A96]"}`}
            >
              Your Verification Journey Starts Here
            </p>

            <div
              className={`mt-10 w-full max-w-[707px] border-[1.5px] px-4 py-12 sm:mt-16 sm:px-6 sm:py-7 md:px-8 md:py-8 lg:min-h-[458px] lg:px-10 lg:py-10 ${
                isDark
                  ? "border-white/20 bg-white/10 backdrop-blur-md"
                  : "border-[#DCE1E6] bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className={`text-[18px] font-semibold leading-none sm:text-[22px] ${isDark ? "text-white" : "text-[#051F2D]"}`}>
                  What happens next?
                </h2>
                <p className={`text-[13px] font-medium sm:text-[14px] ${isDark ? "text-white/80" : "text-[#9AA5AF]"}`}>
                  Estimated time: 3-5 mins
                </p>
              </div>
              <ol className="mt-6 space-y-4 sm:mt-8 sm:space-y-5">
                <li className={`flex items-center gap-3 text-[15px] font-medium leading-[2.5] sm:items-center sm:text-[17px] sm:leading-[2.5] ${isDark ? "text-white/90" : "text-[#5C6D7A]"}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${isDark ? "bg-white/20 text-white" : "bg-[#E4E9EE] text-[#5C6D7A]"}`}>1</span>
                  Complete your vendor Profile.
                </li>
                <li className={`flex items-center gap-3 text-[15px] font-medium leading-[2.5] sm:items-center sm:text-[17px] sm:leading-[2.5] ${isDark ? "text-white/90" : "text-[#5C6D7A]"}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold  ${isDark ? "bg-white/20 text-white" : "bg-[#E4E9EE] text-[#5C6D7A]"}`}>2</span>
                  Upload your Aadhaar (front and back if needed) and PAN for verification.
                </li>
                <li className={`flex items-center gap-3 text-[15px] font-medium leading-[2.5] sm:items-center sm:text-[17px] sm:leading-[2.5] ${isDark ? "text-white/90" : "text-[#5C6D7A]"}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${isDark ? "bg-white/20 text-white" : "bg-[#E4E9EE] text-[#5C6D7A]"}`}>3</span>
                  Get vouched by a verified vendor.
                </li>
              </ol>
              <button
                type="button"
                className={`group mt-12 flex h-[52px] w-full items-center justify-center gap-2 px-6 text-[16px] font-semibold leading-none sm:mx-auto sm:mt-20 sm:h-[56px] sm:max-w-[566px] sm:text-[18px] ${isDark ? "bg-white text-[#051F2D]" : "bg-[#051F2D] text-white"}`}
                onClick={handleContinueToProfile}
              >
                Continue to Profile Setup
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 256 256" aria-hidden className="translate-x-1 transition-transform duration-200 group-hover:translate-x-2">
                  <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" />
                </svg>
              </button>
            </div>
          </section>
        ) : step === "profile_setup" ? (
          <section className="w-full">
            <div className="relative left-1/2 mb-8 w-screen -translate-x-1/2 border-b border-[#DCE1E6]">
              <div className="mx-auto flex h-[76px] w-full items-center px-2 sm:px-4 lg:px-6">
                <Image src="/House of vendors blue.svg" alt="Vendors" width={270} height={82} className="h-auto w-[240px]" />
              </div>
            </div>

            <div className="mb-16 flex items-center justify-center">
              <ProgressStep active number={1} label="Profile" />
              <ProgressStep active={false} number={2} label="Verification" />
              <ProgressStep active={false} number={3} label="Get Vouch" isLast />
            </div>

            <div className="mx-auto max-w-[980px]">
              <h1 className="text-[34px] font-medium leading-none text-[#1F3444]">Complete Your Profile</h1>
              <p className="mt-3 text-[18px] text-[#6D7A85]">Tell us about your brand to get started.</p>

              <div className="mt-10 space-y-8">
                <div>
                  <label className="mb-2 block text-[18px] font-semibold text-[#223544]">Full Name</label>
                  <input value={profileForm.fullName} onChange={(e) => setProfileForm((p) => ({ ...p, fullName: e.target.value }))} className="h-[56px] w-full border border-[#C7CDD3] bg-white px-4 text-[16px] text-[#51616E] outline-none focus:border-[#051F2D]" placeholder="Enter your full name" />
                </div>

                <div>
                  <label className="mb-2 block text-[18px] font-semibold text-[#223544]">Email Address</label>
                  <input value={profileForm.email} onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))} className="h-[56px] w-full border border-[#C7CDD3] bg-white px-4 text-[16px] text-[#51616E] outline-none focus:border-[#051F2D]" placeholder="Enter your email address" />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <SelectField
                    label="Primary Selling Category"
                    placeholder="Select the main category your business deals in"
                    value={profileForm.primarySellingCategory}
                    options={[...PRIMARY_SELLING_CATEGORY_OPTIONS]}
                    onChange={(value) =>
                      setProfileForm((p) => ({
                        ...p,
                        primarySellingCategory: value,
                        otherCategories: p.otherCategories.filter((c) => c !== value),
                      }))
                    }
                  />
                  <MultiCategorySelectLight
                    label="Other Categories"
                    placeholder="Add more categories you sell"
                    options={PRIMARY_SELLING_CATEGORY_OPTIONS}
                    value={profileForm.otherCategories}
                    onChange={(next) => setProfileForm((p) => ({ ...p, otherCategories: next }))}
                    optional
                    exclude={profileForm.primarySellingCategory ? [profileForm.primarySellingCategory] : []}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <SelectField label="City / Location" placeholder="Select your location" value={profileForm.city} options={cityOptions} onChange={(value) => setProfileForm((p) => ({ ...p, city: value }))} />
                  <SelectField label="State" placeholder="Select your state" value={profileForm.state} options={stateOptions} onChange={(value) => setProfileForm((p) => ({ ...p, state: value }))} />
                </div>

                <div>
                  <label className="mb-2 block text-[18px] font-semibold text-[#223544]">Full Address</label>
                  <input value={profileForm.fullAddress} onChange={(e) => setProfileForm((p) => ({ ...p, fullAddress: e.target.value }))} className="h-[56px] w-full border border-[#C7CDD3] bg-white px-4 text-[16px] text-[#51616E] outline-none focus:border-[#051F2D]" placeholder="Enter your full address" />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[18px] font-semibold text-[#223544]">Pincode</label>
                    <input value={profileForm.pincode} onChange={(e) => setProfileForm((p) => ({ ...p, pincode: e.target.value }))} className="h-[56px] w-full border border-[#C7CDD3] bg-white px-4 text-[16px] text-[#51616E] outline-none focus:border-[#051F2D]" placeholder="Enter pincode" />
                  </div>
                  <SelectField
                    label="Are you registered under GST ?"
                    placeholder="Select"
                    value={profileForm.gstRegistered === "yes" ? "Yes, GST Registered" : profileForm.gstRegistered === "no" ? "Not Yet" : ""}
                    options={gstOptions.map((o) => o.label)}
                    onChange={(value) =>
                      setProfileForm((p) => ({
                        ...p,
                        gstRegistered: value === "Yes, GST Registered" ? "yes" : "no",
                        gstNumber: value === "Yes, GST Registered" ? p.gstNumber : "",
                        registeredFirmName: value === "Yes, GST Registered" ? p.registeredFirmName : "",
                      }))
                    }
                  />
                </div>

                {profileForm.gstRegistered === "yes" && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-[18px] font-semibold text-[#223544]">GST Number</label>
                      <input value={profileForm.gstNumber} onChange={(e) => setProfileForm((p) => ({ ...p, gstNumber: e.target.value }))} className="h-[56px] w-full border border-[#C7CDD3] bg-white px-4 text-[16px] text-[#51616E] outline-none focus:border-[#051F2D]" placeholder="Enter your valid GSTIN" />
                    </div>
                    <div>
                      <label className="mb-2 block text-[18px] font-semibold text-[#223544]">Registered Name</label>
                      <input value={profileForm.registeredFirmName} onChange={(e) => setProfileForm((p) => ({ ...p, registeredFirmName: e.target.value }))} className="h-[56px] w-full border border-[#C7CDD3] bg-white px-4 text-[16px] text-[#51616E] outline-none focus:border-[#051F2D]" placeholder="Name as per GST registration" />
                    </div>
                  </div>
                )}

                {error && <p className="text-[15px] font-medium text-[#B04A42]">{error}</p>}

                <div className="flex justify-end pb-10 pt-4">
                  <button
                    onClick={handleSaveProfile}
                    disabled={!isProfileValid || savingProfile}
                    className="group flex h-[58px] min-w-[220px] items-center justify-center gap-2 px-6 text-[18px] font-semibold text-white transition disabled:cursor-not-allowed"
                    style={{ backgroundColor: !isProfileValid || savingProfile ? "#CDD2D5" : "#051F2D" }}
                  >
                    {savingProfile ? "Saving..." : "Continue"}
                    <span className="text-[28px] leading-none transition-transform group-hover:translate-x-1">→</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}
        </div>
    </div>
  );
}
