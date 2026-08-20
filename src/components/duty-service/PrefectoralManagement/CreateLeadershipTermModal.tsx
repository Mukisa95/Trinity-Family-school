'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { useCreateLeadershipTerm, useLeadershipTerms } from '@/lib/hooks/use-duty-service';
import { useAcademicYears, useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { DatePicker } from '@/components/common/date-picker';
import { format, parseISO, isValid } from 'date-fns';
import type { CreateLeadershipTermData } from '@/types/duty-service';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { createFieldValidation, useFormValidation } from '@/lib/utils/form-validation';

const toDate = (s?: string) => { if (!s) return undefined; try { const d = parseISO(s); return isValid(d) ? d : undefined; } catch { return undefined; } };
const toStr = (d?: Date) => d ? format(d, 'yyyy-MM-dd') : '';

interface CreateLeadershipTermModalProps {
    trigger?: React.ReactNode;
}

export function CreateLeadershipTermModal({ trigger }: CreateLeadershipTermModalProps) {
    const [open, setOpen] = useState(false);
    const { data: academicYears = [] } = useAcademicYears();
    const { data: activeAcademicYear } = useActiveAcademicYear();
    const { data: leadershipTerms = [] } = useLeadershipTerms(activeAcademicYear?.id);

    const hasActiveTerm = leadershipTerms.some(term => term.isActive);

    const [formData, setFormData] = useState<Partial<CreateLeadershipTermData>>({
        termName: '',
        startDate: toStr(new Date()),
        endDateType: 'open',
        endDate: undefined,
        academicYearId: '',
    });

    const createLeadershipTerm = useCreateLeadershipTerm();
    const formValidation = useFormValidation([
        createFieldValidation('termName', formData.termName, 'Term name', true, { message: 'Enter the leadership term name.' }),
        createFieldValidation('leadershipStartDate', formData.startDate, 'Start date', true, { message: 'Choose the leadership term start date.' }),
        createFieldValidation('leadershipEndDate', formData.endDate, 'End date', formData.endDateType === 'mark', {
            active: formData.endDateType === 'mark',
            message: 'Choose the marked term end date.',
        }),
    ]);

    useEffect(() => {
        if (activeAcademicYear?.id && !formData.academicYearId) {
            setFormData(prev => ({
                ...prev,
                academicYearId: activeAcademicYear.id
            }));
        }
    }, [activeAcademicYear?.id, formData.academicYearId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formValidation.validateAll().isValid) return;

        try {
            await createLeadershipTerm.mutateAsync({
                termName: formData.termName!,
                startDate: formData.startDate!,
                endDateType: formData.endDateType as 'open' | 'mark',
                endDate: formData.endDateType === 'open' ? undefined : formData.endDate,
                academicYearId: formData.academicYearId,
                isActive: true, // TS requirement, though the backend enforces this as well
            });

            setOpen(false);
            setFormData({
                termName: '',
                startDate: toStr(new Date()),
                endDateType: 'open',
                endDate: undefined,
                academicYearId: activeAcademicYear?.id || '',
            });
        } catch (error) {
            console.error('Error creating leadership term:', error);
            formValidation.setSubmissionError(error instanceof Error ? error.message : 'The leadership term could not be created. Please try again.');
        }
    };

    const handleInputChange = (field: keyof CreateLeadershipTermData, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <div title={hasActiveTerm ? "Please terminate the active term first" : ""}>
                        <Button variant="outline" disabled={hasActiveTerm}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Term
                        </Button>
                    </div>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create Leadership Term</DialogTitle>
                    <DialogDescription>
                        Group prefect assignments into a specific term or administration (e.g. 2025 - 2026 Admin)
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                    <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
                    <div className="space-y-2">
                        <Label htmlFor="termName" className={formValidation.getFieldError('termName') ? 'text-destructive' : undefined}>Term Name *</Label>
                        <Input
                            id="termName"
                            value={formData.termName}
                            onChange={(e) => { handleInputChange('termName', e.target.value); formValidation.handleFieldChange('termName'); }}
                            {...formValidation.getFieldProps('termName')}
                            placeholder="e.g., 2025 - 2026 Term, First Term Cohort"
                        />
                        <FieldError error={formValidation.getFieldError('termName')} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="academicYear">Academic Year Linkage</Label>
                        <Select
                            value={formData.academicYearId || 'none'}
                            onValueChange={(value) => handleInputChange('academicYearId', value === 'none' ? undefined : value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select academic year (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No linkage</SelectItem>
                                {academicYears.map((year) => (
                                    <SelectItem key={year.id} value={year.id}>
                                        {year.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className={formValidation.getFieldError('leadershipStartDate') ? 'text-destructive' : undefined}>Start Date *</Label>
                            <DatePicker
                                date={toDate(formData.startDate)}
                                setDate={(d) => { handleInputChange('startDate', toStr(d)); formValidation.handleFieldChange('leadershipStartDate'); }}
                                triggerProps={formValidation.getFieldProps('leadershipStartDate')}
                                placeholder="Pick start date"
                            />
                            <FieldError error={formValidation.getFieldError('leadershipStartDate')} />
                        </div>

                        <div className="space-y-2">
                            <Label>Term Completion</Label>
                            <RadioGroup
                                value={formData.endDateType}
                                onValueChange={(val) => handleInputChange('endDateType', val)}
                                className="flex flex-col space-y-1 mt-2"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="open" id="open" />
                                    <Label htmlFor="open" className="font-normal">Open (Terminate later)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="mark" id="mark" />
                                    <Label htmlFor="mark" className="font-normal">Mark exact date</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>

                    {formData.endDateType === 'mark' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <Label className={formValidation.getFieldError('leadershipEndDate') ? 'text-destructive' : undefined}>End Date *</Label>
                            <DatePicker
                                date={toDate(formData.endDate)}
                                setDate={(d) => { handleInputChange('endDate', toStr(d)); formValidation.handleFieldChange('leadershipEndDate'); }}
                                triggerProps={formValidation.getFieldProps('leadershipEndDate')}
                                placeholder="Pick end date"
                                allowFuture
                            />
                            <FieldError error={formValidation.getFieldError('leadershipEndDate')} />
                        </div>
                    )}

                    <div className="flex justify-end space-x-2 pt-4 border-t">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            disabled={createLeadershipTerm.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={createLeadershipTerm.isPending}
                        >
                            {createLeadershipTerm.isPending && (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            )}
                            Create Term
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
