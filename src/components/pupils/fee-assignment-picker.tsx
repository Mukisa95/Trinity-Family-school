'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { FeeStructure } from '@/types';

interface FeeAssignmentPickerProps {
  fees: FeeStructure[];
  selectedFeeId: string;
  onSelectFeeId: (feeId: string) => void;
  selectedFeeName?: string;
  triggerId?: string;
  placeholder?: string;
}

export function FeeAssignmentPicker({
  fees,
  selectedFeeId,
  onSelectFeeId,
  selectedFeeName,
  triggerId = 'fee-select',
  placeholder = 'Choose a fee or discount to assign',
}: FeeAssignmentPickerProps) {
  const [open, setOpen] = useState(false);
  const [assignmentFeeSearch, setAssignmentFeeSearch] = useState('');
  const [discountSearch, setDiscountSearch] = useState('');
  const [assignmentFeesExpanded, setAssignmentFeesExpanded] = useState(false);
  const [discountsExpanded, setDiscountsExpanded] = useState(false);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(amount);

  const assignmentFeeOptions = useMemo(
    () => fees.filter((f) => f.category !== 'Discount'),
    [fees]
  );

  const discountFeeOptions = useMemo(
    () => fees.filter((f) => f.category === 'Discount'),
    [fees]
  );

  const filteredAssignmentFees = useMemo(() => {
    const query = assignmentFeeSearch.trim().toLowerCase();
    if (!query) return assignmentFeeOptions;
    return assignmentFeeOptions.filter((f) => f.name.toLowerCase().includes(query));
  }, [assignmentFeeOptions, assignmentFeeSearch]);

  const filteredDiscountFees = useMemo(() => {
    const query = discountSearch.trim().toLowerCase();
    if (!query) return discountFeeOptions;
    return discountFeeOptions.filter((f) => f.name.toLowerCase().includes(query));
  }, [discountFeeOptions, discountSearch]);

  const selectedFee = useMemo(
    () => fees.find((f) => f.id === selectedFeeId),
    [fees, selectedFeeId]
  );

  const displayLabel = selectedFee?.name ?? selectedFeeName;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      if (assignmentFeeOptions.length > 0) {
        setAssignmentFeesExpanded(true);
      } else if (discountFeeOptions.length > 0) {
        setDiscountsExpanded(true);
      }
    } else {
      setAssignmentFeeSearch('');
      setDiscountSearch('');
      setAssignmentFeesExpanded(false);
      setDiscountsExpanded(false);
    }
  };

  const renderFeeOption = (fee: FeeStructure, kind: 'assignment' | 'discount') => {
    const isSelected = selectedFeeId === fee.id;

    return (
      <button
        type="button"
        key={fee.id}
        onClick={() => {
          onSelectFeeId(fee.id);
          handleOpenChange(false);
        }}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-slate-100',
          isSelected && 'bg-indigo-50 ring-1 ring-indigo-200'
        )}
      >
        <span className="min-w-0 flex-1 truncate font-medium">{fee.name}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {kind === 'assignment' ? (
            <Badge className="h-4 px-1.5 text-[10px]">Assignment</Badge>
          ) : (
            <Badge
              variant="secondary"
              className="h-4 bg-green-100 px-1.5 text-[10px] text-green-800 hover:bg-green-100"
            >
              Discount
            </Badge>
          )}
          <span
            className={cn(
              'whitespace-nowrap text-xs font-semibold',
              kind === 'assignment' ? 'text-blue-700' : 'text-green-700'
            )}
          >
            {kind === 'discount' && fee.amount < 0
              ? `${formatCurrency(Math.abs(fee.amount))} off`
              : kind === 'discount'
                ? `${fee.amount}% off`
                : formatCurrency(fee.amount)}
          </span>
        </div>
      </button>
    );
  };

  const renderFeeSection = (
    kind: 'assignment' | 'discount',
    options: FeeStructure[],
    filtered: FeeStructure[],
    search: string,
    onSearchChange: (value: string) => void,
    expanded: boolean,
    onExpandedChange: (open: boolean) => void,
    className?: string
  ) => {
    if (options.length === 0) return null;

    const isAssignment = kind === 'assignment';

    return (
      <Collapsible
        open={expanded || search.length > 0}
        onOpenChange={onExpandedChange}
        className={className}
      >
        <div
          className={cn(
            'overflow-hidden rounded-md border',
            isAssignment ? 'border-blue-100 bg-blue-50/40' : 'border-green-100 bg-green-50/40'
          )}
        >
          <CollapsibleTrigger className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
            <span
              className={cn(
                'text-xs font-bold uppercase tracking-wide',
                isAssignment ? 'text-blue-900' : 'text-green-900'
              )}
            >
              {isAssignment ? 'Assignment fees' : 'Discounts'}
              <span
                className={cn(
                  'ml-1.5 font-normal normal-case',
                  isAssignment ? 'text-blue-700/80' : 'text-green-700/80'
                )}
              >
                ({options.length})
              </span>
            </span>
            <ChevronDown
              className={cn(
                'ml-auto h-4 w-4 shrink-0 transition-transform duration-200',
                isAssignment ? 'text-blue-700' : 'text-green-700',
                (expanded || search.length > 0) && 'rotate-180'
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent
            className={cn(
              'border-t bg-white px-2 pb-2 pt-1.5',
              isAssignment ? 'border-blue-100' : 'border-green-100'
            )}
          >
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={isAssignment ? 'Search assignment fees...' : 'Search discounts...'}
                className="h-8 pl-8 text-xs"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <div className="max-h-36 space-y-0.5 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  {isAssignment ? 'No matching fees' : 'No matching discounts'}
                </p>
              ) : (
                filtered.map((fee) => renderFeeOption(fee, kind))
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={triggerId}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-10 w-full justify-between font-normal"
        >
          <span className={cn('truncate', !displayLabel && 'text-muted-foreground')}>
            {displayLabel ?? placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {fees.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">No available fees to assign</p>
        ) : (
          <div className="max-h-[min(70vh,22rem)] overflow-y-auto p-1.5">
            {renderFeeSection(
              'assignment',
              assignmentFeeOptions,
              filteredAssignmentFees,
              assignmentFeeSearch,
              setAssignmentFeeSearch,
              assignmentFeesExpanded,
              setAssignmentFeesExpanded
            )}
            {renderFeeSection(
              'discount',
              discountFeeOptions,
              filteredDiscountFees,
              discountSearch,
              setDiscountSearch,
              discountsExpanded,
              setDiscountsExpanded,
              assignmentFeeOptions.length > 0 ? 'mt-1.5' : undefined
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
