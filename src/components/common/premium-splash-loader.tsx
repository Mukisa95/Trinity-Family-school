"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";

// ─── Constants ────────────────────────────────────────────────────────────────
const SPLASH_DURATION_MS = 3400;
const EXIT_START_MS      = 2800;
const SPLASH_SHOWN_KEY   = "trinity_splash_shown";

// ─── Easing (plain arrays — work in every framer-motion version) ──────────────
const EXPO_OUT   = [0.16, 1, 0.3, 1] as [number, number, number, number];
const LOGO_SPRING = { type: "spring", damping: 16, stiffness: 85, mass: 0.8 } as const;

// ─── Brand background ─────────────────────────────────────────────────────────
export const BRAND_BG_STYLE: React.CSSProperties = {
  background: [
    "radial-gradient(ellipse 90% 70% at 50% 0%,   rgba(99,102,241,0.38) 0%, transparent 62%)",
    "radial-gradient(ellipse 60% 50% at 85% 100%,  rgba(139,92,246,0.28) 0%, transparent 58%)",
    "radial-gradient(ellipse 55% 45% at 5%  80%,   rgba(59,130,246,0.22) 0%, transparent 55%)",
    "linear-gradient(160deg, #0f172a 0%, #1e1b4b 38%, #1e1035 65%, #0f172a 100%)",
  ].join(", "),
};

// ─── Ambient blobs ─────────────────────────────────────────────────────────────
const BLOBS = [
  { w: 340, h: 340, left: "10%",  top: "8%",  color: "rgba(99,102,241,0.20)",  blur: 80, dur: 14 },
  { w: 280, h: 280, left: "65%",  top: "55%", color: "rgba(139,92,246,0.18)",  blur: 70, dur: 18 },
  { w: 200, h: 200, left: "40%",  top: "72%", color: "rgba(59,130,246,0.16)",  blur: 60, dur: 12 },
  { w: 160, h: 160, left: "5%",   top: "52%", color: "rgba(167,139,250,0.14)", blur: 50, dur: 16 },
];

