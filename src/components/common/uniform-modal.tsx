"use client";

import React, { useState, useEffect } from 'react';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
  ModernDialogFooter,
} from '@/components/ui/modern-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useClasses } from '@/lib/hooks/use-classes';
import { formatMoneyInput, parseFormattedMoney } from '@/lib/utils';
import { validateForm, highlightMissingFields, scrollToFirstMissingField, clearFieldHighlights, createFieldValidation } from '@/lib/utils/form-validation';
import { useSubmissionState } from '@/lib/hooks/use-submission-state';
import { LoadingButton } from '@/components/ui/loading-button';
import { Shirt } from 'lucide-react';
import { format } from 'date-fns';
import type { 
  UniformFormData, 
  UniformGender, 
  UniformClassType, 
  UniformSectionType, 
  UniformSection,
  UniformItem,
  Class
} from '@/types';

interface UniformModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: UniformFormData) => void;
  initialData?: UniformFormData;
  mode: 'add' | 'edit';
}

const uniformGroups = [
  'Shirts',
  'Trousers',
  'Skirts',
  'Dresses',
  'Shoes',
  'Socks',
  'Ties',
  'Belts',
  'Sweaters',
  'Blazers',
  'Hats',
  'Bags',
  'Sports Wear',
  'Accessories',
  'Other'
];

