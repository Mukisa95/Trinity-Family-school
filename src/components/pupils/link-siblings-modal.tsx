'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Users, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PupilsService } from '@/lib/services/pupils.service';
import type { Pupil } from '@/types';

interface LinkSiblingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourcePupil: Pupil;
  onSuccess: () => void;
}

export function LinkSiblingsModal({
  isOpen,
  onClose,
  sourcePupil,
  onSuccess
}: LinkSiblingsModalProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [allPupils, setAllPupils] = useState<Pupil[]>([]);
  const [selectedPupilIds, setSelectedPupilIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  // Load all pupils when modal opens
  useEffect(() => {
    if (isOpen) {
      loadPupils();
    }
  }, [isOpen]);

  const loadPupils = async () => {
    try {
      setIsLoading(true);
      const pupils = await PupilsService.getAllPupils();
      // Exclude the source pupil and any pupils that are already siblings
      const existingSiblings = sourcePupil.familyId 
        ? await PupilsService.getPupilsByFamily(sourcePupil.familyId)
        : [];
      const existingSiblingIds = existingSiblings.map(s => s.id);
      
      const availablePupils = pupils.filter(p => 
        p.id !== sourcePupil.id && 
        !existingSiblingIds.includes(p.id) &&
        p.status === 'Active'
      );
      
      setAllPupils(availablePupils);
    } catch (error) {
      console.error('Error loading pupils:', error);
      toast({
        title: "Error",
        description: "Failed to load pupils. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter pupils based on search term
  const filteredPupils = allPupils.filter(pupil => {
    const searchLower = searchTerm.toLowerCase();
    return (
      pupil.firstName.toLowerCase().includes(searchLower) ||
      pupil.lastName.toLowerCase().includes(searchLower) ||
      (pupil.otherNames && pupil.otherNames.toLowerCase().includes(searchLower)) ||
      pupil.admissionNumber.toLowerCase().includes(searchLower) ||
      (pupil.className && pupil.className.toLowerCase().includes(searchLower))
    );
  });

  const handlePupilSelect = (pupilId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedPupilIds(prev => [...prev, pupilId]);
    } else {
      setSelectedPupilIds(prev => prev.filter(id => id !== pupilId));
    }
  };

  const handleLinkSiblings = async () => {
    if (selectedPupilIds.length === 0) {
      toast({
        title: "No pupils selected",
        description: "Please select at least one pupil to link as a sibling.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLinking(true);

      // Get all pupils that will be linked (source + selected)
      const allPupilIds = [sourcePupil.id, ...selectedPupilIds];
      const allPupils = await Promise.all(
        allPupilIds.map(id => PupilsService.getPupilById(id))
      );

      // Filter out any null results
      const validPupils = allPupils.filter(p => p !== null) as Pupil[];

      // Collect all existing family IDs and their members
      const existingFamilyIds = validPupils
        .map(p => p.familyId)
        .filter(id => id && id.trim() !== '');

      let allFamilyMembers: Pupil[] = [];
      
      if (existingFamilyIds.length > 0) {
        // Get all members from existing families
        const uniqueFamilyIds = [...new Set(existingFamilyIds)];
        for (const familyId of uniqueFamilyIds) {
          if (familyId) {
            const familyMembers = await PupilsService.getPupilsByFamily(familyId);
            allFamilyMembers = [...allFamilyMembers, ...familyMembers];
          }
        }
      }

      // Remove duplicates from family members
      const uniqueFamilyMembers = allFamilyMembers.filter(
        (member, index, self) => self.findIndex(m => m.id === member.id) === index
      );

      // Combine all pupils that need to be linked
      const allPupilsToLink = [...validPupils, ...uniqueFamilyMembers].filter(
        (pupil, index, self) => self.findIndex(p => p.id === pupil.id) === index
      );

      // Use the existing family ID if available, otherwise generate a new one
      let familyIdToUse = sourcePupil.familyId;
      if (!familyIdToUse || familyIdToUse.trim() === '') {
        // Generate a new family ID based on the oldest pupil's data
        const oldestPupil = allPupilsToLink.reduce((oldest, current) => {
          const oldestDate = oldest.dateOfBirth ? new Date(oldest.dateOfBirth) : new Date();
          const currentDate = current.dateOfBirth ? new Date(current.dateOfBirth) : new Date();
          return currentDate < oldestDate ? current : oldest;
        });
        
        familyIdToUse = `fam-${oldestPupil.lastName.toLowerCase()}-${Date.now()}`;
      }

      // Update all pupils with the same family ID
      await Promise.all(
        allPupilsToLink.map(pupil => 
          PupilsService.updatePupil(pupil.id, { familyId: familyIdToUse })
        )
      );

      toast({
        title: "Siblings linked successfully!",
        description: `${allPupilsToLink.length} pupils have been linked as siblings.`,
        variant: "default"
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error linking siblings:', error);
      toast({
        title: "Error",
        description: "Failed to link siblings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLinking(false);
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setSelectedPupilIds([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b bg-gradient-to-r from-blue-50 to-indigo-50 sticky top-0 z-10 space-y-3">
          {/* Title and Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Link Siblings
                </DialogTitle>
                <div className="text-xs font-normal text-gray-600">
                  to {sourcePupil.firstName} {sourcePupil.lastName}
                </div>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isLinking}
                className="px-4 py-2 text-sm"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleLinkSiblings}
                disabled={selectedPupilIds.length === 0 || isLinking}
                className={`px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200 ${
                  selectedPupilIds.length === 0 ? 'opacity-50' : ''
                }`}
                size="sm"
              >
                {isLinking ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-2"></div>
                    Linking...
                  </>
                ) : (
                  <>
                    <Users className="h-3 w-3 mr-2" />
                    Link {selectedPupilIds.length || ''}{selectedPupilIds.length === 1 ? ' Sibling' : ' Siblings'}
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <DialogDescription className="text-gray-600 text-xs">
            Select pupils to link as siblings with shared family ID
          </DialogDescription>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, admission number, class..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-3 py-2 text-sm border border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 rounded-lg transition-all duration-200 bg-white"
            />
          </div>

          {/* Selected Count */}
          {selectedPupilIds.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-blue-100 rounded-full">
                  <CheckCircle2 className="h-3 w-3 text-blue-600" />
                </div>
                <div className="text-sm font-medium text-blue-900">
                  {selectedPupilIds.length} pupil{selectedPupilIds.length === 1 ? '' : 's'} selected
                </div>
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Pupils List */}
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-200 border-t-blue-600 mx-auto"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Users className="h-3 w-3 text-blue-600" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-600 font-medium">Loading pupils...</p>
                </div>
              </div>
            ) : filteredPupils.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center max-w-sm">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="h-6 w-6 text-gray-400" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">No pupils found</h3>
                  <p className="text-gray-600 text-sm">
                    {searchTerm 
                      ? 'Try adjusting your search terms.' 
                      : 'No pupils available to link.'}
                  </p>
                  {searchTerm && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setSearchTerm('')}
                      className="mt-2 text-xs"
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPupils.map((pupil) => {
                  const isSelected = selectedPupilIds.includes(pupil.id);
                  return (
                    <div
                      key={pupil.id}
                      className={`group relative p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-sm ${
                        isSelected 
                          ? 'border-blue-300 bg-blue-50/50 shadow-sm' 
                          : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50/50'
                      }`}
                      onClick={() => handlePupilSelect(pupil.id, !isSelected)}
                    >
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => 
                            handlePupilSelect(pupil.id, checked as boolean)
                          }
                          className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                        
                        <Avatar className="h-10 w-10 border border-gray-200 group-hover:border-gray-300 transition-colors">
                          {pupil.photo && pupil.photo.trim() !== '' && pupil.photo.startsWith('http') ? (
                            <AvatarImage 
                              src={pupil.photo} 
                              alt={`${pupil.firstName} ${pupil.lastName}`}
                            />
                          ) : null}
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm">
                            {pupil.firstName.charAt(0)}{pupil.lastName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h4 className="text-sm font-semibold text-gray-900 truncate">
                                  {pupil.firstName} {pupil.lastName} {pupil.otherNames || ''}
                                </h4>
                                <Badge 
                                  variant={pupil.status === 'Active' ? 'default' : 'secondary'}
                                  className="text-xs px-1.5 py-0.5"
                                >
                                  {pupil.status}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center space-x-4 mt-1 text-xs text-gray-600">
                                <span className="font-mono text-gray-900">{pupil.admissionNumber}</span>
                                <span>{pupil.className || 'N/A'}</span>
                                <span>{pupil.gender}</span>
                                <span>{pupil.section}</span>
                              </div>
                            </div>
                            
                            {isSelected && (
                              <div className="ml-2">
                                <div className="p-1 bg-blue-100 rounded-full">
                                  <CheckCircle2 className="h-3 w-3 text-blue-600" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer - just for spacing and pupil count */}
        <div className="px-5 py-2 border-t bg-gray-50/50 flex justify-center items-center">
          <div className="text-xs text-gray-500">
            {filteredPupils.length > 0 && (
              <span>{filteredPupils.length} pupils available to link</span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 