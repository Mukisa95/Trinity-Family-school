"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, CheckCircle, Package, RotateCcw } from 'lucide-react';
import type { UniformItem, SelectionMode, UniformInventoryItem } from '@/types';

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    collectedItems: string[],
    isFullCollection: boolean,
    collectionSizes: Record<string, string>,
    collectionQuantities: Record<string, number>,
  ) => void | Promise<void>;
  onUnmark?: (uniformId: string, size: string | undefined) => void;
  uniforms: UniformItem[];
  selectionMode: SelectionMode;
  previouslyCollectedItems: string[];
  // New props for inventory integration
  selectedSizes?: Record<string, string>; // Sizes specified during tracking
  uniformInventory?: UniformInventoryItem[]; // Inventory data for stock check
  selectedQuantities?: Record<string, number>;
  collectedQuantities?: Record<string, number>;
}

export function CollectionModal({
  isOpen,
  onClose,
  onSubmit,
  onUnmark,
  uniforms,
  selectionMode,
  previouslyCollectedItems,
  selectedSizes = {},
  uniformInventory = [],
  selectedQuantities = {},
  collectedQuantities = {}
}: CollectionModalProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  // Track size selections for collection (may differ from tracking if out of stock)
  const [collectionSizes, setCollectionSizes] = useState<Record<string, string>>({});
  const [collectionQuantities, setCollectionQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Track which previously-collected item the user is confirming an unmark for
  const [confirmingUnmark, setConfirmingUnmark] = useState<string | null>(null);

  // Initialize collection sizes from tracking sizes when modal opens
  useEffect(() => {
    if (isOpen) {
      setCollectionSizes({ ...selectedSizes });
      setCollectionQuantities({});
      setSelectedItems([]);
      setConfirmingUnmark(null);
    }
  }, [isOpen, selectedSizes]);

  const handleUnmark = useCallback((uniformId: string) => {
    const size = selectedSizes[uniformId];
    onUnmark?.(uniformId, size);
    setConfirmingUnmark(null);
  }, [onUnmark, selectedSizes]);

  // Get inventory item for a uniform
  const getInventory = (uniformId: string): UniformInventoryItem | undefined => {
    return uniformInventory.find(i => i.uniformId === uniformId);
  };

  // Check if uniform has inventory configured
  const hasInventory = (uniformId: string): boolean => {
    const inv = getInventory(uniformId);
    return !!inv && inv.sizes.length > 0;
  };

  // Get stock for a specific size
  const getStockForSize = (uniformId: string, size: string): number => {
    const inv = getInventory(uniformId);
    const stockItem = inv?.stock.find(s => s.size === size);
    return stockItem?.quantity || 0;
  };

  // Get size status for display
  const getSizeStatus = (uniformId: string): { status: 'available' | 'out' | 'unspecified' | 'no-inventory'; size?: string; stock?: number } => {
    if (!hasInventory(uniformId)) {
      return { status: 'no-inventory' };
    }

    const size = collectionSizes[uniformId] || selectedSizes[uniformId];
    if (!size) {
      return { status: 'unspecified' };
    }

    const stock = getStockForSize(uniformId, size);
    if (stock > 0) {
      return { status: 'available', size, stock };
    } else {
      return { status: 'out', size, stock: 0 };
    }
  };

  const handleItemSelection = (uniformId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, uniformId]);
      const totalQty = selectedQuantities[uniformId] || 1;
      const prevQty = collectedQuantities[uniformId] || (previouslyCollectedItems.includes(uniformId) ? 1 : 0);
      const remainingQty = Math.max(1, totalQty - prevQty);
      setCollectionQuantities(prev => ({ ...prev, [uniformId]: remainingQty }));
    } else {
      setSelectedItems(prev => prev.filter(id => id !== uniformId));
      setCollectionQuantities(prev => {
        const next = { ...prev };
        delete next[uniformId];
        return next;
      });
    }
  };

  const handleQuantityChange = (uniformId: string, qty: number) => {
    setCollectionQuantities(prev => ({ ...prev, [uniformId]: qty }));
  };

  const handleSizeChange = (uniformId: string, size: string) => {
    setCollectionSizes(prev => ({ ...prev, [uniformId]: size }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedItems.length === 0 || isSubmitting) {
      alert('Please select at least one item to collect');
      return;
    }

    // Check stock if a size was explicitly selected
    const itemsNeedingAttention: string[] = [];
    for (const itemId of selectedItems) {
      if (hasInventory(itemId)) {
        const size = collectionSizes[itemId];
        if (size) {
          const stock = getStockForSize(itemId, size);
          const reqQty = collectionQuantities[itemId] || 1;
          if (stock < reqQty) {
            const uniform = uniforms.find(u => u.id === itemId);
            itemsNeedingAttention.push(`${uniform?.name || itemId}: Size ${size} does not have enough stock (${stock} available)`);
          }
        }
      }
    }

    if (itemsNeedingAttention.length > 0) {
      alert(`Please resolve the following before collecting:\n\n${itemsNeedingAttention.join('\n')}`);
      return;
    }

    // Check if this collection completes all items
    const isFullCollection = uniforms.every(u => {
      const totalQty = selectedQuantities[u.id] || 1;
      const prevQty = collectedQuantities[u.id] || (previouslyCollectedItems.includes(u.id) ? 1 : 0);
      const newQty = selectedItems.includes(u.id) ? (collectionQuantities[u.id] || 1) : 0;
      return (prevQty + newQty) >= totalQty;
    });

    setIsSubmitting(true);
    try {
      await onSubmit(selectedItems, isFullCollection, collectionSizes, collectionQuantities);
      setSelectedItems([]);
      setCollectionSizes({});
      setCollectionQuantities({});
    } catch {
      // The owner reports the contextual error; keep the selections for a safe retry.
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to get total and collected qty for any uniform
  const getQtyInfo = (uniformId: string) => {
    const totalQty = selectedQuantities[uniformId] || 1;
    const colQty = collectedQuantities[uniformId] ?? (previouslyCollectedItems.includes(uniformId) ? totalQty : 0);
    const remQty = Math.max(0, totalQty - colQty);
    return { totalQty, colQty, remQty, isFullyCollected: colQty >= totalQty && colQty > 0 };
  };

  const availableUniforms = uniforms.filter(u => {
    const { isFullyCollected } = getQtyInfo(u.id);
    return !isFullyCollected;
  });

  const collectedUniforms = uniforms.filter(u => {
    const { colQty } = getQtyInfo(u.id);
    return colQty > 0;
  });

  const handleSelectAll = () => {
    const availableItems = availableUniforms.map(u => u.id);
    setSelectedItems(availableItems);
  };

  const handleClearAll = () => {
    setSelectedItems([]);
  };

  // Render size status badge
  const renderSizeStatus = (uniformId: string) => {
    const status = getSizeStatus(uniformId);

    switch (status.status) {
      case 'available':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
            <CheckCircle className="h-3 w-3 mr-1" />
            {status.size} ({status.stock})
          </Badge>
        );
      case 'out':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            {status.size} (Out)
          </Badge>
        );
      case 'unspecified':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
            <Package className="h-3 w-3 mr-1" />
            Size Optional
          </Badge>
        );
      case 'no-inventory':
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-xs">
            No sizes
          </Badge>
        );
    }
  };

  // Render size selector for a uniform
  const renderSizeSelector = (uniform: UniformItem) => {
    const inv = getInventory(uniform.id);
    if (!inv || inv.sizes.length === 0) return null;

    const currentSize = collectionSizes[uniform.id] || selectedSizes[uniform.id] || '';
    const status = getSizeStatus(uniform.id);
    const needsSelection = status.status === 'unspecified' || status.status === 'out';

    if (!needsSelection && !selectedItems.includes(uniform.id)) return null;

    return (
      <div className="mt-2 pl-8">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Size:</Label>
          <Select value={currentSize} onValueChange={(val) => handleSizeChange(uniform.id, val)}>
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {inv.sizes.map((size) => {
                const stockItem = inv.stock.find(s => s.size === size);
                const qty = stockItem?.quantity || 0;
                const isOut = qty === 0;
                return (
                  <SelectItem key={size} value={size}>
                    <span className={isOut ? 'text-gray-400' : ''}>
                      {size} <span className={`text-xs ${isOut ? 'text-red-500' : 'text-green-600'}`}>({qty})</span>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {status.status === 'out' && (
            <span className="text-xs text-red-500">Please select an available size</span>
          )}
        </div>
      </div>
    );
  };

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
                  {collectedUniforms.map((uniform) => {
                    const { totalQty, colQty, isFullyCollected } = getQtyInfo(uniform.id);
                    return (
                    <div key={uniform.id} className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-100">
                      <div>
                        <div className="font-medium text-sm">{uniform.name}</div>
                        <div className="text-xs text-gray-500">{uniform.group}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedSizes[uniform.id] && (
                          <Badge variant="secondary" className="text-xs">
                            Size: {selectedSizes[uniform.id]}
                          </Badge>
                        )}
                        <Badge variant="default" className={isFullyCollected ? "bg-green-600" : "bg-amber-600"}>
                          {isFullyCollected ? `Collected (${colQty}/${totalQty})` : `Partial (${colQty}/${totalQty})`}
                        </Badge>
                        {/* Unmark button — only shown if onUnmark is provided */}
                        {onUnmark && (
                          confirmingUnmark === uniform.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-amber-700 font-medium">Unmark?</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="h-6 px-2 text-xs"
                                onClick={() => handleUnmark(uniform.id)}
                              >
                                Yes
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs"
                                onClick={() => setConfirmingUnmark(null)}
                              >
                                No
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                              onClick={() => setConfirmingUnmark(uniform.id)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Unmark
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                    );
                  })}
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
                  {availableUniforms.map((uniform) => {
                    const totalQty = selectedQuantities[uniform.id] || 1;
                    const prevQty = collectedQuantities[uniform.id] || (previouslyCollectedItems.includes(uniform.id) ? 1 : 0);
                    const remainingQty = Math.max(1, totalQty - prevQty);
                    const isSelected = selectedItems.includes(uniform.id);
                    const currentReleaseQty = collectionQuantities[uniform.id] || remainingQty;

                    return (
                      <div key={uniform.id}>
                        <div className="flex items-center justify-between space-x-3 p-2 border rounded hover:bg-gray-50">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <Checkbox
                              id={`collect-${uniform.id}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => handleItemSelection(uniform.id, checked as boolean)}
                            />
                            <Label htmlFor={`collect-${uniform.id}`} className="flex-1 cursor-pointer">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium text-sm">
                                    {totalQty > 1 ? `${totalQty}x ${uniform.name}` : uniform.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {uniform.group}
                                    {totalQty > 1 && (
                                      <span className="ml-1 text-blue-600 font-medium">
                                        (Pending: {remainingQty} of {totalQty})
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {renderSizeStatus(uniform.id)}
                                </div>
                              </div>
                            </Label>
                          </div>

                          {isSelected && remainingQty > 1 && (
                            <div className="flex items-center gap-1.5 ml-2 bg-blue-50 dark:bg-blue-900/30 rounded-full px-2 py-0.5 border border-blue-200 shrink-0">
                              <span className="text-[10px] text-blue-700 font-medium mr-1">Release:</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full hover:bg-blue-100 text-xs font-bold"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleQuantityChange(uniform.id, Math.max(1, currentReleaseQty - 1));
                                }}
                              >
                                -
                              </Button>
                              <span className="text-xs font-bold px-1.5 min-w-[20px] text-center text-blue-900 dark:text-blue-100">
                                {currentReleaseQty}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full hover:bg-blue-100 text-xs font-bold"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleQuantityChange(uniform.id, Math.min(remainingQty, currentReleaseQty + 1));
                                }}
                              >
                                +
                              </Button>
                            </div>
                          )}
                        </div>
                        {isSelected && renderSizeSelector(uniform)}
                      </div>
                    );
                  })}
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
                      const size = collectionSizes[itemId];
                      return uniform ? (
                        <div key={itemId} className="text-sm text-blue-700 flex items-center gap-2">
                          • {uniform.name} ({uniform.group})
                          {size && <Badge variant="secondary" className="text-xs">Size: {size}</Badge>}
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
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="w-full sm:w-auto"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={selectedItems.length === 0 || isSubmitting}
            >
              {isSubmitting
                ? 'Recording Collection...'
                : `Mark as Collected (${selectedItems.length} items)`}
            </Button>
          </ModernDialogFooter>
        </form>
      </ModernDialogContent>
    </ModernDialog>
  );
}
