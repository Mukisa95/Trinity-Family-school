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
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { useFormValidation } from '@/lib/utils/form-validation';

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
  const formValidation = useFormValidation([
    { id: 'idType', label: 'ID type', value: idType, required: true, message: 'Choose the type of identification code.' },
    { id: 'customIdName', label: 'Custom ID type', value: customIdName, required: true, active: idType === 'Other', message: 'Enter a name for the custom ID type.' },
    { id: 'idValue', label: 'ID value', value: idValue, required: true, message: 'Enter the ID value or code.' },
  ]);

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
      formValidation.resetValidation();
    }
  }, [isOpen, existingIdentifier]);

  const handleSave = () => {
    if (!formValidation.validateAll().isValid) return;

    const finalIdType = idType === 'Other' ? customIdName.trim() : idType;

    onSave({
      idType: finalIdType,
      idValue: idValue.trim(),
      ...(idType === 'Other' && { customIdName: customIdName.trim() }) // Include if 'Other'
    });
    onClose(); // Close modal after save
  };
  
  const handleModalClose = () => {
    formValidation.resetValidation();
    onClose();
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
      <ModernDialogContent size="md">
        <ModernDialogHeader>
          <ModernDialogTitle>{isEditing ? 'Edit ID Code' : 'Add New ID Code'}</ModernDialogTitle>
        </ModernDialogHeader>
        <div className="grid gap-4 py-4">
          <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={formValidation.focusField} />
          <div className="space-y-2">
            <Label htmlFor="idType" className={formValidation.getFieldError('idType') ? 'text-red-700' : undefined}>
              ID Type <span className="text-red-600">*</span>
            </Label>
            <Select
              value={idType}
              onValueChange={(value) => { setIdType(value as IdType | ''); formValidation.handleFieldChange('idType'); }}
            >
              <SelectTrigger id="idType" {...formValidation.getFieldProps('idType')}>
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
            <FieldError error={formValidation.getFieldError('idType')} />
          </div>

          {idType === 'Other' && (
            <div className="space-y-2">
              <Label htmlFor="customIdName" className={formValidation.getFieldError('customIdName') ? 'text-red-700' : undefined}>
                Custom Type <span className="text-red-600">*</span>
              </Label>
              <Input
                id="customIdName"
                value={customIdName}
                onChange={(e) => { setCustomIdName(e.target.value.toUpperCase()); formValidation.handleFieldChange('customIdName'); }}
                placeholder="e.g., School Specific ID"
                {...formValidation.getFieldProps('customIdName')}
              />
              <FieldError error={formValidation.getFieldError('customIdName')} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="idValue" className={formValidation.getFieldError('idValue') ? 'text-red-700' : undefined}>
              ID Value <span className="text-red-600">*</span>
            </Label>
            <Input
              id="idValue"
              value={idValue}
              onChange={(e) => { setIdValue(e.target.value.toUpperCase()); formValidation.handleFieldChange('idValue'); }}
              placeholder="Enter the ID code/number"
              {...formValidation.getFieldProps('idValue')}
            />
            <FieldError error={formValidation.getFieldError('idValue')} />
          </div>
        </div>
        <ModernDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleModalClose} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={handleSave} className="w-full sm:w-auto">{isEditing ? 'Save Changes' : 'Add ID'}</Button>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
}
