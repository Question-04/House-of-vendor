const PHONE_KEY = "vendor_onboarding_phone";

export function setOnboardingPhone(phone: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PHONE_KEY, phone);
  } catch {
    // ignore storage failures
  }
}

export function getOnboardingPhone(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(PHONE_KEY) || "";
  } catch {
    return "";
  }
}
