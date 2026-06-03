"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Calendar, MapPin } from 'lucide-react';
import { formatDateForDisplay } from "@/lib/utils/date-utils";
import type { Pupil } from '@/types';

interface PupilInfoSectionProps {
  pupil: Pupil;
}

export function PupilInfoSection({ pupil }: PupilInfoSectionProps) {
  return (
    <>
      <div className="pb-4">
        <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
          <Avatar className="h-20 w-20 md:h-24 md:w-24">
            {pupil.photo && pupil.photo.trim() !== '' ? (
              <AvatarImage 
                src={pupil.photo} 
                alt={`${pupil.firstName} ${pupil.lastName}`}
                onError={(e) => {
                  console.log('Avatar image failed to load:', pupil.photo);
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            <AvatarFallback className="text-xl md:text-2xl">
              {pupil.firstName?.charAt(0)}{pupil.lastName?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="text-center sm:text-left">
            <h2 className="text-xl md:text-2xl mb-2 font-semibold tracking-tight">
              {pupil.firstName} {pupil.lastName} {pupil.otherNames}
            </h2>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              <Badge variant="secondary" className="text-xs">
                <User className="w-3 h-3 mr-1" />
                {pupil.className || 'Class not assigned'}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Admission: {pupil.admissionNumber}
              </Badge>
              <Badge variant={pupil.status === 'Active' ? 'default' : 'secondary'} className="text-xs">
                {pupil.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-base md:text-lg font-semibold mb-3 flex items-center">
              <User className="w-4 h-4 md:w-5 md:h-5 mr-2" />
              Personal Information
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Gender:</span>
                <span className="font-medium">{pupil.gender || 'Not specified'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Date of Birth:</span>
                <span className="font-medium">
                  {formatDateForDisplay(pupil.dateOfBirth)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Nationality:</span>
                <span className="font-medium">{pupil.nationality || 'Not specified'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Religion:</span>
                <span className="font-medium">{pupil.religion || 'Not specified'}</span>
              </div>
            </div>
          </div>

          {/* School Information */}
          <div className="space-y-4">
            <h3 className="text-base md:text-lg font-semibold mb-3 flex items-center">
              <Calendar className="w-4 h-4 md:w-5 md:h-5 mr-2" />
              School Information
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Registration Date:</span>
                <span className="font-medium">
                  {formatDateForDisplay(pupil.registrationDate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Section:</span>
                <span className="font-medium">{pupil.section || 'Not specified'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Previous School:</span>
                <span className="font-medium">{pupil.previousSchool || 'Not specified'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Address */}
        {pupil.address && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              Address
            </h3>
            <p className="text-gray-600 dark:text-gray-400">{pupil.address}</p>
          </div>
        )}
      </div>
    </>
  );
} 