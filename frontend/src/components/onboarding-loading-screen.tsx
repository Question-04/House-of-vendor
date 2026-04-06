"use client";

import Image from "next/image";

type OnboardingLoadingScreenProps = {
  title?: string;
  subtitle?: string;
};

export default function OnboardingLoadingScreen({
  title = "Checking your progress",
  subtitle = "Please wait a moment while we load your onboarding step.",
}: OnboardingLoadingScreenProps) {
  return (
    <div className="min-h-screen bg-[#F7F8F8]">
      <div className="relative left-1/2 mb-10 w-screen -translate-x-1/2 border-b border-[#DCE1E6]">
        <div className="mx-auto flex h-[76px] w-full items-center px-2 sm:px-4 lg:px-6">
          <Image src="/House of vendors blue.svg" alt="Vendors" width={270} height={82} className="h-auto w-[240px]" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[860px] flex-col items-center justify-center px-6 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#DCE1E6] border-t-[#051F2D]" />
        <p className="mt-6 text-[24px] font-semibold text-[#1F3444]">{title}</p>
        <p className="mt-2 text-[15px] text-[#7A8792]">{subtitle}</p>
      </div>
    </div>
  );
}
