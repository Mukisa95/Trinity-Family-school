"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, LogIn, School, MapPin, Phone, Mail, Globe, Star, BookOpen, Heart, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  LoginDialog,
  LoginDialogContent,
  LoginDialogHeader,
  LoginDialogTitle,
  LoginDialogTrigger
} from "@/components/ui/login-dialog";
import { useAuth } from "@/lib/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useSchoolSettings } from "@/lib/hooks/use-school-settings";
import { usePhotos } from "@/lib/hooks/use-photos";
import { sampleSchoolSettings } from "@/lib/sample-data";
import Image from "next/image";

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE ARCHITECTURE
//
// Problem: The old page had:
//   • 8 separate setInterval timers → 8 React re-renders every few seconds
//   • ~25 <motion.div whileInView> → 25 Framer scroll observers running at once
//   • Animated blur blobs (filter:blur + transform) → very expensive on GPU
//   • N images mounted with opacity:0 per slideshow → N running CSS transitions
//   • backdrop-blur-sm on a sticky header → repainted on every scroll pixel
//
// Solution:
//   • ONE shared tick → all slideshows derived, zero extra re-renders
//   • Lightweight IntersectionObserver Reveal component (no Framer dependency)
//   • CSS opacity-only keyframes (compositor thread, never triggers layout/paint)
//   • CSSSlideshow mounts only 2 nodes: current + fading-out previous
// ─────────────────────────────────────────────────────────────────────────────

// One 800ms tick drives every slideshow — each derives its index via different
// modulus so galleries advance at different speeds with zero extra timers.
const TICK_MS = 800;

function useTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return tick;
}

function slideFor(tick: number, len: number, everyMs: number): number {
  if (len <= 1) return 0;
  return Math.floor(tick / Math.round(everyMs / TICK_MS)) % len;
}

// ─── CSSSlideshow ────────────────────────────────────────────────────────────
// Only 2 DOM nodes active at once (current + fading out).
// Transitions use opacity CSS keyframes — runs on GPU compositor, never causes
// layout recalc or paint. No Framer Motion, no filter:blur, no scale animation.
type SlidePhoto = { id: string; url: string; title: string; description?: string };

function CSSSlideshow({
  photos,
  currentSlide,
  className = "",
}: {
  photos: SlidePhoto[];
  currentSlide: number;
  className?: string;
}) {
  const [displayed, setDisplayed] = useState(currentSlide);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (currentSlide === displayed) return;
    setFading(true);
    const t = setTimeout(() => {
      setDisplayed(currentSlide);
      setFading(false);
    }, 550);
    return () => clearTimeout(t);
  }, [currentSlide, displayed]);

  if (photos.length === 0) return null;
  const cur = photos[currentSlide % photos.length];
  const prev = photos[displayed % photos.length];

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ isolation: "isolate" }}>
      {fading && prev.id !== cur.id && (
        <div
          className="absolute inset-0"
          style={{ animation: "lgFadeOut 0.55s ease forwards", willChange: "opacity" }}
        >
          <Image src={prev.url} alt={prev.title} fill className="object-cover" />
        </div>
      )}
      <div
        className="absolute inset-0"
        style={{
          animation: fading ? "lgFadeIn 0.55s ease forwards" : "none",
          willChange: "opacity",
        }}
      >
        <Image
          src={cur.url}
          alt={cur.title}
          fill
          className="object-cover"
          priority={currentSlide === 0}
        />
      </div>
    </div>
  );
}