// ─── BrandedAuthScreen ────────────────────────────────────────────────────────
export function BrandedAuthScreen({ message }: { message: string }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className="min-h-screen flex items-center justify-center overflow-hidden"
      style={{ ...BRAND_BG_STYLE, position: "relative" }}
    >
      {/* Ambient blobs */}
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          style={{
            position: "absolute",
            left: b.left, top: b.top,
            width: b.w, height: b.h,
            borderRadius: "50%",
            background: b.color,
            filter: `blur(${b.blur}px)`,
            pointerEvents: "none",
          }}
          animate={prefersReducedMotion ? {} : {
            x: [0, 16, -10, 6, 0],
            y: [0, -12, 8, -4, 0],
          }}
          transition={{ duration: b.dur, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      {/* Glass card */}
      <motion.div
        style={{
          position: "relative", zIndex: 1,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
          padding: "44px 52px",
          borderRadius: 28,
          background: "rgba(255,255,255,0.07)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border: "1px solid rgba(255,255,255,0.13)",
          boxShadow: "0 8px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10)",
        }}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 36, scale: 0.93 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: EXPO_OUT, delay: 0.1 }}
      >
        {/* Logo */}
        <motion.div
          style={{ position: "relative" }}
          initial={prefersReducedMotion ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...LOGO_SPRING, delay: 0.25 }}
        >
          <div style={{
            position: "absolute", inset: -16, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.45) 0%, transparent 70%)",
            filter: "blur(16px)",
          }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Trinity Family School" width={96} height={96}
            style={{ objectFit: "contain", position: "relative", zIndex: 1, display: "block" }} />
        </motion.div>

        {/* Name */}
        <motion.p
          style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: "1.1rem",
            letterSpacing: "0.04em", textShadow: "0 2px 18px rgba(99,102,241,0.70)" }}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EXPO_OUT, delay: 0.4 }}
        >
          Trinity Family School
        </motion.p>

        {/* Message */}
        <motion.p
          style={{ margin: 0, color: "rgba(199,210,254,0.85)", fontSize: "0.68rem",
            letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 500 }}
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 0.85 }}
          transition={{ duration: 0.5, ease: EXPO_OUT, delay: 0.55 }}
        >
          {message}
        </motion.p>

        {/* Dots */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              style={{ width: 6, height: 6, borderRadius: "50%",
                background: "rgba(129,140,248,0.85)", display: "inline-block" }}
              animate={prefersReducedMotion ? {} : { scale: [0.7, 1.3, 0.7], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── PremiumSplashLoader ──────────────────────────────────────────────────────
export function PremiumSplashLoader() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [ready,   setReady  ] = useState(false);   // true after 1st client paint
  const prefersReducedMotion  = useReducedMotion();

  const runSequence = useCallback(() => {
    setVisible(true);
    // Small delay so CSS is flushed before animation starts
    const readyTimer = setTimeout(() => setReady(true), 50);
    const exitTimer  = setTimeout(() => setExiting(true),  EXIT_START_MS);
    const doneTimer  = setTimeout(() => setVisible(false), SPLASH_DURATION_MS);
    return () => { clearTimeout(readyTimer); clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_SHOWN_KEY)) return;
    sessionStorage.setItem(SPLASH_SHOWN_KEY, "1");
    return runSequence();
  }, [runSequence]);

  if (!visible) return null;

  // ── Reduced-motion ──
  if (prefersReducedMotion) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        ...BRAND_BG_STYLE,
        transition: exiting ? "opacity 0.3s ease" : undefined,
        opacity: exiting ? 0 : 1,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Trinity Family School" width={110} height={110}
          style={{ objectFit: "contain" }} />
      </div>
    );
  }

  return (
    /* ── Fixed overlay: background is ALWAYS visible, only content animates in ── */
    <AnimatePresence>
      {!exiting ? (
        <div
          key="splash-bg"
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            /* Background is opaque immediately — no fade-in so it never flashes white */
            ...BRAND_BG_STYLE,
          }}
        >
          {/* ── Ambient floating blobs (pure CSS animation via keyframes) ── */}
          {BLOBS.map((b, i) => (
            <motion.div
              key={i}
              style={{
                position: "absolute",
                left: b.left, top: b.top,
                width: b.w, height: b.h,
                borderRadius: "50%",
                background: b.color,
                filter: `blur(${b.blur}px)`,
                pointerEvents: "none",
              }}
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                x: [0, 18, -12, 6, 0],
                y: [0, -14, 10, -5, 0],
              }}
              transition={{
                opacity: { duration: 1.2, delay: i * 0.15 },
                x: { duration: b.dur, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 },
                y: { duration: b.dur * 0.85, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 },
              }}
            />
          ))}

          {/* ── Glow ring behind logo ── */}
          {ready && (
            <motion.div
              style={{
                position: "absolute",
                width: 300, height: 300, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(99,102,241,0.40) 0%, rgba(139,92,246,0.22) 55%, transparent 70%)",
                filter: "blur(28px)",
                top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.35, 1.05], opacity: [0, 0.85, 0.5] }}
              transition={{ duration: 1.0, times: [0, 0.5, 1], ease: EXPO_OUT, delay: 0.1 }}
            />
          )}

          {/* ── Pulse rings ── */}
          {ready && (
            <motion.div
              className="trinity-splash-glow-pulse"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: EXPO_OUT, delay: 0.55 }}
            />
          )}

          {/* ── Centre content ── */}
          <div style={{
            position: "relative", zIndex: 1,
            display: "flex", flexDirection: "column", alignItems: "center",
          }}>
            {/* Logo tile */}
            {ready && (
              <motion.div
                className="trinity-splash-logo-wrap"
                initial={{ opacity: 0, scale: 0.2, rotate: -12 }}
                animate={{ opacity: 1, scale: [0.2, 1.18, 1.0], rotate: [-12, 4, 0] }}
                transition={{
                  opacity: { duration: 0.35, ease: "easeOut" },
                  scale:   { duration: 0.85, times: [0, 0.55, 1], ease: EXPO_OUT },
                  rotate:  { duration: 0.85, times: [0, 0.6, 1],  ease: EXPO_OUT },
                }}
              >
                <div className="trinity-splash-logo-disc" />
                <div className="trinity-splash-logo-img">
                  <Image
                    src="/logo.png"
                    alt="Trinity Family School"
                    width={200} height={200} priority draggable={false}
                    style={{ objectFit: "contain", width: "100%", height: "100%" }}
                  />
                </div>
                <div className="trinity-splash-shine" />
              </motion.div>
            )}

            {/* School name */}
            {ready && (
              <motion.h1
                className="trinity-splash-title"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EXPO_OUT, delay: 0.7 }}
              >
                Trinity Family School
              </motion.h1>
            )}

            {/* Divider rule */}
            {ready && (
              <motion.div
                style={{
                  height: 1, alignSelf: "stretch",
                  background: "linear-gradient(90deg, transparent, rgba(129,140,248,0.6), rgba(167,139,250,0.5), transparent)",
                  borderRadius: 1, marginBottom: 10,
                }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: EXPO_OUT, delay: 0.9 }}
              />
            )}

            {/* Tagline */}
            {ready && (
              <motion.p
                className="trinity-splash-tagline"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 0.9, y: 0 }}
                transition={{ duration: 0.5, ease: EXPO_OUT, delay: 1.0 }}
              >
                Strive to Excel…
              </motion.p>
            )}

            {/* Loading dots — stagger */}
            {ready && (
              <motion.div
                className="trinity-splash-dots"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden:  {},
                  visible: { transition: { staggerChildren: 0.13, delayChildren: 1.25 } },
                }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="trinity-splash-dot"
                    style={{ animationDelay: `${i * 0.18}s` }}
                    variants={{
                      hidden:  { scale: 0, opacity: 0 },
                      visible: { scale: 1, opacity: 1, transition: LOGO_SPRING },
                    }}
                  />
                ))}
              </motion.div>
            )}
          </div>
        </div>
      ) : (
        /* ── Exit: overlay fades + scales away, revealing dashboard ── */
        <motion.div
          key="splash-exit"
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            ...BRAND_BG_STYLE,
          }}
          initial={{ opacity: 1, scale: 1 }}
          animate={{ opacity: 0, scale: 1.06 }}
          transition={{ duration: 0.65, ease: EXPO_OUT }}
        >
          {/* Bloom burst on exit */}
          <motion.div
            style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(circle at 50% 50%, rgba(99,102,241,0.18) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 3, opacity: [0, 0.6, 0] }}
            transition={{ duration: 0.65, ease: EXPO_OUT }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
