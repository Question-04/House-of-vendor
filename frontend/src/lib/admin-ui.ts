/**
 * Shared admin dashboard control styles — consistent sizing on phone (min tap target) and desktop.
 */

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2";

export const adminBtnBase =
  `inline-flex min-h-10 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition ${focusRing} disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 sm:text-sm`;

export const adminBtnOutline = `${adminBtnBase} border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50`;

export const adminBtnPrimary = `${adminBtnBase} bg-slate-900 text-white shadow-sm hover:bg-slate-800`;

export const adminBtnSuccess = `${adminBtnBase} bg-emerald-700 text-white hover:bg-emerald-800`;

export const adminBtnSuccessStrong = `${adminBtnBase} font-semibold bg-emerald-700 text-white hover:bg-emerald-800`;

export const adminBtnWarning = `${adminBtnBase} font-semibold bg-amber-600 text-white hover:bg-amber-700`;

export const adminBtnDanger = `${adminBtnBase} font-semibold bg-red-700 text-white hover:bg-red-800`;

export const adminBtnDangerSoft = `${adminBtnBase} bg-red-600 text-white hover:bg-red-700`;

export const adminBtnNeutralBorder = `${adminBtnBase} border border-slate-400 bg-white text-slate-800 hover:bg-slate-50`;

export const adminBtnAmberOutline = `${adminBtnBase} border border-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100`;

export const adminBtnEmeraldOutline = `${adminBtnBase} border border-emerald-600 bg-emerald-50 font-semibold text-emerald-800 hover:bg-emerald-100`;

export const adminSelect =
  "min-h-10 w-full max-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm sm:max-w-xs sm:text-sm";

export const adminPageTitle = "text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl";

export const adminPageLead = "mt-1 text-sm text-slate-600";
