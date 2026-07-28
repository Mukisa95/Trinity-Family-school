"use client";

import Image from "next/image";

/**
 * The only blocking visual while the application decides where to take the
 * user. It has no timers, layered exits, animated blur, or spring choreography:
 * the destination simply replaces this surface in one React commit.
 */
export function BrandedAuthScreen({ message }: { message: string }) {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-[100dvh] items-center justify-center bg-[#111827] px-6 text-center text-white"
    >
      <section className="flex w-full max-w-sm flex-col items-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-white/10 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.25)]">
          <Image
            src="/logo.png"
            alt="Trinity Family School"
            width={64}
            height={64}
            priority
            className="h-full w-full object-contain"
          />
        </div>
        <h1 className="text-lg font-semibold tracking-wide">Trinity Family School</h1>
        <p className="mt-2 text-sm text-slate-300">{message}</p>
        <div aria-hidden="true" className="mt-6 h-1 w-24 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-1/2 rounded-full bg-indigo-300" />
        </div>
      </section>
    </main>
  );
}
