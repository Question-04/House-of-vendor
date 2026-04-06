"use client";

type DayNightToggleProps = {
  isDark: boolean;
  onToggle: () => void;
  disabled?: boolean;
  disabledMessage?: string;
};

export function DayNightToggle({
  isDark,
  onToggle,
  disabled = false,
  disabledMessage = "Available soon",
}: DayNightToggleProps) {
  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={`relative flex h-10 w-[88px] items-center rounded-full border border-[#DCE1E6] bg-[#E4E7EA] text-[#6B7A8D] shadow-sm transition-colors duration-200 dark:border-white/20 dark:bg-[#2A3540] ${
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

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="currentColor"
      viewBox="0 0 256 256"
      className={className}
      aria-hidden
    >
      <path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="currentColor"
      viewBox="0 0 256 256"
      className={className}
      aria-hidden
    >
      <path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23Z" />
    </svg>
  );
}

