'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClasses } from '@/lib/hooks/use-classes';
import { Loader2, Users } from 'lucide-react';
import type { Class } from '@/types';

interface ClassSelectorProps {
  selectedClassId: string;
  onClassChange: (classId: string) => void;
  placeholder?: string;
  includeAllOption?: boolean;
  allOptionLabel?: string;
  className?: string;
  disabled?: boolean;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ClassSelector({
  selectedClassId,
  onClassChange,
  placeholder = "Select a class",
  includeAllOption = true,
  allOptionLabel = "All Classes",
  className = "",
  disabled = false,
  showIcon = true,
  size = 'md'
}: ClassSelectorProps) {
  const { data: classes = [], isLoading, error } = useClasses();

  // Sort classes by order if available, otherwise by name
  const sortedClasses = React.useMemo(() => {
    return [...classes].sort((a, b) => {
      // If both have order, sort by order
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      // If only one has order, it comes first
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      // Otherwise sort by name
      return a.name.localeCompare(b.name);
    });
  }, [classes]);

  // Get size-specific styles
  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'h-7 text-xs px-2';
      case 'lg':
        return 'h-10 text-sm px-3';
      default:
        return 'h-8 text-xs px-2.5';
    }
  };

  // Get current selection info
  const selectedClass = sortedClasses.find(c => c.id === selectedClassId);
  const isAllSelected = includeAllOption && selectedClassId === 'all';

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-red-600 text-sm ${className}`}>
        <span>Error loading classes</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Select 
        value={selectedClassId} 
        onValueChange={onClassChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger className={`${getSizeStyles()} ${
          isLoading ? 'opacity-50' : ''
        } ${
          selectedClass || isAllSelected ? 'border-blue-200 bg-blue-50/50' : ''
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {showIcon && (
              <div className="flex-shrink-0">
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                ) : (
                  <Users className="w-3 h-3 text-blue-500" />
                )}
              </div>
            )}
            <SelectValue placeholder={placeholder}>
              {isAllSelected ? (
                <span className="text-blue-700 font-semibold text-xs">{allOptionLabel}</span>
              ) : selectedClass ? (
                <span className="text-blue-700 font-bold text-xs">
                  {selectedClass.code || selectedClass.name}
                </span>
              ) : (
                placeholder
              )}
            </SelectValue>
          </div>
        </SelectTrigger>
        
        <SelectContent className="max-h-64">
          {includeAllOption && (
            <SelectItem value="all" className="font-medium">
              <div className="flex items-center gap-2">
                <Users className="w-3 h-3 text-blue-500" />
                <span className="text-xs font-semibold">{allOptionLabel}</span>
                <span className="text-[10px] text-gray-500 bg-blue-50 px-1.5 py-0.5 rounded ml-auto">
                  {sortedClasses.length}
                </span>
              </div>
            </SelectItem>
          )}
          
          {sortedClasses.length > 0 ? (
            sortedClasses.map((classItem) => (
              <SelectItem key={classItem.id} value={classItem.id}>
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="text-blue-700 font-bold text-xs">
                    {classItem.code || classItem.name}
                  </span>
                  {classItem.pupilCount !== undefined && (
                    <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
                      {classItem.pupilCount}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))
          ) : (
            !isLoading && (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                No classes found
              </div>
            )
          )}
        </SelectContent>
      </Select>
      
      {/* Show loading indicator if needed */}
      {isLoading && (
        <div className="absolute right-7 top-1/2 transform -translate-y-1/2">
          <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
        </div>
      )}
    </div>
  );
}

// Utility hook to manage class selection state
export function useClassSelection(initialClassId: string = 'all') {
  const [selectedClassId, setSelectedClassId] = React.useState(initialClassId);
  
  const handleClassChange = React.useCallback((classId: string) => {
    setSelectedClassId(classId);
  }, []);

  const reset = React.useCallback(() => {
    setSelectedClassId('all');
  }, []);

  return {
    selectedClassId,
    handleClassChange,
    reset,
    isAllSelected: selectedClassId === 'all'
  };
}

export default ClassSelector;