// ─── Reveal ──────────────────────────────────────────────────────────────────
// Replaces <motion.div whileInView> on ~25 elements.
// ONE IntersectionObserver per element (disconnects after firing once) vs
// Framer's persistent scroll listener + animation reconciler overhead.
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "-60px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const { toast } = useToast();

  const { data: schoolSettings } = useSchoolSettings();
  const { data: photos } = usePhotos();
  const settings = schoolSettings || sampleSchoolSettings;

  // ── Auth form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  // ── Single shared tick
  const tick = useTick();

  // ── Memoised photo collections (only recomputed when photos changes)
  const heroPhotos      = React.useMemo(() => photos?.filter(p => p.usage.includes("homepage") || p.usage.includes("banner")) ?? [], [photos]);
  const galleryPhotos   = React.useMemo(() => photos?.filter(p => p.usage.includes("gallery")) ?? [], [photos]);
  const allActive       = React.useMemo(() => photos?.filter(p => p.isActive) ?? [], [photos]);
  const activityPhotos  = React.useMemo(() => photos?.filter(p => p.category === "activities" || p.category === "events") ?? [], [photos]);
  const facilityPhotos  = React.useMemo(() => photos?.filter(p => p.category === "facilities" || p.category === "school_building") ?? [], [photos]);
  const classroomPhotos = React.useMemo(() => photos?.filter(p => p.category === "classroom") ?? [], [photos]);
  const staffPhotos     = React.useMemo(() => photos?.filter(p => p.category === "staff") ?? [], [photos]);
  const playgroundPhotos= React.useMemo(() => photos?.filter(p => p.category === "playground") ?? [], [photos]);
  const generalPhotos   = React.useMemo(() => photos?.filter(p => p.category === "other" && p.usage.includes("general")) ?? [], [photos]);

  // ── Auto slide indices — all derived from one tick, zero setState calls
  const heroSlide       = slideFor(tick, heroPhotos.length,       5000);
  const gallerySlide    = slideFor(tick, galleryPhotos.length,    4000);
  const mainSlide       = slideFor(tick, allActive.length,        4000);
  const activitySlide   = slideFor(tick, activityPhotos.length,   4500);
  const facilitySlide   = slideFor(tick, facilityPhotos.length,   4000);
  const classroomSlide  = slideFor(tick, classroomPhotos.length,  5000);
  const staffSlide      = slideFor(tick, staffPhotos.length,      6000);
  const playgroundSlide = slideFor(tick, playgroundPhotos.length, 7000);
  const generalSlide    = slideFor(tick, generalPhotos.length,    8000);

  // ── Manual nav deltas (added to the auto index so auto-play continues)
  const [heroDelta,    setHeroDelta]    = useState(0);
  const [galleryDelta, setGalleryDelta] = useState(0);
  const [mainDelta,    setMainDelta]    = useState(0);

  const manualHero    = heroPhotos.length    > 0 ? (heroSlide    + heroDelta    + heroPhotos.length    * 1000) % heroPhotos.length    : 0;
  const manualGallery = galleryPhotos.length > 0 ? (gallerySlide + galleryDelta + galleryPhotos.length * 1000) % galleryPhotos.length : 0;
  const manualMain    = allActive.length     > 0 ? (mainSlide    + mainDelta    + allActive.length     * 1000) % allActive.length     : 0;

  // ── Touch swipe for main photo card
  const [touchX, setTouchX] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => setTouchX(e.targetTouches[0].clientX);
  const handleTouchEnd   = (e: React.TouchEvent) => {
    if (touchX == null) return;
    const dist = touchX - e.changedTouches[0].clientX;
    if (Math.abs(dist) > 50) setMainDelta(v => v + (dist > 0 ? 1 : -1));
    setTouchX(null);
  };

  // ── Login submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const ok = await login(username.trim(), password);
      if (ok) {
        toast({ title: "Login Successful", description: `Welcome to ${settings.generalInfo.name}` });
        setShowLoginDialog(false);
        router.push("/");
      } else {
        setError("Invalid username or password. Please try again.");
      }
    } catch {
      setError("An error occurred during login. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* CSS keyframes — injected once, no runtime JS cost */}
      <style>{`
        @keyframes lgFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lgFadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes lgPulse   { 0%,100% { opacity: .12 } 50% { opacity: .26 } }
        @keyframes lgRise    { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

        {/* ────────── HEADER ────────────────────────────────────────────── */}
        <header className="relative z-50 bg-white/96 dark:bg-gray-900/96 border-b shadow-sm">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              {settings.generalInfo.logo ? (
                <Image
                  src={settings.generalInfo.logo}
                  alt="School Logo"
                  width={48}
                  height={48}
                  className="rounded-full"
                  priority
                  loading="eager"
                />
              ) : (
                <div className="h-12 w-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                  <School className="h-6 w-6 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{settings.generalInfo.name}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{settings.generalInfo.motto}</p>
              </div>
            </div>

            <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
              <LoginDialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105">
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </Button>
              </LoginDialogTrigger>
              <LoginDialogContent>
                <LoginDialogHeader>
                  <div className="mx-auto mb-4">
                    {settings.generalInfo.logo ? (
                      <div className="relative w-16 h-16 mx-auto">
                        <Image
                          src={settings.generalInfo.logo}
                          alt="School Logo"
                          fill
                          className="object-contain"
                          loading="eager"
                          priority
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                        <School className="h-8 w-8 text-white" />
                      </div>
                    )}
                  </div>
                  <LoginDialogTitle>Welcome Back</LoginDialogTitle>
                  <p className="text-sm text-muted-foreground">Sign in to access {settings.generalInfo.name}</p>
                </LoginDialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-950/20">
                      <AlertDescription className="text-red-800 dark:text-red-200">{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                      <Input
                        id="username"
                        type="text"
                        placeholder="Enter your username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        disabled={isSubmitting}
                        className="h-12 border-gray-200 dark:border-gray-700 focus:border-blue-500 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          disabled={isSubmitting}
                          className="h-12 pr-12 border-gray-200 dark:border-gray-700 focus:border-blue-500 rounded-xl"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1 h-10 w-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={isSubmitting}
                        >
                          {showPassword
                            ? <EyeOff className="h-4 w-4 text-gray-500" />
                            : <Eye    className="h-4 w-4 text-gray-500" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                    disabled={isSubmitting || isLoading}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        Sign In
                      </>
                    )}
                  </Button>
                </form>
              </LoginDialogContent>
            </LoginDialog>
          </div>
        </header>

        {/* ────────── HERO ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden" style={{ minHeight: "clamp(200px, 40vh, 480px)" }}>
          {heroPhotos.length > 0 ? (
            <div className="relative" style={{ minHeight: "clamp(200px, 40vh, 480px)" }}>
              <CSSSlideshow
                photos={heroPhotos}
                currentSlide={manualHero}
                className="absolute inset-0"
              />

              {/* Overlay text */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="text-center text-white max-w-4xl px-4" style={{ animation: "lgRise 0.7s ease both" }}>
                  <h2 className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg">
                    Welcome to {settings.generalInfo.name}
                  </h2>
                  <p className="text-xl md:text-2xl mb-4 opacity-90">{settings.generalInfo.motto}</p>
                  <p className="text-base md:text-lg max-w-2xl mx-auto opacity-80">
                    {settings.visionMissionValues.description || "Nurturing excellence in education and character development."}
                  </p>
                </div>
              </div>

              {/* Nav */}
              {heroPhotos.length > 1 && (
                <>
                  <button
                    onClick={() => setHeroDelta(d => d - 1)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/25 hover:bg-black/50 text-white flex items-center justify-center transition-colors duration-150"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setHeroDelta(d => d + 1)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/25 hover:bg-black/50 text-white flex items-center justify-center transition-colors duration-150"
                    aria-label="Next slide"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  {/* Pill indicators */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-1.5">
                    {heroPhotos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setHeroDelta(i - heroSlide)}
                        className={`rounded-full transition-all duration-200 ${i === manualHero ? "w-6 h-2.5 bg-white" : "w-2.5 h-2.5 bg-white/50"}`}
                        aria-label={`Go to slide ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Fallback: pure CSS ambient blobs — opacity only, compositor thread only */
            <div
              className="flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800"
              style={{ minHeight: "clamp(200px, 40vh, 480px)" }}
            >
              <div
                className="absolute top-8 left-8 w-56 h-56 rounded-full bg-white/10 pointer-events-none"
                style={{ animation: "lgPulse 7s ease-in-out infinite", willChange: "opacity" }}
              />
              <div
                className="absolute bottom-12 right-12 w-72 h-72 rounded-full bg-purple-300/10 pointer-events-none"
                style={{ animation: "lgPulse 9s ease-in-out infinite 2s", willChange: "opacity" }}
              />
              <div className="text-center text-white max-w-4xl px-4 relative z-10">
                <h2
                  className="text-3xl md:text-5xl font-bold mb-3 drop-shadow-lg"
                  style={{ animation: "lgRise 0.7s ease both" }}
                >
                  Welcome to {settings.generalInfo.name}
                </h2>
                <p
                  className="text-lg md:text-xl mb-2 opacity-90 font-semibold"
                  style={{ animation: "lgRise 0.7s ease 0.15s both" }}
                >
                  {settings.generalInfo.motto || "GUIDING GROWTH, INSPIRING GREATNESS"}
                </p>
                <p
                  className="text-base md:text-lg max-w-3xl mx-auto opacity-80 leading-relaxed"
                  style={{ animation: "lgRise 0.7s ease 0.3s both" }}
                >
                  {settings.visionMissionValues.description ||
                    `${settings.generalInfo.name} is committed to fostering an environment where students achieve their full potential.`}
                </p>
                <div
                  className="mt-6 flex flex-wrap justify-center gap-3"
                  style={{ animation: "lgRise 0.7s ease 0.45s both" }}
                >
                  {["Excellence in Education", "Character Development", "Future Leaders"].map(label => (
                    <span
                      key={label}
                      className="bg-white/20 rounded-lg px-4 py-1.5 border border-white/30 text-sm font-medium"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ────────── MAIN PHOTO CARD ────────────────────────────────────── */}
        {allActive.length > 0 && (
          <section className="py-4 md:py-8 bg-white dark:bg-gray-800">
            <div className="container mx-auto px-4">
              <Reveal>
                <Card className="overflow-hidden max-w-4xl mx-auto shadow-md">
                  <div
                    className="relative h-64"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                  >
                    <CSSSlideshow
                      photos={allActive}
                      currentSlide={manualMain}
                      className="absolute inset-0 h-64"
                    />
                    {/* Invisible tap zones: left = prev, right = next */}
                    <div className="absolute inset-0 grid grid-cols-3 z-10">
                      <div className="cursor-pointer" onClick={() => setMainDelta(d => d - 1)} />
                      <div />
                      <div className="cursor-pointer" onClick={() => setMainDelta(d => d + 1)} />
                    </div>
                    {/* Pill indicators */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 z-20 pointer-events-none">
                      {allActive.map((_, i) => (
                        <span
                          key={i}
                          className={`rounded-full transition-all duration-200 ${i === manualMain ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/50"}`}
                        />
                      ))}
                    </div>
                  </div>
                </Card>
              </Reveal>
            </div>
          </section>
        )}

        {/* ────────── ABOUT ─────────────────────────────────────────────── */}
        <section className="pt-8 pb-16 bg-white dark:bg-gray-800">
          <div className="container mx-auto px-4">
            <Reveal className="text-center mb-10">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">About Our School</h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                Discover what makes {settings.generalInfo.name} a special place for learning and growth.
              </p>
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  Icon: Star,
                  bg: "bg-blue-100 dark:bg-blue-900",
                  ic: "text-blue-600 dark:text-blue-400",
                  title: "Our Vision",
                  text: settings.visionMissionValues.vision || "To be a leading educational institution that nurtures excellence and character.",
                },
                {
                  Icon: BookOpen,
                  bg: "bg-purple-100 dark:bg-purple-900",
                  ic: "text-purple-600 dark:text-purple-400",
                  title: "Our Mission",
                  text: settings.visionMissionValues.mission || "To provide quality education that empowers students to achieve their full potential.",
                },
                {
                  Icon: Heart,
                  bg: "bg-green-100 dark:bg-green-900",
                  ic: "text-green-600 dark:text-green-400",
                  title: "Our Values",
                  text: "Excellence, Integrity, Respect, Innovation, and Community — the pillars that guide our educational approach.",
                },
              ].map(({ Icon, bg, ic, title, text }, i) => (
                <Reveal key={title} delay={i * 80}>
                  <Card className="text-center h-full hover:shadow-md transition-shadow duration-200">
                    <CardHeader>
                      <div className={`mx-auto h-12 w-12 ${bg} rounded-full flex items-center justify-center mb-4`}>
                        <Icon className={`h-6 w-6 ${ic}`} />
                      </div>
                      <CardTitle>{title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 dark:text-gray-400">{text}</p>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ────────── WHATSAPP ──────────────────────────────────────────── */}
        <section className="py-16 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <div className="container mx-auto px-4 text-center">
            <Reveal>
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/50 rounded-full mb-6">
                <MessageCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Join Our WhatsApp Group Today</h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
                Stay connected with our school community! Get instant updates, announcements, and connect with other parents and staff.
              </p>
              <a
                href="https://chat.whatsapp.com/LfKtwT6Qn5eDImR4gagwU3?mode=ac_t"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-3 bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                <MessageCircle className="h-5 w-5" />
                <span>Join WhatsApp Group</span>
              </a>
            </Reveal>
          </div>
        </section>

        {/* ────────── GALLERY ───────────────────────────────────────────── */}
        {galleryPhotos.length > 0 && (
          <section className="py-16 bg-gray-50 dark:bg-gray-900">
            <div className="container mx-auto px-4">
              <Reveal className="text-center mb-12">
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">School Life Gallery</h3>
                <p className="text-lg text-gray-600 dark:text-gray-400">Glimpses of our vibrant school community</p>
              </Reveal>

              <Reveal delay={100}>
                <div className="relative max-w-4xl mx-auto">
                  <div className="relative h-96 rounded-xl overflow-hidden shadow-lg">
                    <CSSSlideshow
                      photos={galleryPhotos}
                      currentSlide={manualGallery}
                      className="absolute inset-0 h-96"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6 pointer-events-none">
                      <h4 className="text-white text-xl font-semibold">{galleryPhotos[manualGallery]?.title}</h4>
                      {galleryPhotos[manualGallery]?.description && (
                        <p className="text-white/90 text-sm mt-1">{galleryPhotos[manualGallery].description}</p>
                      )}
                    </div>
                  </div>

                  {galleryPhotos.length > 1 && (
                    <>
                      <button
                        onClick={() => setGalleryDelta(d => d - 1)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/25 hover:bg-black/50 text-white flex items-center justify-center transition-colors duration-150"
                        aria-label="Previous photo"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setGalleryDelta(d => d + 1)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/25 hover:bg-black/50 text-white flex items-center justify-center transition-colors duration-150"
                        aria-label="Next photo"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      <div className="flex justify-center mt-4 gap-2 overflow-x-auto pb-1">
                        {galleryPhotos.map((p, i) => (
                          <button
                            key={p.id}
                            onClick={() => setGalleryDelta(i - gallerySlide)}
                            className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all duration-150 ${
                              i === manualGallery
                                ? "border-blue-500 scale-110"
                                : "border-transparent hover:border-gray-300"
                            }`}
                            aria-label={`View photo: ${p.title}`}
                          >
                            <Image src={p.url} alt={p.title} width={56} height={56} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </Reveal>
            </div>
          </section>
        )}

        {/* ────────── CONTACT ───────────────────────────────────────────── */}
        <section className="py-16 bg-white dark:bg-gray-800">
          <div className="container mx-auto px-4">
            <Reveal className="text-center mb-12">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Get in Touch</h3>
              <p className="text-lg text-gray-600 dark:text-gray-400">We'd love to hear from you.</p>
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { Icon: MapPin, bg: "bg-blue-100 dark:bg-blue-900",    ic: "text-blue-600 dark:text-blue-400",    label: "Address", value: settings.address.physical   || "School Address"    },
                { Icon: Phone,  bg: "bg-green-100 dark:bg-green-900",   ic: "text-green-600 dark:text-green-400",   label: "Phone",   value: settings.contact.phone     || "Contact Number"    },
                { Icon: Mail,   bg: "bg-purple-100 dark:bg-purple-900", ic: "text-purple-600 dark:text-purple-400", label: "Email",   value: settings.contact.email     || "school@email.com"  },
                { Icon: Globe,  bg: "bg-orange-100 dark:bg-orange-900", ic: "text-orange-600 dark:text-orange-400", label: "Website", value: settings.contact.website   || "www.school.com"    },
              ].map(({ Icon, bg, ic, label, value }, i) => (
                <Reveal key={label} delay={i * 70}>
                  <Card className="text-center h-full hover:shadow-md transition-shadow duration-200">
                    <CardContent className="pt-6">
                      <div className={`mx-auto h-12 w-12 ${bg} rounded-full flex items-center justify-center mb-4`}>
                        <Icon className={`h-6 w-6 ${ic}`} />
                      </div>
                      <h4 className="font-semibold mb-2">{label}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{value}</p>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ────────── PHOTO SHOWCASE ────────────────────────────────────── */}
        {[activityPhotos, facilityPhotos, classroomPhotos, staffPhotos, playgroundPhotos, generalPhotos].some(g => g.length > 0) && (
          <section className="py-16 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900">
            <div className="container mx-auto px-4">
              <Reveal className="mb-10">
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Discover Our School</h3>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Explore the vibrant life and beautiful spaces of our educational community
                </p>
              </Reveal>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { photos: activityPhotos,   slide: activitySlide,   title: "Activities & Events", sub: "Celebrating achievements and milestones" },
                  { photos: facilityPhotos,   slide: facilitySlide,   title: "Our Facilities",      sub: "Modern spaces for learning and growth"   },
                  { photos: classroomPhotos,  slide: classroomSlide,  title: "Learning Spaces",     sub: "Where knowledge comes to life"           },
                  { photos: staffPhotos,      slide: staffSlide,      title: "Our Team",            sub: "Dedicated educators and staff"           },
                  { photos: playgroundPhotos, slide: playgroundSlide, title: "Play & Recreation",   sub: "Fun and fitness for all students"        },
                  { photos: generalPhotos,    slide: generalSlide,    title: "School Life",         sub: "Moments that matter"                     },
                ]
                  .filter(g => g.photos.length > 0)
                  .map((g, i) => (
                    <Reveal key={g.title} delay={i * 60}>
                      <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200">
                        <div className="relative h-48">
                          <CSSSlideshow
                            photos={g.photos}
                            currentSlide={g.slide}
                            className="absolute inset-0 h-48"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                          <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
                            <h4 className="text-white font-semibold">{g.title}</h4>
                            <p className="text-white/80 text-sm">{g.sub}</p>
                          </div>
                        </div>
                      </Card>
                    </Reveal>
                  ))}
              </div>
            </div>
          </section>
        )}

        {/* ────────── FOOTER ────────────────────────────────────────────── */}
        <footer className="bg-gray-900 text-white py-8">
          <div className="container mx-auto px-4 text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              {settings.generalInfo.logo ? (
                <Image
                  src={settings.generalInfo.logo}
                  alt="School Logo"
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                  <School className="h-4 w-4 text-white" />
                </div>
              )}
              <span className="text-lg font-semibold">{settings.generalInfo.name}</span>
            </div>
            <p className="text-gray-400 text-sm mb-2">
              © {new Date().getFullYear()} {settings.generalInfo.name}. All rights reserved.
            </p>
            <p className="text-gray-500 text-xs">Need help? Contact the school administration.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
