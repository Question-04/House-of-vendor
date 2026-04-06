"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { getOnboardingStatus, getProfile, saveProfile } from "@/lib/api";
import { getOnboardingPhone, setOnboardingPhone } from "@/lib/onboarding-session";
import { normalizePhone } from "@/lib/msg91-widget";
import OnboardingLoadingScreen from "@/components/onboarding-loading-screen";
import { MultiCategorySelect } from "@/components/multi-category-select";
import { useTheme } from "@/contexts/theme-context";
import { parseOtherCategoriesFromProfile, PRIMARY_SELLING_CATEGORY_OPTIONS } from "@/lib/vendor-categories";

export const dynamic = "force-dynamic";

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

/** Rank for search: whole string starts with query → word starts with query → substring match (by index). */
function locationSearchRank(optionLower: string, q: string): { tier: number; index: number } {
  if (!q) return { tier: 0, index: 0 };
  if (optionLower.startsWith(q)) return { tier: 0, index: 0 };
  const words = optionLower.split(/[\s/-]+/);
  let bestWordStart = Infinity;
  for (const w of words) {
    if (w.startsWith(q)) bestWordStart = Math.min(bestWordStart, optionLower.indexOf(w));
  }
  if (bestWordStart !== Infinity) return { tier: 1, index: bestWordStart };
  const idx = optionLower.indexOf(q);
  if (idx === -1) return { tier: 9, index: 9999 };
  return { tier: 2, index: idx };
}

