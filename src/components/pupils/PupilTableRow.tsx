import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import React from 'react';
import Link from 'next/link';
import { PencilSimple, Trash, Power, DotsThree } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Pupil, Class } from '@/types';
import { getPupilClassDisplay } from '@/lib/utils/class-streams';
import { getPupilRowTheme } from './pupil-row-theme';

interface PupilTableRowProps {
  pupil: Pupil;
  classes: Class[];
  isLoading?: boolean;
  onDelete: (pupilId: string, pupilName: string) => void;
  onStatusChange: (pupil: Pupil) => void;
  onClassChange: (pupil: Pupil) => void;
  calculateAge: (dateOfBirth: string) => string;
  getClassName: (classId: string | undefined) => string;
  getSiblings: (pupil: Pupil) => Pupil[];
  getPupilHouse: (pupil: Pupil) => any;
}

export function PupilTableRow({
  pupil,
  classes,
  isLoading = false,
  onDelete,
  onStatusChange,
  onClassChange,
  calculateAge,
  getClassName,
  getSiblings,
  getPupilHouse
}: PupilTableRowProps) {
  const pupilHouse = getPupilHouse(pupil);
  const siblings = getSiblings(pupil);
  const classDisplay = getPupilClassDisplay(pupil, classes.find(schoolClass => schoolClass.id === pupil.classId));

  if (isLoading) {
    return (
      <tr className="hover:bg-gray-50 transition-colors animate-pulse dark:hover:bg-slate-900">
        <td className="px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gray-200 flex-shrink-0 dark:bg-slate-800" />
            <div className="min-w-0 flex-1">
              <div className="h-4 bg-gray-200 rounded w-32 mb-1 dark:bg-slate-800" />
              <div className="h-3 bg-gray-200 rounded w-24 dark:bg-slate-800" />
            </div>
          </div>
        </td>
        <td className="hidden sm:table-cell px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-16 dark:bg-slate-800" />
        </td>
        <td className="hidden md:table-cell px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-20 dark:bg-slate-800" />
        </td>
        <td className="px-2 sm:px-4 py-2 sm:py-3">
          <div className="h-4 bg-gray-200 rounded w-24 dark:bg-slate-800" />
        </td>
        <td className="hidden md:table-cell px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-16 dark:bg-slate-800" />
        </td>
        <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
          <div className="h-8 w-8 bg-gray-200 rounded ml-auto dark:bg-slate-800" />
        </td>
      </tr>
    );
  }

  return (
    <tr key={pupil.id} className={getPupilRowTheme(pupil.gender).row}>
      <td className="px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="relative flex-shrink-0">
            <Link 
              href={`/pupil-detail?id=${pupil.id}`}
              className={`block h-8 w-8 sm:h-10 sm:w-10 rounded-full overflow-hidden border-2 transition-all flex-shrink-0`}
              style={{ borderColor: pupilHouse?.themeColor || '#e5e7eb' }}
            >
              {pupil.photo ? (
                <img 
                  src={pupil.photo} 
                  alt={`${formatPupilDisplayName(pupil)}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xs sm:text-sm font-medium" style={{ color: pupilHouse?.themeColor || '#6366f1' }}>
                  {pupil.firstName[0]}
                  {pupil.lastName[0]}
                </div>
              )}
            </Link>
          </div>
          <div className="min-w-0 flex-1">
            <Link 
              href={`/pupil-detail?id=${pupil.id}`}
              className={`text-xs sm:text-sm font-medium ${getPupilRowTheme(pupil.gender).name} transition-colors block truncate`}
            >
              {formatPupilDisplayName(pupil)}
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs text-gray-500 dark:text-slate-400">
              <span className="truncate">{pupil.learnerIdentificationNumber || pupil.admissionNumber}</span>
              <span className="hidden sm:inline">•</span>
              <div className="flex items-center gap-2">
                <span>{pupil.gender}</span>
                {pupil.dateOfBirth && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="text-xs">{calculateAge(pupil.dateOfBirth)} years</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </td>
      <td className="hidden sm:table-cell px-4 py-3">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          pupil.status === 'Active' 
            ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200'
            : pupil.status === 'Inactive'
            ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200'
            : pupil.status === 'Graduated'
            ? 'bg-brand-surface-100 text-brand-ink-800 dark:bg-brand-surface-950/40 dark:text-brand-ink-200'
            : 'bg-gray-100 text-gray-800 dark:bg-slate-900 dark:text-slate-100'
        }`}>
          {pupil.status}
        </span>
      </td>
      <td className="hidden md:table-cell px-4 py-3">
        {pupilHouse ? (
          <span className="text-sm text-gray-900 dark:text-slate-100">{pupilHouse.name}</span>
        ) : (
          <span className="text-sm text-gray-400 dark:text-slate-400">No House</span>
        )}
      </td>
      <td className="px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-slate-100">
            {classDisplay.name || getClassName(pupil.classId)}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            pupil.section === 'Boarding' 
              ? 'bg-brand-secondary-surface-100 text-brand-secondary-ink-700 dark:bg-brand-secondary-surface-950/40 dark:text-brand-secondary-ink-300'
              : 'bg-brand-surface-100 text-brand-ink-700 dark:bg-brand-surface-950/40 dark:text-brand-ink-300'
          }`}>
            {pupil.section === 'Boarding' ? 'Boarding' : 'Day'}
          </span>
        </div>
      </td>
      <td className="hidden md:table-cell px-4 py-3">
        <div className="text-sm text-gray-900 dark:text-slate-100">
          {siblings.length > 0 ? (
            <span className="text-brand-alt-ink-600 font-medium dark:text-brand-alt-ink-400">
              {siblings.length} sibling{siblings.length !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-gray-400 dark:text-slate-400">No siblings</span>
          )}
        </div>
      </td>
      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <DotsThree className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/pupil-detail?id=${pupil.id}`}>
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/pupils/edit?id=${pupil.id}`}>
                <PencilSimple className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onStatusChange(pupil)}>
              <Power className="mr-2 h-4 w-4" />
              Change Status
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onClassChange(pupil)}>
              <PencilSimple className="mr-2 h-4 w-4" />
              Change Class
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(pupil.id, `${formatPupilDisplayName(pupil)}`)}
              className="text-red-600 dark:text-red-400"
            >
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
