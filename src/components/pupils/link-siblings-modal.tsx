'use client';

import { matchesPupilSearch, formatPupilDisplayName } from '@/lib/utils/name-formatter';
import React, { useMemo, useState } from 'react';
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
import { usePupils } from '@/lib/hooks/use-pupils';
import { selectPupilsByIds } from '@/lib/selectors/pupil-selectors';
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
  const { data: pupils = [], isLoading } = usePupils();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPupilIds, setSelectedPupilIds] = useState<string[]>([]);
  const [isLinking, setIsLinking] = useState(false);

  const availablePupils = useMemo(() => pupils.filter(pupil =>
    pupil.id !== sourcePupil.id &&
    (!sourcePupil.familyId || pupil.familyId !== sourcePupil.familyId) &&
    pupil.status === 'Active'
  ), [pupils, sourcePupil.familyId, sourcePupil.id]);

  // Filter pupils based on search term
  const filteredPupils = availablePupils.filter(pupil => matchesPupilSearch(pupil, searchTerm, [pupil.admissionNumber, pupil.className]));

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
      const validPupils = selectPupilsByIds(pupils, allPupilIds);

      // Collect all existing family IDs and their members
      const existingFamilyIds = validPupils
        .map(p => p.familyId)
        .filter(id => id && id.trim() !== '');

      const familyIds = new Set(existingFamilyIds);
      const allFamilyMembers = pupils.filter(pupil =>
        Boolean(pupil.familyId && familyIds.has(pupil.familyId)),
      );

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

      // One server transaction reconciles every pupil marker and parent
      // account, preventing partial families or duplicate ownership.
      await PupilsService.transitionFamilyMembership({
        pupilIds: allPupilsToLink.map(pupil => pupil.id),
        familyId: familyIdToUse,
        preferredPupilId: sourcePupil.id,
      });

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
        <DialogHeader className="px-5 py-3 border-b bg-gradient-to-r from-brand-surface-50 to-brand-alt-surface-50 sticky top-0 z-10 space-y-3 dark:from-brand-surface-950/40 dark:to-brand-alt-surface-950/40">
          {/* Title and Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-brand-surface-100 rounded-lg dark:bg-brand-surface-950/40">
                <Users className="h-4 w-4 text-brand-ink-600 dark:text-brand-ink-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  Link Siblings
                </DialogTitle>
                <div className="text-xs font-normal text-gray-600 dark:text-slate-300">
                  to {formatPupilDisplayName(sourcePupil)}
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
                className={`px-4 py-2 text-sm bg-gradient-to-r from-brand-surface-600 to-brand-alt-surface-600 hover:from-brand-surface-700 hover:to-brand-alt-surface-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200 ${
                  selectedPupilIds.length === 0 ? 'opacity-50' : ''
                }`}
                size="sm"
              >
                {isLinking ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-2 dark:border-slate-700"></div>
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
          
          <DialogDescription className="text-gray-600 text-xs dark:text-slate-300">
            Select pupils to link as siblings with shared family ID
          </DialogDescription>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-400" />
            <Input
              placeholder="Search by name, admission number, class..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-3 py-2 text-sm border border-gray-200 focus:border-brand-400 focus:ring-1 focus:ring-brand-100 rounded-lg transition-all duration-200 bg-white dark:border-slate-700 dark:focus:ring-brand-800/60 dark:bg-slate-900"
            />
          </div>

          {/* Selected Count */}
          {selectedPupilIds.length > 0 && (
            <div className="bg-gradient-to-r from-brand-surface-50 to-brand-alt-surface-50 border border-brand-200 rounded-lg p-3 shadow-sm dark:from-brand-surface-950/40 dark:to-brand-alt-surface-950/40 dark:border-brand-800/60">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-brand-surface-100 rounded-full dark:bg-brand-surface-950/40">
                  <CheckCircle2 className="h-3 w-3 text-brand-ink-600 dark:text-brand-ink-400" />
                </div>
                <div className="text-sm font-medium text-brand-ink-900 dark:text-brand-ink-200">
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
                    <div className="animate-spin rounded-full h-8 w-8 border-3 border-brand-200 border-t-blue-600 mx-auto dark:border-brand-800/60"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Users className="h-3 w-3 text-brand-ink-600 dark:text-brand-ink-400" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-600 font-medium dark:text-slate-300">Loading pupils...</p>
                </div>
              </div>
            ) : filteredPupils.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center max-w-sm">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 dark:bg-slate-900">
                    <AlertCircle className="h-6 w-6 text-gray-400 dark:text-slate-400" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1 dark:text-slate-100">No pupils found</h3>
                  <p className="text-gray-600 text-sm dark:text-slate-300">
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
                          ? 'border-brand-300 bg-brand-surface-50/50 shadow-sm dark:border-brand-800/60 dark:bg-brand-surface-950/50'
                          : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50/50 dark:border-slate-700 dark:hover:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-900/50'
                      }`}
                      onClick={() => handlePupilSelect(pupil.id, !isSelected)}
                    >
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => 
                            handlePupilSelect(pupil.id, checked as boolean)
                          }
                          className="data-[state=checked]:bg-brand-surface-600 data-[state=checked]:border-brand-600"
                        />
                        
                        <Avatar className="h-10 w-10 border border-gray-200 group-hover:border-gray-300 transition-colors dark:border-slate-700 dark:group-hover:border-slate-700">
                          {pupil.photo && pupil.photo.trim() !== '' && pupil.photo.startsWith('http') ? (
                            <AvatarImage 
                              src={pupil.photo} 
                              alt={`${formatPupilDisplayName(pupil)}`}
                            />
                          ) : null}
                          <AvatarFallback className="bg-gradient-to-br from-brand-surface-500 to-brand-alt-surface-600 text-white font-bold text-sm">
                            {pupil.firstName.charAt(0)}{pupil.lastName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h4 className="text-sm font-semibold text-gray-900 truncate dark:text-slate-100">
                                  {formatPupilDisplayName(pupil)}
                                </h4>
                                <Badge 
                                  variant={pupil.status === 'Active' ? 'default' : 'secondary'}
                                  className="text-xs px-1.5 py-0.5"
                                >
                                  {pupil.status}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center space-x-4 mt-1 text-xs text-gray-600 dark:text-slate-300">
                                <span className="font-mono text-gray-900 dark:text-slate-100">{pupil.admissionNumber}</span>
                                <span>{pupil.className || 'N/A'}</span>
                                <span>{pupil.gender}</span>
                                <span>{pupil.section}</span>
                              </div>
                            </div>
                            
                            {isSelected && (
                              <div className="ml-2">
                                <div className="p-1 bg-brand-surface-100 rounded-full dark:bg-brand-surface-950/40">
                                  <CheckCircle2 className="h-3 w-3 text-brand-ink-600 dark:text-brand-ink-400" />
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
        <div className="px-5 py-2 border-t bg-gray-50/50 flex justify-center items-center dark:bg-slate-900/50">
          <div className="text-xs text-gray-500 dark:text-slate-400">
            {filteredPupils.length > 0 && (
              <span>{filteredPupils.length} pupils available to link</span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
