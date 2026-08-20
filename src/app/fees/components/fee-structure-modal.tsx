"use client";

import * as React from "react";
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle, ModernDialogDescription, ModernDialogFooter } from "@/components/ui/modern-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FeeStructure, FeeCategory, FeeFrequency, ClassFeeType, SectionFeeType, FeeSection, AcademicYear, Term, Class as SchoolClass } from "@/types";
import { FEE_CATEGORIES, FEE_FREQUENCIES, CLASS_FEE_TYPES, SECTION_FEE_TYPES, FEE_SECTIONS } from "@/lib/constants";
import { formatMoneyInput, parseFormattedMoney } from '@/lib/utils';
import { createFieldValidation, useFormValidation } from '@/lib/utils/form-validation';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { DollarSign } from 'lucide-react';
import { format } from 'date-fns';

interface FeeStructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<FeeStructure, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
  initialData?: FeeStructure | null;
  mode: 'add' | 'edit';
  academicYears: AcademicYear[];
  allClasses: SchoolClass[];
  currentAcademicYearId?: string;
  currentTermId?: string;
  isAssignmentFeeDefault?: boolean;
}

const FeeStructureModal: React.FC<FeeStructureModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
  academicYears,
  allClasses,
  currentAcademicYearId,
  currentTermId,
  isAssignmentFeeDefault = false,
}) => {
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState<number | string>("");
  const [category, setCategory] = React.useState<FeeCategory>(FEE_CATEGORIES[0]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = React.useState<string | undefined>(currentAcademicYearId);
  const [selectedTermId, setSelectedTermId] = React.useState<string | undefined>(currentTermId);
  const [classFeeType, setClassFeeType] = React.useState<ClassFeeType>("all");
  const [selectedClassIds, setSelectedClassIds] = React.useState<string[]>([]);
  const [sectionFeeType, setSectionFeeType] = React.useState<SectionFeeType>("all");
  const [selectedSection, setSelectedSection] = React.useState<FeeSection | undefined>(undefined);
  const [isRequired, setIsRequired] = React.useState(true);
  const [isRecurring, setIsRecurring] = React.useState(true);
  const [frequency, setFrequency] = React.useState<FeeFrequency>("Termly");
  const [isAssignmentFee, setIsAssignmentFee] = React.useState(isAssignmentFeeDefault);

  const validationFields = React.useMemo(() => [
    createFieldValidation('feeName', name, 'Fee Name', true, { message: 'Enter the fee name.' }),
    createFieldValidation('feeAmount', amount, 'Amount', true, {
      message: 'Enter the fee amount.',
      validate: (value) => parseFormattedMoney(String(value || '')) > 0 ? undefined : 'Enter an amount greater than zero.',
    }),
    createFieldValidation('feeCategory', category, 'Category', true, { message: 'Choose the fee category.' }),
    createFieldValidation('feeAcademicYear', selectedAcademicYearId, 'Academic Year', true, { active: !isAssignmentFee, message: 'Choose the academic year.' }),
    createFieldValidation('feeTerm', selectedTermId, 'Term', true, { active: !isAssignmentFee, message: 'Choose the term.' }),
    createFieldValidation('feeClassIds', selectedClassIds, 'Class Selection', true, { active: !isAssignmentFee && classFeeType === 'specific', message: 'Choose at least one class.' }),
    createFieldValidation('feeSection', selectedSection, 'Section Selection', true, { active: !isAssignmentFee && sectionFeeType === 'specific', message: 'Choose the applicable section.' }),
    createFieldValidation('feeFrequency', frequency, 'Frequency', true, { active: !isAssignmentFee && isRecurring, message: 'Choose the fee frequency.' }),
  ], [amount, category, classFeeType, frequency, isAssignmentFee, isRecurring, name, sectionFeeType, selectedAcademicYearId, selectedClassIds, selectedSection, selectedTermId]);
  const formValidation = useFormValidation(validationFields);

  const availableTerms = React.useMemo(() => {
    if (!selectedAcademicYearId) return [];
    const year = academicYears.find(ay => ay.id === selectedAcademicYearId);
    return year?.terms || [];
  }, [selectedAcademicYearId, academicYears]);

  React.useEffect(() => {
    if (isOpen) {
      const assignmentDefault = mode === 'add' ? isAssignmentFeeDefault : (initialData?.isAssignmentFee || false);
      setIsAssignmentFee(assignmentDefault);

      if (initialData) {
        setName(initialData.name);
        setAmount(formatMoneyInput(initialData.amount.toString()));
        setCategory(initialData.category);
        
        if (assignmentDefault) {
          setIsRequired(true);
          setIsRecurring(false);
          setFrequency(undefined);
          setSelectedAcademicYearId(undefined);
          setSelectedTermId(undefined);
          setClassFeeType("all");
          setSelectedClassIds([]);
          setSectionFeeType("all");
          setSelectedSection(undefined);
        } else {
          setSelectedAcademicYearId(initialData.academicYearId);
          setClassFeeType(initialData.classFeeType || "all");
          setSelectedClassIds(initialData.classIds || []);
          setSectionFeeType(initialData.sectionFeeType || "all");
          setSelectedSection(initialData.section);
          setIsRequired(initialData.isRequired);
          setIsRecurring(initialData.isRecurring);
          setFrequency(initialData.frequency || "Termly");
        }
      } else { // Add mode
        setName("");
        setAmount("");
        setCategory(FEE_CATEGORIES[0]);
        if (assignmentDefault) {
          setIsRequired(true);
          setIsRecurring(false);
          setFrequency(undefined);
          setSelectedAcademicYearId(undefined);
          setSelectedTermId(undefined);
          setClassFeeType("all");
          setSelectedClassIds([]);
          setSectionFeeType("all");
          setSelectedSection(undefined);
        } else {
          setSelectedAcademicYearId(currentAcademicYearId);
          // Term ID will be set by the next effect
          setClassFeeType("all");
          setSelectedClassIds([]);
          setSectionFeeType("all");
          setSelectedSection(undefined);
          setIsRequired(true);
          setIsRecurring(true);
          setFrequency("Termly");
        }
      }
    }
  }, [initialData, isOpen, currentAcademicYearId, isAssignmentFeeDefault, mode]);
  
  React.useEffect(() => {
    if (isOpen) {
      if (isAssignmentFee) return; // Don't set academic year/term for assignment fees

      if (selectedAcademicYearId && availableTerms.length > 0) {
        let targetTermIdToSet: string | undefined;
        if (mode === 'edit' && initialData && initialData.academicYearId === selectedAcademicYearId) {
          targetTermIdToSet = initialData.termId;
        } else if (currentTermId && availableTerms.some(t => t.id === currentTermId)) {
          targetTermIdToSet = currentTermId;
        }

        const currentTermIsValid = availableTerms.some(t => t.id === targetTermIdToSet);
        
        if (currentTermIsValid) {
          setSelectedTermId(targetTermIdToSet);
        } else if (availableTerms[0]?.id) {
          setSelectedTermId(availableTerms[0].id);
        } else {
          setSelectedTermId(undefined);
        }
      } else if (selectedAcademicYearId && availableTerms.length === 0) {
        setSelectedTermId(undefined); 
      } else if (!selectedAcademicYearId) {
        setSelectedTermId(undefined);
      }
    }
  }, [isOpen, selectedAcademicYearId, availableTerms, currentTermId, initialData, mode, isAssignmentFee]);

  React.useEffect(() => {
    if (isAssignmentFee) {
      setIsRequired(true);
      setIsRecurring(false);
      setFrequency(undefined);
      setSelectedAcademicYearId(undefined);
      setSelectedTermId(undefined);
      setClassFeeType("all");
      setSelectedClassIds([]);
      setSectionFeeType("all");
      setSelectedSection(undefined);
    } else {
      // Optionally, reset to defaults when toggling isAssignmentFee OFF
      // For now, we let existing values persist unless explicitly changed
      if (mode === 'add') { // Only reset to general defaults if in 'add' mode
        setIsRequired(true);
        setIsRecurring(true);
        setFrequency("Termly");
        setSelectedAcademicYearId(currentAcademicYearId);
        // Term will be set by other effect
      }
    }
  }, [isAssignmentFee, mode, currentAcademicYearId]);

  const handleClassIdToggle = (classId: string) => {
    setSelectedClassIds(prev =>
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
    formValidation.handleFieldChange('feeClassIds');
  };

  const handleSubmit = () => {
    const validation = formValidation.validateAll();
    if (!validation.isValid) {
      return;
    }

    const numericAmount = parseFormattedMoney(typeof amount === 'string' ? amount : amount.toString());
    onSubmit({
      name,
      amount: numericAmount,
      category,
      academicYearId: isAssignmentFee ? undefined : selectedAcademicYearId!, // Use undefined if assignment fee
      termId: isAssignmentFee ? undefined : selectedTermId!, // Use undefined if assignment fee
      classFeeType: isAssignmentFee ? 'all' : classFeeType,
      classIds: (isAssignmentFee || classFeeType === 'all') ? undefined : selectedClassIds,
      sectionFeeType: isAssignmentFee ? 'all' : sectionFeeType,
      section: (isAssignmentFee || sectionFeeType === 'all') ? undefined : selectedSection,
      isRequired, // This is now correctly set based on isAssignmentFee
      isRecurring: isAssignmentFee ? false : isRecurring,
      frequency: isAssignmentFee ? undefined : (isRecurring ? frequency : undefined),
      isAssignmentFee,
    });
    onClose(); 
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={onClose}>
      <ModernDialogContent 
        size="xl" 
        className="w-[95vw] max-w-4xl" 
        open={isOpen}
        onOpenChange={onClose}
      >
        <ModernDialogHeader className="p-2">
          <ModernDialogTitle className="text-sm">{mode === 'add' ? (isAssignmentFeeDefault ? 'Add Assignment Fee' : 'Add New Fee Item') : 'Edit Fee Item'}</ModernDialogTitle>
          <ModernDialogDescription className="text-[0.65rem]">Fill in the details for the fee item.</ModernDialogDescription>
        </ModernDialogHeader>
        
        {/* Academic Context Banner */}
        <div className={`mx-1 sm:mx-2 mt-1 sm:mt-2 p-1 border rounded-md text-[0.6rem] ${mode === 'edit' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex flex-wrap gap-1 items-center">
            <div className="flex items-center gap-0.5">
              <span className="font-bold text-[9px] text-muted-foreground pt-0.5">Shs.</span>
              <span className="font-medium">Fee Management</span>
            </div>
            <div>
              <strong>Date:</strong> {format(new Date(), "MMM dd, yyyy")}
            </div>
            <div className={`text-[0.5rem] px-1 py-0.5 rounded ml-auto ${mode === 'edit' ? 'text-amber-700 bg-amber-100' : 'text-green-700 bg-green-100'}`}>
              {mode === 'edit' ? 'Edit Mode' : 'Create Mode'}
            </div>
          </div>
        </div>
        
        <div className="flex-grow min-h-0 overflow-y-auto">
          <div className="grid gap-4 p-6">
            <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
            <div className="space-y-2">
              <Label htmlFor="feeName">Name <span className="text-destructive">*</span></Label>
              <Input id="feeName" value={name} onChange={(e) => { setName(e.target.value.toUpperCase()); formValidation.handleFieldChange('feeName'); }} {...formValidation.getFieldProps('feeName')} />
              <FieldError error={formValidation.getFieldError('feeName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feeAmount">Amount <span className="text-destructive">*</span></Label>
              <Input id="feeAmount" type="text" value={typeof amount === 'string' ? amount : formatMoneyInput(amount.toString())} onChange={(e) => { setAmount(formatMoneyInput(e.target.value)); formValidation.handleFieldChange('feeAmount'); }} {...formValidation.getFieldProps('feeAmount')} />
              <FieldError error={formValidation.getFieldError('feeAmount')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feeCategory">Category <span className="text-destructive">*</span></Label>
              <Select value={category} onValueChange={(val) => { setCategory(val as FeeCategory); formValidation.handleFieldChange('feeCategory'); }}>
                <SelectTrigger id="feeCategory" {...formValidation.getFieldProps('feeCategory')}><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {FEE_CATEGORIES.filter(cat => cat !== 'Discount').map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError error={formValidation.getFieldError('feeCategory')} />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4 mt-2">
                <Label htmlFor="isAssignmentFee" className="text-right">Assignment Fee?</Label>
                <Checkbox id="isAssignmentFee" checked={isAssignmentFee} onCheckedChange={(checked) => setIsAssignmentFee(typeof checked === 'boolean' ? checked : false)} className="col-span-3 justify-self-start" />
            </div>

            {!isAssignmentFee && (
              <>
                <div className="p-3 border rounded-md bg-muted/50 mt-2">
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">Academic Context</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="feeAcademicYear">Academic Year <span className="text-destructive">*</span></Label>
                            <Select value={selectedAcademicYearId} onValueChange={(value) => { setSelectedAcademicYearId(value); formValidation.handleFieldChange('feeAcademicYear'); }} disabled={academicYears.length === 0}>
                                <SelectTrigger id="feeAcademicYear" {...formValidation.getFieldProps('feeAcademicYear')}><SelectValue placeholder="Select year" /></SelectTrigger>
                                <SelectContent>
                                    {academicYears.length === 0 && <SelectItem value="no-years" disabled>No academic years available</SelectItem>}
                                    {academicYears.map(ay => <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FieldError error={formValidation.getFieldError('feeAcademicYear')} />
                        </div>
                        <div>
                            <Label htmlFor="feeTerm">Term <span className="text-destructive">*</span></Label>
                            <Select value={selectedTermId} onValueChange={(value) => { setSelectedTermId(value); formValidation.handleFieldChange('feeTerm'); }} disabled={!selectedAcademicYearId || availableTerms.length === 0}>
                                <SelectTrigger id="feeTerm" {...formValidation.getFieldProps('feeTerm')}><SelectValue placeholder="Select term" /></SelectTrigger>
                                <SelectContent>
                                    {availableTerms.length === 0 && <SelectItem value="no-terms-placeholder" disabled>Select academic year first</SelectItem>}
                                    {availableTerms.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FieldError error={formValidation.getFieldError('feeTerm')} />
                        </div>
                    </div>
                </div>
                
                <div className="p-3 border rounded-md bg-muted/50 mt-2">
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">Applicability - Classes</h4>
                    <div className="grid grid-cols-4 items-center gap-4 mb-2">
                        <Label htmlFor="classFeeType" className="text-right">Apply To</Label>
                        <div className="col-span-3">
                            <Select value={classFeeType} onValueChange={(val) => setClassFeeType(val as ClassFeeType)}>
                                <SelectTrigger><SelectValue placeholder="Select class applicability" /></SelectTrigger>
                                <SelectContent>
                                {CLASS_FEE_TYPES.filter(type => type).map(type => <SelectItem key={type} value={type!}>{type!.charAt(0).toUpperCase() + type!.slice(1)} Classes</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {classFeeType === 'specific' && (
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label className="text-right pt-2">Select Classes</Label>
                            <ScrollArea id="feeClassIds" tabIndex={-1} aria-invalid={Boolean(formValidation.getFieldError('feeClassIds'))} aria-describedby={formValidation.getFieldError('feeClassIds') ? 'feeClassIds-error' : undefined} className="col-span-3 h-32 rounded-md border p-2 aria-invalid:border-red-600 aria-invalid:bg-red-50/70 aria-invalid:ring-2 aria-invalid:ring-red-200">
                            {allClasses.map(cls => (
                                <div key={cls.id} className="flex items-center space-x-2 py-1">
                                <Checkbox id={`cls-${cls.id}`} checked={selectedClassIds.includes(cls.id)} onCheckedChange={() => handleClassIdToggle(cls.id)} />
                                <Label htmlFor={`cls-${cls.id}`} className="font-normal text-xs">{cls.name}</Label>
                                </div>
                            ))}
                            {allClasses.length === 0 && <p className="text-xs text-muted-foreground">No classes available.</p>}
                            </ScrollArea>
                            <FieldError error={formValidation.getFieldError('feeClassIds')} className="col-start-2 col-span-3" />
                        </div>
                    )}
                </div>

                <div className="p-3 border rounded-md bg-muted/50 mt-2">
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">Applicability - Sections</h4>
                    <div className="grid grid-cols-4 items-center gap-4 mb-2">
                        <Label htmlFor="sectionFeeType" className="text-right">Apply To</Label>
                        <div className="col-span-3">
                            <Select value={sectionFeeType} onValueChange={(val) => setSectionFeeType(val as SectionFeeType)}>
                                <SelectTrigger><SelectValue placeholder="Select section applicability" /></SelectTrigger>
                                <SelectContent>
                                {SECTION_FEE_TYPES.filter(type => type).map(type => <SelectItem key={type} value={type!}>{type!.charAt(0).toUpperCase() + type!.slice(1)} Sections</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {sectionFeeType === 'specific' && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="feeSection" className="text-right">Select Section</Label>
                            <div className="col-span-3">
                                <Select value={selectedSection} onValueChange={(val) => { setSelectedSection(val as FeeSection); formValidation.handleFieldChange('feeSection'); }}>
                                    <SelectTrigger id="feeSection" {...formValidation.getFieldProps('feeSection')}><SelectValue placeholder="Select section" /></SelectTrigger>
                                    <SelectContent>
                                    {FEE_SECTIONS.filter(sec => sec).map(sec => <SelectItem key={sec} value={sec!}>{sec}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FieldError error={formValidation.getFieldError('feeSection')} />
                            </div>
                        </div>
                    )}
                </div>
              </>
            )}
            
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isRequired" className="text-right">Is Required?</Label>
                <Checkbox 
                    id="isRequired" 
                    checked={isRequired} 
                    onCheckedChange={(checked) => setIsRequired(typeof checked === 'boolean' ? checked : false)} 
                    className="col-span-3 justify-self-start"
                    disabled={isAssignmentFee}
                />
            </div>

            {!isAssignmentFee && (
                <>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="isRecurring" className="text-right">Is Recurring?</Label>
                        <Checkbox id="isRecurring" checked={isRecurring} onCheckedChange={(checked) => {
                            const isChecked = typeof checked === 'boolean' ? checked : false;
                            setIsRecurring(isChecked);
                            if (!isChecked) setFrequency(undefined); else setFrequency("Termly");
                        }} className="col-span-3 justify-self-start"/>
                    </div>
                    {isRecurring && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="feeFrequency" className="text-right">Frequency</Label>
                            <Select value={frequency} onValueChange={(val) => { setFrequency(val as FeeFrequency); formValidation.handleFieldChange('feeFrequency'); }}>
                                <SelectTrigger id="feeFrequency" className="col-span-3" {...formValidation.getFieldProps('feeFrequency')}><SelectValue placeholder="Select frequency" /></SelectTrigger>
                                <SelectContent>
                                {FEE_FREQUENCIES.filter(freq => freq).map(freq => <SelectItem key={freq} value={freq!}>{freq}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FieldError error={formValidation.getFieldError('feeFrequency')} className="col-start-2 col-span-3" />
                        </div>
                    )}
                </>
            )}
          </div>
        </div>

        <ModernDialogFooter className="flex-shrink-0 px-6 pb-6 pt-4 border-t flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={handleSubmit} className="w-full sm:w-auto">Save Fee Item</Button>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
};

export default FeeStructureModal;
