"use client";

import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, User } from 'lucide-react';
import { usePupils } from '@/lib/hooks/use-pupils';
import type { Pupil } from '@/types';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';

interface PupilSelectorProps {
  onSelect: (pupil: Pupil | null) => void;
  selectedPupilId?: string;
}

export default function PupilSelector({ onSelect, selectedPupilId }: PupilSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch pupils using React Query
  const { data: pupils = [], isLoading: loading, error } = usePupils();

  // Filter pupils based on search term
  const filteredPupils = useMemo(() => {
    if (!searchTerm.trim()) {
      return pupils;
    }

    return pupils.filter(pupil => {
      const fullName = formatPupilDisplayName(pupil).toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      
      return (
        fullName.includes(searchLower) ||
        pupil.admissionNumber.toLowerCase().includes(searchLower) ||
        pupil.className?.toLowerCase().includes(searchLower)
      );
    });
  }, [pupils, searchTerm]);

  const handlePupilSelect = (pupil: Pupil) => {
    onSelect(pupil);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading pupils...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <div className="text-red-600 mb-4">Failed to load pupils</div>
        <Button onClick={() => window.location.reload()} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          placeholder="Search by name, admission number, or class..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        {filteredPupils.length} pupil{filteredPupils.length !== 1 ? 's' : ''} found
      </div>

      {/* Pupils List */}
      <div className="grid gap-3 max-h-96 overflow-y-auto">
        {filteredPupils.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <User className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No pupils found matching your search.</p>
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
                      alt={formatPupilDisplayName(pupil)}
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
                        {formatPupilDisplayName(pupil)}
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
    </div>
  );
} 