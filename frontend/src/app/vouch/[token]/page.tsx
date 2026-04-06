"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getPublicVouchInfo, submitPublicVouch } from "@/lib/api";

type Props = {
  params: Promise<{ token: string }>;
};

export default function PublicVouchPage({ params }: Props) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [vendorName, setVendorName] = useState("");
  const [vouchCount, setVouchCount] = useState(0);
  const [target, setTarget] = useState(30);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [spark, setSpark] = useState(false);
  const [form, setForm] = useState({
    name: "",
    brandName: "",
    email: "",
    phone: "",
  });

  const canSubmit = useMemo(() => form.name.trim() && form.brandName.trim() && form.email.trim() && form.phone.trim(), [form]);

  useEffect(() => {
    const run = async () => {
      const resolved = await params;
      const tokenFromRoute = resolved.token || "";
      setToken(tokenFromRoute);
      if (!tokenFromRoute) {
        setError("Invalid vouch link.");
        setLoading(false);
        return;
      }
      const status = await getPublicVouchInfo(tokenFromRoute);
      if (!status.success) {
        setError(status.message || "This vouch link is invalid.");
        setLoading(false);
        return;
      }
      setVendorName(status.vendorName || "this vendor");
      setVouchCount(status.vouchCount || 0);
      setTarget(status.target || 30);
      setLoading(false);
    };
    void run();
  }, [params]);

  const onSubmit = async () => {
    if (!canSubmit || !token) {
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const result = await submitPublicVouch({
        token,
        name: form.name,
        brandName: form.brandName,
        email: form.email,
        phone: form.phone,
      });
      if (!result.success) {
        setError(result.message || "Could not submit vouch.");
        return;
      }
      setVouchCount(result.vouchCount || vouchCount);
      setTarget(result.target || target);
      setSuccess("Thank you. Your vouch has been submitted.");
      setSpark(true);
      setTimeout(() => setSpark(false), 1000);
      setForm({ name: "", brandName: "", email: "", phone: "" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#F7F8F8]" />;
  }

  return (
    <div className="min-h-screen bg-[#F7F8F8]">
      <div className="relative left-1/2 mb-8 w-screen -translate-x-1/2 border-b border-[#DCE1E6]">
        <div className="mx-auto flex h-[76px] w-full items-center px-2 sm:px-4 lg:px-6">
          <Image src="/House of vendors blue.svg" alt="Vendors" width={270} height={82} className="h-auto w-[240px]" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[860px] px-6 pb-16">
        <div className="border border-[#E2E5E8] bg-[#F9F8F8] p-8 shadow-[0_3px_12px_rgba(20,44,65,0.07)]">
          <h1 className="text-[32px] font-semibold text-[#1C3040]">Vendor Vouch Form</h1>
          <p className="mt-3 text-[16px] text-[#72808C]">
            Share your trust for <span className="font-semibold text-[#1C3040]">{vendorName || "this vendor"}</span>. Your phone number is mandatory and one phone number can vouch only once.
          </p>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-[14px] text-[#8C99A3]">
              Current progress: {vouchCount}/{target}
            </p>
            <div className="h-2 w-[220px] rounded-full bg-[#E2E5E8]">
              <div className="h-2 rounded-full bg-[#C7A77B]" style={{ width: `${Math.min(100, Math.round((vouchCount / Math.max(target, 1)) * 100))}%` }} />
            </div>
          </div>

          <div className="mt-7 space-y-4">
            <Input label="Your Name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="Enter your name" />
            <Input label="Brand Name" value={form.brandName} onChange={(value) => setForm((prev) => ({ ...prev, brandName: value }))} placeholder="Enter your brand name" />
            <Input label="Email" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} placeholder="Enter your email" />
            <Input label="Phone Number" value={form.phone} onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))} placeholder="Enter your phone number" />
          </div>

          {error ? <p className="mt-5 text-[14px] text-[#C24747]">{error}</p> : null}
          {success ? <p className="mt-5 text-[14px] text-[#2F8C57]">{success}</p> : null}

          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={!canSubmit || submitting}
            className={`mt-7 h-[52px] min-w-[230px] px-6 text-[17px] font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:bg-[#BFC5CB] ${
              spark ? "bg-[#0D6B45] scale-[1.02]" : "bg-[#051F2D] hover:brightness-110"
            }`}
          >
            {submitting ? "Submitting..." : "I vouch for this vendor"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-[16px] font-semibold text-[#223544] sm:text-[15px]">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-[52px] w-full border border-[#C7CDD3] bg-white px-4 text-[16px] text-[#51616E] outline-none transition-all duration-200 focus:border-[#051F2D] focus:shadow-[0_0_0_3px_rgba(5,31,45,0.08)] sm:text-[15px]"
      />
    </div>
  );
}
