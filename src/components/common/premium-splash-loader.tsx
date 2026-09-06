"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const STARTUP_STAGES = [
  'Checking your secure sign-in…',
  'Restoring your saved school workspace…',
  'Preparing school records…',
  'Getting your dashboard ready…',
];

/**
 * A CSS-only startup surface. The small block animation is deliberately kept
 * beside the logo rather than using a video, so it remains smooth on weak
 * devices and slow connections.
 */
export function BrandedAuthScreen({
  message,
}: {
  message: string;
}) {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStageIndex((current) => (current + 1) % STARTUP_STAGES.length);
    }, 1800);
    return () => window.clearInterval(interval);
  }, []);

  const activeMessage = STARTUP_STAGES[stageIndex] ?? message;

  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center bg-[#111827] px-6 text-center text-white"
    >
      <section className="flex w-full max-w-sm flex-col items-center">
        <div className="flex items-center justify-center gap-4" aria-hidden="true">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-white/10 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.25)]">
            <Image
              src="/logo.png"
              alt=""
              width={64}
              height={64}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <div className="relative h-12 w-12" aria-hidden="true">
            <span className="startup-block startup-block-one absolute left-0 top-0 h-4 w-4 rounded bg-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.65)]" />
            <span className="startup-block startup-block-two absolute left-6 top-0 h-4 w-4 rounded bg-indigo-300 shadow-[0_0_16px_rgba(165,180,252,0.6)]" />
            <span className="startup-block startup-block-three absolute left-3 top-6 h-4 w-4 rounded bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.55)]" />
          </div>
        </div>
        <div className="mt-5" aria-live="polite" aria-atomic="true">
          <h1 className="text-lg font-semibold tracking-wide">Trinity Family School</h1>
          <p className="mt-2 min-h-5 text-sm text-slate-300">{activeMessage}</p>
        </div>
        <p className="mt-3 text-xs text-slate-400">Strive to Excel</p>
      </section>
      <style jsx global>{`
        .startup-block { animation: startup-block-float 720ms cubic-bezier(0.4, 0, 0.2, 1) infinite; }
        .startup-block-two { animation-delay: -240ms; }
        .startup-block-three { animation-delay: -480ms; }
        @keyframes startup-block-float {
          0%, 100% { transform: translate(0, 0) scale(0.82); opacity: 0.45; }
          50% { transform: translate(8px, 8px) scale(1.16); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .startup-block { animation: none; opacity: 0.9; }
        }
      `}</style>
    </main>
  );
}
