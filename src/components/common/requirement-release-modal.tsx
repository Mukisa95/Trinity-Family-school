"use client";

import React, { useState } from 'react';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
  ModernDialogFooter,
} from '@/components/ui/modern-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { RequirementItem, RequirementSelectionMode } from '@/types';

interface RequirementReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (releasedItems: string[], isFullRelease: boolean) => void;
  requirements: RequirementItem[];
  selectionMode: RequirementSelectionMode;
  previouslyReleasedItems: string[];
}

export function RequirementReleaseModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  requirements,
  selectionMode,
  previouslyReleasedItems
}: RequirementReleaseModalProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [releaseAll, setReleaseAll] = useState(false);

  // Get items that haven't been released yet
  const availableItems = requirements.filter(req => !previouslyReleasedItems.includes(req.id));

  const handleItemSelection = (itemId: string, checked: boolean) => {
    setSelectedItems(prev => 
      checked 
        ? [...prev, itemId]
        : prev.filter(id => id !== itemId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(availableItems.map(item => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (releaseAll) {
      // Release all remaining items
      onSubmit(availableItems.map(item => item.id), true);
    } else {
      if (selectedItems.length === 0) {
        alert('Please select at least one item to release');
        return;
      }
      
      // Check if this release completes all items
      const allItemsWillBeReleased = [...previouslyReleasedItems, ...selectedItems].length === requirements.length;
      onSubmit(selectedItems, allItemsWillBeReleased);
    }
    
    // Reset form
    setSelectedItems([]);
    setReleaseAll(false);
  };

  const handleClose = () => {
    setSelectedItems([]);
    setReleaseAll(false);
    onClose();
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={handleClose}>
      <ModernDialogContent size="md" open={isOpen} onOpenChange={handleClose}>
        <ModernDialogHeader>
          <ModernDialogTitle>Release Requirements</ModernDialogTitle>
        </ModernDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Previously Released Items */}
          {previouslyReleasedItems.length > 0 && (
            <div className="bg-green-50 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-green-800 mb-2">Already Released:</h4>
              <div className="space-y-1">
                {previouslyReleasedItems.map(itemId => {
                  const item = requirements.find(r => r.id === itemId);
                  return item ? (
                    <div key={itemId} className="text-sm text-green-700">
                      ✓ {item.name}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Available Items to Release */}
          {availableItems.length > 0 ? (
            <div>
              <Label className="text-sm font-medium">Items to Release:</Label>
              
              {/* Release All Option */}
              <div className="mt-2 p-3 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="release-all"
                    checked={releaseAll}
                    onCheckedChange={(checked) => {
                      setReleaseAll(checked as boolean);
                      if (checked) {
                        setSelectedItems([]);
                      }
                    }}
                  />
                  <Label htmlFor="release-all" className="font-medium text-blue-600">
                    Release All Remaining Items
                  </Label>
                </div>
                {releaseAll && (
                  <div className="mt-2 text-sm text-gray-600">
                    This will mark all remaining requirements as released.
                  </div>
                )}
              </div>

              {/* Individual Item Selection */}
              {!releaseAll && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Select Individual Items:</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelectAll(selectedItems.length !== availableItems.length)}
                    >
                      {selectedItems.length === availableItems.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  
                  <ScrollArea className="h-32 border rounded-md p-3">
                    <div className="space-y-2">
                      {availableItems.map((item) => (
                        <div key={item.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`item-${item.id}`}
                            checked={selectedItems.includes(item.id)}
                            onCheckedChange={(checked) => handleItemSelection(item.id, checked as boolean)}
                          />
                          <Label htmlFor={`item-${item.id}`} className="text-sm font-normal">
                            {item.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  
                  {selectedItems.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedItems.length} item(s) selected for release
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">All requirements have already been released.</p>
            </div>
          )}

          <ModernDialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={handleClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            {availableItems.length > 0 && (
              <Button type="submit" className="w-full sm:w-auto">
                Release Selected
              </Button>
            )}
          </ModernDialogFooter>
        </form>
      </ModernDialogContent>
    </ModernDialog>
  );
} 