function filterSortLocationOptions(options: string[], query: string, selected: string): string[] {
  const q = query.trim().toLowerCase();
  let list = q ? options.filter((o) => o.toLowerCase().includes(q)) : [...options];
  list.sort((a, b) => {
    const la = a.toLowerCase();
    const lb = b.toLowerCase();
    const ra = locationSearchRank(la, q);
    const rb = locationSearchRank(lb, q);
    if (ra.tier !== rb.tier) return ra.tier - rb.tier;
    if (ra.index !== rb.index) return ra.index - rb.index;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
  if (selected && list.includes(selected)) {
    list = [selected, ...list.filter((x) => x !== selected)];
  }
  return list;
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

function SelectField({
  label,
  placeholder,
  value,
  options,
  onChange,
  optional = false,
  isDark = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  optional?: boolean;
  isDark?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const orderedOptions = useMemo(() => {
    if (!value || !options.includes(value)) return options;
    const rest = options.filter((opt) => opt !== value);
    return [value, ...rest];
  }, [options, value]);

  return (
    <div className="relative">
      <label className={`mb-4 block text-[16px] font-semibold sm:mb-2 sm:text-[18px] ${isDark ? "text-white" : "text-[#223544]"}`}>
        {label} {optional && <span className={`font-medium italic ${isDark ? "text-white/90" : "text-[#223544]"}`}>(optional)</span>}
      </label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex h-[52px] w-full items-center justify-between border px-4 text-left text-[15px] sm:h-[56px] sm:text-[16px] ${
          isDark
            ? "border-white/20 bg-white/10 text-white"
            : "border-[#C7CDD3] bg-white text-[#6D7A85]"
        }`}
      >
        <span className={value ? (isDark ? "text-white font-medium" : "text-[#51616E]") : (isDark ? "text-[#9BA5AB]" : "text-[#A8B0B7]")}>
          {value || placeholder}
        </span>
        <span className={`transition-transform ${open ? "rotate-180" : ""} ${isDark ? "text-white/80" : "text-[#8B97A1]"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
            <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path>
          </svg>
        </span>
      </button>
      {open && (
        <div
          className={`absolute z-20 mt-1 max-h-[220px] w-full overflow-y-auto border ${
            isDark ? "border-white/20 bg-[#051F2D]" : "border-[#AEB8C1] bg-white"
          }`}
        >
          {orderedOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={`block w-full px-4 py-2 text-left text-[15px] sm:text-[16px] ${
                value === option
                  ? "bg-[#C7A77B] text-[#051F2D]"
                  : isDark
                    ? "text-white hover:bg-white/10"
                    : "text-[#34495A] hover:bg-[#F4F6F8]"
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

function SearchableSelectField({
  label,
  placeholder,
  value,
  options,
  onChange,
  optional = false,
  isDark = false,
  searchPlaceholder = "Type to search…",
}: {
  label: string;
  placeholder: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  optional?: boolean;
  isDark?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const displayOptions = useMemo(() => filterSortLocationOptions(options, query, value), [options, query, value]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const id = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const panelClass = isDark ? "border-white/20 bg-[#051F2D] shadow-lg" : "border-[#AEB8C1] bg-white shadow-lg";
  const inputBarClass = isDark ? "border-white/15 bg-[#051F2D]" : "border-[#DCE1E6] bg-[#F7F8F8]";
  const searchInputClass = isDark
    ? "border-white/20 bg-white/10 text-white placeholder:text-white/45"
    : "border-[#C7CDD3] bg-white text-[#51616E] placeholder:text-[#9BA5AB]";

  return (
    <div ref={rootRef} className="relative min-w-0 w-full max-w-full">
      <label className={`mb-4 block text-[16px] font-semibold sm:mb-2 sm:text-[18px] ${isDark ? "text-white" : "text-[#223544]"}`}>
        {label} {optional && <span className={`font-medium italic ${isDark ? "text-white/90" : "text-[#223544]"}`}>(optional)</span>}
      </label>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex h-[52px] w-full min-w-0 max-w-full items-center justify-between gap-2 border px-3 text-left text-[15px] sm:h-[56px] sm:px-4 sm:text-[16px] ${
          isDark ? "border-white/20 bg-white/10 text-white" : "border-[#C7CDD3] bg-white text-[#6D7A85]"
        }`}
      >
        <span
          className={`min-w-0 flex-1 truncate ${value ? (isDark ? "font-medium text-white" : "text-[#51616E]") : isDark ? "text-[#9BA5AB]" : "text-[#A8B0B7]"}`}
        >
          {value || placeholder}
        </span>
        <span className={`shrink-0 transition-transform ${open ? "rotate-180" : ""} ${isDark ? "text-white/80" : "text-[#8B97A1]"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
            <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path>
          </svg>
        </span>
      </button>
      {open && (
        <div
          className={`absolute left-0 right-0 z-[40] mt-1 flex max-h-[min(18rem,52vh)] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-sm border ${panelClass}`}
          role="listbox"
          aria-label={label}
        >
          <div className={`shrink-0 border-b px-2 py-2 sm:px-3 ${inputBarClass}`}>
            <input
              ref={searchRef}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label={`Search ${label}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder={searchPlaceholder}
              className={`h-10 w-full min-w-0 max-w-full rounded-sm border px-3 text-[16px] outline-none focus:border-[#051F2D] sm:h-11 ${searchInputClass}`}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain py-1">
            {displayOptions.length === 0 ? (
              <p className={`px-3 py-3 text-left text-[14px] sm:text-[15px] ${isDark ? "text-white/70" : "text-[#6D7A85]"}`}>No matches. Try another spelling.</p>
            ) : (
              displayOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={value === option}
                  className={`w-full max-w-full px-3 py-2.5 text-left text-[15px] break-words sm:px-4 sm:text-[16px] ${
                    value === option
                      ? "bg-[#C7A77B] text-[#051F2D]"
                      : isDark
                        ? "text-white hover:bg-white/10"
                        : "text-[#34495A] hover:bg-[#F4F6F8]"
                  }`}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  {option}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileSetupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [phone, setPhone] = useState("");
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

  const { isDark, toggleTheme } = useTheme();

  const isProfileValid = useMemo(
    () =>
      profileForm.fullName.trim() &&
      profileForm.email.trim() &&
      profileForm.primarySellingCategory.trim() &&
      profileForm.city.trim() &&
      profileForm.state.trim() &&
      profileForm.fullAddress.trim() &&
      profileForm.pincode.trim() &&
      (profileForm.gstRegistered === "no" || (profileForm.gstNumber.trim() && profileForm.registeredFirmName.trim())),
    [profileForm]
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
      try {
        const status = await getOnboardingStatus(resolvedPhone);
        if (status.success && status.nextStep && status.nextStep !== "profile") {
          if (status.nextStep === "verification") {
            router.replace(`/onboarding/verification?phone=${encodeURIComponent(resolvedPhone)}`);
          } else {
            router.replace(`/onboarding/get-vouch?phone=${encodeURIComponent(resolvedPhone)}`);
          }
          return;
        }

        const profile = await getProfile(resolvedPhone);
        if (profile.success) {
          setProfileForm({
            fullName: profile.profile.fullName || "",
            email: profile.profile.email || "",
            primarySellingCategory: profile.profile.primarySellingCategory || "",
            otherCategories: parseOtherCategoriesFromProfile(profile.profile.otherCategories),
            city: profile.profile.city || "",
            state: profile.profile.state || "",
            fullAddress: profile.profile.fullAddress || "",
            pincode: profile.profile.pincode || "",
            gstRegistered: profile.profile.gstRegistered ? "yes" : "no",
            gstNumber: profile.profile.gstNumber || "",
            registeredFirmName: profile.profile.registeredFirmName || "",
          });
        }
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, [router, searchParams]);

  const handleSaveProfile = async () => {
    setError("");
    if (!isProfileValid || !phone) {
      setError("Please complete all required fields.");
      return;
    }
    setSavingProfile(true);
    try {
      const result = await saveProfile({
        phone,
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
      const next = result.nextStep || "verification";
      if (next === "verification") {
        router.push(`/onboarding/verification?phone=${encodeURIComponent(phone)}`);
      } else {
        router.push(`/onboarding/get-vouch?phone=${encodeURIComponent(phone)}`);
      }
    } catch {
      setError("Could not save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return <OnboardingLoadingScreen title="Preparing your profile setup" subtitle="Fetching your details and checking your onboarding status." />;
  }

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#051F2D]" : "bg-[#F7F8F8]"}`}>
      <section className="w-full">
        <div className={`relative left-1/2 mb-8 w-screen -translate-x-1/2 border-b ${isDark ? "border-white/20 bg-[#051F2D]" : "border-[#DCE1E6]"}`}>
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

        {/* Phone: single step indicator (current step only – circle + step name) */}
        <div className="mb-6 flex items-center justify-start px-3 sm:hidden">
          <div className="flex items-center">
            <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full border-2 border-[#C7A77B]">
              <span className="text-[20px] font-semibold text-[#C7A77B]">1</span>
            </div>
            <span className="ml-3 text-[20px] font-semibold text-[#C7A77B]">Profile</span>
          </div>
        </div>
        {/* Web: full 3-step indicator */}
        <div className="mb-16 hidden items-center justify-center sm:flex">
          <ProgressStep active number={1} label="Profile" isDark={isDark} />
          <ProgressStep active={false} number={2} label="Verification" isDark={isDark} />
          <ProgressStep active={false} number={3} label="Get Vouch" isLast isDark={isDark} />
        </div>

        <div className="mx-auto max-w-[980px] px-3 sm:px-0">
          <h1 className={`text-[24px] font-semibold leading-tight sm:text-[32px] sm:leading-none ${isDark ? "text-white" : "text-[#1F3444]"}`}>Complete Your Profile</h1>
          <p className={`mt-2 text-[15px] sm:mt-3 sm:text-[18px] ${isDark ? "text-white/80" : "text-[#6D7A85]"}`}>Tell us about your brand to get started.</p>

          <div className="mt-6 space-y-6 pb-10 sm:mt-10 sm:space-y-8">
            <div>
              <label className={`mb-4 block text-[16px] font-semibold sm:mb-2 sm:text-[18px] ${isDark ? "text-white" : "text-[#223544]"}`}>Full Name</label>
              <input
                value={profileForm.fullName}
                onChange={(e) => setProfileForm((p) => ({ ...p, fullName: e.target.value }))}
                className={`h-[52px] w-full border px-4 text-[16px] font-medium outline-none focus:border-[#051F2D] placeholder:text-[#9BA5AB] sm:h-[56px] ${
                  isDark ? "border-white/20 bg-white/10 text-white" : "border-[#C7CDD3] bg-white text-[#51616E]"
                }`}
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className={`mb-4 block text-[16px] font-semibold sm:mb-2 sm:text-[18px] ${isDark ? "text-white" : "text-[#223544]"}`}>Email Address</label>
              <input
                value={profileForm.email}
                onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))}
                className={`h-[52px] w-full border px-4 text-[16px] font-medium outline-none focus:border-[#051F2D] placeholder:text-[#9BA5AB] sm:h-[56px] ${
                  isDark ? "border-white/20 bg-white/10 text-white" : "border-[#C7CDD3] bg-white text-[#51616E]"
                }`}
                placeholder="Enter your email address"
              />
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-4">
              <SelectField
                isDark={isDark}
                label="Primary Selling Category"
                placeholder="Choose your main business category"
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
              <MultiCategorySelect
                isDark={isDark}
                label="Other Categories"
                placeholder="Add more categories you sell"
                options={PRIMARY_SELLING_CATEGORY_OPTIONS}
                value={profileForm.otherCategories}
                onChange={(next) => setProfileForm((p) => ({ ...p, otherCategories: next }))}
                optional
                exclude={profileForm.primarySellingCategory ? [profileForm.primarySellingCategory] : []}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 md:gap-4">
              <SearchableSelectField
                isDark={isDark}
                label="City / Location"
                placeholder="Select your location"
                searchPlaceholder="Search city (e.g. M for Mumbai)…"
                value={profileForm.city}
                options={cityOptions}
                onChange={(v) => setProfileForm((p) => ({ ...p, city: v }))}
              />
            </div>

            {/* State and Pincode in one row (phone and web) */}
            <div className="grid grid-cols-2 gap-3 min-w-0 sm:gap-4">
              <div className="min-w-0">
                <SearchableSelectField
                  isDark={isDark}
                  label="State"
                  placeholder="Select your state"
                  searchPlaceholder="Search state…"
                  value={profileForm.state}
                  options={stateOptions}
                  onChange={(v) => setProfileForm((p) => ({ ...p, state: v }))}
                />
              </div>
              <div className="min-w-0">
                <label className={`mb-4 block text-[16px] font-semibold sm:mb-2 sm:text-[18px] ${isDark ? "text-white" : "text-[#223544]"}`}>Pincode</label>
                <input
                  value={profileForm.pincode}
                  onChange={(e) => setProfileForm((p) => ({ ...p, pincode: e.target.value }))}
                  className={`h-[52px] w-full min-w-0 max-w-full border px-3 text-[16px] font-medium outline-none focus:border-[#051F2D] placeholder:text-[#9BA5AB] sm:h-[56px] sm:px-4 ${
                    isDark ? "border-white/20 bg-white/10 text-white" : "border-[#C7CDD3] bg-white text-[#51616E]"
                  }`}
                  placeholder="Enter pincode"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div>
              <label className={`mb-4 block text-[16px] font-semibold sm:mb-2 sm:text-[18px] ${isDark ? "text-white" : "text-[#223544]"}`}>Full Address</label>
              <input
                value={profileForm.fullAddress}
                onChange={(e) => setProfileForm((p) => ({ ...p, fullAddress: e.target.value }))}
                className={`h-[52px] w-full border px-4 text-[16px] font-medium outline-none focus:border-[#051F2D] placeholder:text-[#9BA5AB] sm:h-[56px] ${
                  isDark ? "border-white/20 bg-white/10 text-white" : "border-[#C7CDD3] bg-white text-[#51616E]"
                }`}
                placeholder="Enter your full address"
              />
            </div>

            <div>
              <SelectField
                isDark={isDark}
                label="Are you registered under GST ?"
                placeholder="Select"
                value={profileForm.gstRegistered === "yes" ? "Yes, GST Registered" : "Not Yet"}
                options={["Yes, GST Registered", "Not Yet"]}
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
                  <label className={`mb-4 block text-[16px] font-semibold sm:mb-2 sm:text-[18px] ${isDark ? "text-white" : "text-[#223544]"}`}>GST Number</label>
                  <input
                    value={profileForm.gstNumber}
                    onChange={(e) => setProfileForm((p) => ({ ...p, gstNumber: e.target.value }))}
                    className={`h-[52px] w-full border px-4 text-[16px] font-medium outline-none focus:border-[#051F2D] placeholder:text-[#9BA5AB] sm:h-[56px] ${
                      isDark ? "border-white/20 bg-white/10 text-white" : "border-[#C7CDD3] bg-white text-[#51616E]"
                    }`}
                    placeholder="Enter your valid GSTIN"
                  />
                </div>
                <div>
                  <label className={`mb-4 block text-[16px] font-semibold sm:mb-2 sm:text-[18px] ${isDark ? "text-white" : "text-[#223544]"}`}>Registered Name</label>
                  <input
                    value={profileForm.registeredFirmName}
                    onChange={(e) => setProfileForm((p) => ({ ...p, registeredFirmName: e.target.value }))}
                    className={`h-[52px] w-full border px-4 text-[16px] font-medium outline-none focus:border-[#051F2D] placeholder:text-[#9BA5AB] sm:h-[56px] ${
                      isDark ? "border-white/20 bg-white/10 text-white" : "border-[#C7CDD3] bg-white text-[#51616E]"
                    }`}
                    placeholder="Name as per GST registration"
                  />
                </div>
              </div>
            )}

            {error && <p className="text-[15px] font-medium text-[#B04A42]">{error}</p>}

            <div className="flex justify-end pb-10 pt-4">
              <button
                onClick={handleSaveProfile}
                disabled={!isProfileValid || savingProfile}
                className={`group flex h-[52px] min-w-[200px] items-center justify-center gap-2 px-5 text-[16px] font-semibold transition disabled:cursor-not-allowed sm:h-[58px] sm:min-w-[220px] sm:px-6 sm:text-[18px] ${
                  !isProfileValid || savingProfile
                    ? "bg-[#CDD2D5] text-white"
                    : isDark
                      ? "bg-white text-[#051F2D]"
                      : "bg-[#051F2D] text-white"
                }`}
              >
                {savingProfile ? "Saving..." : "Continue"}
                <span className="text-[28px] leading-none transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ProfileSetupPage() {
  return (
    <Suspense fallback={<OnboardingLoadingScreen />}>
      <ProfileSetupPageContent />
    </Suspense>
  );
}
