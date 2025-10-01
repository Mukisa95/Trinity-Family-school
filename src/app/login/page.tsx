"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Eye, EyeOff, LogIn, School, Users, UserCheck, ChevronLeft, ChevronRight, MapPin, Phone, Mail, Globe, Award, BookOpen, Heart, Star, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useSchoolSettings } from "@/lib/hooks/use-school-settings";
import { usePhotos } from "@/lib/hooks/use-photos";
import { sampleSchoolSettings } from "@/lib/sample-data";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  
  // School data
  const { data: schoolSettings, isLoading: settingsLoading } = useSchoolSettings();
  const { data: photos } = usePhotos();
  const settings = schoolSettings || sampleSchoolSettings;
  
  // Login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Slideshow state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentGallerySlide, setCurrentGallerySlide] = useState(0);
  const [currentActivitySlide, setCurrentActivitySlide] = useState(0);
  const [currentFacilitySlide, setCurrentFacilitySlide] = useState(0);
  const [currentClassroomSlide, setCurrentClassroomSlide] = useState(0);
  const [currentStaffSlide, setCurrentStaffSlide] = useState(0);
  const [currentPlaygroundSlide, setCurrentPlaygroundSlide] = useState(0);
  const [currentGeneralSlide, setCurrentGeneralSlide] = useState(0);
  
  // Get photos for different sections
  const heroPhotos = photos?.filter(p => p.usage.includes('homepage') || p.usage.includes('banner')) || [];
  const galleryPhotos = photos?.filter(p => p.usage.includes('gallery')) || [];
  
  // Auto-advance hero slideshow
  useEffect(() => {
    if (heroPhotos.length > 1) {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % heroPhotos.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [heroPhotos.length]);
  
  // Auto-advance gallery slideshow
  useEffect(() => {
    if (galleryPhotos.length > 1) {
      const timer = setInterval(() => {
        setCurrentGallerySlide((prev) => (prev + 1) % galleryPhotos.length);
      }, 4000);
      return () => clearInterval(timer);
    }
  }, [galleryPhotos.length]);

  // Page loading effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setPageLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Photo control states
  const [isActivityPlaying, setIsActivityPlaying] = useState(true);
  const [isActivityFullscreen, setIsActivityFullscreen] = useState(false);
  const [activitySlideSpeed, setActivitySlideSpeed] = useState(4000);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Auto-advance activity slideshow with controls
  useEffect(() => {
    const allPhotos = photos?.filter(p => p.isActive) || [];
    if (!isActivityPlaying || allPhotos.length <= 1) return;

      const timer = setInterval(() => {
      setCurrentActivitySlide((prev) => (prev + 1) % allPhotos.length);
    }, activitySlideSpeed);

      return () => clearInterval(timer);
  }, [isActivityPlaying, activitySlideSpeed, photos]);

  // Keyboard navigation for photo slideshow
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const allPhotos = photos?.filter(p => p.isActive) || [];
      if (allPhotos.length <= 1) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentActivitySlide((prev) => (prev - 1 + allPhotos.length) % allPhotos.length);
          break;
        case 'ArrowRight':
          e.preventDefault();
          setCurrentActivitySlide((prev) => (prev + 1) % allPhotos.length);
          break;
        case ' ':
          e.preventDefault();
          setIsActivityPlaying(!isActivityPlaying);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos, isActivityPlaying]);

  // Touch handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    const allPhotos = photos?.filter(p => p.isActive) || [];
    if (allPhotos.length <= 1) return;

    if (isLeftSwipe) {
      setCurrentActivitySlide((prev) => (prev + 1) % allPhotos.length);
    } else if (isRightSwipe) {
      setCurrentActivitySlide((prev) => (prev - 1 + allPhotos.length) % allPhotos.length);
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  useEffect(() => {
    const facilityPhotos = photos?.filter(p => p.category === 'facilities' || p.category === 'school_building') || [];
    if (facilityPhotos.length > 1) {
      const timer = setInterval(() => {
        setCurrentFacilitySlide((prev) => (prev + 1) % facilityPhotos.length);
      }, 4000);
      return () => clearInterval(timer);
    }
  }, [photos]);

  useEffect(() => {
    const classroomPhotos = photos?.filter(p => p.category === 'classroom') || [];
    if (classroomPhotos.length > 1) {
      const timer = setInterval(() => {
        setCurrentClassroomSlide((prev) => (prev + 1) % classroomPhotos.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [photos]);

  useEffect(() => {
    const staffPhotos = photos?.filter(p => p.category === 'staff') || [];
    if (staffPhotos.length > 1) {
      const timer = setInterval(() => {
        setCurrentStaffSlide((prev) => (prev + 1) % staffPhotos.length);
      }, 6000);
      return () => clearInterval(timer);
    }
  }, [photos]);

  useEffect(() => {
    const playgroundPhotos = photos?.filter(p => p.category === 'playground') || [];
    if (playgroundPhotos.length > 1) {
      const timer = setInterval(() => {
        setCurrentPlaygroundSlide((prev) => (prev + 1) % playgroundPhotos.length);
      }, 7000);
      return () => clearInterval(timer);
    }
  }, [photos]);

  useEffect(() => {
    const generalPhotos = photos?.filter(p => p.category === 'other' && p.usage.includes('general')) || [];
    if (generalPhotos.length > 1) {
      const timer = setInterval(() => {
        setCurrentGeneralSlide((prev) => (prev + 1) % generalPhotos.length);
      }, 8000);
      return () => clearInterval(timer);
    }
  }, [photos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const success = await login(username.trim(), password);
      
      if (success) {
        toast({
          title: "Login Successful",
          description: `Welcome to ${settings.generalInfo.name} Management System`,
        });
        setIsTransitioning(true);
        setShowLoginDialog(false);
        
        // Delay navigation to show transition animation
        setTimeout(() => {
          router.push("/");
        }, 800);
      } else {
        setError("Invalid username or password. Please try again.");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("An error occurred during login. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroPhotos.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + heroPhotos.length) % heroPhotos.length);
  };

  const nextGallerySlide = () => {
    setCurrentGallerySlide((prev) => (prev + 1) % galleryPhotos.length);
  };

  const prevGallerySlide = () => {
    setCurrentGallerySlide((prev) => (prev - 1 + galleryPhotos.length) % galleryPhotos.length);
  };

  // Loading screen component
  if (pageLoading || settingsLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 flex items-center justify-center z-50">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center text-white"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="h-16 w-16 border-4 border-white border-t-transparent rounded-full mx-auto mb-6"
          />
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-3xl font-bold mb-2"
          >
            {schoolSettings?.generalInfo?.name || "School Management System"}
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-lg opacity-90"
          >
            Loading your educational journey...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative">
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            key="transition-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 pointer-events-none"
          >
            {/* Smooth sliding overlay */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              transition={{
                duration: 0.6,
                ease: [0.4, 0, 0.2, 1]
              }}
              className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800"
            />
            
            {/* Secondary overlay for smooth effect */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              transition={{
                duration: 0.7,
                delay: 0.1,
                ease: [0.4, 0, 0.2, 1]
              }}
              className="absolute inset-0 bg-gradient-to-br from-purple-600 via-blue-600 to-purple-800 opacity-80"
            />
            
            {/* Loading indicator */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="text-center text-white">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="h-8 w-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4"
                />
                <motion.p
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.3 }}
                  className="text-lg font-medium"
                >
                  Signing you in...
                </motion.p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="min-h-screen bg-gray-50 dark:bg-gray-900"
      >
      {/* Header with Login Button */}
      <header className="relative z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            {settings.generalInfo.logo ? (
              <Image
                src={settings.generalInfo.logo}
                alt="School Logo"
                width={48}
                height={48}
                className="rounded-full"
              />
            ) : (
              <div className="h-12 w-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                <School className="h-6 w-6 text-white" />
          </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {settings.generalInfo.name}
          </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {settings.generalInfo.motto}
          </p>
            </div>
        </div>

          <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
            <LoginDialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Button>
            </LoginDialogTrigger>
            <LoginDialogContent>
              <LoginDialogHeader>
                {/* School Logo/Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.5, type: "spring", bounce: 0.3 }}
                  className="mx-auto mb-4"
                >
                  {settings.generalInfo.logo ? (
                    <div className="relative w-16 h-16 mx-auto">
                      <Image
                        src={settings.generalInfo.logo}
                        alt="School Logo"
                        fill
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                      <School className="h-8 w-8 text-white" />
                    </div>
                  )}
                </motion.div>
                
                <LoginDialogTitle>Welcome Back</LoginDialogTitle>
                <p className="text-sm text-muted-foreground">
                  Sign in to access {settings.generalInfo.name}
                </p>
              </LoginDialogHeader>

              <motion.form 
                onSubmit={handleSubmit} 
                className="space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-950/20">
                      <AlertDescription className="text-red-800 dark:text-red-200">
                        {error}
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                )}
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Username
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isSubmitting}
                      className="h-12 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500 rounded-xl transition-all duration-200"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isSubmitting}
                        className="h-12 pr-12 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500 rounded-xl transition-all duration-200"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-10 w-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isSubmitting}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-500" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-500" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                  disabled={isSubmitting || isLoading}
                >
                  {isSubmitting ? (
                    <>
                      <motion.div 
                        className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      Signing In...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign In
                    </>
                  )}
                </Button>


              </motion.form>
            </LoginDialogContent>
          </LoginDialog>
        </div>
      </header>

      {/* Hero Section with Slideshow */}
       <section className="relative overflow-hidden min-h-[25vh] md:min-h-[40vh]">
        {heroPhotos.length > 0 ? (
          <div className="relative h-full min-h-[25vh] md:min-h-[40vh]">
            {heroPhotos.map((photo, index) => (
              <div
                key={photo.id}
                className={`absolute inset-0 transition-opacity duration-1000 ${
                  index === currentSlide ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <Image
                  src={photo.url}
                  alt={photo.title}
                  fill
                  className="object-cover"
                  priority={index === 0}
                />
              </div>
            ))}
            
            {/* Navigation Arrows */}
            {heroPhotos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white"
                  onClick={prevSlide}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white"
                  onClick={nextSlide}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}
            
            {/* Slide Indicators */}
            {heroPhotos.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                {heroPhotos.map((_, index) => (
                  <button
                    key={index}
                    className={`w-3 h-3 rounded-full transition-all ${
                      index === currentSlide ? 'bg-white' : 'bg-white/50'
                    }`}
                    onClick={() => setCurrentSlide(index)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="min-h-[25vh] md:min-h-[40vh] bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 flex items-center justify-center relative overflow-hidden">
            {/* Animated background elements */}
            <motion.div
              animate={{ 
                rotate: [0, 360],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 20, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-xl"
            />
            <motion.div
              animate={{ 
                rotate: [360, 0],
                scale: [1, 0.8, 1]
              }}
              transition={{ 
                duration: 15, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              className="absolute bottom-20 right-20 w-48 h-48 bg-purple-300/20 rounded-full blur-2xl"
            />
            
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
               className="text-center text-white max-w-4xl px-4 py-2 md:py-0 relative z-10"
             >
              
              <motion.h2
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                 className="text-2xl md:text-5xl font-bold mb-0 drop-shadow-lg"
              >
                Welcome to {settings.generalInfo.name}
              </motion.h2>
              
              <motion.p
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.8 }}
                 className="text-sm md:text-xl mb-1 drop-shadow-md opacity-90 font-semibold"
              >
                {settings.generalInfo.motto || "GUIDING GROWTH, INSPIRING GREATNESS"}
              </motion.p>
              
              <motion.p
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.8 }}
                 className="text-xs md:text-lg max-w-3xl mx-auto drop-shadow-md opacity-80 leading-relaxed mb-1"
              >
                {settings.visionMissionValues.description || `${settings.generalInfo.name} is committed to fostering an environment where students can achieve their full potential academically, socially, and morally.`}
              </motion.p>
              
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.1, duration: 0.8 }}
                 className="mt-0 flex flex-wrap justify-center gap-2 md:gap-3"
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                    className="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-0 border border-white/30"
                >
                  <span className="text-xs md:text-sm font-medium">Excellence in Education</span>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                   className="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-0 border border-white/30"
                >
                  <span className="text-xs md:text-sm font-medium">Character Development</span>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                   className="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-0 border border-white/30"
                >
                  <span className="text-xs md:text-sm font-medium">Future Leaders</span>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        )}
        
        {/* Overlay Content - Only show when there are photos */}
        {heroPhotos.length > 0 && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-center text-white max-w-4xl px-4">
              <h2 className="text-5xl md:text-6xl font-bold mb-4 drop-shadow-lg">
                Welcome to {settings.generalInfo.name}
              </h2>
              <p className="text-xl md:text-2xl mb-6 drop-shadow-md opacity-90">
                {settings.generalInfo.motto}
              </p>
              <p className="text-lg md:text-xl max-w-2xl mx-auto drop-shadow-md opacity-80">
                {settings.visionMissionValues.description || "Nurturing excellence in education and character development."}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Photo Card Immediately After Welcome Message */}
      {(() => {
        const allPhotos = photos?.filter(p => p.isActive) || [];
        
        // Show loading state if photos are still loading
        if (!photos) {
          return (
            <section className="py-2 md:py-8 bg-white dark:bg-gray-800">
              <div className="container mx-auto px-4">
                <Card className="overflow-hidden max-w-4xl mx-auto">
                  <div className="relative h-64 flex items-center justify-center">
                    <div className="text-gray-500 dark:text-gray-400">Loading photos...</div>
                  </div>
                </Card>
              </div>
            </section>
          );
        }
        
        if (allPhotos.length > 0) {
          return (
            <section className="py-2 md:py-8 bg-white dark:bg-gray-800">
              <div className="container mx-auto px-4">
                <motion.div 
         initial={{ opacity: 0, y: 50 }}
         whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
         viewport={{ once: true, margin: "-100px" }}
                >
                  <Card className="overflow-hidden max-w-4xl mx-auto">
                    <div 
                      className="relative h-64 group"
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      {allPhotos.map((photo, index) => (
                        <div
                          key={photo.id}
                          className={`absolute inset-0 transition-opacity duration-1000 ${
                            index === currentActivitySlide ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <Image
                            src={photo.url}
                            alt={photo.title || `Photo ${index + 1}`}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                      

                      
                                              {/* Fullscreen Button - Top Left Corner */}
                        <motion.button
                          onClick={() => setIsActivityFullscreen(!isActivityFullscreen)}
                          className="absolute top-4 left-4 z-20 w-10 h-10 bg-black/40 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors duration-200"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {isActivityFullscreen ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                          )}
                        </motion.button>

                        {/* Hidden Click Areas for Navigation */}
                        {/* Left Click Area - Previous */}
                        <div 
                          className="absolute left-0 top-0 w-1/3 h-full z-10 cursor-pointer"
                          onClick={() => setCurrentActivitySlide((prev) => (prev - 1 + allPhotos.length) % allPhotos.length)}
                        />
                         
                        {/* Right Click Area - Next */}
                        <div 
                          className="absolute right-0 top-0 w-1/3 h-full z-10 cursor-pointer"
                          onClick={() => setCurrentActivitySlide((prev) => (prev + 1) % allPhotos.length)}
                        />
                         
                        {/* Center Click Area - Play/Pause */}
                        <div 
                          className="absolute left-1/3 top-0 w-1/3 h-full z-10 cursor-pointer"
                          onClick={() => setIsActivityPlaying(!isActivityPlaying)}
                        />
                      

                                          </div>
                    </Card>
                  </motion.div>
                </div>
              </section>
            );
          }
        
        // Show message when no photos are available
        return (
          <section className="py-2 md:py-8 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4">
              <Card className="overflow-hidden max-w-4xl mx-auto">
                <div className="relative h-64 flex items-center justify-center">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <div className="text-lg font-medium mb-2">No Photos Available</div>
                    <div className="text-sm">Photos will appear here once they are uploaded to the system.</div>
                  </div>
                </div>
              </Card>
            </div>
          </section>
        );
      })()}

      {/* Fullscreen Modal */}
      {isActivityFullscreen && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <div className="relative w-full h-full">
            {/* Fullscreen Photos */}
            {(() => {
              const allPhotos = photos?.filter(p => p.isActive) || [];
              return allPhotos.map((photo, index) => (
                <div
                  key={photo.id}
                  className={`absolute inset-0 transition-opacity duration-1000 ${
                    index === currentActivitySlide ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <Image
                    src={photo.url}
                    alt={photo.title || `Photo ${index + 1}`}
                    fill
                    className="object-contain"
                  />
                </div>
              ));
            })()}
            
            {/* Fullscreen Controls */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
              {/* Close Fullscreen Button */}
              <motion.button
                onClick={() => setIsActivityFullscreen(false)}
                className="w-10 h-10 bg-black/60 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors duration-200"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
              
              {/* Play/Pause Button */}
              <motion.button
                onClick={() => setIsActivityPlaying(!isActivityPlaying)}
                className="w-10 h-10 bg-black/60 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors duration-200"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                {isActivityPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </motion.button>
            </div>
            
            {/* Fullscreen Click Areas */}
            {(() => {
              const allPhotos = photos?.filter(p => p.isActive) || [];
              return (
                <>
                  <div 
                    className="absolute left-0 top-0 w-1/3 h-full z-10 cursor-pointer"
                    onClick={() => setCurrentActivitySlide((prev) => (prev - 1 + allPhotos.length) % allPhotos.length)}
                  />
                  <div 
                    className="absolute right-0 top-0 w-1/3 h-full z-10 cursor-pointer"
                    onClick={() => setCurrentActivitySlide((prev) => (prev + 1) % allPhotos.length)}
                  />
                  <div 
                    className="absolute left-1/3 top-0 w-1/3 h-full z-10 cursor-pointer"
                    onClick={() => setIsActivityPlaying(!isActivityPlaying)}
                  />
                </>
              );
            })()}
          </div>
        </div>
      )}

                           {/* School Information Section */}
                 <section className="pt-8 pb-16 bg-white dark:bg-gray-800">
          <div className="container mx-auto px-4">
            <motion.div 
              className="text-center mb-8"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true, margin: "-100px" }}
            >
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              About Our School
            </h3>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Discover what makes {settings.generalInfo.name} a special place for learning and growth.
            </p>
            </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Vision */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                viewport={{ once: true, margin: "-100px" }}
              >
            <Card className="text-center">
              <CardHeader>
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      whileInView={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.6, delay: 0.4, type: "spring" }}
                      viewport={{ once: true, margin: "-100px" }}
                    >
                <div className="mx-auto h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                  <Star className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                    </motion.div>
                <CardTitle>Our Vision</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  {settings.visionMissionValues.vision || "To be a leading educational institution that nurtures excellence and character in every student."}
                </p>
          </CardContent>
        </Card>
              </motion.div>

            {/* Mission */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                viewport={{ once: true, margin: "-100px" }}
              >
            <Card className="text-center">
              <CardHeader>
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      whileInView={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.6, delay: 0.5, type: "spring" }}
                      viewport={{ once: true, margin: "-100px" }}
                    >
                <div className="mx-auto h-12 w-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mb-4">
                  <BookOpen className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                    </motion.div>
                <CardTitle>Our Mission</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  {settings.visionMissionValues.mission || "To provide quality education that empowers students to achieve their full potential and become responsible global citizens."}
              </p>
            </CardContent>
          </Card>
              </motion.div>
          
            {/* Values */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                viewport={{ once: true, margin: "-100px" }}
              >
            <Card className="text-center">
              <CardHeader>
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      whileInView={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.6, delay: 0.6, type: "spring" }}
                      viewport={{ once: true, margin: "-100px" }}
                    >
                <div className="mx-auto h-12 w-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                  <Heart className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                    </motion.div>
                <CardTitle>Our Values</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  Excellence, Integrity, Respect, Innovation, and Community - the pillars that guide our educational approach.
                </p>
              </CardContent>
            </Card>
              </motion.div>
          </div>
        </div>
      </section>

      {/* WhatsApp Group Section */}
      <section className="py-16 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              whileInView={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.8, delay: 0.2, type: "spring" }}
              viewport={{ once: true, margin: "-100px" }}
              className="mx-auto mb-6"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/50 rounded-full">
                <MessageCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Join Our WhatsApp Group Today
              </h3>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
              Stay connected with our school community! Get instant updates, announcements, and connect with other parents and staff members.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <a 
                href="https://chat.whatsapp.com/LfKtwT6Qn5eDImR4gagwU3?mode=ac_t" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-3 bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <MessageCircle className="h-5 w-5" />
                <span>Join WhatsApp Group</span>
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Photo Gallery Section */}
      {galleryPhotos.length > 0 && (
        <section className="py-16 bg-gray-50 dark:bg-gray-900">
          <div className="container mx-auto px-4">
            <motion.div 
              className="text-center mb-12"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                School Life Gallery
              </h3>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Glimpses of our vibrant school community
              </p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              viewport={{ once: true, margin: "-100px" }}
            >
            <div className="relative max-w-4xl mx-auto">
              <div className="relative h-96 rounded-lg overflow-hidden">
                {galleryPhotos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className={`absolute inset-0 transition-opacity duration-1000 ${
                      index === currentGallerySlide ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <Image
                      src={photo.url}
                      alt={photo.title}
                      fill
                      className="object-cover rounded-lg"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6">
                      <h4 className="text-white text-xl font-semibold">{photo.title}</h4>
                      {photo.description && (
                        <p className="text-white/90 text-sm mt-1">{photo.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Navigation */}
              {galleryPhotos.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white"
                    onClick={prevGallerySlide}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white"
                    onClick={nextGallerySlide}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                  
                  {/* Thumbnails */}
                  <div className="flex justify-center mt-6 space-x-2 overflow-x-auto pb-2">
                    {galleryPhotos.map((photo, index) => (
                      <button
                        key={photo.id}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          index === currentGallerySlide 
                            ? 'border-blue-500 scale-110' 
                            : 'border-transparent hover:border-gray-300'
                        }`}
                        onClick={() => setCurrentGallerySlide(index)}
                      >
                        <Image
                          src={photo.url}
                          alt={photo.title}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
             </motion.div>
          </div>
        </section>
      )}

      {/* Contact Information */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Get in Touch
            </h3>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              We'd love to hear from you. Contact us for more information.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Address */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true, margin: "-100px" }}
            >
            <Card className="text-center">
              <CardContent className="pt-6">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.6, delay: 0.3, type: "spring" }}
                    viewport={{ once: true, margin: "-100px" }}
                  >
                <div className="mx-auto h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                  <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                  </motion.div>
                <h4 className="font-semibold mb-2">Address</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {settings.address.physical || "School Address"}
                </p>
              </CardContent>
            </Card>
            </motion.div>
            
            {/* Phone */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              viewport={{ once: true, margin: "-100px" }}
            >
            <Card className="text-center">
              <CardContent className="pt-6">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.6, delay: 0.4, type: "spring" }}
                    viewport={{ once: true, margin: "-100px" }}
                  >
                <div className="mx-auto h-12 w-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                  <Phone className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                  </motion.div>
                <h4 className="font-semibold mb-2">Phone</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {settings.contact.phone || "Contact Number"}
                </p>
              </CardContent>
            </Card>
            </motion.div>
            
            {/* Email */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              viewport={{ once: true, margin: "-100px" }}
            >
            <Card className="text-center">
              <CardContent className="pt-6">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.6, delay: 0.5, type: "spring" }}
                    viewport={{ once: true, margin: "-100px" }}
                  >
                <div className="mx-auto h-12 w-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                  </motion.div>
                <h4 className="font-semibold mb-2">Email</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {settings.contact.email || "school@email.com"}
                </p>
              </CardContent>
            </Card>
            </motion.div>
            
            {/* Website */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              viewport={{ once: true, margin: "-100px" }}
            >
            <Card className="text-center">
              <CardContent className="pt-6">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.6, delay: 0.6, type: "spring" }}
                    viewport={{ once: true, margin: "-100px" }}
                  >
                <div className="mx-auto h-12 w-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mb-4">
                  <Globe className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                  </motion.div>
                <h4 className="font-semibold mb-2">Website</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {settings.contact.website || "www.school.com"}
              </p>
            </CardContent>
          </Card>
            </motion.div>
          </div>
        </div>
      </section>

             {/* Photo Showcase Section */}
       <section className="py-16 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900">
         <div className="container mx-auto px-4">
           <motion.div 
             initial={{ opacity: 0, y: 50 }}
             whileInView={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.8, delay: 0.2 }}
             viewport={{ once: true, margin: "-100px" }}
           >
             <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
               Discover Our School
             </h3>
             <p className="text-lg text-gray-600 dark:text-gray-400">
               Explore the vibrant life and beautiful spaces of our educational community
             </p>
           </motion.div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {/* Activities & Events Slideshow */}
             {(() => {
               const activityPhotos = photos?.filter(p => p.category === 'activities' || p.category === 'events') || [];
               if (activityPhotos.length > 0) {
                 return (
                   <motion.div 
                     initial={{ opacity: 0, y: 50 }}
                     whileInView={{ opacity: 1, y: 0 }}
                     transition={{ duration: 0.8, delay: 0.2 }}
                     viewport={{ once: true, margin: "-100px" }}
                   >
                 <Card className="overflow-hidden">
                   <div className="relative h-48">
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
                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                     <div className="absolute bottom-0 left-0 right-0 p-4">
                       <h4 className="text-white font-semibold">Activities & Events</h4>
                       <p className="text-white/80 text-sm">Celebrating achievements and milestones</p>
                     </div>
                   </div>
                 </Card>
                   </motion.div>
               );
               }
               return null;
             })()}
             
             {/* Facilities Slideshow */}
             {(() => {
               const facilityPhotos = photos?.filter(p => p.category === 'facilities' || p.category === 'school_building') || [];
               if (facilityPhotos.length > 0) {
                 return (
                   <motion.div 
                     initial={{ opacity: 0, y: 50 }}
                     whileInView={{ opacity: 1, y: 0 }}
                     transition={{ duration: 0.8, delay: 0.2 }}
                     viewport={{ once: true, margin: "-100px" }}
                   >
                 <Card className="overflow-hidden">
                   <div className="relative h-48">
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
                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                     <div className="absolute bottom-0 left-0 right-0 p-4">
                       <h4 className="text-white font-semibold">Our Facilities</h4>
                       <p className="text-white/80 text-sm">Modern spaces for learning and growth</p>
                     </div>
                   </div>
                 </Card>
               </motion.div>
               );
             }
             return null;
             })()}
             
             {/* Classroom & Learning Slideshow */}
             {(() => {
               const classroomPhotos = photos?.filter(p => p.category === 'classroom') || [];
               return classroomPhotos.length > 0 && (
                 <Card className="overflow-hidden">
                   <div className="relative h-48">
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
                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                     <div className="absolute bottom-0 left-0 right-0 p-4">
                       <h4 className="text-white font-semibold">Learning Spaces</h4>
                       <p className="text-white/80 text-sm">Where knowledge comes to life</p>
                     </div>
                   </div>
                 </Card>
               );
             })()}
             
             {/* Staff & Community Slideshow */}
             {(() => {
               const staffPhotos = photos?.filter(p => p.category === 'staff') || [];
               return staffPhotos.length > 0 && (
                 <Card className="overflow-hidden">
                   <div className="relative h-48">
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
                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                     <div className="absolute bottom-0 left-0 right-0 p-4">
                       <h4 className="text-white font-semibold">Our Team</h4>
                       <p className="text-white/80 text-sm">Dedicated educators and staff</p>
                     </div>
                   </div>
                 </Card>
               );
             })()}
             
             {/* Playground & Recreation Slideshow */}
             {(() => {
               const playgroundPhotos = photos?.filter(p => p.category === 'playground') || [];
               return playgroundPhotos.length > 0 && (
                 <Card className="overflow-hidden">
                   <div className="relative h-48">
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
                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                     <div className="absolute bottom-0 left-0 right-0 p-4">
                       <h4 className="text-white font-semibold">Play & Recreation</h4>
                       <p className="text-white/80 text-sm">Fun and fitness for all students</p>
                     </div>
                   </div>
                 </Card>
               );
             })()}
             
             {/* General School Life Slideshow */}
             {(() => {
               const generalPhotos = photos?.filter(p => p.category === 'other' && p.usage.includes('general')) || [];
               return generalPhotos.length > 0 && (
                 <Card className="overflow-hidden">
                   <div className="relative h-48">
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
                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                     <div className="absolute bottom-0 left-0 right-0 p-4">
                       <h4 className="text-white font-semibold">School Life</h4>
                       <p className="text-white/80 text-sm">Moments that matter</p>
                     </div>
                   </div>
                 </Card>
               );
             })()}
           </div>
         </div>
       </section>

        {/* Footer */}
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
          <p className="text-gray-400 text-sm mb-4">
            © {new Date().getFullYear()} {settings.generalInfo.name}. All rights reserved.
          </p>
          <p className="text-gray-500 text-xs">
            Need help? Contact the school administration.
          </p>
        </div>
       </footer>
       </motion.div>
    </div>
  );
} 
