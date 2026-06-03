import React, { useState, useEffect, useMemo } from 'react';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
  ModernDialogDescription,
  ModernDialogFooter,
} from "@/components/ui/modern-dialog";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, GripVertical, ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import type { Pupil } from '@/types';

export interface ExportConfig {
  columns: string[];
  nameFormat: 'combined' | 'separated';
  classFormat: 'name' | 'code';
  sectionFormat: 'full' | 'short';
  genderFormat: 'full' | 'short';
}

interface ExportConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (config: ExportConfig) => void;
  pupils: Pupil[];
}

interface ColumnDefinition {
  id: string;
  label: string;
  isDynamicCode?: boolean;
}

const BASE_COLUMNS: ColumnDefinition[] = [
  { id: 'indexNumber', label: 'Index Number' },
  { id: 'lin', label: 'LIN Number' },
  { id: 'admissionNumber', label: 'Admission Number' },
  { id: 'name', label: 'Pupil Name' },
  { id: 'gender', label: 'Gender' },
  { id: 'class', label: 'Class' },
  { id: 'stream', label: 'Stream' },
  { id: 'section', label: 'Study Status (Section)' },
  { id: 'status', label: 'Account Status' },
  { id: 'age', label: 'Age / DOB' },
  { id: 'siblingCount', label: 'Sibling Count' },
  { id: 'house', label: 'House' },
];

