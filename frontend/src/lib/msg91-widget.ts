/**
 * Loads MSG91 OTP Widget script and initializes with exposeMethods so we can use
 * window.sendOtp, window.retryOtp, window.verifyOtp in our custom UI.
 */
const SCRIPT_URL = "https://verify.msg91.com/otp-provider.js";

export type WidgetConfig = {
  widgetId: string;
  tokenAuth: string;
  identifier?: string;
};

export function loadMSG91Widget(config: WidgetConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Window not available"));
      return;
    }
    if (window.sendOtp) {
      resolve();
      return;
    }
    const scriptId = "msg91-otp-provider";
    if (document.getElementById(scriptId)) {
      resolve();
      return;
    }
    const configuration = {
      widgetId: config.widgetId,
      tokenAuth: config.tokenAuth,
      identifier: config.identifier ?? "",
      exposeMethods: true,
      captchaRenderId: "",
      success: () => {},
      failure: () => {},
    };
    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = SCRIPT_URL;
    script.onload = () => {
      // Widget script defines initSendOTP on window; call it with our config
      if (typeof window.initSendOTP === "function") {
        window.initSendOTP(configuration);
      }
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load MSG91 widget"));
    document.body.appendChild(script);
  });
}

/** Normalize phone to country code + number (e.g. 91 for India, no +). */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length >= 10) return digits;
  return "";
}
