"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MultiCategorySelectProps = {
  label: string;
  placeholder: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  optional?: boolean;
  isDark?: boolean;
  /** Options to exclude from the list (e.g. primary category). */
  exclude?: string[];
};

export function MultiCategorySelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  optional = false,
  isDark = false,
  exclude = [],
}: MultiCategorySelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const excludeSet = useMemo(() => new Set(exclude.filter(Boolean)), [exclude]);
  const selectable = useMemo(() => options.filter((o) => !excludeSet.has(o)), [options, excludeSet]);
  const selectedSet = useMemo(() => new Set(value), [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const summary =
    value.length === 0
      ? ""
      : value.length <= 2
        ? value.join(", ")
        : `${value.length} categories selected`;

  const toggle = (opt: string) => {
    if (selectedSet.has(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <label className={`mb-4 block text-[16px] font-semibold sm:mb-2 sm:text-[18px] ${isDark ? "text-white" : "text-[#223544]"}`}>
        {label}{" "}
        {optional && <span className={`font-medium italic ${isDark ? "text-white/90" : "text-[#223544]"}`}>(optional)</span>}
      </label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex min-h-[52px] w-full items-center justify-between border px-4 py-2 text-left text-[15px] sm:min-h-[56px] sm:text-[16px] ${
          isDark ? "border-white/20 bg-white/10 text-white" : "border-[#C7CDD3] bg-white text-[#6D7A85]"
        }`}
      >
        <span
          className={
            summary
              ? isDark
                ? "text-white font-medium"
                : "text-[#51616E]"
              : isDark
                ? "text-[#9BA5AB]"
                : "text-[#A8B0B7]"
          }
        >
          {summary || placeholder}
        </span>
        <span className={`shrink-0 transition-transform ${open ? "rotate-180" : ""} ${isDark ? "text-white/80" : "text-[#8B97A1]"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
            <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
          </svg>
        </span>
      </button>
      {open && (
        <div
          className={`absolute z-20 mt-1 max-h-[220px] w-full overflow-y-auto border ${
            isDark ? "border-white/20 bg-[#051F2D]" : "border-[#AEB8C1] bg-white"
          }`}
        >
          {selectable.length === 0 ? (
            <p className={`px-4 py-3 text-[14px] sm:text-[15px] ${isDark ? "text-white/70" : "text-[#6D7A85]"}`}>
              All categories are selected as primary or none left to add.
            </p>
          ) : (
            selectable.map((option) => {
              const checked = selectedSet.has(option);
              return (
                <button
                  key={option}
                  type="button"
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left text-[15px] sm:text-[16px] ${
                    checked
                      ? "bg-[#C7A77B] text-[#051F2D]"
                      : isDark
                        ? "text-white hover:bg-white/10"
                        : "text-[#34495A] hover:bg-[#F4F6F8]"
                  }`}
                  onClick={() => toggle(option)}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked ? "border-[#051F2D] bg-[#051F2D]" : isDark ? "border-white/40" : "border-[#AEB8C1]"
                    }`}
                  >
                    {checked ? (
                      <span className="text-[11px] font-bold leading-none text-[#C7A77B]" aria-hidden>
                        ✓
                      </span>
                    ) : null}
                  </span>
                  {option}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/** Light-theme variant for login page (no isDark). */
export function MultiCategorySelectLight({
  label,
  placeholder,
  options,
  value,
  onChange,
  optional = false,
  exclude = [],
}: Omit<MultiCategorySelectProps, "isDark">) {
  return (
    <MultiCategorySelect
      label={label}
      placeholder={placeholder}
      options={options}
      value={value}
      onChange={onChange}
      optional={optional}
      isDark={false}
      exclude={exclude}
    />
  );
}
