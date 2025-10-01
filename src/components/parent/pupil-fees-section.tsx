"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BookOpen } from 'lucide-react';
import { usePupil } from '@/lib/hooks/use-pupils';
import ParentFeesViewClient from './ParentFeesViewClient';

interface PupilFeesSectionProps {
  pupilId: string;
}

export function PupilFeesSection({ pupilId }: PupilFeesSectionProps) {
  const { data: pupil } = usePupil(pupilId);
  
  return (
    <>
      <div className="mb-4">
        <div className="flex items-center space-x-3">
          <Avatar className="h-12 w-12">
            {pupil?.photo && pupil.photo.trim() !== '' ? (
              <AvatarImage 
                src={pupil.photo} 
                alt={`${pupil.firstName} ${pupil.lastName}`}
                onError={(e) => {
                  console.log('Avatar image failed to load:', pupil.photo);
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            <AvatarFallback className="text-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
              {pupil?.firstName?.charAt(0)}{pupil?.lastName?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-lg md:text-xl font-semibold tracking-tight">
            Fees Information
          </h2>
        </div>
      </div>
      <div>
        <ParentFeesViewClient pupilId={pupilId} />
      </div>
    </>
  );
} 