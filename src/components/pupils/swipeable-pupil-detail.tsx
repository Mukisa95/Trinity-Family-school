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
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  {
    id: 'fees',
    title: 'Fees',
    icon: Receipt,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  {
    id: 'requirements',
    title: 'Requirements',
    icon: Shirt,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200'
  },
  {
    id: 'attendance',
    title: 'Attendance',
    icon: BarChart3,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },
  {
    id: 'results',
    title: 'Results',
    icon: BookOpen,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200'
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
          <h2 className="text-2xl font-bold text-gray-900">Pupil Details</h2>
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
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300 ease-out"
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
                    <p className="text-sm text-gray-600 mt-1">
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
          <p className="text-sm text-gray-500">
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
          background: #3b82f6;
          opacity: 1;
        }
        
        .pupil-detail-swiper .swiper-slide {
          height: auto;
        }
      `}</style>
    </div>
  );
}
