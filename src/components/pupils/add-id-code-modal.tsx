"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
  ModernDialogFooter,
} from '@/components/ui/modern-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AdditionalIdentifier } from '@/types';

interface AddIdCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (identifier: AdditionalIdentifier) => void;
  existingIdentifier?: AdditionalIdentifier | null; // For editing
}

const ID_TYPES = ['NIN', 'LIN', 'Index Number', 'Passport', 'Birth Certificate No.', 'Other'] as const;
type IdTypeTuple = typeof ID_TYPES;
type IdType = IdTypeTuple[number];

export function AddIdCodeModal({ isOpen, onClose, onSave, existingIdentifier }: AddIdCodeModalProps) {
  const [idType, setIdType] = useState<IdType | ''>('');
  const [customIdName, setCustomIdName] = useState('');
  const [idValue, setIdValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!existingIdentifier;

  useEffect(() => {
    if (isOpen) {
      if (existingIdentifier) {
        const typeExistsInList = ID_TYPES.includes(existingIdentifier.idType as IdType);
        if (typeExistsInList) {
          setIdType(existingIdentifier.idType as IdType);
          setCustomIdName('');
        } else {
          setIdType('Other');
          setCustomIdName(existingIdentifier.idType); // Assuming original type was custom
        }
        setIdValue(existingIdentifier.idValue);
      } else {
        // Reset form for new entry
        setIdType('');
        setCustomIdName('');
        setIdValue('');
      }
      setError(null);
    }
  }, [isOpen, existingIdentifier]);

  const handleSave = () => {
    setError(null);
    if (!idType) {
      setError('Please select an ID type.');
      return;
    }
    if (idType === 'Other' && !customIdName.trim()) {
      setError('Please enter a name for the custom ID type.');
      return;
    }
    if (!idValue.trim()) {
      setError('Please enter the ID value/code.');
      return;
    }

    const finalIdType = idType === 'Other' ? customIdName.trim() : idType;

    onSave({
      idType: finalIdType,
      idValue: idValue.trim(),
      ...(idType === 'Other' && { customIdName: customIdName.trim() }) // Include if 'Other'
    });
    onClose(); // Close modal after save
  };
  
  const handleModalClose = () => {
    setError(null);
    onClose();
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
      <ModernDialogContent size="md">
        <ModernDialogHeader>
          <ModernDialogTitle>{isEditing ? 'Edit ID Code' : 'Add New ID Code'}</ModernDialogTitle>
        </ModernDialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="idType">
              ID Type
            </Label>
            <Select
              value={idType}
              onValueChange={(value) => setIdType(value as IdType | '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select ID type" />
              </SelectTrigger>
              <SelectContent>
                {ID_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {idType === 'Other' && (
            <div className="space-y-2">
              <Label htmlFor="customIdName">
                Custom Type
              </Label>
              <Input
                id="customIdName"
                value={customIdName}
                onChange={(e) => setCustomIdName(e.target.value.toUpperCase())}
                placeholder="e.g., School Specific ID"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="idValue">
              ID Value
            </Label>
            <Input
              id="idValue"
              value={idValue}
              onChange={(e) => setIdValue(e.target.value.toUpperCase())}
              placeholder="Enter the ID code/number"
            />
          </div>
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
        </div>
        <ModernDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleModalClose} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={handleSave} className="w-full sm:w-auto">{isEditing ? 'Save Changes' : 'Add ID'}</Button>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
} 