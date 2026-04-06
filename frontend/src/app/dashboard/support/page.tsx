"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createSupportTicket, getSupportTicketDocUrl, uploadTicketDocs, type SupportTicket } from "@/lib/api";
import { getOnboardingPhone } from "@/lib/onboarding-session";
import { useSupportTicketsQuery, dashboardQueryKeys } from "@/lib/dashboard-queries";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import VendorFooter from "@/components/vendor-footer";

type SupportTab = "raise" | "my_tickets";

const CATEGORIES = ["Payment", "Verification", "Shipping", "Login/Account", "Onboarding", "Other"] as const;

const SUBJECT_OPTIONS: Record<string, string[]> = {
  Payment: ["Delayed payout", "Incorrect payout amount", "Payment not received", "TDS/GST query", "Other"],
  Verification: ["Product rejected during verification", "Verification taking too long", "Need to resubmit documents", "Other"],
  Shipping: ["Wrong shipping address", "Package damaged", "Shipping label issue", "Pickup not scheduled", "Other"],
  "Login/Account": ["Cannot log in", "Phone number change", "Account locked", "Other"],
  Onboarding: ["Verification documents rejected", "Vouch not received", "Profile update needed", "Other"],
  Other: ["Other"],
};

const STATUS_OPTIONS = ["Open", "In Progress", "Resolved", "Closed"];

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  Open: { bg: "#DBEAFE", text: "#1D4ED8" },
  "In Progress": { bg: "#FEF3C7", text: "#92400E" },
  Resolved: { bg: "#DCFCE7", text: "#166534" },
  Closed: { bg: "#E5E7EB", text: "#374151" },
};

const CATEGORY_FILTER = ["All Categories", ...CATEGORIES];
const TIME_FILTER = ["All Time", "Today", "This Week", "This Month"];

function SupportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillOrderId = searchParams.get("orderId") || "";
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<SupportTab>(tabParam === "my_tickets" ? "my_tickets" : "raise");

  const phone = typeof window !== "undefined" ? getOnboardingPhone() : "";
  const queryClient = useQueryClient();
  const { data: tickets = [], isPending: ticketsLoading } = useSupportTicketsQuery(phone);

  const invalidateTickets = useCallback(async () => {
    if (!phone) return;
    await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.tickets(phone) });
    await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.notifications(phone) });
    await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.notificationsUnread(phone) });
  }, [phone, queryClient]);

  // --- Raise a Ticket state ---
  const [category, setCategory] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [orderId, setOrderId] = useState(prefillOrderId);
  const [subject, setSubject] = useState("");
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [customSubject, setCustomSubject] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const subjectRef = useRef<HTMLDivElement>(null);

  // --- My Tickets state ---
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState("All Time");
  const [timeFilterOpen, setTimeFilterOpen] = useState(false);
  const [viewingTicket, setViewingTicket] = useState<SupportTicket | null>(null);
  const [attachmentErr, setAttachmentErr] = useState<string | null>(null);
  const [openingAttachmentIdx, setOpeningAttachmentIdx] = useState<number | null>(null);

  const statusFilterRef = useRef<HTMLDivElement>(null);
  const categoryFilterRef = useRef<HTMLDivElement>(null);
  const timeFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefillOrderId) setOrderId(prefillOrderId);
  }, [prefillOrderId]);

  useEffect(() => {
    if (tabParam === "my_tickets") setActiveTab("my_tickets");
    if (tabParam === "raise") setActiveTab("raise");
  }, [tabParam]);

  useEffect(() => {
    setAttachmentErr(null);
    setOpeningAttachmentIdx(null);
  }, [viewingTicket?.id]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setCategoryOpen(false);
      if (subjectRef.current && !subjectRef.current.contains(e.target as Node)) setSubjectOpen(false);
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target as Node)) setStatusFilterOpen(false);
      if (categoryFilterRef.current && !categoryFilterRef.current.contains(e.target as Node)) setCategoryFilterOpen(false);
      if (timeFilterRef.current && !timeFilterRef.current.contains(e.target as Node)) setTimeFilterOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const subjectOptions = category ? (SUBJECT_OPTIONS[category] ?? ["Other"]) : [];
  const resolvedSubject = subject === "Other" ? customSubject.trim() : subject;
  const canSubmit = category && orderId.trim() && resolvedSubject && description.trim() && email.trim() && !submitting;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;
    const remaining = 3 - files.length;
    const toAdd = Array.from(selected).slice(0, remaining);
    if (toAdd.length > 0) setFiles((prev) => [...prev, ...toAdd]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!canSubmit || !phone) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await createSupportTicket({
        vendorPhone: phone,
        category,
        orderId: orderId.trim(),
        subject: resolvedSubject,
        description: description.trim(),
        email: email.trim(),
        priority,
      });
      if (!res.success) {
        setSubmitError(res.message || "Could not create ticket.");
        setSubmitting(false);
        return;
      }
      const ticketId = res.ticket?.id;
      if (ticketId && files.length > 0) {
        for (const file of files) {
          await uploadTicketDocs({ phone, ticketId, file });
        }
      }
      setSubmitSuccess(true);
      setCategory("");
      setOrderId("");
      setSubject("");
      setCustomSubject("");
      setDescription("");
      setEmail("");
      setPriority("Medium");
      setFiles([]);
      await invalidateTickets();
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const openTicketAttachment = useCallback(
    async (idx: number) => {
      if (!phone || !viewingTicket) return;
      setAttachmentErr(null);
      setOpeningAttachmentIdx(idx);
      try {
        const res = await getSupportTicketDocUrl(phone, viewingTicket.id, idx);
        if (res.success && res.url) {
          window.open(res.url, "_blank", "noopener,noreferrer");
        } else {
          setAttachmentErr(res.message || "Could not open this attachment.");
        }
      } catch {
        setAttachmentErr("Could not open this attachment.");
      } finally {
        setOpeningAttachmentIdx(null);
      }
    },
    [phone, viewingTicket]
  );

  const filteredTickets = useMemo(() => {
    let list = [...tickets];
    if (statusFilter !== "All Statuses") list = list.filter((t) => t.status === statusFilter);
    if (categoryFilter !== "All Categories") list = list.filter((t) => t.category === categoryFilter);
    if (timeFilter !== "All Time") {
      const now = new Date();
      list = list.filter((t) => {
        const created = new Date(t.createdAt);
        if (timeFilter === "Today") return created.toDateString() === now.toDateString();
        if (timeFilter === "This Week") {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return created >= weekAgo;
        }
        if (timeFilter === "This Month") {
          return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }
    return list;
  }, [tickets, statusFilter, categoryFilter, timeFilter]);

  return (
    <div
      className={`relative mx-auto w-full max-w-[1650px] px-4 pt-6 sm:px-8 sm:pt-10 lg:px-0 ${
        activeTab === "raise" ? "pb-28 sm:pb-16" : "pb-24 sm:pb-16"
      }`}
    >
      {/* Back button — same design as profile / add-product */}
      <div className="mb-6 sm:mb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-none border-2 border-[#c7a77b] bg-white px-3 py-2 hover:bg-[#c7a77b]/10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256" className="shrink-0 text-[#1C3040]">
            <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
          </svg>
          <span
            className="text-[15px] font-semibold text-[#1C3040]"
            style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
          >
            Back
          </span>
        </button>
      </div>

      {/* Heading — Georgia / Times New Roman, matches orders & inventory pages */}
      <header className="mb-6 sm:mb-8">
        <h1
          className="text-[25px] text-[#1C3040] sm:text-[40px]"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400 }}
        >
          Contact Support?
        </h1>
        <p
          className="mt-1 text-[14px] text-[#72808C] sm:text-[16px]"
          style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
        >
          We&apos;re here to help. Raise a ticket or check your existing requests.
        </p>
      </header>

      {/* Tabs + response time */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[#e0e6ed] sm:mb-8">
        <div className="flex gap-6 sm:gap-8">
          <button
            type="button"
            onClick={() => { setActiveTab("raise"); setViewingTicket(null); }}
            className={`pb-2 text-[15px] font-semibold transition sm:pb-3 sm:text-[17px] ${
              activeTab === "raise"
                ? "border-b-2 border-[#1C3040] text-[#1C3040]"
                : "text-[#72808C] hover:text-[#1C3040]"
            }`}
            style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
          >
            Raise a Ticket
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("my_tickets"); setViewingTicket(null); }}
            className={`pb-2 text-[15px] font-semibold transition sm:pb-3 sm:text-[17px] ${
              activeTab === "my_tickets"
                ? "border-b-2 border-[#1C3040] text-[#1C3040]"
                : "text-[#72808C] hover:text-[#1C3040]"
            }`}
            style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
          >
            My Tickets
          </button>
        </div>
        <p
          className="pb-2 text-[12px] italic text-[#c7a77b] sm:pb-3 sm:text-[14px]"
          style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
        >
          Avg. response time 24–48 hours.
        </p>
      </div>

      {/* ======= RAISE A TICKET TAB ======= */}
      {activeTab === "raise" && (
        <div>
          {submitSuccess && (
            <div
              className="mb-4 rounded-none border border-[#166534] bg-[#DCFCE7] px-4 py-3 text-[13px] font-medium text-[#166534] sm:mb-6 sm:px-5 sm:text-[14px]"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
            >
              Your ticket has been submitted successfully. We&apos;ll get back to you soon.
            </div>
          )}
          {submitError && (
            <div
              className="mb-4 rounded-none border border-[#b91c1c] bg-[#fef2f2] px-4 py-3 text-[13px] font-medium text-[#b91c1c] sm:mb-6 sm:px-5 sm:text-[14px]"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
            >
              {submitError}
            </div>
          )}

          <div className="space-y-6 rounded-none border border-[#e0e6ed] bg-white px-4 py-6 sm:space-y-8 sm:px-8 sm:py-10">
            {/* Two-column layout for category + order ID */}
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-8">
              {/* Category */}
              <div>
                <label className="mb-1.5 block text-[16px] font-semibold text-[#1C3040] sm:mb-2 sm:text-[15px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                  Category <span className="text-[#b91c1c]">*</span>
                </label>
                <div ref={categoryRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setCategoryOpen((v) => !v)}
                    className="flex h-[48px] w-full items-center justify-between border border-[#DCE1E6] bg-white px-4 text-left text-[14px] text-[#6D7A85] sm:h-[52px] sm:px-5 sm:text-[15px]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    <span>{category || "Select a category"}</span>
                    <DropdownChevron open={categoryOpen} />
                  </button>
                  {categoryOpen && (
                    <div className="absolute z-20 mt-1 max-h-[220px] w-full overflow-y-auto border border-[#DCE1E6] bg-white shadow-lg">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c}
                          type="button"
                            className={`block w-full px-4 py-2.5 text-left text-[14px] sm:px-5 sm:py-3 sm:text-[15px] ${
                            category === c ? "bg-[#c7a77b] text-[#051F2D]" : "text-[#34495A] hover:bg-[#F4F6F8]"
                          }`}
                          style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                          onClick={() => {
                            setCategory(c);
                            setCategoryOpen(false);
                            setSubject("");
                            setCustomSubject("");
                          }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Order ID */}
              <div>
                <label className="mb-1.5 block text-[16px] font-semibold text-[#1C3040] sm:mb-2 sm:text-[15px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                  Order ID <span className="text-[#b91c1c]">*</span>
                </label>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="e.g. ORD-12345 or Enter related product ID"
                  className="h-[48px] w-full border border-[#DCE1E6] bg-white px-4 text-[16px] text-[#051F2D] sm:h-[52px] sm:px-5 sm:text-[15px]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                />
              </div>
            </div>

            {/* Subject */}
            {category && (
              <div>
                <label className="mb-1.5 block text-[16px] font-semibold text-[#1C3040] sm:mb-2 sm:text-[15px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                  Subject <span className="text-[#b91c1c]">*</span>
                </label>
                <div ref={subjectRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setSubjectOpen((v) => !v)}
                    className="flex h-[48px] w-full items-center justify-between border border-[#DCE1E6] bg-white px-4 text-left text-[14px] text-[#6D7A85] sm:h-[52px] sm:px-5 sm:text-[15px]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    <span>{subject || "Select a subject"}</span>
                    <DropdownChevron open={subjectOpen} />
                  </button>
                  {subjectOpen && (
                    <div className="absolute z-20 mt-1 max-h-[220px] w-full overflow-y-auto border border-[#DCE1E6] bg-white shadow-lg">
                      {subjectOptions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`block w-full px-4 py-2.5 text-left text-[14px] sm:px-5 sm:py-3 sm:text-[15px] ${
                            subject === s ? "bg-[#c7a77b] text-[#051F2D]" : "text-[#34495A] hover:bg-[#F4F6F8]"
                          }`}
                          style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                          onClick={() => {
                            setSubject(s);
                            setSubjectOpen(false);
                            if (s !== "Other") setCustomSubject("");
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {subject === "Other" && (
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Describe your subject"
                    className="mt-2 h-[48px] w-full border border-[#DCE1E6] bg-white px-4 text-[16px] text-[#051F2D] sm:mt-3 sm:h-[52px] sm:px-5 sm:text-[15px]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  />
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-[16px] font-semibold text-[#1C3040] sm:mb-2 sm:text-[15px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                Description <span className="text-[#b91c1c]">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in detail"
                rows={6}
                className="w-full border border-[#DCE1E6] bg-white px-4 py-3 text-[16px] leading-relaxed text-[#051F2D] sm:px-5 sm:py-4 sm:text-[15px]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              />
            </div>

            {/* Two-column layout for email + priority */}
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-8">
              {/* Email */}
              <div>
                <label className="mb-1.5 block text-[16px] font-semibold text-[#1C3040] sm:mb-2 sm:text-[15px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                  Email Address <span className="text-[#b91c1c]">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="h-[48px] w-full border border-[#DCE1E6] bg-white px-4 text-[16px] text-[#051F2D] sm:h-[52px] sm:px-5 sm:text-[15px]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                />
              </div>

              {/* Priority */}
              <div>
                <label className="mb-1.5 block text-[16px] font-semibold text-[#1C3040] sm:mb-2 sm:text-[15px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                  Priority Level
                </label>
                <div className="flex h-[48px] items-center gap-6 sm:h-[52px] sm:gap-8">
                  {(["Low", "Medium", "High"] as const).map((p) => (
                    <label key={p} className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="radio"
                        name="priority"
                        value={p}
                        checked={priority === p}
                        onChange={() => setPriority(p)}
                        className="h-[16px] w-[16px] accent-[#1C3040] sm:h-[18px] sm:w-[18px]"
                      />
                      <span className="text-[14px] text-[#1C3040] sm:text-[15px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                        {p}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label className="mb-2 block text-[16px] font-semibold text-[#1C3040] sm:mb-3 sm:text-[15px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                Upload supporting files
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />

              {files.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="mb-3 flex items-center gap-5 rounded-none border border-[#e0e6ed] bg-[#F9F8F8] px-5 py-4"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#72808C" viewBox="0 0 256 256">
                    <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[#1C3040] sm:text-[15px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                      {file.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#72808C] sm:text-[13px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center text-[#9ca3af] hover:text-[#b91c1c]"
                    aria-label="Remove file"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                      <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
                    </svg>
                  </button>
                </div>
              ))}

              {files.length < 3 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-3 rounded-none border border-dashed border-[#CDD2D5] bg-[#F9F8F8] px-6 py-8 text-center hover:border-[#c7a77b] hover:bg-[#faf8f5] sm:px-10 sm:py-10"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#72808C" viewBox="0 0 256 256">
                    <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM93.66,77.66,120,51.31V144a8,8,0,0,0,16,0V51.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,77.66Z" />
                  </svg>
                  <p className="text-[14px] text-[#657480] sm:text-[16px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                    Click to upload files (up to 3)
                  </p>
                  <p className="text-[12px] text-[#93A0AA] sm:text-[13px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                    JPG or PNG (max 10MB each)
                  </p>
                </button>
              )}
            </div>

            {/* Submit */}
            <div className="pt-2 sm:pt-4">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="hidden h-[48px] min-w-[220px] rounded-none px-8 text-[15px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex sm:h-auto sm:min-w-[260px] sm:px-10 sm:py-3.5 sm:text-[16px]"
                style={{
                  fontFamily: "'Montserrat', Arial, sans-serif",
                  backgroundColor: canSubmit ? "#c7a77b" : "#D1D5DB",
                }}
              >
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phone-only fixed CTA for Raise a Ticket (replaces bottom nav space) */}
      {activeTab === "raise" && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] border-t border-[#e0e6ed] bg-white px-4 py-3 sm:hidden">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-12 w-full rounded-none text-[15px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              fontFamily: "'Montserrat', Arial, sans-serif",
              backgroundColor: canSubmit ? "#c7a77b" : "#D1D5DB",
            }}
          >
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      )}

      {/* ======= MY TICKETS TAB ======= */}
      {activeTab === "my_tickets" && !viewingTicket && (
        <div>
          {/* Filters */}
          <div className="mb-4 grid grid-cols-3 gap-2 sm:mb-6 sm:flex sm:gap-4">
            <FilterDropdown
              ref={statusFilterRef}
              label={statusFilter}
              open={statusFilterOpen}
              onToggle={() => setStatusFilterOpen((v) => !v)}
              options={["All Statuses", ...STATUS_OPTIONS]}
              selected={statusFilter}
              onSelect={(v) => { setStatusFilter(v); setStatusFilterOpen(false); }}
            />
            <FilterDropdown
              ref={categoryFilterRef}
              label={categoryFilter}
              open={categoryFilterOpen}
              onToggle={() => setCategoryFilterOpen((v) => !v)}
              options={CATEGORY_FILTER as unknown as string[]}
              selected={categoryFilter}
              onSelect={(v) => { setCategoryFilter(v); setCategoryFilterOpen(false); }}
            />
            <FilterDropdown
              ref={timeFilterRef}
              label={timeFilter}
              open={timeFilterOpen}
              onToggle={() => setTimeFilterOpen((v) => !v)}
              options={TIME_FILTER}
              selected={timeFilter}
              onSelect={(v) => { setTimeFilter(v); setTimeFilterOpen(false); }}
            />
          </div>

          {ticketsLoading && (
            <div className="py-12 text-center text-[15px] text-[#72808C]">Loading tickets…</div>
          )}

          {!ticketsLoading && filteredTickets.length === 0 && (
            <div className="flex min-h-[40vh] flex-col items-center justify-center py-12 text-center">
              <p className="text-[20px] font-medium text-[#c7a77b]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                No tickets yet
              </p>
              <p className="mt-2 text-[16px] text-[#72808C]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                When you raise a ticket, it will appear here.
              </p>
            </div>
          )}

          {!ticketsLoading && filteredTickets.length > 0 && (
            <div className="space-y-3 sm:space-y-0 sm:overflow-x-auto sm:[&>*]:block">
              {/* Phone: card list */}
              <div className="space-y-3 sm:hidden">
                {filteredTickets.map((ticket) => {
                  const badge = STATUS_BADGES[ticket.status] || STATUS_BADGES.Open;
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setViewingTicket(ticket)}
                      className="flex w-full items-stretch rounded-none border border-[#e0e6ed] bg-[#f9f8f8] px-4 py-5 text-left"
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className="text-[13px] font-semibold text-[#1C3040]"
                            style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                          >
                            #{ticket.ticketCode}
                          </p>
                          <span
                            className="inline-flex items-center rounded-none px-2.5 py-0.5 text-[11px] font-semibold"
                            style={{ backgroundColor: badge.bg, color: badge.text, fontFamily: "'Montserrat', Arial, sans-serif" }}
                          >
                            {ticket.status}
                          </span>
                        </div>
                        <p
                          className="mt-1 line-clamp-2 text-[13px] text-[#50626C]"
                          style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                        >
                          {ticket.subject}
                        </p>
                        <p
                          className="mt-1 text-[11px] text-[#72808C]"
                          style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                        >
                          {ticket.category} • {formatDate(ticket.createdAt)}
                        </p>
                      </div>
                      <div className="ml-3 flex items-center self-stretch">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          fill="#1C3040"
                          viewBox="0 0 256 256"
                          className="shrink-0"
                        >
                          <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Desktop / tablet: keep table view */}
              <div className="hidden sm:block sm:overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse">
                  <thead>
                    <tr className="bg-[#1C3040] text-left">
                      {["TICKET ID", "SUBJECT", "CATEGORY", "STATUS", "DATE RAISED", "ACTION"].map((col) => (
                        <th
                          key={col}
                          className="px-5 py-4 text-[13px] font-semibold uppercase tracking-wider text-white"
                          style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((ticket) => {
                      const badge = STATUS_BADGES[ticket.status] || STATUS_BADGES.Open;
                      return (
                        <tr key={ticket.id} className="border-b border-[#e0e6ed] bg-white hover:bg-[#fafafa]">
                          <td className="px-5 py-4 text-[15px] font-medium text-[#1C3040]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                            #{ticket.ticketCode}
                          </td>
                          <td className="max-w-[280px] truncate px-5 py-4 text-[15px] text-[#50626C]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                            {ticket.subject}
                          </td>
                          <td className="px-5 py-4 text-[15px] text-[#50626C]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                            {ticket.category}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className="inline-flex items-center rounded-none px-3 py-1 text-[13px] font-semibold"
                              style={{ backgroundColor: badge.bg, color: badge.text, fontFamily: "'Montserrat', Arial, sans-serif" }}
                            >
                              {ticket.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-[15px] text-[#50626C]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                            {formatDate(ticket.createdAt)}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() => setViewingTicket(ticket)}
                              className="flex items-center gap-1 text-[15px] font-medium text-[#1C3040] hover:underline"
                              style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                            >
                              View
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                                <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======= TICKET DETAIL VIEW ======= */}
      {activeTab === "my_tickets" && viewingTicket && (
        <div>
          <div className="mb-6 sm:mb-8">
            <button
              type="button"
              onClick={() => setViewingTicket(null)}
              className="flex items-center gap-2 rounded-none border-2 border-[#c7a77b] bg-white px-3 py-2 hover:bg-[#c7a77b]/10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256" className="shrink-0 text-[#1C3040]">
                <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
              </svg>
              <span
                className="text-[15px] font-semibold text-[#1C3040]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                Back to My Tickets
              </span>
            </button>
          </div>

          <div className="rounded-none border border-[#e0e6ed] bg-[#f9f8f8] px-4 py-6 sm:px-8 sm:py-10">
            {/* Header row */}
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8 sm:gap-4">
              <h2
                className="text-[20px] font-semibold text-[#1C3040] sm:text-[26px]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                #{viewingTicket.ticketCode}
              </h2>
              <span
                className="inline-flex items-center rounded-none px-3 py-1.5 text-[12px] font-semibold sm:px-4 sm:py-2 sm:text-[14px]"
                style={{
                  backgroundColor: (STATUS_BADGES[viewingTicket.status] || STATUS_BADGES.Open).bg,
                  color: (STATUS_BADGES[viewingTicket.status] || STATUS_BADGES.Open).text,
                  fontFamily: "'Montserrat', Arial, sans-serif",
                }}
              >
                {viewingTicket.status}
              </span>
            </div>

            <div className="space-y-4 sm:space-y-5">
              <DetailRow label="Subject" value={viewingTicket.subject} />
              <DetailRow label="Category" value={viewingTicket.category} />
              <DetailRow label="Order ID" value={viewingTicket.orderId || "—"} />
              <DetailRow label="Priority" value={viewingTicket.priority} />
              <DetailRow label="Email" value={viewingTicket.email} />
              <DetailRow label="Raise Date" value={formatDate(viewingTicket.createdAt)} />

              <div>
                <p
                  className="text-[13px] font-semibold uppercase tracking-wide text-[#72808C]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  Description
                </p>
                <p
                  className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#1C3040] sm:text-[16px]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  {viewingTicket.description}
                </p>
              </div>

              {viewingTicket.docUrls && viewingTicket.docUrls.length > 0 && (
                <div>
                  <p
                    className="text-[13px] font-semibold uppercase tracking-wide text-[#72808C]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    Attachments
                  </p>
                  <p
                    className="mt-1.5 text-[12px] leading-snug text-[#93A0AA]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    Open in a new tab. Each link is valid for about 3 minutes.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
                    {viewingTicket.docUrls.map((storedRef, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={openingAttachmentIdx === idx || !phone}
                        onClick={() => void openTicketAttachment(idx)}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-none border border-[#c7a77b] bg-white px-4 py-2.5 text-left text-[14px] font-semibold text-[#1C3040] hover:bg-[#f5f0e8] disabled:opacity-60 sm:min-h-0 sm:justify-start"
                        style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                      >
                        {openingAttachmentIdx === idx ? "Opening…" : ticketAttachmentLabel(storedRef, idx)}
                      </button>
                    ))}
                  </div>
                  {attachmentErr ? (
                    <p className="mt-2 text-[13px] text-[#B91C1C]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                      {attachmentErr}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Mobile bottom nav — phone view only (hidden on Raise a Ticket so CTA can take its place) */}
      {activeTab === "my_tickets" && <VendorFooter variant="minimal" />}
      {activeTab !== "raise" && <MobileBottomNav />}
    </div>
  );
}

/* ─── Helper Components ─── */

function ticketAttachmentLabel(storedRef: string, index: number): string {
  const r = storedRef.toLowerCase();
  const n = index + 1;
  if (r.includes(".pdf")) return `Open PDF (document ${n})`;
  if (r.includes(".png")) return `Open PNG image (document ${n})`;
  if (r.includes(".jpg") || r.includes(".jpeg")) return `Open image (document ${n})`;
  return `Open attachment ${n}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="text-[13px] font-semibold uppercase tracking-wide text-[#72808C]"
        style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-[16px] text-[#1C3040]"
        style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
      >
        {value}
      </p>
    </div>
  );
}

function DropdownChevron({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#8B97A1" viewBox="0 0 256 256" className="shrink-0">
        <path d="M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#8B97A1" viewBox="0 0 256 256" className="shrink-0">
      <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  );
}

import { forwardRef } from "react";

const FilterDropdown = forwardRef<
  HTMLDivElement,
  {
    label: string;
    open: boolean;
    onToggle: () => void;
    options: string[];
    selected: string;
    onSelect: (v: string) => void;
  }
>(function FilterDropdown({ label, open, onToggle, options, selected, onSelect }, ref) {
  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-[44px] w-full min-w-0 items-center justify-between gap-2 border border-[#DCE1E6] bg-white px-2.5 text-[12px] text-[#6D7A85] sm:h-[48px] sm:w-auto sm:justify-start sm:px-5 sm:text-[14px]"
        style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
      >
        <span className="min-w-0 truncate">{label}</span>
        <DropdownChevron open={open} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 min-w-[200px] border border-[#DCE1E6] bg-white shadow-lg">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`block w-full px-5 py-2.5 text-left text-[14px] ${
                selected === opt ? "bg-[#c7a77b] text-[#051F2D]" : "text-[#34495A] hover:bg-[#F4F6F8]"
              }`}
              style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              onClick={() => onSelect(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day.toString().padStart(2, "0")}/${month}/${year}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SupportPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F8F8] p-6 text-[#1C3040]">Loading support…</div>}>
      <SupportPage />
    </Suspense>
  );
}
