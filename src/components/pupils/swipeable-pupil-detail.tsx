"use client";

import React, { useState, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Navigation, Keyboard } from 'swiper/modules';
import { ChevronLeft, ChevronRight, UserSquare, Receipt, Shirt, BookOpen, BarChart3, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

interface SwipeablePupilDetailProps {
  pupil: any;
  children: React.ReactNode;
  onSectionChange?: (sectionIndex: number) => void;
}

const sections = [
  {
    id: 'information',
    title: 'Information',
    icon: Info,
    color: 'text-brand-ink-600 dark:text-brand-ink-400',
    bgColor: 'bg-brand-surface-50 dark:bg-brand-surface-950/40',
    borderColor: 'border-brand-200 dark:border-brand-800/60'
  },
  {
    id: 'fees',
    title: 'Fees',
    icon: Receipt,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/40',
    borderColor: 'border-green-200 dark:border-green-800/60'
  },
  {
    id: 'requirements',
    title: 'Requirements',
    icon: Shirt,
    color: 'text-brand-secondary-ink-600 dark:text-brand-secondary-ink-400',
    bgColor: 'bg-brand-secondary-surface-50 dark:bg-brand-secondary-surface-950/40',
    borderColor: 'border-brand-secondary-200 dark:border-brand-secondary-800/60'
  },
  {
    id: 'attendance',
    title: 'Attendance',
    icon: BarChart3,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/40',
    borderColor: 'border-orange-200 dark:border-orange-800/60'
  },
  {
    id: 'results',
    title: 'Results',
    icon: BookOpen,
    color: 'text-brand-alt-ink-600 dark:text-brand-alt-ink-400',
    bgColor: 'bg-brand-alt-surface-50 dark:bg-brand-alt-surface-950/40',
    borderColor: 'border-brand-alt-200 dark:border-brand-alt-800/60'
  }
];

export function SwipeablePupilDetail({ pupil, children, onSectionChange }: SwipeablePupilDetailProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const swiperRef = useRef<any>(null);

  const handleSlideChange = (swiper: any) => {
    setActiveIndex(swiper.activeIndex);
    onSectionChange?.(swiper.activeIndex);
  };

  const goToSlide = (index: number) => {
    if (swiperRef.current) {
      swiperRef.current.slideTo(index);
    }
  };

  return (
    <div className="w-full">
      {/* Section Navigation */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Pupil Details</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToSlide(activeIndex - 1)}
              disabled={activeIndex === 0}
              className="p-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToSlide(activeIndex + 1)}
              disabled={activeIndex === sections.length - 1}
              className="p-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Section Indicators */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => goToSlide(index)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  activeIndex === index
                    ? `${section.bgColor} ${section.borderColor} border-2 ${section.color}`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{section.title}</span>
                {activeIndex === index && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {index + 1}/{sections.length}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-slate-800">
          <div
            className="bg-gradient-to-r from-brand-surface-500 to-brand-secondary-surface-500 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${((activeIndex + 1) / sections.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Swipeable Content */}
      <div className="relative">
        <Swiper
          ref={swiperRef}
          modules={[Pagination, Navigation, Keyboard]}
          spaceBetween={30}
          slidesPerView={1}
          onSlideChange={handleSlideChange}
          keyboard={{ enabled: true }}
          pagination={{
            clickable: true,
            dynamicBullets: true,
          }}
          navigation={false}
          className="pupil-detail-swiper"
          style={{ paddingBottom: '60px' }}
        >
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <SwiperSlide key={section.id}>
                <Card className={`shadow-lg border-2 ${section.borderColor} ${section.bgColor} min-h-[600px]`}>
                  <CardHeader className={`${section.bgColor} border-b ${section.borderColor}`}>
                    <CardTitle className={`flex items-center text-xl ${section.color}`}>
                      <Icon className="mr-3 h-6 w-6" />
                      {section.title}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1 dark:text-slate-300">
                      Swipe left or right to navigate between sections
                    </p>
                  </CardHeader>
                  <CardContent className="p-6">
                    {/* Content will be passed as children and rendered based on section */}
                    <div className="section-content" data-section={section.id}>
                      {children}
                    </div>
                  </CardContent>
                </Card>
              </SwiperSlide>
            );
          })}
        </Swiper>

        {/* Swipe Instructions */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            💡 <strong>Touch Tip:</strong> Swipe left or right to navigate between sections
          </p>
        </div>
      </div>

      {/* Custom CSS for Swiper */}
      <style jsx global>{`
        .pupil-detail-swiper .swiper-pagination {
          bottom: 20px;
        }
        
        .pupil-detail-swiper .swiper-pagination-bullet {
          background: #6b7280;
          opacity: 0.5;
        }
        
        .pupil-detail-swiper .swiper-pagination-bullet-active {
          background: rgb(var(--brand-surface-500));
          opacity: 1;
        }
        
        .pupil-detail-swiper .swiper-slide {
          height: auto;
        }
      `}</style>
    </div>
  );
}
