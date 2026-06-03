'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Search, Users } from 'lucide-react';
import { useAssignPupilToPost, useLeadershipTerms } from '@/lib/hooks/use-duty-service';
import { usePupils } from '@/lib/hooks/use-pupils';
import { PrefectoralPost } from '@/types/duty-service';

interface AssignPupilToPostModalProps {
  post: PrefectoralPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
  selectedTermId?: string;
}

export function AssignPupilToPostModal({ post, open, onOpenChange, trigger, selectedTermId }: AssignPupilToPostModalProps) {
  const { data: pupils = [], isLoading: pupilsLoading } = usePupils();
  const { data: allTerms = [], isLoading: termsLoading } = useLeadershipTerms();
  const createAssignment = useAssignPupilToPost();

  // Filter out terminated terms so we only assign to active or future ones
  const availableTerms = allTerms.filter(t => t.isActive);

  const [formData, setFormData] = useState({
    pupilId: '',
    leadershipTermId: selectedTermId || '',
    notes: '',
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPupil, setSelectedPupil] = useState<any>(null);

  // Initialize form data when post changes
  useEffect(() => {
    if (post) {
      setFormData({
        pupilId: '',
        leadershipTermId: selectedTermId || '',
        notes: '',
      });
      setSearchTerm('');
      setSelectedPupil(null);
    }
  }, [post, selectedTermId]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!post) return;

    try {
      await createAssignment.mutateAsync({
        postId: post.id,
        pupilId: formData.pupilId,
        leadershipTermId: formData.leadershipTermId,
        isActive: true,
        notes: formData.notes || undefined,
      });

      onOpenChange(false);
      setFormData({
        pupilId: '',
        leadershipTermId: selectedTermId || '',
        notes: '',
      });
      setSearchTerm('');
      setSelectedPupil(null);
    } catch (error) {
      console.error('Error creating post assignment:', error);
    }
  };

  const getFilteredPupils = () => {
    return pupils
      .filter(p => p.status === 'Active') // Fixed: use 'Active' instead of 'active'
      .filter(p => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
          p.firstName.toLowerCase().includes(searchLower) ||
          p.lastName.toLowerCase().includes(searchLower) ||
          p.admissionNumber.toLowerCase().includes(searchLower) ||
          (p.className && p.className.toLowerCase().includes(searchLower))
        );
      })
      .sort((a, b) => {
        // Sort by class name first, then by first name
        if (a.className && b.className) {
          const classComparison = a.className.localeCompare(b.className);
          if (classComparison !== 0) return classComparison;
        }
        return a.firstName.localeCompare(b.firstName);
      });
  };

  const handlePupilSelect = (pupil: any) => {
    setSelectedPupil(pupil);
    setFormData(prev => ({ ...prev, pupilId: pupil.id }));
    setSearchTerm('');
  };

  const filteredPupils = getFilteredPupils();

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Pupil to {post.postName}</DialogTitle>
          <DialogDescription>
            Assign a pupil to this prefectoral post by selecting a leadership term.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pupil Selection with Search */}
          <div className="space-y-2">
            <Label htmlFor="pupilSearch">Search and Select Pupil</Label>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="pupilSearch"
                placeholder="Search by name, admission number, or class..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Selected Pupil Display */}
            {selectedPupil && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">
                      {selectedPupil.firstName} {selectedPupil.lastName}
                    </p>
                    <p className="text-sm text-green-600">
                      {selectedPupil.admissionNumber} • {selectedPupil.className}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Pupil List */}
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              {pupilsLoading ? (
                <div className="p-4 text-center">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">Loading pupils...</p>
                </div>
              ) : filteredPupils.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    {searchTerm ? 'No pupils found matching your search.' : 'No active pupils available.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredPupils.map((pupil) => (
                    <button
                      key={pupil.id}
                      type="button"
                      onClick={() => handlePupilSelect(pupil)}
                      className={`w-full p-3 text-left hover:bg-muted transition-colors ${selectedPupil?.id === pupil.id ? 'bg-muted' : ''
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {pupil.firstName} {pupil.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {pupil.admissionNumber} • {pupil.className}
                          </p>
                        </div>
                        {selectedPupil?.id === pupil.id && (
                          <div className="text-green-600">
                            <Users className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Hidden input for form validation */}
            <input
              type="hidden"
              value={formData.pupilId}
              onChange={(e) => handleInputChange('pupilId', e.target.value)}
            />
          </div>

          {/* Term Selection */}
          <div className="space-y-2">
            <Label htmlFor="leadershipTermId">Prefectoral Term *</Label>
            <Select
              value={formData.leadershipTermId}
              onValueChange={(val) => handleInputChange('leadershipTermId', val)}
            >
              <SelectTrigger>
                <SelectValue placeholder={termsLoading ? 'Loading terms...' : 'Select term'} />
              </SelectTrigger>
              <SelectContent>
                {availableTerms.map((term) => (
                  <SelectItem key={term.id} value={term.id}>
                    {term.termName} ({new Date(term.startDate).getFullYear()})
                  </SelectItem>
                ))}
                {availableTerms.length === 0 && !termsLoading && (
                  <SelectItem value="none" disabled>
                    No active terms available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about this assignment..."
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createAssignment.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createAssignment.isPending || !formData.pupilId || !formData.leadershipTermId}
            >
              {createAssignment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Pupil
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
