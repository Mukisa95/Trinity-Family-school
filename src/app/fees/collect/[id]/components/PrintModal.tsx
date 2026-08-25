import React, { useState } from 'react';
import { Printer } from '@phosphor-icons/react';
import { Printer as LucidePrinter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ReportCreationDialogFrame } from '@/components/exam/report-creation-dialog';
import type { Pupil, AcademicYear } from '@/types';
import type { PupilFee } from '../types';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  fees: PupilFee[];
  pupil?: Pupil;
  selectedAcademicYear?: AcademicYear | null;
  selectedTerm?: string;
  onPrint?: (selectedFees: PupilFee[]) => void;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-UG', {
  style: 'currency',
  currency: 'UGX',
  maximumFractionDigits: 0,
}).format(amount || 0);

export function PrintModal({
  isOpen,
  onClose,
  fees,
  pupil,
  selectedAcademicYear,
  selectedTerm,
  onPrint,
}: PrintModalProps) {
  const [selectedFees, setSelectedFees] = useState<string[]>([]);
  const selectedFeeItems = fees.filter((fee) => selectedFees.includes(fee.id));
  const totalAmount = selectedFeeItems.reduce((sum, fee) => sum + (fee.amount || 0), 0);
  const totalPaid = selectedFeeItems.reduce((sum, fee) => sum + (fee.paid || 0), 0);
  const totalBalance = totalAmount - totalPaid;
  const allSelected = fees.length > 0 && selectedFees.length === fees.length;
  const scope = pupil
    ? `${`${pupil.firstName || ''} ${pupil.lastName || ''}`.trim() || 'Pupil'} · ${selectedAcademicYear?.name || 'Current academic year'}`
    : `${fees.length} available fee${fees.length === 1 ? '' : 's'}`;

  const handleToggleFee = (feeId: string) => {
    setSelectedFees((current) => (
      current.includes(feeId)
        ? current.filter((id) => id !== feeId)
        : [...current, feeId]
    ));
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedFees(checked ? fees.map((fee) => fee.id) : []);
  };

  const handleClose = () => {
    setSelectedFees([]);
    onClose();
  };

  const handlePrint = () => {
    if (selectedFeeItems.length === 0) return;
    // The parent starts a PDF workspace job immediately, then this selection
    // dialog closes so the user can work while the document is being created.
    onPrint?.(selectedFeeItems);
    handleClose();
  };

  return (
    <ReportCreationDialogFrame
      open={isOpen}
      onClose={handleClose}
      scope={scope}
      step={1}
      title="Select fees to print"
      description="Choose the fee items for this pupil statement."
      icon={LucidePrinter}
      flowSteps={['Fees', 'Options', 'Preview']}
      maxWidthClassName="sm:max-w-3xl"
      footer={
        <>
          <p className={`hidden text-xs font-medium sm:block ${selectedFeeItems.length ? 'text-slate-600' : 'text-red-600'}`}>
            {selectedFeeItems.length
              ? `${selectedFeeItems.length} fee${selectedFeeItems.length === 1 ? '' : 's'} · ${formatCurrency(totalBalance)} balance`
              : 'Select one or more fees to continue.'}
          </p>
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="min-h-11 rounded-full px-4 font-semibold text-slate-700 hover:bg-slate-200/70 hover:text-slate-950"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handlePrint}
              disabled={selectedFeeItems.length === 0}
              className="min-h-11 rounded-full bg-blue-600 px-5 font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:ring-blue-600"
            >
              <Printer className="mr-2 h-4 w-4" />
              Create PDF
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4 py-0.5">
        <section className="grid gap-2 rounded-3xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-3" aria-label="Selected fees summary">
          {[
            ['Selected', `${selectedFeeItems.length} fee${selectedFeeItems.length === 1 ? '' : 's'}`, 'text-blue-700'],
            ['Total', formatCurrency(totalAmount), 'text-slate-900'],
            ['Balance', formatCurrency(totalBalance), 'text-red-700'],
          ].map(([label, value, valueClass]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className={`mt-0.5 text-sm font-bold ${valueClass}`}>{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-3" aria-labelledby="fees-to-print-title">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 id="fees-to-print-title" className="text-sm font-bold text-slate-900">Fee items</h3>
            {fees.length > 0 && (
              <Label htmlFor="select-all-fees-to-print" className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                All
                <Checkbox
                  id="select-all-fees-to-print"
                  checked={allSelected}
                  onCheckedChange={(checked) => handleSelectAll(checked === true)}
                />
              </Label>
            )}
          </div>

          {fees.length === 0 ? (
            <div className="flex min-h-28 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 text-center">
              <Printer className="h-7 w-7 text-slate-400" />
              <p className="mt-2 text-sm font-semibold text-slate-700">No fees available</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {fees.map((fee) => {
                const paid = fee.paid || 0;
                const balance = fee.balance ?? Math.max(0, (fee.amount || 0) - paid);
                const status = balance <= 0 && paid > 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid';
                const isSelected = selectedFees.includes(fee.id);
                const feeId = `fee-to-print-${fee.id}`;

                return (
                  <div
                    key={fee.id}
                    className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-2 transition-[border-color,background-color,box-shadow] duration-200 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 shadow-[0_6px_18px_rgba(37,99,235,0.08)]'
                        : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                    }`}
                  >
                    <Checkbox
                      id={feeId}
                      checked={isSelected}
                      onCheckedChange={() => handleToggleFee(fee.id)}
                    />
                    <Label htmlFor={feeId} className="min-w-0 flex-1 cursor-pointer">
                      <span className="block truncate text-sm font-semibold text-slate-900">{fee.name}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{fee.category || 'General'}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-700'
                            : status === 'Partial'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}>{status}</span>
                        {fee.discount && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Discount</span>}
                      </span>
                    </Label>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(fee.amount || 0)}</p>
                      <p className={`mt-0.5 text-xs font-semibold ${balance > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {balance > 0 ? `${formatCurrency(balance)} due` : 'Cleared'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {selectedTerm && (
          <div className="rounded-3xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-xs font-semibold text-blue-900">
            Statement term: {selectedTerm}
          </div>
        )}
      </div>
    </ReportCreationDialogFrame>
  );
}
