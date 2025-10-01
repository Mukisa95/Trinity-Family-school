"use client";

import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { Search, User, Filter, X } from 'lucide-react';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useClasses } from '@/lib/hooks/use-classes';
import type { Pupil } from '@/types';

interface FilteredPupilSelectorProps {
  onSelect: (pupil: Pupil | null) => void;
  selectedPupilId?: string;
  availablePupils: Pupil[]; // Pupils that don't have parent accounts yet
}

interface PupilFilters {
  searchTerm: string;
  classId: string | undefined;
  gender: string | undefined;
  section: string | undefined;
}

export function FilteredPupilSelector({ onSelect, selectedPupilId, availablePupils }: FilteredPupilSelectorProps) {
  const [filters, setFilters] = useState<PupilFilters>({
    searchTerm: '',
    classId: undefined,
    gender: undefined,
    section: undefined,
  });

  // Fetch classes for filtering
  const { data: classes = [] } = useClasses();

  // Apply filters to available pupils
  const filteredPupils = useMemo(() => {
    let result = availablePupils;

    // Search filter
    if (filters.searchTerm.trim()) {
      const searchLower = filters.searchTerm.toLowerCase();
      result = result.filter(pupil => {
        const fullName = `${pupil.firstName} ${pupil.lastName} ${pupil.otherNames || ''}`.toLowerCase();
        return (
          fullName.includes(searchLower) ||
          pupil.admissionNumber.toLowerCase().includes(searchLower) ||
          pupil.className?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Class filter
    if (filters.classId) {
      result = result.filter(pupil => pupil.classId === filters.classId);
    }

    // Gender filter
    if (filters.gender) {
      result = result.filter(pupil => pupil.gender === filters.gender);
    }

    // Section filter
    if (filters.section) {
      result = result.filter(pupil => pupil.section === filters.section);
    }

    return result;
  }, [availablePupils, filters]);

  const handlePupilSelect = (pupil: Pupil) => {
    onSelect(pupil);
  };

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      classId: undefined,
      gender: undefined,
      section: undefined,
    });
  };

  const hasActiveFilters = filters.searchTerm || filters.classId || filters.gender || filters.section;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Select Pupil for Parent Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search by name, admission number, or class..."
            value={filters.searchTerm}
            onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
            className="pl-10"
          />
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Class Filter */}
          <div>
            <select 
              value={filters.classId || ""} 
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                classId: e.target.value === "" ? undefined : e.target.value 
              }))}
              className="w-full px-3 py-2 border border-input bg-background text-sm ring-offset-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All Classes</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          {/* Gender Filter */}
          <div>
            <select 
              value={filters.gender || ""} 
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                gender: e.target.value === "" ? undefined : e.target.value 
              }))}
              className="w-full px-3 py-2 border border-input bg-background text-sm ring-offset-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          {/* Section Filter */}
          <div>
            <select 
              value={filters.section || ""} 
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                section: e.target.value === "" ? undefined : e.target.value 
              }))}
              className="w-full px-3 py-2 border border-input bg-background text-sm ring-offset-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All Sections</option>
              <option value="Day">Day</option>
              <option value="Boarding">Boarding</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          <div>
            <Button 
              variant="outline" 
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        {/* Active Filters Badge */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Filters applied:</span>
            {filters.classId && (
              <Badge variant="secondary">
                Class: {classes.find(c => c.id === filters.classId)?.name}
              </Badge>
            )}
            {filters.gender && <Badge variant="secondary">Gender: {filters.gender}</Badge>}
            {filters.section && <Badge variant="secondary">Section: {filters.section}</Badge>}
          </div>
        )}

        {/* Results Count */}
        <div className="text-sm text-gray-600">
          {filteredPupils.length} pupil{filteredPupils.length !== 1 ? 's' : ''} found
        </div>

        {/* Pupils List */}
        <div className="grid gap-3 max-h-96 overflow-y-auto">
          {filteredPupils.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <User className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No pupils found matching your criteria.</p>
              {hasActiveFilters && (
                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  className="mt-2"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            filteredPupils.map((pupil) => (
              <Card
                key={pupil.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedPupilId === pupil.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                }`}
                onClick={() => handlePupilSelect(pupil)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    {pupil.photo ? (
                      <img
                        src={pupil.photo}
                        alt={`${pupil.firstName} ${pupil.lastName}`}
                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg font-semibold text-gray-600">
                        {pupil.firstName[0]}
                      </div>
                    )}

                    {/* Pupil Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {pupil.firstName} {pupil.lastName} {pupil.otherNames || ''}
                        </h3>
                        <Badge variant={pupil.status === 'Active' ? 'default' : 'secondary'}>
                          {pupil.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <span>ID: {pupil.admissionNumber}</span>
                        {pupil.className && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span>Class: {pupil.className}</span>
                          </>
                        )}
                        <span className="text-gray-300">•</span>
                        <span>{pupil.gender}</span>
                        <span className="text-gray-300">•</span>
                        <span>{pupil.section}</span>
                      </div>
                    </div>

                    {/* Selection Indicator */}
                    {selectedPupilId === pupil.id && (
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
} 