"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { loadMSG91Widget, normalizePhone } from "@/lib/msg91-widget";
import type { MSG91VerifySuccess } from "@/types/msg91";
import { useTheme } from "@/contexts/theme-context";

const OTP_LENGTH = 6;

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

export default function AdminSignInPage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();

  const [phone, setPhone] = useState("");
  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState("");

  const [widgetReady, setWidgetReady] = useState(false);
  const [widgetError, setWidgetError] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);

  const [otpDigits, setOtpDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ""));
  const otp = otpDigits.join("");
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [otpRequestId, setOtpRequestId] = useState<string | undefined>(undefined);
  const [resendCountdown, setResendCountdown] = useState(0);

  const widgetId = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID ?? "";
  const tokenAuth = process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH ?? "";

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
    const timer = setInterval(() => setResendCountdown((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [step, resendCountdown]);

  const clearOtp = useCallback(() => {
    setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
    requestAnimationFrame(() => {
      otpRefs.current[0]?.focus();
    });
  }, []);

  const handleOtpChange = useCallback((index: number, rawValue: string) => {
    const cleaned = rawValue.replace(/\D/g, "");
    if (!cleaned) {
      setOtpDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }
    // iOS/Android OTP autofill can inject the full code into one input.
    if (cleaned.length > 1) {
      const chunk = cleaned.slice(0, OTP_LENGTH).split("");
      setOtpDigits((prev) => {
        const next = [...prev];
        for (let i = 0; i < OTP_LENGTH; i++) next[i] = chunk[i] || "";
        return next;
      });
      requestAnimationFrame(() => {
        otpRefs.current[Math.min(chunk.length, OTP_LENGTH - 1)]?.focus();
      });
      return;
    }
    const digit = cleaned.slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (index < OTP_LENGTH - 1) {
      requestAnimationFrame(() => otpRefs.current[index + 1]?.focus());
    }
  }, []);

  const handleGetOTP = useCallback(() => {
    setError("");
    if (!normalizedPhone) {
      setError("Enter a valid phone number.");
      return;
    }
    if (!widgetReady || !window.sendOtp) {
      setError("OTP widget not ready. Please refresh.");
      return;
    }
    setSendingOtp(true);
    window.sendOtp(
      normalizedPhone,
      (data) => {
        setStep("otp");
        setResendCountdown(30);
        setOtpRequestId(getReqIdFromWidgetData(data) || undefined);
        clearOtp();
        setSendingOtp(false);
      },
      (err) => {
        setError(typeof err === "string" ? err : "Could not send OTP. Please try again.");
        setSendingOtp(false);
      }
    );
  }, [clearOtp, normalizedPhone, widgetReady]);

  const handleResendOTP = useCallback(() => {
    if (resendCountdown > 0) return;
    setError("");
    if (!widgetReady) {
      setError("OTP widget not ready. Please refresh.");
      return;
    }
    setResendingOtp(true);

    const handleResendSuccess = (data?: unknown) => {
      const reqId = getReqIdFromWidgetData(data);
      if (reqId) setOtpRequestId(reqId);
      setResendCountdown(30);
      clearOtp();
      setResendingOtp(false);
    };

    const handleResendFailure = (err: unknown) => {
      // Some MSG91 flows need sendOtp when retryOtp reqId is stale/missing.
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
      window.retryOtp("text", handleResendSuccess as any, handleResendFailure as any, otpRequestId);
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
      (err) => handleResendFailure(err)
    );
  }, [clearOtp, normalizedPhone, otpRequestId, resendCountdown, widgetReady]);

  const handleVerifyOTP = useCallback(() => {
    setError("");
    if (otp.length !== OTP_LENGTH) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }
    if (!widgetReady || !window.verifyOtp) {
      setError("OTP widget not ready. Please refresh.");
      return;
    }
    if (!normalizedPhone) {
      setError("Phone is required.");
      return;
    }

    setVerifyingOtp(true);
    window.verifyOtp(
      otp,
      async (data: MSG91VerifySuccess) => {
        const token = getTokenFromWidget(data);
        const reqIdFromResponse = getReqIdFromWidgetData(data);
        if (reqIdFromResponse) setOtpRequestId(reqIdFromResponse);

        if (!token) {
          setError("Verification failed: token not received.");
          clearOtp();
          setVerifyingOtp(false);
          return;
        }

        const result = await signIn("credentials", {
          phone: normalizedPhone,
          accessToken: token,
          redirect: false,
        });

        if (result?.ok) {
          setVerifyingOtp(false);
          router.push("/admin");
          return;
        }

        setVerifyingOtp(false);
        setError("Not authorized to access the admin dashboard.");
        clearOtp();
      },
      (err) => {
        setError(typeof err === "string" ? err : "Invalid OTP. Please try again.");
        setVerifyingOtp(false);
        clearOtp();
      },
      otpRequestId
    );
  }, [clearOtp, normalizedPhone, otp, otpRequestId, router, widgetReady]);

  const AdminShellBg = isDark ? "min-h-screen bg-[#051F2D]" : "min-h-screen bg-[#F7F8F8]";

  return (
    <div className={AdminShellBg}>
      <div className={`relative left-1/2 w-screen -translate-x-1/2 border-b ${isDark ? "border-white/20 bg-[#051F2D]" : "border-[#DCE1E6] bg-white"}`}>
        <div className="mx-auto flex h-[65px] w-full max-w-[1400px] items-center justify-between gap-3 pl-3 pr-4 sm:h-[76px] sm:mx-0 sm:max-w-none sm:px-0 sm:pl-3 sm:pr-6 lg:pl-4 lg:pr-8">
          <Image
            src={isDark ? "/House of vendors white.svg" : "/House of vendors blue.svg"}
            alt="House of Vendors"
            width={270}
            height={82}
            className="h-auto w-[190px] sm:w-[220px]"
          />
          <button
            type="button"
            onClick={() => toggleTheme()}
            className="hidden rounded border border-slate-200 bg-white/10 px-3 py-1.5 text-xs text-white sm:block"
            aria-label="Toggle theme"
          >
            Theme
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <div className={`rounded-xl border p-5 shadow-sm sm:p-6 ${isDark ? "border-white/15 bg-white/10" : "border-slate-200 bg-white"}`}>
          <h1 className={`text-xl font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Admin Login</h1>
          <p className={`mt-1 text-sm ${isDark ? "text-white/70" : "text-slate-600"}`}>Allowed phones only (MSG91 OTP).</p>

          {widgetError ? <p className="mt-4 text-sm text-red-600">{widgetError}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

          {step === "phone" ? (
            <div className="mt-6 space-y-3">
              <label className="block text-sm font-medium text-slate-700">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 919876543210"
                className={`w-full rounded-lg border px-3 py-2 text-base sm:text-sm ${
                  isDark ? "border-white/15 bg-white/10 text-white" : "border-slate-200 bg-white text-slate-900"
                }`}
              />
              <button
                type="button"
                onClick={() => handleGetOTP()}
                disabled={sendingOtp || !widgetReady}
                className={`h-10 w-full rounded-lg bg-[#051F2D] text-sm font-semibold text-white ${
                  sendingOtp || !widgetReady ? "opacity-60" : "hover:brightness-110"
                }`}
              >
                {sendingOtp ? "Sending..." : "Get OTP"}
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="text-sm text-slate-700">
                OTP sent to <span className="font-mono">{normalizedPhone}</span>
              </div>
              <div className="flex items-center gap-2">
                {otpDigits.map((d, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpRefs.current[idx] = el;
                    }}
                    value={d}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={idx === 0 ? "one-time-code" : "off"}
                    name={idx === 0 ? "otp" : `otp-${idx}`}
                    onChange={(e) => {
                      handleOtpChange(idx, e.target.value);
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      handleOtpChange(idx, e.clipboardData.getData("text"));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !otpDigits[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
                      if (e.key === "ArrowLeft" && idx > 0) otpRefs.current[idx - 1]?.focus();
                      if (e.key === "ArrowRight" && idx < OTP_LENGTH - 1) otpRefs.current[idx + 1]?.focus();
                    }}
                    className={`h-12 w-10 rounded-lg border text-center text-lg font-semibold ${
                      isDark ? "border-white/15 bg-white/10 text-white" : "border-slate-200 bg-white text-slate-900"
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleVerifyOTP()}
                disabled={verifyingOtp || !widgetReady}
                className={`h-10 w-full rounded-lg bg-[#C7A77B] text-sm font-semibold text-[#051F2D] ${
                  verifyingOtp || !widgetReady ? "opacity-60" : "hover:brightness-110"
                }`}
              >
                {verifyingOtp ? "Verifying..." : "Verify & Login"}
              </button>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleResendOTP()}
                  disabled={resendCountdown > 0 || resendingOtp}
                  className={`text-sm font-medium underline underline-offset-2 ${
                    resendCountdown > 0 || resendingOtp ? "opacity-50" : ""
                  }`}
                >
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend OTP"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
                    setOtpRequestId(undefined);
                    setError("");
                  }}
                  className={`text-sm font-medium ${isDark ? "text-white/80" : "text-slate-700"}`}
                >
                  Change phone
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