export function ExportConfigModal({
  isOpen,
  onClose,
  onExport,
  pupils
}: ExportConfigModalProps) {
  // Extract dynamic ID codes present in the current pupils list
  const dynamicCodeColumns = useMemo(() => {
    const codeTypes = new Set<string>();
    
  // Look for explicit specific codes first, such as a SchoolPay payment code if it is stored separately
    // Then look through generic additionalIdentifiers
    pupils.forEach(p => {
      if (p.additionalIdentifiers) {
        p.additionalIdentifiers.forEach(id => {
          if (id.idType && id.idType.trim() && id.idType !== 'LIN' && id.idType !== 'indexNumber') {
            codeTypes.add(id.idType.trim());
          }
        });
      }
    });

    return Array.from(codeTypes).map(type => ({
      id: `code:${type}`,
      label: `${type} Code`,
      isDynamicCode: true
    }));
  }, [pupils]);

  const allAvailableColumns = useMemo(() => {
    return [...BASE_COLUMNS, ...dynamicCodeColumns];
  }, [dynamicCodeColumns]);

  const [activeColumns, setActiveColumns] = useState<string[]>([]);
  const [inactiveColumns, setInactiveColumns] = useState<string[]>([]);
  
  const [nameFormat, setNameFormat] = useState<'combined' | 'separated'>('separated');
  const [classFormat, setClassFormat] = useState<'name' | 'code'>('name');
  const [sectionFormat, setSectionFormat] = useState<'full' | 'short'>('short');
  const [genderFormat, setGenderFormat] = useState<'full' | 'short'>('short');

  // Initialize columns when modal opens
  useEffect(() => {
    if (isOpen) {
      // Default selection
      const defaultActive = [
        'indexNumber',
        'lin',
        'admissionNumber', 
        'name', 
        'gender', 
        'class', 
        'stream',
        'section', 
        'house',
        ...dynamicCodeColumns.map(c => c.id)
      ];
      
      const defaultInactive = allAvailableColumns
        .map(c => c.id)
        .filter(id => !defaultActive.includes(id));

      setActiveColumns(defaultActive);
      setInactiveColumns(defaultInactive);
    }
  }, [isOpen, allAvailableColumns, dynamicCodeColumns]);

  const getColumnLabel = (id: string) => {
    return allAvailableColumns.find(c => c.id === id)?.label || id;
  };

  const toggleColumn = (id: string, isActive: boolean) => {
    if (isActive) {
      // Move to inactive
      setActiveColumns(prev => prev.filter(colId => colId !== id));
      setInactiveColumns(prev => [...prev, id]);
    } else {
      // Move to active (append)
      setInactiveColumns(prev => prev.filter(colId => colId !== id));
      setActiveColumns(prev => [...prev, id]);
    }
  };

  const moveColumnUp = (index: number) => {
    if (index === 0) return;
    setActiveColumns(prev => {
      const newCols = [...prev];
      const temp = newCols[index];
      newCols[index] = newCols[index - 1];
      newCols[index - 1] = temp;
      return newCols;
    });
  };

  const moveColumnDown = (index: number) => {
    if (index === activeColumns.length - 1) return;
    setActiveColumns(prev => {
      const newCols = [...prev];
      const temp = newCols[index];
      newCols[index] = newCols[index + 1];
      newCols[index + 1] = temp;
      return newCols;
    });
  };

  const handleExport = () => {
    onExport({
      columns: activeColumns,
      nameFormat,
      classFormat,
      sectionFormat,
      genderFormat
    });
    onClose();
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModernDialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <ModernDialogHeader className="pt-6 pb-2 px-6">
          <ModernDialogTitle className="flex items-center gap-2 text-xl">
            <Download className="w-5 h-5 text-green-600" />
            Customize Excel Export
          </ModernDialogTitle>
          <ModernDialogDescription>
            Choose which columns to include, arrange their order, and select formatting options.
          </ModernDialogDescription>
        </ModernDialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 bg-slate-50/50">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Formatting Options */}
            <div className="space-y-5 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-slate-800 text-sm border-b pb-2">Formatting Options</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500">Pupil Name</Label>
                  <RadioGroup value={nameFormat} onValueChange={(val: any) => setNameFormat(val)} className="flex flex-col gap-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="separated" id="name-sep" />
                      <Label htmlFor="name-sep" className="text-sm font-normal cursor-pointer">Separated (Surname, First Name, Other Names)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="combined" id="name-comb" />
                      <Label htmlFor="name-comb" className="text-sm font-normal cursor-pointer">Combined Together</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500">Class Format</Label>
                  <RadioGroup value={classFormat} onValueChange={(val: any) => setClassFormat(val)} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="name" id="class-full" />
                      <Label htmlFor="class-full" className="text-sm font-normal cursor-pointer">Full Name</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="code" id="class-code" />
                      <Label htmlFor="class-code" className="text-sm font-normal cursor-pointer">Short Code</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500">Study Status (Section)</Label>
                  <RadioGroup value={sectionFormat} onValueChange={(val: any) => setSectionFormat(val)} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="short" id="section-short" />
                      <Label htmlFor="section-short" className="text-sm font-normal cursor-pointer">D / B</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="full" id="section-full" />
                      <Label htmlFor="section-full" className="text-sm font-normal cursor-pointer">Day / Boarding</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500">Gender Format</Label>
                  <RadioGroup value={genderFormat} onValueChange={(val: any) => setGenderFormat(val)} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="short" id="gender-short" />
                      <Label htmlFor="gender-short" className="text-sm font-normal cursor-pointer">M / F</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="full" id="gender-full" />
                      <Label htmlFor="gender-full" className="text-sm font-normal cursor-pointer">Male / Female</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>

            {/* Right Column - Column Selection and Ordering */}
            <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold text-slate-800 text-sm">Columns & Ordering</h3>
                <span className="text-xs text-slate-500">{activeColumns.length} included</span>
              </div>
              
              <ScrollArea className="flex-1 pr-4 -mr-4">
                <div className="space-y-6">
                  {/* Active Columns */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Columns (In Order)</Label>
                    <div className="space-y-1.5">
                      {activeColumns.map((colId, index) => (
                        <div key={colId} className="flex items-center gap-2 bg-indigo-50/50 border border-indigo-100 p-2 rounded-lg group">
                          <button 
                            onClick={() => toggleColumn(colId, true)}
                            className="text-indigo-600 hover:text-indigo-800 p-1 bg-white rounded shadow-sm hover:bg-slate-50 transition-colors"
                            title="Remove column"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                            {getColumnLabel(colId)}
                          </span>
                          
                          <div className="flex flex-col gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => moveColumnUp(index)}
                              disabled={index === 0}
                              className="p-0.5 hover:bg-white rounded disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => moveColumnDown(index)}
                              disabled={index === activeColumns.length - 1}
                              className="p-0.5 hover:bg-white rounded disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {activeColumns.length === 0 && (
                        <div className="text-center p-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                          No columns selected for export
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Available Columns */}
                  {inactiveColumns.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available Columns</Label>
                      <div className="flex flex-wrap gap-2">
                        {inactiveColumns.map((colId) => (
                          <button
                            key={colId}
                            onClick={() => toggleColumn(colId, false)}
                            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1.5 rounded-lg text-sm text-slate-600 transition-colors"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                            {getColumnLabel(colId)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

        </div>

        <ModernDialogFooter className="p-4 border-t bg-white">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={activeColumns.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Generate Excel
          </Button>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
}
