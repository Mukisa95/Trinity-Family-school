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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { formatMoneyInput, parseFormattedMoney } from '@/lib/utils';
import { useClasses } from '@/lib/hooks/use-classes';
import { validateForm, highlightMissingFields, scrollToFirstMissingField, clearFieldHighlights, createFieldValidation } from '@/lib/utils/form-validation';
import { useSubmissionState } from '@/lib/hooks/use-submission-state';
import { LoadingButton } from '@/components/ui/loading-button';
import { BookMarked } from 'lucide-react';
import { format } from 'date-fns';
import type { 
  RequirementFormData, 
  RequirementGender, 
  RequirementClassType, 
  RequirementSectionType, 
  RequirementSection,
  RequirementFrequency,
  RequirementItem,
  Class
} from '@/types';

interface RequirementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: RequirementFormData) => void;
  selectedRequirement?: RequirementItem | null;
}

const requirementGroups = [
  'Books',
  'Stationery',
  'Equipment',
  'Sports',
  'Art Supplies',
  'Science Materials',
  'Technology',
  'Other'
];

export function RequirementModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  selectedRequirement 
}: RequirementModalProps) {
  const [formData, setFormData] = useState<RequirementFormData>({
    name: '',
    price: '',
    quantity: '',
    group: '',
    gender: 'all',
    classType: 'all',
    classIds: [],
    sectionType: 'all',
    section: undefined,
    frequency: 'termly',
    description: ''
  });

  const { data: classes = [] } = useClasses();
  const { isSubmitting, submitWithState } = useSubmissionState();

  useEffect(() => {
    if (selectedRequirement) {
      setFormData({
        name: selectedRequirement.name,
        price: selectedRequirement.price.toString(),
        quantity: selectedRequirement.quantity?.toString() || '',
        group: selectedRequirement.group,
        gender: selectedRequirement.gender,
        classType: selectedRequirement.classType,
        classIds: selectedRequirement.classIds || [],
        sectionType: selectedRequirement.sectionType,
        section: selectedRequirement.section,
        frequency: selectedRequirement.frequency,
        description: selectedRequirement.description || ''
      });
    } else {
      setFormData({
        name: '',
        price: '',
        quantity: '',
        group: '',
        gender: 'all',
        classType: 'all',
        classIds: [],
        sectionType: 'all',
        section: undefined,
        frequency: 'termly',
        description: ''
      });
    }
  }, [selectedRequirement, isOpen]);

  const handleInputChange = (field: keyof RequirementFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMoneyInput(e.target.value);
    handleInputChange('price', formatted);
  };

  const handleGenderChange = (gender: RequirementGender) => {
    handleInputChange('gender', gender);
  };

  const handleClassTypeChange = (classType: RequirementClassType) => {
    setFormData(prev => ({
      ...prev,
      classType,
      classIds: classType === 'all' ? [] : prev.classIds
    }));
  };

  const handleClassSelection = (classId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      classIds: checked 
        ? [...(prev.classIds || []), classId]
        : (prev.classIds || []).filter(id => id !== classId)
    }));
  };

  const handleSectionTypeChange = (sectionType: RequirementSectionType) => {
    setFormData(prev => ({
      ...prev,
      sectionType,
      section: sectionType === 'all' ? undefined : prev.section
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear any previous field highlights
    const allFieldIds = ['name', 'group', 'price', 'frequency'];
    clearFieldHighlights(allFieldIds);

    // Define validation fields
    const validationFields = [
      createFieldValidation('name', formData.name.trim(), 'Requirement Name', true),
      createFieldValidation('group', formData.group.trim(), 'Group/Category', true),
      createFieldValidation('price', formData.price && parseFormattedMoney(formData.price) > 0 ? formData.price : '', 'Price', true),
      createFieldValidation('frequency', formData.frequency, 'Frequency', true),
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
        successTitle: selectedRequirement ? "Requirement Updated" : "Requirement Added",
        successMessage: selectedRequirement 
          ? "Requirement has been successfully updated."
          : "New requirement has been successfully added.",
        errorTitle: "Error",
        errorMessage: "Failed to save requirement. Please try again.",
        onSuccess: () => {
          onClose();
        }
      }
    );
  };

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
            {selectedRequirement ? 'Edit Requirement' : 'Add New Requirement'}
          </ModernDialogTitle>
        </ModernDialogHeader>
        
        {/* Academic Context Banner */}
        <div className={`mx-1 sm:mx-2 mt-1 sm:mt-2 p-1 border rounded-md text-[0.6rem] ${selectedRequirement ? 'bg-amber-50 border-amber-200' : 'bg-purple-50 border-purple-200'}`}>
          <div className="flex flex-wrap gap-1 items-center">
            <div className="flex items-center gap-0.5">
              <BookMarked className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="font-medium">Requirements Management</span>
            </div>
            <div>
              <strong>Date:</strong> {format(new Date(), "MMM dd, yyyy")}
            </div>
            <div className={`text-[0.5rem] px-1 py-0.5 rounded ml-auto ${selectedRequirement ? 'text-amber-700 bg-amber-100' : 'text-purple-700 bg-purple-100'}`}>
              {selectedRequirement ? 'Edit Mode' : 'Create Mode'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {/* Basic Information */}
            <div className="lg:col-span-1 xl:col-span-2 space-y-3 md:space-y-4">
              <div>
                <Label htmlFor="name" className="text-xs md:text-sm font-medium">Requirement Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value.toUpperCase())}
                  placeholder="e.g., Mathematics Textbook"
                  className="text-sm md:text-base"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <div>
                  <Label htmlFor="group" className="text-xs md:text-sm font-medium">Group/Category *</Label>
                  <Select 
                    value={formData.group} 
                    onValueChange={(value) => handleInputChange('group', value)}
                  >
                    <SelectTrigger id="group" className="text-sm md:text-base">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {requirementGroups.map((group) => (
                        <SelectItem key={group} value={group} className="text-sm md:text-base">
                          {group}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

                <div>
                  <Label htmlFor="quantity" className="text-xs md:text-sm font-medium">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                    placeholder="e.g., 3"
                    className="text-sm md:text-base"
                    min="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional: Number of items required
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <Label htmlFor="frequency" className="text-xs md:text-sm font-medium">Frequency *</Label>
                  <Select 
                    value={formData.frequency} 
                    onValueChange={(value: RequirementFrequency) => handleInputChange('frequency', value)}
                  >
                    <SelectTrigger id="frequency" className="text-sm md:text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="termly" className="text-sm md:text-base">Every Term</SelectItem>
                      <SelectItem value="yearly" className="text-sm md:text-base">Every Year</SelectItem>
                      <SelectItem value="one-time" className="text-sm md:text-base">One Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-1">
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
            </div>

            {/* Targeting Options */}
            <div className="lg:col-span-1 xl:col-span-1 space-y-3 md:space-y-4">
              {/* Gender Targeting */}
              <div>
                <Label className="text-xs md:text-sm font-medium">Gender Targeting *</Label>
                <RadioGroup
                  value={formData.gender}
                  onValueChange={handleGenderChange}
                  className="flex flex-col space-y-1.5 md:space-y-2 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="gender-all" className="w-3 h-3 md:w-4 md:h-4" />
                    <Label htmlFor="gender-all" className="text-xs md:text-sm font-normal">
                      All Students
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="gender-male" className="w-3 h-3 md:w-4 md:h-4" />
                    <Label htmlFor="gender-male" className="text-xs md:text-sm font-normal">
                      Boys Only
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="gender-female" className="w-3 h-3 md:w-4 md:h-4" />
                    <Label htmlFor="gender-female" className="text-xs md:text-sm font-normal">
                      Girls Only
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Class Targeting */}
              <div>
                <Label className="text-xs md:text-sm font-medium">Class Targeting *</Label>
                <RadioGroup
                  value={formData.classType}
                  onValueChange={handleClassTypeChange}
                  className="flex flex-col space-y-1.5 md:space-y-2 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="class-all" className="w-3 h-3 md:w-4 md:h-4" />
                    <Label htmlFor="class-all" className="text-xs md:text-sm font-normal">
                      All Classes
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="specific" id="class-specific" className="w-3 h-3 md:w-4 md:h-4" />
                    <Label htmlFor="class-specific" className="text-xs md:text-sm font-normal">
                      Specific Classes
                    </Label>
                  </div>
                </RadioGroup>

                {formData.classType === 'specific' && (
                  <div className="mt-2 md:mt-3">
                    <Label className="text-xs md:text-sm">Select Classes:</Label>
                    <ScrollArea className="h-24 md:h-32 border rounded-md p-2 md:p-3 mt-1 md:mt-2">
                      <div className="space-y-1.5 md:space-y-2">
                        {classes.map((cls: Class) => (
                          <div key={cls.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`class-${cls.id}`}
                              checked={formData.classIds?.includes(cls.id) || false}
                              onCheckedChange={(checked) => handleClassSelection(cls.id, checked as boolean)}
                              className="w-3 h-3 md:w-4 md:h-4"
                            />
                            <Label htmlFor={`class-${cls.id}`} className="text-xs md:text-sm font-normal">
                              {cls.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    {formData.classIds && formData.classIds.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.classIds.length} class(es) selected
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Section Targeting */}
              <div>
                <Label className="text-xs md:text-sm font-medium">Section Targeting *</Label>
                <RadioGroup
                  value={formData.sectionType}
                  onValueChange={handleSectionTypeChange}
                  className="flex flex-col space-y-1.5 md:space-y-2 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="section-all" className="w-3 h-3 md:w-4 md:h-4" />
                    <Label htmlFor="section-all" className="text-xs md:text-sm font-normal">
                      All Sections
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="specific" id="section-specific" className="w-3 h-3 md:w-4 md:h-4" />
                    <Label htmlFor="section-specific" className="text-xs md:text-sm font-normal">
                      Specific Section
                    </Label>
                  </div>
                </RadioGroup>

                {formData.sectionType === 'specific' && (
                  <div className="mt-2 md:mt-3">
                    <Select 
                      value={formData.section} 
                      onValueChange={(value: RequirementSection) => handleInputChange('section', value)}
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
              loadingText={selectedRequirement ? 'Updating...' : 'Adding...'}
              className="w-full sm:w-auto text-sm md:text-base"
            >
              {selectedRequirement ? 'Update Requirement' : 'Add Requirement'}
            </LoadingButton>
          </ModernDialogFooter>
        </form>
      </ModernDialogContent>
    </ModernDialog>
  );
} 