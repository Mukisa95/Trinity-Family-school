"use client";

import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { usePhotos } from '@/lib/hooks/use-photos';
import { usePupil, usePupilsByFamily } from '@/lib/hooks/use-pupils';
import { useAuth } from '@/lib/contexts/auth-context';
import { sampleSchoolSettings } from '@/lib/sample-data';
import { 
  School, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  User, 
  Heart,
  Target,
  Star,
  Calendar,
  Building,
  Award,
  Users,
  BookOpen,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AcademicProgressTile } from './academic-progress-tile';
import { PhotoViewerDialog } from '@/components/common/photo-viewer-dialog';

// Note: motion() factory is deprecated but still works
// Will migrate to new API in future framer-motion update
// eslint-disable-next-line @typescript-eslint/no-deprecated
const AnimatedCard = motion(Card);
const AnimatedDiv = motion.div;

// PhotoSlideshow Component
const PhotoSlideshow = ({ photos }: { photos: any[] }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resumeSlideshowOnClose, setResumeSlideshowOnClose] = useState(false);

  // Filter active photos
  const activePhotos = useMemo(() => {
    return photos?.filter(photo => photo.isActive) || [];
  }, [photos]);

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || activePhotos.length === 0) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % activePhotos.length);
    }, 4000); // Change slide every 4 seconds

    return () => clearInterval(interval);
  }, [isPlaying, activePhotos.length]);

  const showPrevious = () => {
    setCurrentSlide((previous) => (previous - 1 + activePhotos.length) % activePhotos.length);
  };

  const showNext = () => {
    setCurrentSlide((previous) => (previous + 1) % activePhotos.length);
  };

  if (!activePhotos.length) {
    return (
      <Card className="h-full border-0 shadow-xl bg-gradient-to-br from-slate-50 via-white to-brand-surface-50 overflow-hidden dark:from-slate-900 dark:via-slate-900 dark:to-brand-surface-950/40">
        <CardContent className="flex items-center justify-center h-64 relative">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, #3b82f6 2px, transparent 2px),
                               radial-gradient(circle at 75% 75%, #8b5cf6 2px, transparent 2px)`,
              backgroundSize: '24px 24px'
            }} />
          </div>
          
          <div className="text-center text-gray-400 relative z-10 dark:text-slate-400">
            <motion.div 
              className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-brand-surface-100 to-brand-secondary-surface-100 rounded-2xl flex items-center justify-center shadow-lg dark:from-brand-surface-950/40 dark:to-brand-secondary-surface-950/40"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <svg className="w-10 h-10 text-gray-400 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </motion.div>
            <p className="text-sm font-medium">No photos available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-0 shadow-xl bg-white overflow-hidden group dark:bg-slate-900">
      <CardContent className="p-0 relative">
        <div className="relative h-64 overflow-hidden cursor-pointer">
          {/* Main slideshow */}
          <div className="relative w-full h-full">
            {activePhotos.map((photo, index) => (
              <motion.div
                key={photo.id}
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{
                  opacity: index === currentSlide ? 1 : 0,
                  scale: index === currentSlide ? 1 : 1.05,
                }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <img
                  src={photo.url}
                  alt={photo.title || 'School moment'}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                {/* Modern gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
                
                {/* Subtle corner accent */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/10 to-transparent dark:from-slate-900/10" />
              </motion.div>
            ))}
          </div>

          <button
            type="button"
            aria-label={`Open ${activePhotos[currentSlide].title || 'school photo'} in a larger viewer`}
            className="absolute inset-0 z-10 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
            onClick={() => {
              setResumeSlideshowOnClose(isPlaying);
              setIsPlaying(false);
              setIsFullscreen(true);
            }}
          >
            <span className="sr-only">Open photo</span>
          </button>

          {activePhotos.length > 1 && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-between px-2 opacity-100 sm:opacity-0 sm:transition-opacity sm:duration-200 sm:group-hover:opacity-100">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={showPrevious}
                aria-label="Show previous dashboard photo"
                className="pointer-events-auto h-9 w-9 rounded-full border border-white/20 bg-black/35 text-white shadow-md backdrop-blur-md hover:bg-black/55 hover:text-white dark:border-slate-700/20"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={showNext}
                aria-label="Show next dashboard photo"
                className="pointer-events-auto h-9 w-9 rounded-full border border-white/20 bg-black/35 text-white shadow-md backdrop-blur-md hover:bg-black/55 hover:text-white dark:border-slate-700/20"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>

      <PhotoViewerDialog
        open={isFullscreen}
        onOpenChange={(open) => {
          setIsFullscreen(open);
          if (!open && resumeSlideshowOnClose) {
            setIsPlaying(true);
            setResumeSlideshowOnClose(false);
          }
        }}
        photos={activePhotos}
        currentIndex={currentSlide}
        onCurrentIndexChange={setCurrentSlide}
      />
    </Card>
  );
};

export function ParentAboutSchool() {
  const { data: schoolSettings, isLoading, error } = useSchoolSettings();
  const { data: photos } = usePhotos();
  const { user } = useAuth();
  const settings = schoolSettings || sampleSchoolSettings;
  
  // State for avatar click animation
  const [clickedAvatar, setClickedAvatar] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [avatarRefs, setAvatarRefs] = useState<{ [key: string]: HTMLDivElement | null }>({});

  // Get familyId from user account (preferred) or fallback to pupil's familyId
  const userFamilyId = user?.familyId;
  const { data: primaryPupil } = usePupil(user?.pupilId || '');
  const fallbackFamilyId = primaryPupil?.familyId;
  const familyId = userFamilyId || fallbackFamilyId;

  // Fetch all family members using the family-based relationship
  const { data: familyMembers = [] } = usePupilsByFamily(familyId || '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-brand-ink-600 dark:text-brand-ink-400" />
        <span className="ml-2 text-gray-600 dark:text-slate-300">Loading school information...</span>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5
      }
    }
  };

  const socialLinks = [
    { icon: Facebook, url: settings.socialMedia?.facebook, label: 'Facebook', color: 'text-brand-ink-600 dark:text-brand-ink-400' },
    { icon: Twitter, url: settings.socialMedia?.twitter, label: 'Twitter', color: 'text-sky-500 dark:text-sky-400' },
    { icon: Instagram, url: settings.socialMedia?.instagram, label: 'Instagram', color: 'text-pink-600 dark:text-pink-400' },
    { icon: Linkedin, url: settings.socialMedia?.linkedin, label: 'LinkedIn', color: 'text-brand-ink-700 dark:text-brand-ink-300' }
  ].filter(social => social.url);

  // Determine layout based on number of children
  const hasSingleChild = familyMembers.length === 1;
  const hasMultipleChildren = familyMembers.length > 1;

  // Handle avatar click animation
  const handleAvatarClick = (pupilId: string) => {
    if (isAnimating) return; // Prevent multiple clicks during animation
    
    setIsAnimating(true);
    setClickedAvatar(pupilId);
    
    // After animation completes, trigger view change
    setTimeout(() => {
      // Trigger a custom event to change the view in ParentLayout
      const event = new CustomEvent('changePupilAndView', {
        detail: { pupilId, view: 'dashboard' }
      });
      window.dispatchEvent(event);
      
      // Reset animation state after navigation
      setTimeout(() => {
        setClickedAvatar(null);
        setIsAnimating(false);
      }, 100);
    }, 1200); // Increased duration for smoother transition
  };



  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 md:space-y-8">
      {/* Enhanced Hero Section with Pupils' Photos */}
      <AnimatedDiv
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center py-4 md:py-6 bg-gradient-to-br from-brand-surface-50 to-brand-alt-surface-100 dark:from-brand-surface-900/20 dark:to-brand-alt-surface-900/20 rounded-xl"
      >
        {/* Logo and Pupils Photos Layout */}
        <div className="flex justify-center items-center mb-2 md:mb-3 gap-4 md:gap-6">
          {/* Single Child Layout: Logo and child photo side by side in center */}
          {hasSingleChild && (
            <>
              {/* School Logo */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="relative w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden shadow-lg"
              >
                {settings.generalInfo.logo ? (
                  <Image
                    src={settings.generalInfo.logo}
                    alt={`${settings.generalInfo.name} Logo`}
                    fill
                    className="object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-brand-surface-500 to-brand-alt-surface-600 flex items-center justify-center shadow-lg">
                    <School className="h-6 w-6 md:h-8 md:w-8 text-white" />
                  </div>
                )}
              </motion.div>

              {/* Single Child Photo */}
              <motion.div
                ref={(el) => setAvatarRefs(prev => ({ ...prev, [familyMembers[0].id]: el }))}
                initial={{ opacity: 0, scale: 0.8, x: 20 }}
                animate={{ 
                  opacity: clickedAvatar === familyMembers[0].id ? 0 : 1, 
                  scale: clickedAvatar === familyMembers[0].id ? 1.2 : 1, 
                  x: clickedAvatar === familyMembers[0].id ? 0 : 0,
                  y: clickedAvatar === familyMembers[0].id ? 0 : 0,
                  rotate: clickedAvatar === familyMembers[0].id ? 360 : 0
                }}
                transition={{ 
                  delay: clickedAvatar === familyMembers[0].id ? 0 : 0.3, 
                  duration: clickedAvatar === familyMembers[0].id ? 1.2 : 0.5,
                  ease: clickedAvatar === familyMembers[0].id ? "easeInOut" : "easeOut"
                }}
                className="relative cursor-pointer hover:scale-105 transition-transform duration-200"
                onClick={() => handleAvatarClick(familyMembers[0].id)}
                style={{ pointerEvents: isAnimating ? 'none' : 'auto' }}
              >
                <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2 border-white shadow-lg dark:border-slate-700">
                  {familyMembers[0].photo && familyMembers[0].photo.trim() !== '' ? (
                    <AvatarImage 
                      src={familyMembers[0].photo} 
                      alt={`${formatPupilDisplayName(familyMembers[0])}`}
                      onError={(e) => {
                        console.log('Avatar image failed to load:', familyMembers[0].photo);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <AvatarFallback className="text-sm md:text-base bg-gradient-to-br from-brand-surface-500 to-brand-secondary-surface-600 text-white font-semibold">
                    {familyMembers[0].firstName?.charAt(0)}{familyMembers[0].lastName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
            </>
          )}

          {/* Multiple Children Layout: Children photos on both sides with logo in center (bigger) */}
          {hasMultipleChildren && (
            <>
              {/* Left side - First half of children */}
              <div className="flex items-center gap-2 md:gap-3">
                {familyMembers.slice(0, Math.ceil(familyMembers.length / 2)).map((pupil, index) => (
                  <motion.div
                    key={pupil.id}
                    ref={(el) => setAvatarRefs(prev => ({ ...prev, [pupil.id]: el }))}
                    initial={{ opacity: 0, scale: 0.8, x: -20 }}
                    animate={{ 
                      opacity: clickedAvatar === pupil.id ? 0 : 1, 
                      scale: clickedAvatar === pupil.id ? 1.2 : 1, 
                      x: clickedAvatar === pupil.id ? 0 : 0,
                      y: clickedAvatar === pupil.id ? 0 : 0,
                      rotate: clickedAvatar === pupil.id ? 360 : 0
                    }}
                    transition={{ 
                      delay: clickedAvatar === pupil.id ? 0 : 0.1 * index, 
                      duration: clickedAvatar === pupil.id ? 1.2 : 0.5,
                      ease: clickedAvatar === pupil.id ? "easeInOut" : "easeOut"
                    }}
                    className="relative cursor-pointer hover:scale-105 transition-transform duration-200"
                    onClick={() => handleAvatarClick(pupil.id)}
                    style={{ pointerEvents: isAnimating ? 'none' : 'auto' }}
                  >
                    <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2 border-white shadow-lg dark:border-slate-700">
                      {pupil.photo && pupil.photo.trim() !== '' ? (
                        <AvatarImage 
                          src={pupil.photo} 
                          alt={`${formatPupilDisplayName(pupil)}`}
                          onError={(e) => {
                            console.log('Avatar image failed to load:', pupil.photo);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                      <AvatarFallback className="text-sm md:text-base bg-gradient-to-br from-brand-surface-500 to-brand-secondary-surface-600 text-white font-semibold">
                        {pupil.firstName?.charAt(0)}{pupil.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                ))}
              </div>

              {/* Center - School Logo (bigger for multiple children) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden shadow-lg"
              >
                {settings.generalInfo.logo ? (
                  <Image
                    src={settings.generalInfo.logo}
                    alt={`${settings.generalInfo.name} Logo`}
                    fill
                    className="object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-brand-surface-500 to-brand-alt-surface-600 flex items-center justify-center shadow-lg">
                    <School className="h-8 w-8 md:h-10 md:w-10 text-white" />
                  </div>
                )}
              </motion.div>

              {/* Right side - Second half of children */}
              <div className="flex items-center gap-2 md:gap-3">
                {familyMembers.slice(Math.ceil(familyMembers.length / 2)).map((pupil, index) => (
                  <motion.div
                    key={pupil.id}
                    ref={(el) => setAvatarRefs(prev => ({ ...prev, [pupil.id]: el }))}
                    initial={{ opacity: 0, scale: 0.8, x: 20 }}
                    animate={{ 
                      opacity: clickedAvatar === pupil.id ? 0 : 1, 
                      scale: clickedAvatar === pupil.id ? 1.2 : 1, 
                      x: clickedAvatar === pupil.id ? 0 : 0,
                      y: clickedAvatar === pupil.id ? 0 : 0,
                      rotate: clickedAvatar === pupil.id ? 360 : 0
                    }}
                    transition={{ 
                      delay: clickedAvatar === pupil.id ? 0 : 0.1 * index, 
                      duration: clickedAvatar === pupil.id ? 1.2 : 0.5,
                      ease: clickedAvatar === pupil.id ? "easeInOut" : "easeOut"
                    }}
                    className="relative cursor-pointer hover:scale-105 transition-transform duration-200"
                    onClick={() => handleAvatarClick(pupil.id)}
                    style={{ pointerEvents: isAnimating ? 'none' : 'auto' }}
                  >
                    <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2 border-white shadow-lg dark:border-slate-700">
                      {pupil.photo && pupil.photo.trim() !== '' ? (
                        <AvatarImage 
                          src={pupil.photo} 
                          alt={`${formatPupilDisplayName(pupil)}`}
                          onError={(e) => {
                            console.log('Avatar image failed to load:', pupil.photo);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                      <AvatarFallback className="text-sm md:text-base bg-gradient-to-br from-brand-surface-500 to-brand-secondary-surface-600 text-white font-semibold">
                        {pupil.firstName?.charAt(0)}{pupil.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-2"
        >
          {settings.generalInfo.name || "Trinity Family School"}
        </motion.h1>
        
        {settings.generalInfo.motto && (
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-sm md:text-base text-gray-600 dark:text-gray-400 italic font-medium"
          >
            "{settings.generalInfo.motto}"
          </motion.p>
        )}

        {/* Children names display */}
        {familyMembers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-3"
          >
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              {hasSingleChild ? (
                `Welcome, ${formatPupilDisplayName(familyMembers[0])}`
              ) : (
                `Welcome, ${familyMembers.map(pupil => `${formatPupilDisplayName(pupil)}`).join(' & ')}`
              )}
            </p>
            

          </motion.div>
        )}
      </AnimatedDiv>

      {/* Photo Slideshow */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.6 }}
      >
        <PhotoSlideshow photos={photos || []} />
      </motion.div>

      {/* Academic Progress Tile */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
      >
        <AcademicProgressTile />
      </motion.div>

      {/* Vision, Mission, Values */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6"
      >
        {settings.visionMissionValues.vision && (
          <AnimatedCard variants={itemVariants} className="group hover:shadow-lg transition-all duration-300">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-12 h-12 bg-gradient-to-br from-brand-secondary-surface-500 to-pink-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Target className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl text-brand-secondary-ink-700 dark:text-brand-secondary-ink-300">Our Vision</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 text-center leading-relaxed">
                {settings.visionMissionValues.vision}
              </p>
            </CardContent>
          </AnimatedCard>
        )}

        {settings.visionMissionValues.mission && (
          <AnimatedCard variants={itemVariants} className="group hover:shadow-lg transition-all duration-300">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-12 h-12 bg-gradient-to-br from-brand-surface-500 to-cyan-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Heart className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl text-brand-ink-700 dark:text-brand-ink-300">Our Mission</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 text-center leading-relaxed">
                {settings.visionMissionValues.mission}
              </p>
            </CardContent>
          </AnimatedCard>
        )}

        {settings.visionMissionValues.coreValues && (
          <AnimatedCard variants={itemVariants} className="group hover:shadow-lg transition-all duration-300">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Star className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl text-green-700 dark:text-green-300">Our Values</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 text-center leading-relaxed">
                {settings.visionMissionValues.coreValues}
              </p>
            </CardContent>
          </AnimatedCard>
        )}
      </motion.div>

      {/* School Description & Contact Information */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* School Description */}
        {settings.visionMissionValues.description && (
          <AnimatedCard variants={itemVariants} className="bg-gradient-to-r from-brand-surface-50 to-brand-alt-surface-50 dark:from-brand-surface-900/10 dark:to-brand-alt-surface-900/10 hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-xl flex items-center justify-center">
                <BookOpen className="h-5 w-5 mr-3 text-brand-ink-600 dark:text-brand-ink-400" />
                About Our School
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed">
                {settings.visionMissionValues.description}
              </p>
            </CardContent>
          </AnimatedCard>
        )}

        {/* Contact Information */}
        <AnimatedCard variants={itemVariants} className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <Phone className="h-5 w-5 mr-3 text-brand-ink-600 dark:text-brand-ink-400" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings.contact.phone && (
              <div className="flex items-center space-x-3">
                <Phone className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                <span className="text-gray-700 dark:text-gray-300">{settings.contact.phone}</span>
              </div>
            )}
            {settings.contact.alternativePhone && (
              <div className="flex items-center space-x-3">
                <Phone className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                <span className="text-gray-700 dark:text-gray-300">{settings.contact.alternativePhone}</span>
              </div>
            )}
            {settings.contact.email && (
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                <span className="text-gray-700 dark:text-gray-300">{settings.contact.email}</span>
              </div>
            )}
            {settings.contact.website && (
              <div className="flex items-center space-x-3">
                <Globe className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                <a 
                  href={settings.contact.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-brand-ink-600 hover:text-brand-ink-800 dark:text-brand-ink-400 dark:hover:text-brand-ink-300 transition-colors"
                >
                  {settings.contact.website}
                </a>
              </div>
            )}
            {(settings.address.physical || settings.address.postal) && (
              <div className="pt-4 border-t">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-gray-500 dark:text-slate-400" />
                  Address
                </h4>
                {settings.address.physical && (
                  <p className="text-gray-700 dark:text-gray-300 text-sm mb-1">
                    <strong>Physical:</strong> {settings.address.physical}
                  </p>
                )}
                {settings.address.postal && (
                  <p className="text-gray-700 dark:text-gray-300 text-sm mb-1">
                    <strong>Postal:</strong> {settings.address.postal}
                  </p>
                )}
                {settings.address.city && (
                  <p className="text-gray-700 dark:text-gray-300 text-sm">
                    <strong>City:</strong> {settings.address.city}, {settings.address.country}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </AnimatedCard>
      </motion.div>
    </div>
  );
}
