"use client"

import React from 'react';
import { EnhancedSkeleton, AvatarSkeleton, TextSkeleton } from '@/components/ui/enhanced-skeleton';

interface PupilTableRowSkeletonProps {
  count?: number;
}

export function PupilTableRowSkeleton({ count = 5 }: PupilTableRowSkeletonProps) {
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
          <td className="px-2 sm:px-4 py-2 sm:py-3">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="flex-shrink-0">
                <AvatarSkeleton 
                  width="2.5rem" 
                  height="2.5rem" 
                  delay={index * 0.05}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <TextSkeleton 
                  width={index % 2 === 0 ? "75%" : "85%"} 
                  height="0.875rem"
                  delay={index * 0.05 + 0.1}
                />
                <div className="space-y-1">
                  <TextSkeleton 
                    width="60%" 
                    height="0.75rem"
                    delay={index * 0.05 + 0.15}
                  />
                  <TextSkeleton 
                    width="40%" 
                    height="0.75rem"
                    delay={index * 0.05 + 0.2}
                  />
                </div>
              </div>
            </div>
          </td>
          <td className="hidden sm:table-cell px-4 py-3">
            <TextSkeleton 
              width="4rem" 
              height="1.25rem"
              delay={index * 0.05 + 0.25}
            />
          </td>
          <td className="hidden md:table-cell px-4 py-3">
            <TextSkeleton 
              width="5rem" 
              height="1rem"
              delay={index * 0.05 + 0.3}
            />
          </td>
          <td className="px-2 sm:px-4 py-2 sm:py-3">
            <div className="space-y-1">
              <TextSkeleton 
                width="3.5rem" 
                height="0.875rem"
                delay={index * 0.05 + 0.35}
              />
              <TextSkeleton 
                width="2.5rem" 
                height="0.875rem"
                delay={index * 0.05 + 0.4}
              />
            </div>
          </td>
          <td className="hidden md:table-cell px-4 py-3">
            <TextSkeleton 
              width="4rem" 
              height="1rem"
              delay={index * 0.05 + 0.45}
            />
          </td>
          <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
            <div className="flex justify-end">
              <EnhancedSkeleton 
                variant="button" 
                width="2rem" 
                height="2rem"
                delay={index * 0.05 + 0.5}
              />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

