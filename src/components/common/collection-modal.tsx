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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { UniformItem, SelectionMode } from '@/types';

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (collectedItems: string[], isFullCollection: boolean) => void;
  uniforms: UniformItem[];
  selectionMode: SelectionMode;
  previouslyCollectedItems: string[];
}

export function CollectionModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  uniforms, 
  selectionMode,
  previouslyCollectedItems 
}: CollectionModalProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const handleItemSelection = (uniformId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, uniformId]);
    } else {
      setSelectedItems(prev => prev.filter(id => id !== uniformId));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedItems.length === 0) {
      alert('Please select at least one item to collect');
      return;
    }

    // Check if this collection completes all items
    const allItemIds = uniforms.map(u => u.id);
    const allCollectedItems = [...previouslyCollectedItems, ...selectedItems];
    const isFullCollection = allItemIds.every(id => allCollectedItems.includes(id));

    onSubmit(selectedItems, isFullCollection);
    setSelectedItems([]);
  };

  const handleSelectAll = () => {
    const availableItems = uniforms
      .filter(u => !previouslyCollectedItems.includes(u.id))
      .map(u => u.id);
    setSelectedItems(availableItems);
  };

  const handleClearAll = () => {
    setSelectedItems([]);
  };

  const availableUniforms = uniforms.filter(u => !previouslyCollectedItems.includes(u.id));
  const collectedUniforms = uniforms.filter(u => previouslyCollectedItems.includes(u.id));

  return (
    <ModernDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModernDialogContent size="2xl">
        <ModernDialogHeader>
          <ModernDialogTitle>Mark Items as Collected</ModernDialogTitle>
        </ModernDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Collection Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Collection Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{uniforms.length}</div>
                  <div className="text-sm text-gray-600">Total Items</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{previouslyCollectedItems.length}</div>
                  <div className="text-sm text-gray-600">Already Collected</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{availableUniforms.length}</div>
                  <div className="text-sm text-gray-600">Pending Collection</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Previously Collected Items */}
          {collectedUniforms.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-green-600">Previously Collected Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {collectedUniforms.map((uniform) => (
                    <div key={uniform.id} className="flex items-center justify-between p-2 bg-green-50 rounded">
                      <div>
                        <div className="font-medium text-sm">{uniform.name}</div>
                        <div className="text-xs text-gray-500">{uniform.group}</div>
                      </div>
                      <Badge variant="default" className="bg-green-600">
                        Collected
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Items for Collection */}
          {availableUniforms.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select Items to Collect</CardTitle>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearAll}
                  >
                    Clear All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {availableUniforms.map((uniform) => (
                    <div key={uniform.id} className="flex items-center space-x-3 p-2 border rounded hover:bg-gray-50">
                      <Checkbox
                        id={`collect-${uniform.id}`}
                        checked={selectedItems.includes(uniform.id)}
                        onCheckedChange={(checked) => handleItemSelection(uniform.id, checked as boolean)}
                      />
                      <Label htmlFor={`collect-${uniform.id}`} className="flex-1 cursor-pointer">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-sm">{uniform.name}</div>
                            <div className="text-xs text-gray-500">{uniform.group}</div>
                          </div>
                          <Badge variant="outline">
                            Pending
                          </Badge>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <div className="text-green-600 font-medium text-lg">
                  ✓ All items have been collected!
                </div>
                <div className="text-gray-600 text-sm mt-2">
                  No items are pending collection.
                </div>
              </CardContent>
            </Card>
          )}

          {/* Collection Preview */}
          {selectedItems.length > 0 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg text-blue-700">Collection Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    Items to be collected ({selectedItems.length}):
                  </div>
                  <div className="space-y-1">
                    {selectedItems.map(itemId => {
                      const uniform = uniforms.find(u => u.id === itemId);
                      return uniform ? (
                        <div key={itemId} className="text-sm text-blue-700">
                          • {uniform.name} ({uniform.group})
                        </div>
                      ) : null;
                    })}
                  </div>
                  
                  {/* Check if this will complete the collection */}
                  {(() => {
                    const allItemIds = uniforms.map(u => u.id);
                    const allCollectedItems = [...previouslyCollectedItems, ...selectedItems];
                    const willComplete = allItemIds.every(id => allCollectedItems.includes(id));
                    
                    return willComplete && (
                      <div className="mt-3 p-2 bg-green-100 border border-green-300 rounded text-green-700 text-sm font-medium">
                        ✓ This will complete the full collection!
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          <ModernDialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="w-full sm:w-auto"
              disabled={selectedItems.length === 0}
            >
              Mark as Collected ({selectedItems.length} items)
            </Button>
          </ModernDialogFooter>
        </form>
      </ModernDialogContent>
    </ModernDialog>
  );
} 