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
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Plus, CreditCard } from 'lucide-react';
import type { AdditionalIdentifier } from '@/types';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { useFormValidation } from '@/lib/utils/form-validation';

interface ManageIdCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (identifiers: AdditionalIdentifier[]) => void;
  existingIdentifiers: AdditionalIdentifier[];
  pupilName: string;
}

const ID_TYPES = ['NIN', 'LIN', 'Index Number', 'Passport', 'Birth Certificate No.', 'Other'] as const;
type IdTypeTuple = typeof ID_TYPES;
type IdType = IdTypeTuple[number];

interface IdFormData {
  idType: IdType | '';
  customIdName: string;
  idValue: string;
}

export function ManageIdCodesModal({ 
  isOpen, 
  onClose, 
  onSave, 
  existingIdentifiers, 
  pupilName 
}: ManageIdCodesModalProps) {
  const [identifiers, setIdentifiers] = useState<AdditionalIdentifier[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<IdFormData>({
    idType: '',
    customIdName: '',
    idValue: ''
  });
  const formValidation = useFormValidation([
    { id: 'managedIdType', label: 'ID type', value: formData.idType, required: true, message: 'Choose the type of identification code.' },
    { id: 'managedCustomIdName', label: 'Custom ID type name', value: formData.customIdName, required: true, active: formData.idType === 'Other', message: 'Enter a name for the custom ID type.' },
    { id: 'managedIdValue', label: 'ID value', value: formData.idValue, required: true, message: 'Enter the ID value or code.' },
  ]);

  useEffect(() => {
    if (isOpen) {
      setIdentifiers([...existingIdentifiers]);
      setIsFormOpen(false);
      setEditingIndex(null);
      resetForm();
    }
  }, [isOpen, existingIdentifiers]);

  const resetForm = () => {
    setFormData({
      idType: '',
      customIdName: '',
      idValue: ''
    });
    formValidation.resetValidation();
  };

  const handleAddNew = () => {
    resetForm();
    setEditingIndex(null);
    setIsFormOpen(true);
  };

  const handleEdit = (index: number) => {
    const identifier = identifiers[index];
    const typeExistsInList = ID_TYPES.includes(identifier.idType as IdType);
    
    setFormData({
      idType: typeExistsInList ? (identifier.idType as IdType) : 'Other',
      customIdName: typeExistsInList ? '' : identifier.idType,
      idValue: identifier.idValue
    });
    setEditingIndex(index);
    setIsFormOpen(true);
    formValidation.resetValidation();
  };

  const handleDelete = (index: number) => {
    if (window.confirm('Are you sure you want to delete this ID code?')) {
      const newIdentifiers = identifiers.filter((_, i) => i !== index);
      setIdentifiers(newIdentifiers);
    }
  };

  const handleFormSave = () => {
    if (!formValidation.validateAll().isValid) return;

    const finalIdType = formData.idType === 'Other' ? formData.customIdName.trim() : formData.idType;
    
    // Check for duplicates (excluding the one being edited)
    const isDuplicate = identifiers.some((identifier, index) => 
      identifier.idType === finalIdType && 
      identifier.idValue.trim().toLowerCase() === formData.idValue.trim().toLowerCase() &&
      index !== editingIndex
    );

    if (isDuplicate) {
      formValidation.setSubmissionError('An ID code with this type and value already exists.');
      return;
    }

    const newIdentifier: AdditionalIdentifier = {
      idType: finalIdType,
      idValue: formData.idValue.trim()
    };

    let newIdentifiers;
    if (editingIndex !== null) {
      // Editing existing
      newIdentifiers = [...identifiers];
      newIdentifiers[editingIndex] = newIdentifier;
    } else {
      // Adding new
      newIdentifiers = [...identifiers, newIdentifier];
    }

    setIdentifiers(newIdentifiers);
    setIsFormOpen(false);
    resetForm();
    setEditingIndex(null);
  };

  const handleSaveAll = () => {
    onSave(identifiers);
    onClose();
  };

  const handleModalClose = () => {
    setIsFormOpen(false);
    setEditingIndex(null);
    resetForm();
    onClose();
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
      <ModernDialogContent size="lg" open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
        <ModernDialogHeader>
          <ModernDialogTitle className="flex items-center">
            <CreditCard className="mr-2 h-5 w-5 text-green-600" />
            Manage ID Codes - {pupilName}
          </ModernDialogTitle>
        </ModernDialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Existing ID Codes List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">Current ID Codes</h3>
              <Button
                onClick={handleAddNew}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add New
              </Button>
            </div>
            
            {identifiers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CreditCard className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                <p>No ID codes added yet</p>
                <p className="text-xs">Click "Add New" to add an ID code</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {identifiers.map((identifier, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {identifier.idType}
                        </Badge>
                      </div>
                      <p className="font-mono text-sm text-gray-900">
                        {identifier.idValue}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        onClick={() => handleEdit(index)}
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={() => handleDelete(index)}
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add/Edit Form */}
          {isFormOpen && (
            <div className="border-t pt-4 space-y-4">
              <h3 className="text-sm font-medium text-gray-900">
                {editingIndex !== null ? 'Edit ID Code' : 'Add New ID Code'}
              </h3>
              <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={formValidation.focusField} />
              
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="managedIdType" className={formValidation.getFieldError('managedIdType') ? 'text-red-700' : undefined}>ID Type <span className="text-red-600">*</span></Label>
                  <Select
                    value={formData.idType}
                    onValueChange={(value) => { setFormData(prev => ({ ...prev, idType: value as IdType | '' })); formValidation.handleFieldChange('managedIdType'); }}
                  >
                    <SelectTrigger id="managedIdType" {...formValidation.getFieldProps('managedIdType')}>
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
                  <FieldError error={formValidation.getFieldError('managedIdType')} />
                </div>

                {formData.idType === 'Other' && (
                  <div className="space-y-2">
                    <Label htmlFor="managedCustomIdName" className={formValidation.getFieldError('managedCustomIdName') ? 'text-red-700' : undefined}>Custom Type Name <span className="text-red-600">*</span></Label>
                    <Input
                      id="managedCustomIdName"
                      value={formData.customIdName}
                      onChange={(e) => { setFormData(prev => ({ ...prev, customIdName: e.target.value.toUpperCase() })); formValidation.handleFieldChange('managedCustomIdName'); }}
                      placeholder="e.g., School Specific ID"
                      {...formValidation.getFieldProps('managedCustomIdName')}
                    />
                    <FieldError error={formValidation.getFieldError('managedCustomIdName')} />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="managedIdValue" className={formValidation.getFieldError('managedIdValue') ? 'text-red-700' : undefined}>ID Value <span className="text-red-600">*</span></Label>
                  <Input
                    id="managedIdValue"
                    value={formData.idValue}
                    onChange={(e) => { setFormData(prev => ({ ...prev, idValue: e.target.value.toUpperCase() })); formValidation.handleFieldChange('managedIdValue'); }}
                    placeholder="Enter the ID code/number"
                    {...formValidation.getFieldProps('managedIdValue')}
                  />
                  <FieldError error={formValidation.getFieldError('managedIdValue')} />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleFormSave}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {editingIndex !== null ? 'Save Changes' : 'Add ID Code'}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsFormOpen(false);
                      resetForm();
                      setEditingIndex(null);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <ModernDialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleModalClose}>
            Close
          </Button>
          <Button onClick={handleSaveAll} className="bg-blue-600 hover:bg-blue-700">
            Save All Changes
          </Button>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
}
