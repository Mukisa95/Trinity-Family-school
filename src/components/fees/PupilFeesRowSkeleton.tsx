"use client"

import React from 'react';
import { EnhancedSkeleton, AvatarSkeleton, TextSkeleton } from '@/components/ui/enhanced-skeleton';

interface PupilFeesRowSkeletonProps {
  count?: number;
}

export function PupilFeesRowSkeleton({ count = 5 }: PupilFeesRowSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <tr 
          key={index} 
          className="animate-pulse"
          style={{ 
            animationDelay: `${index * 0.1}s`,
            animationDuration: '1.5s',
            opacity: 1
          }}
        >
          {/* Pupil Information */}
          <td className="px-6 py-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AvatarSkeleton 
                  width="2.5rem" 
                  height="2.5rem" 
                  delay={index * 0.05}
                />
              </div>
              <div className="ml-4 min-w-0 flex-1 space-y-2">
                <TextSkeleton 
                  width={index % 2 === 0 ? "75%" : "85%"} 
                  height="0.875rem"
                  delay={index * 0.05 + 0.1}
                />
                <div className="space-y-1">
                  <TextSkeleton 
                    width="40%" 
                    height="0.75rem"
                    delay={index * 0.05 + 0.15}
                  />
                </div>
              </div>
            </div>
          </td>

          {/* Class (Skeleton) */}
          <td className="px-6 py-4">
            <TextSkeleton 
              width="4rem" 
              height="0.875rem"
              delay={index * 0.05 + 0.2}
            />
          </td>

          {/* Section (Skeleton) */}
          <td className="px-6 py-4">
            <TextSkeleton 
              width="5rem" 
              height="0.875rem"
              delay={index * 0.05 + 0.2}
            />
          </td>

          {/* Total Fees */}
          <td className="px-6 py-4">
            <div className="space-y-1">
              <TextSkeleton 
                width="4rem" 
                height="0.875rem"
                delay={index * 0.05 + 0.25}
              />
              <TextSkeleton 
                width="3rem" 
                height="0.75rem"
                delay={index * 0.05 + 0.3}
              />
            </div>
          </td>

          {/* Total Paid */}
          <td className="px-6 py-4">
            <TextSkeleton 
              width="4rem" 
              height="0.875rem"
              delay={index * 0.05 + 0.35}
            />
          </td>

          {/* Balance */}
          <td className="px-6 py-4">
            <div className="space-y-1">
              <TextSkeleton 
                width="4rem" 
                height="0.875rem"
                delay={index * 0.05 + 0.4}
              />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}























