"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, LogIn, School, MapPin, Phone, Mail, Globe, Star, BookOpen, Heart, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useSchoolSettings } from "@/lib/hooks/use-school-settings";
import { usePhotos } from "@/lib/hooks/use-photos";
import { sampleSchoolSettings } from "@/lib/sample-data";
import Image from "next/image";

// ─────────────────────────────────────────────────────────────────────────────
// REVEAL ANIMATION COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
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
      { rootMargin: "-30px" }
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
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

// ─── COUNT UP NUMBER COMPONENT ────────────────────────────────────────────────
function CountUpNumber({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let cur = 0;
          const step = Math.ceil(target / 40) || 1;
          const timer = setInterval(() => {
            cur = Math.min(cur + step, target);
            setCount(cur);
            if (cur >= target) clearInterval(timer);
          }, 35);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
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
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Gallery slideshow states
  const [currentActivitySlide, setCurrentActivitySlide] = useState(0);
  const [currentFacilitySlide, setCurrentFacilitySlide] = useState(0);
  const [currentClassroomSlide, setCurrentClassroomSlide] = useState(0);
  const [currentStaffSlide, setCurrentStaffSlide] = useState(0);
  const [currentPlaygroundSlide, setCurrentPlaygroundSlide] = useState(0);
  const [currentGeneralSlide, setCurrentGeneralSlide] = useState(0);

  // Auto-advance slideshows
  useEffect(() => {
    const timer = setInterval(() => {
      const activityPhotos = photos?.filter(p => p.category === 'activities' || p.category === 'events') || [];
      if (activityPhotos.length > 1) {
        setCurrentActivitySlide(prev => (prev + 1) % activityPhotos.length);
      }
      const facilityPhotos = photos?.filter(p => p.category === 'facilities' || p.category === 'school_building') || [];
      if (facilityPhotos.length > 1) {
        setCurrentFacilitySlide(prev => (prev + 1) % facilityPhotos.length);
      }
      const classroomPhotos = photos?.filter(p => p.category === 'classroom') || [];
      if (classroomPhotos.length > 1) {
        setCurrentClassroomSlide(prev => (prev + 1) % classroomPhotos.length);
      }
      const staffPhotos = photos?.filter(p => p.category === 'staff') || [];
      if (staffPhotos.length > 1) {
        setCurrentStaffSlide(prev => (prev + 1) % staffPhotos.length);
      }
      const playgroundPhotos = photos?.filter(p => p.category === 'playground') || [];
      if (playgroundPhotos.length > 1) {
        setCurrentPlaygroundSlide(prev => (prev + 1) % playgroundPhotos.length);
      }
      const generalPhotos = photos?.filter(p => p.category === 'other' && p.usage.includes('general')) || [];
      if (generalPhotos.length > 1) {
        setCurrentGeneralSlide(prev => (prev + 1) % generalPhotos.length);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [photos]);

  // ── Block scroll on page when modal is active
  useEffect(() => {
    if (showLoginModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showLoginModal]);

  // ── Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowLoginModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Calculate established years dynamically
  const establishedYear = parseInt(settings.generalInfo.establishedYear || "2009", 10);
  const currentYear = new Date().getFullYear();
  const yearsOfExcellence = isNaN(establishedYear) ? 17 : Math.max(1, currentYear - establishedYear);

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
        setShowLoginModal(false);
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        .trinity-portal-landing {
          --trinity-navy:   #1a2340;
          --trinity-green:  #1a7a4a;
          --trinity-green2: #22a05a;
          --trinity-gold:   #d4a017;
          --trinity-gold2:  #f0b429;
          --trinity-text:   #1a2340;
          --trinity-muted:  #555e75;
          --trinity-light:  #f4f6fa;
          --trinity-white:  #ffffff;
          --trinity-border: #e2e6ef;
          
          font-family: 'Inter', sans-serif;
          background: var(--trinity-white);
          color: var(--trinity-text);
          overflow-x: hidden;
        }

        .dark .trinity-portal-landing {
          --trinity-navy:   #0f172a;
          --trinity-green:  #22c55e;
          --trinity-green2: #4ade80;
          --trinity-gold:   #eab308;
          --trinity-gold2:  #facc15;
          --trinity-text:   #f8fafc;
          --trinity-muted:  #94a3b8;
          --trinity-light:  #1e293b;
          --trinity-white:  #0f172a;
          --trinity-border: #334155;
        }

        .trinity-portal-landing h1, 
        .trinity-portal-landing h2, 
        .trinity-portal-landing h3, 
        .trinity-portal-landing h4,
        .trinity-portal-landing .font-space-grotesk {
          font-family: 'Inter', sans-serif;
        }

        .trinity-portal-landing ::-webkit-scrollbar {
          width: 5px;
        }
        .trinity-portal-landing ::-webkit-scrollbar-track {
          background: #f0f2ff;
        }
        .dark .trinity-portal-landing ::-webkit-scrollbar-track {
          background: #1e293b;
        }
        .trinity-portal-landing ::-webkit-scrollbar-thumb {
          background: var(--trinity-navy);
          border-radius: 4px;
        }

        /* Topbar styling */
        .trinity-portal-landing .topbar {
          background: var(--trinity-navy);
          padding: 9px 5%;
          display: flex; align-items:center; justify-content:space-between;
          font-size: 13px; color: rgba(255,255,255,.85);
        }
        .trinity-portal-landing .topbar-left { display:flex; align-items:center; gap:24px; }
        .trinity-portal-landing .topbar-right { display:flex; align-items:center; gap:22px; }
        .trinity-portal-landing .topbar a { color:rgba(255,255,255,.85); text-decoration:none; display:flex; align-items:center; gap:6px; transition:color .2s; }
        .trinity-portal-landing .topbar a:hover { color:#fff; }
        .trinity-portal-landing .topbar-divider { width:1px; height:14px; background:rgba(255,255,255,.2); }
        .trinity-portal-landing .social-icons { display:flex; gap:14px; }
        .trinity-portal-landing .social-icons a { color: rgba(255,255,255,.85); transition: color .2s; }
        .trinity-portal-landing .social-icons a:hover { color: #fff; }

        /* Navigation Header */
        .trinity-portal-landing .mainnav {
          background: var(--trinity-white);
          padding: 0 5%;
          display: flex; align-items:center; justify-content:space-between;
          border-bottom: 1px solid var(--trinity-border);
          position: sticky; top:0; z-index:200;
          box-shadow: 0 2px 12px rgba(0,0,0,.06);
        }

        .trinity-portal-landing .brand { display:flex; align-items:center; gap:14px; text-decoration:none; padding: 12px 0; }
        .trinity-portal-landing .brand-text { line-height:1.2; }
        .trinity-portal-landing .brand-text .name { font-size:20px; font-weight:800; color:var(--trinity-navy); letter-spacing:-.01em; }
        .trinity-portal-landing .brand-text .sub  { font-size:12px; font-weight:600; color:var(--trinity-muted); letter-spacing:.04em; text-transform:uppercase; }

        .trinity-portal-landing .nav-links { display:flex; align-items:center; gap:2px; }
        .trinity-portal-landing .nav-links a {
          color: var(--trinity-text); text-decoration:none; font-size:14px; font-weight:500;
          padding: 26px 16px; display:block; position:relative;
          transition: color .2s;
        }
        .trinity-portal-landing .nav-links a:hover { color:var(--trinity-navy); }
        .trinity-portal-landing .nav-links a.active { color:var(--trinity-navy); font-weight:700; }
        .trinity-portal-landing .nav-links a.active::after {
          content:''; position:absolute; bottom:0; left:16px; right:16px; height:3px;
          background: var(--trinity-gold2); border-radius:2px 2px 0 0;
        }

        .trinity-portal-landing .btn-parent {
          background: var(--trinity-white); border: 2px solid var(--trinity-navy);
          color: var(--trinity-navy); padding:9px 20px; border-radius:8px;
          font-family:'Inter',sans-serif; font-weight:600; font-size:13.5px;
          cursor:pointer; display:flex; align-items:center; gap:7px;
          transition: background .2s, color .2s;
        }
        .trinity-portal-landing .btn-parent:hover { background:var(--trinity-navy); color:#fff; }
        .trinity-portal-landing .btn-staff {
          background: var(--trinity-navy); border:2px solid var(--trinity-navy);
          color: #fff; padding:9px 20px; border-radius:8px;
          font-family:'Inter',sans-serif; font-weight:600; font-size:13.5px;
          cursor:pointer; display:flex; align-items:center; gap:7px;
          transition: background .2s, box-shadow .2s;
        }
        .trinity-portal-landing .btn-staff:hover { background:#0f1a30; box-shadow:0 4px 14px rgba(26,35,64,.3); }

        /* Split Hero */
        .trinity-portal-landing .hero {
          display:grid; grid-template-columns: 1fr 1fr;
          min-height: 520px;
          background: var(--trinity-white);
          position:relative; overflow:hidden;
        }

        .trinity-portal-landing .hero-left {
          padding: 60px 5% 50px 5%;
          display:flex; flex-direction:column; justify-content:center;
          position:relative; z-index:2;
        }

        .trinity-portal-landing .admissions-badge {
          display:inline-flex; align-items:center; gap:9px;
          background: var(--trinity-gold2); color: var(--trinity-navy);
          padding: 8px 18px; border-radius:999px;
          font-size: 12px; font-weight:800; letter-spacing:.06em; text-transform:uppercase;
          margin-bottom: 26px; width:fit-content;
          box-shadow: 0 4px 16px rgba(240,180,41,.35);
        }

        .trinity-portal-landing .hero-heading {
          font-size: clamp(2.2rem, 4.2vw, 3.4rem);
          font-weight:800; line-height:1.1; letter-spacing:-.02em;
          margin-bottom: 4px;
        }
        .trinity-portal-landing .hero-heading .line1 { color: var(--trinity-navy); display:block; }
        .trinity-portal-landing .hero-heading .line2 { color: var(--trinity-green); display:block; }

        .trinity-portal-landing .hero-underline {
          width:52px; height:4px; background:var(--trinity-gold2); border-radius:2px;
          margin: 14px 0 22px;
        }

        .trinity-portal-landing .hero-desc {
          font-size:15px; color:var(--trinity-muted); line-height:1.72; max-width:400px;
          margin-bottom:30px;
        }

        .trinity-portal-landing .hero-cta { display:flex; gap:14px; align-items:center; margin-bottom:44px; }
        .trinity-portal-landing .cta-apply {
          background:var(--trinity-navy); color:#fff; border:2px solid var(--trinity-navy);
          padding:13px 26px; border-radius:8px;
          font-family:'Inter',sans-serif; font-weight:700; font-size:14.5px;
          cursor:pointer; display:flex; align-items:center; gap:8px;
          transition:background .2s, transform .2s;
        }
        .trinity-portal-landing .cta-apply:hover { background:#0f1a30; transform:translateY(-2px); }
        .trinity-portal-landing .cta-contact {
          background:transparent; color:var(--trinity-navy); border:2px solid var(--trinity-navy);
          padding:13px 24px; border-radius:8px;
          font-family:'Inter',sans-serif; font-weight:600; font-size:14.5px;
          cursor:pointer; display:flex; align-items:center; gap:8px;
          transition:background .2s, color .2s;
        }
        .trinity-portal-landing .cta-contact:hover { background:var(--trinity-navy); color:#fff; }

        .trinity-portal-landing .hero-stats {
          display:flex; gap:0; align-items:flex-start;
        }
        .trinity-portal-landing .hstat {
          padding-right:28px; margin-right:28px;
          border-right:1px solid var(--trinity-border);
        }
        .trinity-portal-landing .hstat:last-child { border-right:none; padding-right:0; margin-right:0; }
        .trinity-portal-landing .hstat-icon { font-size:22px; margin-bottom:5px; }
        .trinity-portal-landing .hstat-icon.green { color:var(--trinity-green); }
        .trinity-portal-landing .hstat-icon.blue  { color:#2563eb; }
        .trinity-portal-landing .hstat-icon.gold  { color:var(--trinity-gold2); }
        .trinity-portal-landing .hstat-icon.teal  { color:#0ea5a0; }
        .trinity-portal-landing .hstat-val { font-size:1.6rem; font-weight:800; color:var(--trinity-navy); line-height:1.1; }
        .trinity-portal-landing .hstat-label { font-size:12px; color:var(--trinity-muted); font-weight:500; margin-top:2px; }

        /* Right panel photo styles */
        .trinity-portal-landing .hero-right {
          position:relative; overflow:hidden;
        }
        .trinity-portal-landing .hero-photo {
          width:100%; height:100%; object-fit:cover; object-position:center top;
          display:block;
          filter:brightness(.97);
        }
        .trinity-portal-landing .hero-right::before {
          content:''; position:absolute; top:0; left:0; bottom:0; width:120px; z-index:2;
          background:linear-gradient(to right, var(--trinity-white) 0%, transparent 100%);
        }
        .trinity-portal-landing .hero-card {
          position:absolute; bottom:20px; right:20px; z-index:3;
          background:#fff; border-radius:14px; padding:14px 20px;
          box-shadow:0 8px 32px rgba(0,0,0,.12);
          display:flex; align-items:center; gap:12px;
          min-width:180px;
        }
        .dark .trinity-portal-landing .hero-card {
          background:#1e293b;
        }
        .trinity-portal-landing .hero-card-icon { font-size:26px; }
        .trinity-portal-landing .hero-card-text strong { display:block; font-size:14px; font-weight:700; color:var(--trinity-navy); }
        .trinity-portal-landing .hero-card-text span { font-size:12px; color:var(--trinity-green); font-weight:600; }

        /* Quick Links Ribbon */
        .trinity-portal-landing .quicklinks {
          background:var(--trinity-white);
          border-radius:16px;
          margin: 0 4% -24px;
          position:relative; z-index:10;
          box-shadow: 0 8px 40px rgba(0,0,0,.1);
          display:grid; grid-template-columns:repeat(5,1fr);
          overflow:hidden;
        }
        .trinity-portal-landing .ql-item {
          display:flex; align-items:center; gap:14px;
          padding:22px 20px;
          border-right:1px solid var(--trinity-border);
          text-decoration:none; color:var(--trinity-text);
          transition:background .2s;
          cursor:pointer;
        }
        .trinity-portal-landing .ql-item:last-child { border-right:none; }
        .trinity-portal-landing .ql-item:hover { background:var(--trinity-light); }
        .trinity-portal-landing .ql-icon {
          width:44px; height:44px; border-radius:12px;
          display:flex; align-items:center; justify-content:center;
          font-size:20px; flex-shrink:0;
        }
        .trinity-portal-landing .ic-green  { background:#e8f7ee; color:#1a7a4a; }
        .trinity-portal-landing .ic-gold   { background:#fef8e7; color:#d4a017; }
        .trinity-portal-landing .ic-blue   { background:#e8f0fe; color:#2563eb; }
        .trinity-portal-landing .ic-purple { background:#f0ebff; color:#7c3aed; }
        .trinity-portal-landing .ic-teal   { background:#e6f7f7; color:#0ea5a0; }
        .trinity-portal-landing .ql-text strong { display:block; font-size:14px; font-weight:700; color:var(--trinity-navy); }
        .trinity-portal-landing .ql-text span   { font-size:12px; color:var(--trinity-muted); font-weight:400; margin-top:1px; display:block; }

        /* Why Choose Section */
        .trinity-portal-landing .why-section {
          padding: 100px 5% 80px;
          background: var(--trinity-light);
        }
        .trinity-portal-landing .why-section h2 { text-align:center; font-size:2rem; font-weight:800; color:var(--trinity-navy); margin-bottom:10px; }
        .trinity-portal-landing .why-underline { width:52px; height:4px; background:var(--trinity-gold2); border-radius:2px; margin:0 auto 50px; }

        .trinity-portal-landing .why-grid {
          max-width:1200px; margin:0 auto;
          display:grid; grid-template-columns:repeat(6,1fr); gap:16px;
        }
        .trinity-portal-landing .why-card {
          background:var(--trinity-white); border-radius:14px; padding:28px 18px 24px;
          border:1px solid var(--trinity-border);
          text-align:center;
          transition:transform .3s, box-shadow .3s;
        }
        .trinity-portal-landing .why-card:hover { transform:translateY(-6px); box-shadow:0 16px 40px rgba(0,0,0,.1); }
        .trinity-portal-landing .why-icon-wrap {
          width:52px; height:52px; border-radius:14px; margin:0 auto 14px;
          display:flex; align-items:center; justify-content:center; font-size:24px;
        }
        .trinity-portal-landing .wc1 { background:#e8f7ee; }
        .trinity-portal-landing .wc2 { background:#e8f0fe; }
        .trinity-portal-landing .wc3 { background:#fff3e0; }
        .trinity-portal-landing .wc4 { background:#e3f2fd; }
        .trinity-portal-landing .wc5 { background:#fce4ec; }
        .trinity-portal-landing .wc6 { background:#e8f7ee; }
        .trinity-portal-landing .why-card h4 { font-size:13.5px; font-weight:700; color:var(--trinity-navy); margin-bottom:6px; line-height:1.3; }
        .trinity-portal-landing .why-card p  { font-size:12px; color:var(--trinity-muted); line-height:1.6; }

        .trinity-portal-landing .footer { background:var(--trinity-navy); color:rgba(255,255,255,.7); text-align:center; padding:24px 5%; font-size:13px; }
        .trinity-portal-landing .footer a { color:rgba(255,255,255,.7); text-decoration:none; }

        /* About Us Section */
        .trinity-portal-landing .about-section {
          padding: 90px 5% 80px;
          background: var(--trinity-white);
        }
        .trinity-portal-landing .about-section h2 { text-align:center; font-size:2rem; font-weight:800; color:var(--trinity-navy); margin-bottom:10px; }
        .trinity-portal-landing .about-subtitle { text-align:center; font-size:15px; color:var(--trinity-muted); max-width:600px; margin:0 auto 20px; line-height:1.6; }
        .trinity-portal-landing .about-underline { width:52px; height:4px; background:var(--trinity-gold2); border-radius:2px; margin:0 auto 50px; }

        .trinity-portal-landing .about-grid {
          max-width:1200px; margin:0 auto;
          display:grid; grid-template-columns:repeat(3,1fr); gap:24px;
        }
        .trinity-portal-landing .about-card {
          background:var(--trinity-light); border-radius:18px; padding:38px 28px;
          border:1px solid var(--trinity-border);
          text-align:center;
          transition:transform .3s, box-shadow .3s;
          display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
        }
        .trinity-portal-landing .about-card:hover { transform:translateY(-6px); box-shadow:0 16px 40px rgba(0,0,0,.08); }
        .trinity-portal-landing .about-icon-wrap {
          width:60px; height:60px; border-radius:50%; margin-bottom:20px;
          display:flex; align-items:center; justify-content:center;
          font-size:24px;
        }
        .trinity-portal-landing .ab1 { background:#e8f0fe; color:#2563eb; }
        .trinity-portal-landing .ab2 { background:#f0ebff; color:#7c3aed; }
        .trinity-portal-landing .ab3 { background:#e8f7ee; color:#1a7a4a; }
        .trinity-portal-landing .about-card h3 { font-size:18px; font-weight:700; color:var(--trinity-navy); margin-bottom:12px; }
        .trinity-portal-landing .about-card p { font-size:14px; color:var(--trinity-muted); line-height:1.6; }
        
        .trinity-portal-landing .values-list { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-top:10px; }
        .trinity-portal-landing .value-tag {
          background:var(--trinity-white); border:1px solid var(--trinity-border);
          padding:4px 12px; border-radius:99px; font-size:12px; font-weight:600; color:var(--trinity-navy);
        }

        /* Contact Section */
        .trinity-portal-landing .contact-section {
          padding: 90px 5% 85px;
          background: var(--trinity-light);
          border-top: 1px solid var(--trinity-border);
        }
        .trinity-portal-landing .contact-section h2 { text-align:center; font-size:2rem; font-weight:800; color:var(--trinity-navy); margin-bottom:10px; }
        .trinity-portal-landing .contact-subtitle { text-align:center; font-size:15px; color:var(--trinity-muted); max-width:600px; margin:0 auto 20px; line-height:1.6; }
        .trinity-portal-landing .contact-underline { width:52px; height:4px; background:var(--trinity-gold2); border-radius:2px; margin:0 auto 50px; }

        .trinity-portal-landing .contact-grid {
          max-width:1200px; margin:0 auto;
          display:grid; grid-template-columns:repeat(4,1fr); gap:20px;
        }
        .trinity-portal-landing .contact-card {
          background:var(--trinity-white); border-radius:18px; padding:30px 20px;
          border:1px solid var(--trinity-border);
          text-align:center;
          transition:transform .3s, box-shadow .3s;
          display: flex; flex-direction: column; align-items: center;
        }
        .trinity-portal-landing .contact-card:hover { transform:translateY(-6px); box-shadow:0 16px 40px rgba(0,0,0,.08); }
        .trinity-portal-landing .contact-icon-wrap {
          width:56px; height:56px; border-radius:16px; margin-bottom:18px;
          display:flex; align-items:center; justify-content:center;
          font-size:22px;
        }
        .trinity-portal-landing .co1 { background:#e8f0fe; color:#2563eb; }
        .trinity-portal-landing .co2 { background:#e8f7ee; color:#1a7a4a; }
        .trinity-portal-landing .co3 { background:#f0ebff; color:#7c3aed; }
        .trinity-portal-landing .co4 { background:#fef8e7; color:#d4a017; }
        .trinity-portal-landing .contact-card h4 { font-size:15px; font-weight:700; color:var(--trinity-navy); margin-bottom:10px; }
        .trinity-portal-landing .contact-card p,
        .trinity-portal-landing .contact-card a { font-size:13px; color:var(--trinity-muted); line-height:1.6; word-break:break-all; text-decoration:none; }
        .trinity-portal-landing .contact-card a:hover { color:var(--trinity-navy); text-decoration:underline; }

        /* Gallery Section */
        .trinity-portal-landing .gallery-section {
          padding: 90px 5% 85px;
          background: var(--trinity-white);
          border-top: 1px solid var(--trinity-border);
        }
        .trinity-portal-landing .gallery-section h2 { text-align:center; font-size:2rem; font-weight:800; color:var(--trinity-navy); margin-bottom:10px; }
        .trinity-portal-landing .gallery-subtitle { text-align:center; font-size:15px; color:var(--trinity-muted); max-width:600px; margin:0 auto 20px; line-height:1.6; }
        .trinity-portal-landing .gallery-underline { width:52px; height:4px; background:var(--trinity-gold2); border-radius:2px; margin:0 auto 50px; }

        .trinity-portal-landing .gallery-grid {
          max-width:1200px; margin:0 auto;
          display:grid; grid-template-columns:repeat(3,1fr); gap:24px;
        }
        .trinity-portal-landing .gallery-card {
          background:var(--trinity-white); border-radius:18px;
          border:1px solid var(--trinity-border);
          overflow:hidden;
          box-shadow:0 4px 16px rgba(0,0,0,.04);
          transition:transform .3s, box-shadow .3s;
        }
        .trinity-portal-landing .gallery-card:hover { transform:translateY(-6px); box-shadow:0 16px 40px rgba(0,0,0,.08); }
        
        .trinity-portal-landing .gallery-image-container {
          position:relative; height:240px; width:100%; overflow:hidden;
        }
        .trinity-portal-landing .gallery-overlay {
          position:absolute; inset:0;
          background:linear-gradient(to top, rgba(26,35,64,0.85) 0%, rgba(26,35,64,0.2) 60%, transparent 100%);
          z-index:2;
        }
        .trinity-portal-landing .gallery-card-content {
          position:absolute; bottom:0; left:0; right:0; padding:20px; z-index:3;
          color:var(--trinity-white);
          text-align: left;
        }
        .trinity-portal-landing .gallery-card-content h4 { font-size:16px; font-weight:700; color:#fff; margin-bottom:4px; }
        .trinity-portal-landing .gallery-card-content p { font-size:12.5px; color:rgba(255,255,255,0.85); margin:0; line-height:1.4; }

        /* Glassmorphic Modal */
        .trinity-portal-landing .modal-overlay {
          position:fixed; inset:0; z-index:1000;
          display:flex; align-items:center; justify-content:center;
          opacity:0; pointer-events:none; transition:opacity .35s ease;
          overflow:hidden;
          backdrop-filter:blur(10px);
          -webkit-backdrop-filter:blur(10px);
          background:rgba(0,0,0,.25);
        }
        .trinity-portal-landing .modal-overlay.open { opacity:1; pointer-events:auto; }
        
        .trinity-portal-landing .modal-backdrop {
          position:absolute; inset:0;
          background:transparent;
        }
        .trinity-portal-landing .m-orb { position:absolute; border-radius:50%; filter:blur(72px); pointer-events:none; }
        .trinity-portal-landing .m-orb1 { width:500px;height:500px;top:-150px;left:-140px;background:radial-gradient(circle,rgba(79,99,255,.45),transparent 70%);animation:orbFloat 20s ease-in-out infinite;opacity:.65; }
        .trinity-portal-landing .m-orb2 { width:450px;height:450px;bottom:-140px;right:-130px;background:radial-gradient(circle,rgba(0,200,230,.35),transparent 70%);animation:orbFloat 26s ease-in-out infinite reverse;opacity:.55; }
        .trinity-portal-landing .m-orb3 { width:280px;height:280px;top:38%;right:14%;background:radial-gradient(circle,rgba(160,100,255,.28),transparent 70%);animation:orbFloat 18s ease-in-out infinite 6s;opacity:.4; }
        .trinity-portal-landing .m-orb4 { width:200px;height:200px;top:14%;left:18%;background:radial-gradient(circle,rgba(245,158,11,.2),transparent 70%);animation:orbFloat 22s ease-in-out infinite 3s;opacity:.35; }
        
        .trinity-portal-landing .modal-grid {
          position:absolute;inset:0;
          background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);
          background-size:70px 70px;
          mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black,transparent);
        }

        .trinity-portal-landing .modal-card {
          position:relative; z-index:5;
          width:min(420px,92vw); margin:20px;
          padding:32px; border-radius:28px;
          background:rgba(255,255,255,.12);
          border:1px solid rgba(255,255,255,.2);
          backdrop-filter:blur(24px) saturate(180%);
          -webkit-backdrop-filter:blur(24px) saturate(180%);
          box-shadow:0 10px 50px rgba(0,0,0,.25);
          color:#fff;
          transform:translateY(30px) scale(.95); opacity:0;
          transition:transform .5s cubic-bezier(.22,1,.36,1), opacity .4s ease;
        }
        .trinity-portal-landing .modal-overlay.open .modal-card { transform:translateY(0) scale(1); opacity:1; }

        .trinity-portal-landing .modal-close {
          position:absolute; top:24px; right:24px;
          background:transparent; border:none;
          color:#fff; font-size:18px; cursor:pointer;
          opacity:.8; transition:opacity .2s;
        }
        .trinity-portal-landing .modal-close:hover { opacity:1; transform:scale(1.1); }

        .trinity-portal-landing .modal-top { text-align:left; margin-bottom:24px; }
        .trinity-portal-landing .modal-top h2 { font-size:1.6rem; font-weight:700; margin-bottom:8px; color:#fff; }
        .trinity-portal-landing .modal-top p  { font-size:.95rem; color:rgba(255,255,255,.8); margin-bottom:0; }

        .trinity-portal-landing .mfield { margin-bottom:18px; }
        .trinity-portal-landing .mfield label { display:block; font-size:11.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:rgba(255,255,255,.6); margin-bottom:8px; }
        .trinity-portal-landing .input-row { position:relative; }
        .trinity-portal-landing .input-row .iicon { position:absolute; left:15px; top:50%; transform:translateY(-50%); color:rgba(255,255,255,.35); pointer-events:none; }
        
        .trinity-portal-landing .mfield input {
          width:100%; padding:15px 15px 15px 44px;
          background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.15);
          border-radius:14px; color:#fff; font-size:14px;
          outline:none;
          transition:background .25s, border-color .25s, box-shadow .25s;
        }
        .trinity-portal-landing .mfield input::placeholder { color:rgba(255,255,255,.4); }
        .trinity-portal-landing .mfield input:focus { border-color:#60a5fa; box-shadow:0 0 0 4px rgba(96,165,250,.15); background:rgba(255,255,255,.12); }
        
        .trinity-portal-landing .eye-btn { position:absolute; right:16px; top:50%; transform:translateY(-50%); cursor:pointer; color:rgba(255,255,255,.35); transition:color .2s; }
        .trinity-portal-landing .eye-btn:hover { color:rgba(255,255,255,.7); }

        .trinity-portal-landing .mrow {
          display:flex; align-items:center; justify-content:space-between;
          margin-bottom:24px; font-size:12.5px;
        }
        .trinity-portal-landing .mrow label { display:flex; align-items:center; gap:7px; color:rgba(255,255,255,.6); cursor:pointer; }
        .trinity-portal-landing .mrow input[type=checkbox] { accent-color:#4F63FF; }
        .trinity-portal-landing .mrow a { color:#67e8f9; text-decoration:none; font-weight:600; }
        .trinity-portal-landing .mrow a:hover { text-decoration:underline; }

        .trinity-portal-landing .modal-submit {
          width:100%; padding:15px; border:none; border-radius:14px;
          background:linear-gradient(135deg,#2563eb,#4f46e5);
          color:#fff; font-weight:700; font-size:14.5px;
          cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;
          box-shadow:0 8px 20px rgba(37,99,235,.25);
          transition:transform .2s, box-shadow .2s;
        }
        .trinity-portal-landing .modal-submit:hover { transform:translateY(-2px); box-shadow:0 12px 28px rgba(37,99,235,.45); }
        .trinity-portal-landing .modal-submit:active { transform:scale(.98); }
        .trinity-portal-landing .modal-submit.loading { pointer-events:none; }
        .trinity-portal-landing .modal-submit .spinner { width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;display:none;animation:spin .7s linear infinite; }
        .trinity-portal-landing .modal-submit.loading .spinner { display:inline-block; }
        .trinity-portal-landing .modal-submit.loading .btn-text { display:none; }

        .trinity-portal-landing .modal-divider { display:flex;align-items:center;gap:10px;margin:22px 0 14px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.3); }
        .trinity-portal-landing .modal-divider::before,
        .trinity-portal-landing .modal-divider::after { content:'';flex:1;height:1px;background:rgba(255,255,255,.08); }
        
        .trinity-portal-landing .modal-foot { text-align:center;font-size:12.5px;color:rgba(255,255,255,.4); }
        .trinity-portal-landing .modal-foot strong { color:rgba(255,255,255,.75); }

        @keyframes orbFloat { 0%,100%{transform:translate(0,0) scale(1);} 33%{transform:translate(50px,-40px) scale(1.1);} 66%{transform:translate(-30px,40px) scale(.92);} }
        @keyframes spin { to{transform:rotate(360deg);} }

        /* Responsive Grid fixes */
        @media (max-width: 1024px) {
          .trinity-portal-landing .why-grid { grid-template-columns: repeat(3, 1fr); }
          .trinity-portal-landing .quicklinks { grid-template-columns: repeat(3, 1fr); margin-bottom: 24px; }
          .trinity-portal-landing .about-grid { grid-template-columns: repeat(2, 1fr); }
          .trinity-portal-landing .contact-grid { grid-template-columns: repeat(2, 1fr); }
          .trinity-portal-landing .gallery-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .trinity-portal-landing .hero { grid-template-columns: 1fr; }
          .trinity-portal-landing .hero-left { padding: 48px 5%; }
          .trinity-portal-landing .hero-right { height: 360px; }
          .trinity-portal-landing .quicklinks { grid-template-columns: repeat(2, 1fr); margin: 0 4% 20px; }
          .trinity-portal-landing .why-grid { grid-template-columns: repeat(2, 1fr); }
          .trinity-portal-landing .about-grid { grid-template-columns: 1fr; }
          .trinity-portal-landing .contact-grid { grid-template-columns: repeat(2, 1fr); }
          .trinity-portal-landing .gallery-grid { grid-template-columns: repeat(2, 1fr); }
          .trinity-portal-landing .nav-links { display: none; }
          .trinity-portal-landing .topbar { flex-direction: column; gap: 8px; text-align: center; }
        }
        @media (max-width: 480px) {
          .trinity-portal-landing .quicklinks { grid-template-columns: 1fr; }
          .trinity-portal-landing .why-grid { grid-template-columns: 1fr; }
          .trinity-portal-landing .about-grid { grid-template-columns: 1fr; }
          .trinity-portal-landing .contact-grid { grid-template-columns: 1fr; }
          .trinity-portal-landing .gallery-grid { grid-template-columns: 1fr; }
          .trinity-portal-landing .hero-stats { flex-wrap: wrap; gap: 20px; }
          .trinity-portal-landing .hstat { border-right: none; padding-right: 0; margin-right: 0; }
        }
      `}</style>

      <div className="trinity-portal-landing min-h-screen">
        
        {/* ────────── TOP INFO BAR ───────────────────────────────────────── */}
        <div className="topbar">
          <div className="topbar-left">
            <a href={`tel:${settings.contact.phone || "+256 700 123 456"}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.34a2 2 0 0 1 2-2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              {settings.contact.phone || "+256 700 123 456"}
            </a>
            <div className="topbar-divider" />
            <a href={`mailto:${settings.contact.email || "info@trinityschool.ac.ug"}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              {settings.contact.email || "info@trinityschool.ac.ug"}
            </a>
          </div>
          <div className="topbar-right">
            <button className="bg-transparent border-none text-white/85 hover:text-white cursor-pointer flex items-center gap-1.5 text-[13px]" onClick={() => setShowLoginModal(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Log In
            </button>
            <div className="topbar-divider" />
            <div className="social-icons flex items-center">
              <a href={settings.socialMedia?.facebook || "#"} title="Facebook" className="mr-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href={settings.socialMedia?.instagram || "#"} title="Instagram" className="mr-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
              </a>
              <a href={settings.socialMedia?.whatsapp || "https://chat.whatsapp.com/LfKtwT6Qn5eDImR4gagwU3?mode=ac_t"} title="WhatsApp">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
              </a>
            </div>
          </div>
        </div>

        {/* ────────── MAIN NAVIGATION ────────────────────────────────────── */}
        <nav className="mainnav">
          <a className="brand" href="#">
            {settings.generalInfo.logo ? (
              <div className="relative w-[48px] h-[48px] shrink-0">
                <Image
                  src={settings.generalInfo.logo}
                  alt="School Logo"
                  fill
                  className="rounded-full object-contain bg-white p-0.5 border border-white/20 shadow-md"
                  loading="eager"
                  priority
                />
              </div>
            ) : (
              <svg className="shield-svg" width="58" height="68" viewBox="0 0 58 68" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M29 2L4 12V34C4 49 15 61 29 66C43 61 54 49 54 34V12L29 2Z" fill="#1a2340" stroke="#d4a017" strokeWidth="2.5"/>
                <path d="M29 8L9 16V34C9 46 18 56 29 61C40 56 49 46 49 34V16L29 8Z" fill="#22a05a"/>
                <rect x="26.5" y="16" width="5" height="22" rx="1" fill="white"/>
                <rect x="18" y="24" width="22" height="5" rx="1" fill="white"/>
                <circle cx="29" cy="13" r="3" fill="#f0b429"/>
              </svg>
            )}
            <div className="brand-text">
              <div className="name uppercase tracking-tight font-extrabold">{settings.generalInfo.name.replace(" Primary School", "").replace(" Nursery & Primary School", "")}</div>
              <div className="sub font-bold">{settings.generalInfo.schoolType || "Nursery & Primary School"}</div>
            </div>
          </a>

          <div className="nav-links">
            <a href="#" className="active">Home</a>
            <a href="#about">About Us</a>
            <a href="#gallery">Gallery</a>
            <a href="#why-choose">Why Choose Us</a>
            <a href="#contact">Contact</a>
          </div>

          <div className="nav-actions">
            <button className="btn-staff" onClick={() => setShowLoginModal(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Log In
            </button>
          </div>
        </nav>

        {/* ────────── SPLIT HERO SECTION ─────────────────────────────────── */}
        <section className="hero">
          {/* Left Text details */}
          <div className="hero-left">
            <div className="admissions-badge">
              <span className="mega">📣</span>
              Admissions Open for {currentYear} Academic Year!
            </div>

            <h1 className="hero-heading">
              <span className="line1">Guiding Growth.</span>
              <span className="line2">Inspiring Greatness.</span>
            </h1>
            <div className="hero-underline" />

            <p className="hero-desc">
              {settings.visionMissionValues.description || "Providing quality nursery and primary education in a safe, caring and Christian-centered environment where every child can thrive."}
            </p>



            <div className="hero-stats">
              <div className="hstat">
                <div className="hstat-icon green">👥</div>
                <div className="hstat-val"><CountUpNumber target={settings.statistics?.students || 500} />+</div>
                <div className="hstat-label">Pupils</div>
              </div>
              <div className="hstat">
                <div className="hstat-icon blue">🧑‍🏫</div>
                <div className="hstat-val"><CountUpNumber target={settings.statistics?.teachers || 25} />+</div>
                <div className="hstat-label">Teachers</div>
              </div>
              <div className="hstat">
                <div className="hstat-icon gold">🏆</div>
                <div className="hstat-val"><CountUpNumber target={yearsOfExcellence} />+</div>
                <div className="hstat-label">Years of Excellence</div>
              </div>
              <div className="hstat">
                <div className="hstat-icon teal">📊</div>
                <div className="hstat-val"><CountUpNumber target={settings.statistics?.passRate || 95} />%</div>
                <div className="hstat-label">PLE Success Rate</div>
              </div>
            </div>
          </div>

          {/* Right Image panel */}
          <div className="hero-right">
            <Image
              className="hero-photo"
              src="/images/log-in image.png"
              alt="Students learning at Trinity Family School"
              fill
              priority
              loading="eager"
            />
            <div className="hero-card">
              <div className="hero-card-icon">🎓</div>
              <div className="hero-card-text">
                <strong>{currentYear} Enrolment</strong>
                <span>Now Open — Apply Today</span>
              </div>
            </div>
          </div>
        </section>

        {/* ────────── OVERLAPPING QUICK LINKS STRIP ───────────────────────── */}
        <Reveal>
          <div className="quicklinks">
            <a className="ql-item" href="#contact">
              <div className="ql-icon ic-green">📋</div>
              <div className="ql-text"><strong>Admissions</strong><span>Apply for {currentYear}</span></div>
            </a>
            <a className="ql-item" href="#contact">
              <div className="ql-icon ic-gold">💰</div>
              <div className="ql-text"><strong>School Fees</strong><span>Fee structure</span></div>
            </a>
            <a className="ql-item" href="#contact">
              <div className="ql-icon ic-blue">⬇️</div>
              <div className="ql-text"><strong>Downloads</strong><span>Forms &amp; documents</span></div>
            </a>
            <a className="ql-item" href="#gallery">
              <div className="ql-icon ic-purple">🖼️</div>
              <div className="ql-text"><strong>Gallery</strong><span>School moments</span></div>
            </a>
            <a className="ql-item" href="#contact">
              <div className="ql-icon ic-teal">📞</div>
              <div className="ql-text"><strong>Contact Us</strong><span>Get in touch</span></div>
            </a>
          </div>
        </Reveal>

        {/* ────────── WHY CHOOSE TRINITY ──────────────────────────────────── */}
        <section id="why-choose" className="why-section">
          <h2>Why Choose Trinity?</h2>
          <div className="why-underline" />
          <div className="why-grid">
            {[
              { icon: "🎓", title: "Academic Excellence", desc: "Strong performance in PLE and beyond", class: "wc1" },
              { icon: "📖", title: "Competency Based Learning", desc: "Preparing learners for real life", class: "wc2" },
              { icon: "👧", title: "Child-Centered Education", desc: "Nurturing every child's potential", class: "wc3" },
              { icon: "💻", title: "ICT & STEM Programs", desc: "Equipping learners for the digital future", class: "wc4" },
              { icon: "⚽", title: "Co-Curricular Activities", desc: "Building talent, confidence and teamwork", class: "wc5" },
              { icon: "🛡️", title: "Safe & Nurturing Environment", desc: "A secure and caring school community", class: "wc6" }
            ].map((card, idx) => (
              <Reveal key={idx} delay={idx * 60}>
                <div className="why-card h-full">
                  <div className={`why-icon-wrap ${card.class}`}>
                    {card.icon}
                  </div>
                  <h4>{card.title}</h4>
                  <p>{card.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ────────── ABOUT US SECTION ───────────────────────────────────── */}
        <section id="about" className="about-section">
          <Reveal>
            <h2>About Us</h2>
            <div className="about-underline" />
            <p className="about-subtitle">
              Learn more about our educational foundation, vision, mission and core values at {settings.generalInfo.name}.
            </p>
          </Reveal>
          
          <div className="about-grid">
            <Reveal delay={100}>
              <div className="about-card h-full">
                <div className="about-icon-wrap ab1">
                  <Star className="w-6 h-6" />
                </div>
                <h3>Our Vision</h3>
                <p>
                  {settings.visionMissionValues.vision || "To be a leading institution in providing holistic and transformative education."}
                </p>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="about-card h-full">
                <div className="about-icon-wrap ab2">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3>Our Mission</h3>
                <p>
                  {settings.visionMissionValues.mission || "To nurture students into critical thinkers, lifelong learners, and responsible global citizens through a balanced and challenging curriculum."}
                </p>
              </div>
            </Reveal>

            <Reveal delay={300}>
              <div className="about-card h-full">
                <div className="about-icon-wrap ab3">
                  <Heart className="w-6 h-6" />
                </div>
                <h3>Our Core Values</h3>
                <p className="mb-4">
                  Guided by character and excellence, we instill these pillars in every learner:
                </p>
                <div className="values-list">
                  {(settings.visionMissionValues.coreValues || "Integrity, Excellence, Respect, Collaboration, Innovation")
                    .split(",")
                    .map((val: string, idx: number) => (
                      <span key={idx} className="value-tag">
                        {val.trim()}
                      </span>
                    ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ────────── GALLERY SECTION ────────────────────────────────────── */}
        <section id="gallery" className="gallery-section">
          <Reveal>
            <h2>Discover Our School</h2>
            <div className="gallery-underline" />
            <p className="gallery-subtitle">
              Explore the vibrant life, learning spaces, and beautiful moments of our educational community.
            </p>
          </Reveal>

          <div className="gallery-grid">
            {/* Activities & Events */}
            {(() => {
              const activityPhotos = photos?.filter(p => p.category === 'activities' || p.category === 'events') || [];
              if (activityPhotos.length === 0) return null;
              return (
                <Reveal delay={100}>
                  <div className="gallery-card">
                    <div className="gallery-image-container">
                      {activityPhotos.map((photo, index) => (
                        <div
                          key={photo.id}
                          className={`absolute inset-0 transition-opacity duration-1000 ${
                            index === currentActivitySlide ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <Image
                            src={photo.url}
                            alt={photo.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                      <div className="gallery-overlay" />
                      <div className="gallery-card-content">
                        <h4>Activities &amp; Events</h4>
                        <p>Celebrating achievements and milestones</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })()}

            {/* Our Facilities */}
            {(() => {
              const facilityPhotos = photos?.filter(p => p.category === 'facilities' || p.category === 'school_building') || [];
              if (facilityPhotos.length === 0) return null;
              return (
                <Reveal delay={200}>
                  <div className="gallery-card">
                    <div className="gallery-image-container">
                      {facilityPhotos.map((photo, index) => (
                        <div
                          key={photo.id}
                          className={`absolute inset-0 transition-opacity duration-1000 ${
                            index === currentFacilitySlide ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <Image
                            src={photo.url}
                            alt={photo.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                      <div className="gallery-overlay" />
                      <div className="gallery-card-content">
                        <h4>Our Facilities</h4>
                        <p>Modern spaces for learning and growth</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })()}

            {/* Learning Spaces */}
            {(() => {
              const classroomPhotos = photos?.filter(p => p.category === 'classroom') || [];
              if (classroomPhotos.length === 0) return null;
              return (
                <Reveal delay={300}>
                  <div className="gallery-card">
                    <div className="gallery-image-container">
                      {classroomPhotos.map((photo, index) => (
                        <div
                          key={photo.id}
                          className={`absolute inset-0 transition-opacity duration-1000 ${
                            index === currentClassroomSlide ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <Image
                            src={photo.url}
                            alt={photo.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                      <div className="gallery-overlay" />
                      <div className="gallery-card-content">
                        <h4>Learning Spaces</h4>
                        <p>Where knowledge comes to life</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })()}

            {/* Our Team */}
            {(() => {
              const staffPhotos = photos?.filter(p => p.category === 'staff') || [];
              if (staffPhotos.length === 0) return null;
              return (
                <Reveal delay={400}>
                  <div className="gallery-card">
                    <div className="gallery-image-container">
                      {staffPhotos.map((photo, index) => (
                        <div
                          key={photo.id}
                          className={`absolute inset-0 transition-opacity duration-1000 ${
                            index === currentStaffSlide ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <Image
                            src={photo.url}
                            alt={photo.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                      <div className="gallery-overlay" />
                      <div className="gallery-card-content">
                        <h4>Our Team</h4>
                        <p>Dedicated educators and staff</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })()}

            {/* Play & Recreation */}
            {(() => {
              const playgroundPhotos = photos?.filter(p => p.category === 'playground') || [];
              if (playgroundPhotos.length === 0) return null;
              return (
                <Reveal delay={500}>
                  <div className="gallery-card">
                    <div className="gallery-image-container">
                      {playgroundPhotos.map((photo, index) => (
                        <div
                          key={photo.id}
                          className={`absolute inset-0 transition-opacity duration-1000 ${
                            index === currentPlaygroundSlide ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <Image
                            src={photo.url}
                            alt={photo.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                      <div className="gallery-overlay" />
                      <div className="gallery-card-content">
                        <h4>Play &amp; Recreation</h4>
                        <p>Fun and fitness for all students</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })()}

            {/* School Life */}
            {(() => {
              const generalPhotos = photos?.filter(p => p.category === 'other' && p.usage.includes('general')) || [];
              if (generalPhotos.length === 0) return null;
              return (
                <Reveal delay={600}>
                  <div className="gallery-card">
                    <div className="gallery-image-container">
                      {generalPhotos.map((photo, index) => (
                        <div
                          key={photo.id}
                          className={`absolute inset-0 transition-opacity duration-1000 ${
                            index === currentGeneralSlide ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <Image
                            src={photo.url}
                            alt={photo.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                      <div className="gallery-overlay" />
                      <div className="gallery-card-content">
                        <h4>School Life</h4>
                        <p>Moments that matter</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })()}
          </div>
        </section>

        {/* ────────── CONTACT US SECTION ──────────────────────────────────── */}
        <section id="contact" className="contact-section">
          <Reveal>
            <h2>Contact Us</h2>
            <div className="contact-underline" />
            <p className="contact-subtitle">
              We'd love to hear from you. Reach out to us for admissions, inquiries, or support.
            </p>
          </Reveal>

          <div className="contact-grid">
            <Reveal delay={100}>
              <div className="contact-card h-full">
                <div className="contact-icon-wrap co1">
                  <MapPin className="w-6 h-6" />
                </div>
                <h4>Our Location</h4>
                <p>{settings.address.physical || "123 Education Lane, Kampala"}</p>
                <p className="text-xs text-slate-400 mt-2 block">
                  {settings.address.postal || "P.O. Box 789, Kampala"}
                </p>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="contact-card h-full">
                <div className="contact-icon-wrap co2">
                  <Phone className="w-6 h-6" />
                </div>
                <h4>Phone Contacts</h4>
                <a href={`tel:${settings.contact.phone || "+256 777 123456"}`}>
                  {settings.contact.phone || "+256 777 123456"}
                </a>
                {settings.contact.alternativePhone && (
                  <a href={`tel:${settings.contact.alternativePhone}`} className="mt-1 block">
                    {settings.contact.alternativePhone}
                  </a>
                )}
              </div>
            </Reveal>

            <Reveal delay={300}>
              <div className="contact-card h-full">
                <div className="contact-icon-wrap co3">
                  <Mail className="w-6 h-6" />
                </div>
                <h4>Email Address</h4>
                <a href={`mailto:${settings.contact.email || "info@trinityfamilyschool.edu"}`}>
                  {settings.contact.email || "info@trinityfamilyschool.edu"}
                </a>
              </div>
            </Reveal>

            <Reveal delay={400}>
              <div className="contact-card h-full">
                <div className="contact-icon-wrap co4">
                  <Globe className="w-6 h-6" />
                </div>
                <h4>Official Website</h4>
                <a href={settings.contact.website ? `https://${settings.contact.website.replace("https://", "").replace("http://", "")}` : "#"} target="_blank" rel="noopener noreferrer">
                  {settings.contact.website || "www.trinityfamilyschool.edu"}
                </a>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ────────── SIMPLE FOOTER ───────────────────────────────────────── */}
        <footer className="footer">
          © {new Date().getFullYear()} {settings.generalInfo.name} · {settings.address.city || "Kampala"}, {settings.address.country || "Uganda"} ·{" "}
          <a href={`mailto:${settings.contact.email || "info@trinityschool.ac.ug"}`}>
            {settings.contact.email || "info@trinityschool.ac.ug"}
          </a>
        </footer>

        {/* ────────── GLASSMORPHISM LOGIN MODAL ───────────────────────────── */}
        {showLoginModal && (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden"
            style={{ animation: "lgFadeIn 0.35s ease forwards" }}
          >
            <div
              className="absolute inset-0 bg-gradient-to-br from-[#1a2060] via-[#0f1b55] to-[#0e3f80] cursor-pointer"
              onClick={() => setShowLoginModal(false)}
            />

            {/* Ambient sliding orbs */}
            <div className="m-orb m-orb1 absolute" />
            <div className="m-orb m-orb2 absolute" />
            <div className="m-orb m-orb3 absolute" />
            <div className="m-orb m-orb4 absolute" />

            <div className="modal-grid absolute" />

            {/* Frosted card container */}
            <div
              className="modal-card relative text-white"
              style={{ animation: "lgRise 0.5s cubic-bezier(.22,1,.36,1) forwards" }}
            >
              <button
                className="modal-close"
                onClick={() => setShowLoginModal(false)}
              >
                ✕
              </button>

              <div className="modal-top">
                <h2>Welcome Back</h2>
                <p>Sign in to access your academic dashboard.</p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg border border-red-500/35 bg-red-500/10 text-red-200 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mfield">
                  <label className="block text-[11.5px] font-bold tracking-wider uppercase text-white/60 mb-2">Email or Username</label>
                  <div className="input-row relative">
                    <span className="iicon absolute left-[15px] top-1/2 -translate-y-1/2 text-white/35">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    </span>
                    <input
                      type="text"
                      placeholder="you@trinityschool.ac.ug"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full py-3.5 pl-[44px] pr-3.5 bg-white/7 border border-white/12 rounded-full text-white text-sm outline-none transition-all duration-200 focus:bg-[#4F63FF]/15 focus:border-[#4F63FF]"
                    />
                  </div>
                </div>

                <div className="mfield">
                  <label className="block text-[11.5px] font-bold tracking-wider uppercase text-white/60 mb-2">Password</label>
                  <div className="input-row relative">
                    <span className="iicon absolute left-[15px] top-1/2 -translate-y-1/2 text-white/35">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full py-3.5 pl-[44px] pr-[44px] bg-white/7 border border-white/12 rounded-full text-white text-sm outline-none transition-all duration-200 focus:bg-[#4F63FF]/15 focus:border-[#4F63FF]"
                    />
                    <span
                      className="eye-btn absolute right-[16px] top-1/2 -translate-y-1/2 cursor-pointer text-white/35 hover:text-white"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-[15px] h-[15px]" /> : <Eye className="w-[15px] h-[15px]" />}
                    </span>
                  </div>
                </div>

                <div className="mrow flex items-center justify-between text-[12.5px] mb-6">
                  <label className="flex items-center gap-[7px] text-white/60 cursor-pointer">
                    <input type="checkbox" className="accent-[#4F63FF]" /> Keep me signed in
                  </label>
                  <a href="#" className="text-[#67e8f9] font-bold hover:underline">Forgot password?</a>
                </div>

                <button
                  className="modal-submit w-full py-3.5 rounded-full border-none bg-gradient-to-r from-[#4F63FF] to-[#00C2E0] text-white font-bold text-[14.5px] tracking-wide cursor-pointer flex items-center justify-center gap-2 shadow-[0_8px_28px_rgba(79,99,255,0.5)] hover:translate-y-[-2px] hover:shadow-[0_14px_38px_rgba(79,99,255,0.65)] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
                  type="submit"
                  disabled={isSubmitting || isLoading}
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-1" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </form>

              <div className="modal-divider flex items-center gap-2.5 my-5 uppercase text-[11px] tracking-wider text-white/30">
                Secure Access
              </div>

              <p className="modal-foot text-center text-[12.5px] text-white/45">
                Trinity Family School <strong className="text-white/75">Staff Portal</strong>
              </p>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