export function UniformModal({ isOpen, onClose, onSubmit, initialData, mode }: UniformModalProps) {
  const { data: classes = [] } = useClasses();
  const { isSubmitting, submitWithState } = useSubmissionState();
  
  const [formData, setFormData] = useState<UniformFormData>({
    name: '',
    price: '',
    group: '',
    gender: 'all',
    classType: 'all',
    classIds: [],
    sectionType: 'all',
    section: undefined,
    description: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        name: '',
        price: '',
        group: '',
        gender: 'all',
        classType: 'all',
        classIds: [],
        sectionType: 'all',
        section: undefined,
        description: ''
      });
    }
  }, [initialData, isOpen]);

  const handleInputChange = (field: keyof UniformFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMoneyInput(e.target.value);
    handleInputChange('price', formatted);
  };

  const handleClassSelection = (classId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      classIds: checked 
        ? [...(prev.classIds || []), classId]
        : (prev.classIds || []).filter(id => id !== classId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear any previous field highlights
    const allFieldIds = ['name', 'price', 'group'];
    clearFieldHighlights(allFieldIds);

    // Define validation fields
    const validationFields = [
      createFieldValidation('name', formData.name.trim(), 'Uniform Name', true),
      createFieldValidation('price', formData.price && parseFormattedMoney(formData.price) > 0 ? formData.price : '', 'Price', true),
      createFieldValidation('group', formData.group, 'Uniform Group', true),
    ];

    // Add conditional validation for specific class selection
    if (formData.classType === 'specific') {
      validationFields.push(
        createFieldValidation('classIds', formData.classIds && formData.classIds.length > 0 ? formData.classIds : [], 'Class Selection', true)
      );
    }

    // Add conditional validation for specific section selection
    if (formData.sectionType === 'specific') {
      validationFields.push(
        createFieldValidation('section', formData.section, 'Section Selection', true)
      );
    }

    // Validate form
    const validation = validateForm(validationFields);
    
    if (!validation.isValid) {
      // Highlight missing fields
      const missingFieldIds = validation.missingFields.map(field => field.id);
      highlightMissingFields(missingFieldIds);
      
      // Scroll to first missing field
      if (validation.firstMissingFieldId) {
        scrollToFirstMissingField(validation.firstMissingFieldId);
      }
      
      // Show error alert with specific missing fields
      const missingFieldNames = validation.missingFields.map(field => field.label).join(', ');
      alert(`Please fill in the following required fields: ${missingFieldNames}`);
      return;
    }

    // Use submission state for protected submission
    await submitWithState(
      () => Promise.resolve(onSubmit(formData)),
      {
        successTitle: mode === 'edit' ? "Uniform Updated" : "Uniform Added",
        successMessage: mode === 'edit' 
          ? "Uniform item has been successfully updated."
          : "New uniform item has been successfully added.",
        errorTitle: "Error",
        errorMessage: "Failed to save uniform item. Please try again.",
        onSuccess: () => {
          onClose();
        }
      }
    );
  };

  const selectedClasses = classes.filter(cls => formData.classIds?.includes(cls.id));

  return (
    <ModernDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModernDialogContent 
        size="xl" 
        className="w-[95vw] max-w-4xl" 
        open={isOpen}
        onOpenChange={onClose}
      >
        <ModernDialogHeader className="p-2">
          <ModernDialogTitle className="text-sm">
            {mode === 'add' ? 'Add New Uniform Item' : 'Edit Uniform Item'}
          </ModernDialogTitle>
        </ModernDialogHeader>
        
        {/* Academic Context Banner */}
        <div className={`mx-1 sm:mx-2 mt-1 sm:mt-2 p-1 border rounded-md text-[0.6rem] ${mode === 'edit' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex flex-wrap gap-1 items-center">
            <div className="flex items-center gap-0.5">
              <Shirt className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="font-medium">Uniform Management</span>
            </div>
            <div>
              <strong>Date:</strong> {format(new Date(), "MMM dd, yyyy")}
            </div>
            <div className={`text-[0.5rem] px-1 py-0.5 rounded ml-auto ${mode === 'edit' ? 'text-amber-700 bg-amber-100' : 'text-blue-700 bg-blue-100'}`}>
              {mode === 'edit' ? 'Edit Mode' : 'Create Mode'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {/* Basic Information */}
            <div className="lg:col-span-1 xl:col-span-2 space-y-3 md:space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <Label htmlFor="name" className="text-xs md:text-sm font-medium">Uniform Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value.toUpperCase())}
                    placeholder="e.g., School Shirt, Tie, Blazer"
                    className="text-sm md:text-base"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="price" className="text-xs md:text-sm font-medium">Price (UGX) *</Label>
                  <Input
                    id="price"
                    value={formData.price}
                    onChange={handlePriceChange}
                    placeholder="e.g., 25,000"
                    className="text-sm md:text-base"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="group" className="text-xs md:text-sm font-medium">Uniform Group *</Label>
                <Select value={formData.group} onValueChange={(value) => handleInputChange('group', value)}>
                  <SelectTrigger id="group" className="text-sm md:text-base">
                    <SelectValue placeholder="Select uniform group" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniformGroups.map((group) => (
                      <SelectItem key={group} value={group} className="text-sm md:text-base">
                        {group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description" className="text-xs md:text-sm font-medium">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value.toUpperCase())}
                  placeholder="Optional description..."
                  className="text-sm md:text-base resize-none"
                  rows={2}
                />
              </div>
            </div>

            {/* Targeting Options */}
            <div className="lg:col-span-1 xl:col-span-1 space-y-3 md:space-y-4">
              {/* Gender Targeting */}
              <div>
                <Label className="text-xs md:text-sm font-medium">Gender Targeting *</Label>
                <RadioGroup
                  value={formData.gender}
                  onValueChange={(value: UniformGender) => handleInputChange('gender', value)}
                  className="flex flex-col space-y-1.5 md:space-y-2 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="gender-all" className="w-4 h-4 md:w-5 md:h-5" />
                    <Label htmlFor="gender-all" className="text-xs md:text-sm font-normal cursor-pointer select-none">All Students</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="gender-male" className="w-4 h-4 md:w-5 md:h-5" />
                    <Label htmlFor="gender-male" className="text-xs md:text-sm font-normal cursor-pointer select-none">Boys Only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="gender-female" className="w-4 h-4 md:w-5 md:h-5" />
                    <Label htmlFor="gender-female" className="text-xs md:text-sm font-normal cursor-pointer select-none">Girls Only</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Class Targeting */}
              <div>
                <Label className="text-xs md:text-sm font-medium">Class Targeting *</Label>
                <RadioGroup
                  value={formData.classType}
                  onValueChange={(value: UniformClassType) => handleInputChange('classType', value)}
                  className="flex flex-col space-y-1.5 md:space-y-2 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="class-all" className="w-4 h-4 md:w-5 md:h-5" />
                    <Label htmlFor="class-all" className="text-xs md:text-sm font-normal cursor-pointer select-none">All Classes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="specific" id="class-specific" className="w-4 h-4 md:w-5 md:h-5" />
                    <Label htmlFor="class-specific" className="text-xs md:text-sm font-normal cursor-pointer select-none">Specific Classes</Label>
                  </div>
                </RadioGroup>

                {formData.classType === 'specific' && (
                  <div className="mt-2 md:mt-3">
                    <Label className="text-xs md:text-sm">Select Classes:</Label>
                    <ScrollArea className="h-24 md:h-32 border rounded-md p-2 md:p-3 mt-1 md:mt-2">
                      <div className="space-y-1.5 md:space-y-2">
                        {classes.map((cls) => (
                          <div key={cls.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`class-${cls.id}`}
                              checked={formData.classIds?.includes(cls.id) || false}
                              onCheckedChange={(checked) => handleClassSelection(cls.id, checked as boolean)}
                              className="w-4 h-4 md:w-5 md:h-5 border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <Label 
                              htmlFor={`class-${cls.id}`} 
                              className="text-xs md:text-sm font-normal cursor-pointer select-none"
                            >
                              {cls.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    {selectedClasses.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedClasses.map((cls) => (
                          <Badge key={cls.id} variant="secondary" className="text-xs">
                            {cls.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section Targeting */}
              <div>
                <Label className="text-xs md:text-sm font-medium">Section Targeting *</Label>
                <RadioGroup
                  value={formData.sectionType}
                  onValueChange={(value: UniformSectionType) => handleInputChange('sectionType', value)}
                  className="flex flex-col space-y-1.5 md:space-y-2 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="section-all" className="w-4 h-4 md:w-5 md:h-5" />
                    <Label htmlFor="section-all" className="text-xs md:text-sm font-normal cursor-pointer select-none">All Sections</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="specific" id="section-specific" className="w-4 h-4 md:w-5 md:h-5" />
                    <Label htmlFor="section-specific" className="text-xs md:text-sm font-normal cursor-pointer select-none">Specific Section</Label>
                  </div>
                </RadioGroup>

                {formData.sectionType === 'specific' && (
                  <div className="mt-2 md:mt-3">
                    <Select 
                      value={formData.section} 
                      onValueChange={(value: UniformSection) => handleInputChange('section', value)}
                    >
                      <SelectTrigger className="text-sm md:text-base">
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Day" className="text-sm md:text-base">Day Section</SelectItem>
                        <SelectItem value="Boarding" className="text-sm md:text-base">Boarding Section</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>

          <ModernDialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:space-x-2">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto text-sm md:text-base">
              Cancel
            </Button>
            <LoadingButton 
              type="submit" 
              loading={isSubmitting}
              loadingText={mode === 'add' ? 'Adding...' : 'Updating...'}
              className="w-full sm:w-auto text-sm md:text-base"
            >
              {mode === 'add' ? 'Add Uniform Item' : 'Update Uniform Item'}
            </LoadingButton>
          </ModernDialogFooter>
        </form>
      </ModernDialogContent>
    </ModernDialog>
  );
} 