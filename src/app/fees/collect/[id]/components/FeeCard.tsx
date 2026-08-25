import React, { useState } from 'react';
import { CurrencyCircleDollar, Receipt, IdentificationCard, Printer, ChatCircle, ArrowCounterClockwise, TShirt, CaretDown, CaretUp, Package } from '@phosphor-icons/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { useStaffById } from '@/lib/hooks/use-staff';
import { UniformFeesIntegrationService } from '@/lib/services/uniform-fees-integration.service';
import { useUpdateUniformTracking } from '@/lib/hooks/use-uniform-tracking';
import { useUniforms } from '@/lib/hooks/use-uniforms';
import { useUniformInventory, useIncrementStockBatch } from '@/lib/hooks/use-uniform-inventory';
import { CollectionModal } from '@/components/common/collection-modal';
import { PaymentSignatureDisplay } from './PaymentSignatureDisplay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import type { AcademicYear, PaymentRecord, Pupil, UniformTracking } from '@/types';
import { getCollectedUniformItemIds } from '../utils/uniformCollectionState';
import { usePDFViewer } from '@/lib/hooks/use-pdf-viewer';
import { useToast } from '@/hooks/use-toast';

// Extended PupilFee interface (matching the main component)
interface PupilFee {
  id: string;
  name: string;
  amount: number;
  category: string;
  description?: string;
  isRequired: boolean;
  isAssignmentFee?: boolean;
  paid: number;
  balance: number;
  payments: PaymentRecord[];
  discount?: {
    id: string;
    name: string;
    amount: number;
    type: 'fixed' | 'percentage' | 'fees-holiday';
  };
  originalAmount?: number;
  feeBreakdown?: Array<{
    name: string;
    amount: number;
    paid: number;
    balance: number;
    term: string;
    year: string;
  }>;
}

interface FeeCardProps {
  fee: PupilFee;
  pupil: Pupil;
  onPayment: (fee: PupilFee, balance: number, totalPaid: number) => void;
  onRevertPayment?: (payment: PaymentRecord, fee: PupilFee) => void;
  selectedTerm: string;
  selectedAcademicYear: AcademicYear | null;
  isPaymentDataLoading?: boolean; // When true, payment buttons should be disabled
  uniformTrackingRecord?: UniformTracking | null;
  isUniformTrackingLoading?: boolean;
  uniformTrackingError?: Error | null;
}

export function FeeCard({
  fee,
  pupil,
  onPayment,
  onRevertPayment,
  selectedTerm,
  selectedAcademicYear,
  isPaymentDataLoading = false,
  uniformTrackingRecord = null,
  isUniformTrackingLoading = false,
  uniformTrackingError = null,
}: FeeCardProps) {
  const pdfViewer = usePDFViewer();
  const { toast } = useToast();
  const [isPaymentHistoryExpanded, setIsPaymentHistoryExpanded] = useState(false);
  const [isUniformTrackingExpanded, setIsUniformTrackingExpanded] = useState(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const totalPaid = fee.paid || 0;
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(amount || 0);

  const formatCurrencyCompact = (amount: number) =>
    'Sh. ' + new Intl.NumberFormat('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);

  // Get uniform tracking ID if this is a uniform fee
  const uniformTrackingId = UniformFeesIntegrationService.isUniformFee(fee)
    ? (fee as any).uniformTrackingId
    : null;

  // Fetch uniforms for collection modal
  const { data: allUniforms = [] } = useUniforms();

  // Update uniform tracking mutation
  const updateUniformTracking = useUpdateUniformTracking();
  const incrementStockBatch = useIncrementStockBatch();
  const queryClient = useQueryClient();

  // Uniform inventory for size/stock tracking
  const { data: uniformInventory = [] } = useUniformInventory();

  // Handle collection submission
  const handleCollectionSubmit = async (
    collectedItems: string[],
    isFullCollection: boolean,
    collectionSizes: Record<string, string>,
    collectionQuantities?: Record<string, number>
  ) => {
    if (!uniformTrackingId || !uniformTrackingRecord) return;

    const mergedSizes = {
      ...(uniformTrackingRecord.selectedSizes || {}),
      ...collectionSizes,
    };
    const stockReductions = collectedItems
      .filter(itemId => collectionSizes[itemId])
      .map(itemId => ({
        uniformId: itemId,
        size: collectionSizes[itemId],
        quantity: collectionQuantities?.[itemId] || 1,
      }));
    try {
      const mergedCollectedQuantities: Record<string, number> = {
        ...(uniformTrackingRecord.collectedQuantities || {})
      };
      collectedItems.forEach(itemId => {
        const added = collectionQuantities?.[itemId] || 1;
        mergedCollectedQuantities[itemId] = (mergedCollectedQuantities[itemId] || 0) + added;
      });

      const allItemIds = trackingUniforms.map(u => u.id);
      const fullyCollectedItemIds = allItemIds.filter(id => {
        const totalQty = uniformTrackingRecord.selectedQuantities?.[id] || 1;
        const colQty = mergedCollectedQuantities[id] || 0;
        return colQty >= totalQty;
      });
      const isCompleteCollection = allItemIds.length > 0 && allItemIds.every(id => fullyCollectedItemIds.includes(id));

      // Update tracking record
      await updateUniformTracking.mutateAsync({
        id: uniformTrackingId,
        data: {
          collectedItems: fullyCollectedItemIds,
          collectionStatus: isCompleteCollection ? 'collected' : 'partial',
          collectionDate: new Date().toISOString(),
          selectedSizes: mergedSizes,
          collectedQuantities: mergedCollectedQuantities,
          history: [
            ...(uniformTrackingRecord.history || []),
            {
              date: new Date().toISOString(),
              type: 'collection',
              collectedItems: collectedItems,
              releasedBy: 'Current User'
            }
          ]
        },
        stockReductions,
      });

      setIsCollectionModalOpen(false);
    } catch (error) {
      console.error('Error recording collection:', error);
      const errorCode =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : '';
      if (errorCode.includes('resource-exhausted')) {
        alert('The school database read quota is temporarily exhausted. No collection was recorded and no stock was changed. Please try again later.');
      } else {
        alert('Failed to record collection. No collection or stock change was saved.');
      }
      throw error;
    }
  };

  // Handle unmark — remove a previously collected item
  const handleUnmarkItem = async (uniformId: string, size: string | undefined) => {
    if (!uniformTrackingId || !uniformTrackingRecord) return;

    try {
      // Restore stock if a size was recorded
      if (size) {
        try {
          await incrementStockBatch.mutateAsync([{ uniformId, size, quantity: 1 }]);
        } catch (stockError) {
          console.error('Error restoring stock:', stockError);
        }
      }

      // Use the authoritative top-level collectedItems on the record
      const currentCollectedItems: string[] = uniformTrackingRecord.collectedItems || [];
      const newCollectedItems = currentCollectedItems.filter((id: string) => id !== uniformId);

      // Determine new collection status
      const allItemIds = trackingUniforms.map(u => u.id);
      const newCollectionStatus =
        newCollectedItems.length === 0
          ? 'pending'
          : newCollectedItems.length >= allItemIds.length
          ? 'collected'
          : 'partial';

      // Remove the size from selectedSizes
      const updatedSizes = { ...(uniformTrackingRecord.selectedSizes || {}) };
      delete updatedSizes[uniformId];

      await updateUniformTracking.mutateAsync({
        id: uniformTrackingId,
        data: {
          collectedItems: newCollectedItems,
          collectionStatus: newCollectionStatus,
          selectedSizes: updatedSizes,
          history: [
            ...(uniformTrackingRecord.history || []),
            {
              date: new Date().toISOString(),
              type: 'unmark',
              collectedItems: [],
              unmarkedItems: [uniformId],
              releasedBy: 'Current User',
            },
          ],
        },
      });

    } catch (error) {
      console.error('Error unmarking item:', error);
      alert('Failed to unmark item. Please try again.');
    }
  };

  // Get uniforms for the tracking record
  const trackingUniforms = React.useMemo(() => {
    if (!uniformTrackingRecord || !allUniforms.length) return [];
    const uniformIds = Array.isArray(uniformTrackingRecord.uniformId)
      ? uniformTrackingRecord.uniformId
      : [uniformTrackingRecord.uniformId];
    return allUniforms.filter(u => uniformIds.includes(u.id));
  }, [uniformTrackingRecord, allUniforms]);

  // Resolve current and legacy collected items through the shared display state.
  const previouslyCollectedItems = React.useMemo(() => {
    if (!uniformTrackingRecord) return [];
    return getCollectedUniformItemIds(uniformTrackingRecord);
  }, [uniformTrackingRecord]);

  const effectiveCollectionStatus = React.useMemo(() => {
    if (!uniformTrackingRecord) return null;
    if (uniformTrackingRecord.collectionStatus === 'collected') return 'collected';

    const uniformIds = Array.isArray(uniformTrackingRecord.uniformId)
      ? uniformTrackingRecord.uniformId
      : [uniformTrackingRecord.uniformId];
    const isFullyCollected =
      uniformIds.length > 0 &&
      uniformIds.every(id => {
        const total = uniformTrackingRecord.selectedQuantities?.[id] || 1;
        const collected =
          uniformTrackingRecord.collectedQuantities?.[id] ??
          (previouslyCollectedItems.includes(id) ? total : 0);
        return collected >= total;
      });

    return isFullyCollected ? 'collected' : uniformTrackingRecord.collectionStatus;
  }, [uniformTrackingRecord, previouslyCollectedItems]);

  // For carry forward fees, use the pre-calculated balance to avoid double-counting payments
  const balance = fee.id === 'previous-balance' ? (fee.balance || 0) : ((fee.amount || 0) - totalPaid);
  const { data: schoolSettings } = useSchoolSettings();

  // Fetch staff member information if pupil has assigned staff
  const { data: assignedStaff } = useStaffById(pupil.assignedStaffId || '', {
    enabled: !!pupil.assignedStaffId && fee.discount?.type === 'fees-holiday'
  });

  // Get payments sorted by date (most recent first)
  const sortedPayments = [...(fee.payments || [])].sort((a, b) => {
    const dateA = new Date(a.paymentDate || '').getTime();
    const dateB = new Date(b.paymentDate || '').getTime();
    return dateB - dateA;
  });
  const latestReceiptPayment = sortedPayments.find((payment) => !payment.reverted);

  // Show only 2 most recent payments when collapsed
  const displayedPayments = isPaymentHistoryExpanded ? sortedPayments : sortedPayments.slice(0, 2);
  const hasMorePayments = sortedPayments.length > 2;

  const handlePrintReceipt = async (payment: PaymentRecord) => {
    const receiptNumber = payment.id.slice(-8).toUpperCase();
    const fileName = `receipt-${receiptNumber}-${pupil.firstName}-${pupil.lastName}.pdf`;
    await pdfViewer.runPDFJob(
      { fileName, title: `Receipt ${receiptNumber}`, initialMessage: 'Rendering payment receipt…' },
      async ({ updateProgress }) => {
        updateProgress(18, 'Preparing receipt details…');
        const doc = new jsPDF({
          unit: 'mm',
          format: [80, 120],
          orientation: 'portrait',
        });
        const currentDate = new Date().toLocaleString();
        const paymentDate = new Date(payment.paymentDate).toLocaleDateString();

    // Set up styling
    doc.setFillColor(248, 250, 252);

    // HEADER SECTION - School Information (properly spaced with more vertical space)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const schoolName = schoolSettings?.generalInfo?.name || 'SCHOOL NAME';
    // Ensure school name fits within receipt width (74mm)
    doc.text(schoolName, 40, 8, { align: 'center', maxWidth: 70 });

    // School contact info with more spacing
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    if (schoolSettings?.contact?.phone) {
      doc.text(`Tel: ${schoolSettings.contact.phone}`, 40, 14, { align: 'center', maxWidth: 70 });
    }
    if (schoolSettings?.address?.physical) {
      doc.text(schoolSettings.address.physical, 40, 18, { align: 'center', maxWidth: 70 });
    }
    if (schoolSettings?.address?.city && schoolSettings?.address?.country) {
      doc.text(`${schoolSettings.address.city}, ${schoolSettings.address.country}`, 40, 22, { align: 'center', maxWidth: 70 });
    }

    // RECEIPT DETAILS - 2 Column Layout (adjusted for new header spacing)
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');

    // Left column
    doc.text(`Receipt No: ${receiptNumber}`, 5, 28);
    doc.text(`Date: ${paymentDate}`, 5, 31);

    // Right column
    doc.text(`Academic Year: ${selectedAcademicYear?.name || 'N/A'}`, 42, 28);
    doc.text(`Term: ${selectedTerm || 'N/A'}`, 42, 31);

    // STUDENT INFORMATION SECTION - 2 Column Layout
    doc.setFillColor(243, 244, 246);
    doc.rect(3, 35, 74, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('STUDENT INFORMATION', 5, 37.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    // Left column
    doc.text(`Name: ${pupil.firstName || ''} ${pupil.lastName || ''}`, 5, 41);
    doc.text(`Admission No: ${pupil.admissionNumber || 'N/A'}`, 5, 44);
    doc.setFont('helvetica', 'bold');
    doc.text(`Pay Code: ${pupil.payCode || pupil.additionalIdentifiers?.find(id => (id.idType || '').toLowerCase().includes('pay code'))?.idValue || 'N/A'}`, 5, 47);
    doc.setFont('helvetica', 'normal');

    // Right column
    doc.text(`Class: ${pupil.className || 'N/A'}`, 42, 41);
    doc.text(`Section: ${pupil.section || 'N/A'}`, 42, 44);

    // PAYMENT DETAILS SECTION
    doc.setFillColor(243, 244, 246);
    doc.rect(3, 48, 74, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT DETAILS', 5, 50.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Fee: ${fee.name || 'N/A'}`, 5, 54);
    doc.text(`Original Amount: ${new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.amount)}`, 5, 57);
    doc.text(`Amount Paid: ${new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(payment.amount)}`, 5, 60);

    // Calculate balance
    const currentBalance = (fee.amount || 0) - (fee.paid || 0);
    doc.text(`Balance: ${new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(currentBalance)}`, 5, 63);

    if (payment.paidBy?.name) {
      doc.text(`Received By: ${payment.paidBy.name}`, 5, 66);
    }

    // FOOTER SECTION
    doc.setFillColor(243, 244, 246);
    doc.rect(3, 70, 74, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('THANK YOU', 40, 72.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('Keep this receipt for your records', 40, 76, { align: 'center' });
    doc.text('This is a computer generated receipt', 40, 79, { align: 'center' });
    doc.text(`Generated: ${currentDate}`, 40, 82, { align: 'center' });

    // QR CODE SECTION - Generate actual QR code
    try {
      // Import QR code library dynamically
      const QRCode = await import('qrcode');

      // Generate QR code data
      const qrData = JSON.stringify({
        receiptNo: receiptNumber,
        studentName: `${pupil.firstName} ${pupil.lastName}`,
        amount: payment.amount,
        date: paymentDate,
        fee: fee.name,
        school: schoolSettings?.generalInfo?.name || 'School'
      });

      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        width: 60,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Add QR code to PDF
      doc.addImage(qrCodeDataURL, 'PNG', 30, 86, 20, 20);

      // Add border around entire receipt
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.rect(2, 2, 76, 108);
    } catch (error) {
      console.log('QR code generation error:', error);
      // Fallback with placeholder
      doc.setFillColor(240, 240, 240);
      doc.rect(30, 86, 20, 20, 'F');
      doc.setFontSize(5);
      doc.setFont('helvetica', 'normal');
      doc.text('QR Code', 40, 97, { align: 'center' });

      // Add border around entire receipt
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.rect(2, 2, 76, 108);
    }

        updateProgress(96, 'Finalizing receipt…');
        return doc.output('blob');
      },
    );
  };

  const handleSendSMS = (payment: PaymentRecord) => {
    // Will be implemented in later phases
    console.log('Send SMS for payment:', payment.id);
  };

  const handleRevertPayment = (payment: PaymentRecord) => {
    if (onRevertPayment) {
      onRevertPayment(payment, fee);
    } else {
      // Will be implemented in later phases
      console.log('Revert payment:', payment.id);
    }
  };

  const handlePrimaryAction = () => {
    if (balance <= 0) {
      if (!latestReceiptPayment) {
        toast({
          variant: 'destructive',
          title: 'Receipt unavailable',
          description: 'No completed payment was found for this fee.',
        });
        return;
      }

      void handlePrintReceipt(latestReceiptPayment).catch((error) => {
        console.error('Failed to open payment receipt:', error);
        toast({
          variant: 'destructive',
          title: 'Could not open receipt',
          description: 'Please try again.',
        });
      });
      return;
    }

    onPayment(fee, balance, totalPaid);
  };

  const handleGenerateAssignmentCard = () => {
    // Will be implemented in later phases
    console.log('Generate assignment card for fee:', fee.id);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border-2 border-slate-200 p-3 sm:p-4 transition-colors hover:border-indigo-300">
      {/* Fee Header - name and pay action on one line */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 flex-1 text-base sm:text-lg font-medium text-gray-900 break-words leading-tight">{fee.name}</h3>
        <button
          onClick={handlePrimaryAction}
          disabled={isPaymentDataLoading}
          className={`inline-flex flex-shrink-0 items-center justify-center px-4 py-2 border-2 text-xs sm:text-sm font-semibold rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isPaymentDataLoading
            ? 'border-gray-300 text-gray-400 bg-gray-50 cursor-not-allowed shadow-none'
            : 'border-indigo-600 text-indigo-700 bg-white shadow-sm hover:bg-indigo-50 hover:border-indigo-700 hover:shadow-md hover:scale-95 origin-center'
            }`}
        >
          {isPaymentDataLoading ? (
            <>
              <div className="w-4 h-4 mr-1.5 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
              <span className="hidden sm:inline">Fetching payment data...</span>
              <span className="sm:hidden">Loading...</span>
            </>
          ) : balance <= 0 ? (
            <>
              <Receipt className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">View Receipt</span>
              <span className="sm:hidden">Receipt</span>
            </>
          ) : (
            <>
              <span className="font-bold text-[11px] mr-1.5">Shs.</span>
              <span className="hidden sm:inline">{totalPaid > 0 ? 'Make Another Payment' : 'Make Payment'}</span>
              <span className="sm:hidden">{totalPaid > 0 ? 'Pay More' : 'Pay'}</span>
            </>
          )}
        </button>
      </div>

      <div className="min-w-0">
          {fee.description && fee.id !== 'previous-balance' && (
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 break-words">{fee.description}</p>
          )}

          {/* Discount Information - Compact */}
          {fee.discount && (
            <div className={`p-2.5 mt-2 rounded-md border ${fee.discount.type === 'fees-holiday' ? 'border-blue-200 bg-blue-50 hover:border-blue-300' : 'border-purple-100 bg-purple-50 hover:border-purple-200'} transition-all`}>
              {fee.discount.type === 'fees-holiday' ? (
                // Fees Holiday Display - New Format
                <>
                  <div className="text-xs sm:text-sm text-blue-700 mb-1.5">
                    This fee has been halted as part of staff privilege to {(() => {
                      if (assignedStaff) {
                        const title = assignedStaff.gender === 'Female' ? 'Mrs' : 'Mr';
                        return `${title} ${assignedStaff.firstName} ${assignedStaff.lastName}`;
                      }
                      return 'staff member';
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm text-blue-600 mt-0.5 break-words">
                    Applied to: {fee.name} ({new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.originalAmount || fee.amount)})
                  </div>
                </>
              ) : (
                // Regular Discount Display - Compact Dynamic Layout
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-x-4 gap-y-1.5 w-full">
                  {/* Left Column: Discount Name & Amount */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                    <span className="font-semibold text-purple-900 bg-purple-150/70 border border-purple-200 px-2 py-0.5 rounded text-[11px] uppercase tracking-wider truncate max-w-[150px]" title={fee.discount.name}>
                      {fee.discount.name}
                    </span>
                    <span className="text-purple-700 font-medium text-xs sm:text-sm">
                      Active Discount: <span className="font-bold text-purple-900">{formatCurrency(fee.discount.amount)}</span>
                    </span>
                  </div>
                  
                  {/* Right Column: Calculations and Term */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm font-medium">
                    <span className="text-purple-650">
                      Old amount: <span className="line-through text-purple-500/80">{formatCurrency(fee.originalAmount || (fee.amount + fee.discount.amount))}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-md">
                      New amount: <span className="font-bold text-emerald-800">{formatCurrency(fee.amount)}</span>
                    </span>
                    <span className="text-purple-300 text-xs hidden sm:inline">|</span>
                    <span className="text-purple-500 text-xs font-normal">
                      {selectedTerm} - {selectedAcademicYear?.name}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Previous Balance Breakdown - Redesigned: No scrolling, compact, color-coded */}
          {fee.id === 'previous-balance' && fee.feeBreakdown && (
            <div className="mt-2">
              <div className="space-y-1.5">
                {Object.entries(fee.feeBreakdown.reduce((acc, item) => {
                  const key = `${item.term} ${item.year}`;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(item);
                  return acc;
                }, {} as Record<string, Array<{ name: string; amount: number; paid: number; balance: number; term: string; year: string }>>))
                  .map(([termYear, items], termIndex) => {
                    // Color scheme for different terms
                    const colorSchemes = [
                      { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-100', text: 'text-blue-900', accent: 'text-blue-700' },
                      { bg: 'bg-amber-50', border: 'border-amber-200', header: 'bg-amber-100', text: 'text-amber-900', accent: 'text-amber-700' },
                      { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-100', text: 'text-purple-900', accent: 'text-purple-700' },
                      { bg: 'bg-green-50', border: 'border-green-200', header: 'bg-green-100', text: 'text-green-900', accent: 'text-green-700' },
                      { bg: 'bg-pink-50', border: 'border-pink-200', header: 'bg-pink-100', text: 'text-pink-900', accent: 'text-pink-700' },
                    ];
                    const colors = colorSchemes[termIndex % colorSchemes.length];

                    return (
                      <div key={termYear} className={`${colors.bg} ${colors.border} border rounded-md overflow-hidden`}>
                        {/* Term/Year Header */}
                        <div className={`${colors.header} px-2 py-1 border-b ${colors.border}`}>
                          <h4 className={`text-[11px] font-semibold ${colors.text}`}>{termYear}</h4>
                        </div>

                        {/* Items List - Compact inline layout */}
                        <div className="px-2 py-1 space-y-0.5">
                          {items.map((item, index) => (
                            <div key={index} className="flex items-center justify-between gap-2 text-[11px] py-0.5">
                              <span className={`${colors.accent} min-w-0 flex-1 truncate`}>{item.name}</span>
                              <span className={`${colors.text} font-medium whitespace-nowrap`}>
                                {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(item.balance)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Term Total */}
                        <div className={`${colors.header} px-2 py-0.5 border-t ${colors.border} flex justify-between items-center`}>
                          <span className={`text-[10px] font-medium ${colors.text}`}>Term Total:</span>
                          <span className={`text-[11px] font-bold ${colors.text} whitespace-nowrap`}>
                            {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(
                              items.reduce((sum, item) => sum + item.balance, 0)
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                {/* Grand Total */}
                <div className="bg-red-50 border-2 border-red-300 rounded-md px-2 py-1.5 mt-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-red-900">Total Outstanding Balance:</span>
                    <span className="text-[12px] text-red-700 whitespace-nowrap font-bold">
                      {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(fee.amount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Uniform Details */}
          {UniformFeesIntegrationService.isUniformFee(fee) && (
            <div className="mt-2 space-y-2">
              <div className="p-2 rounded-md border border-blue-100 bg-blue-50">
                <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-1 font-semibold text-blue-900 shrink-0">
                      <TShirt size={14} className="text-blue-600" />
                      <span>Uniform Details</span>
                    </div>

                    {(fee as any).uniformDetails?.selectionMode && (
                      <span className="text-[10px] text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded border border-blue-200 font-medium shrink-0">
                        {(fee as any).uniformDetails.selectionMode}
                      </span>
                    )}

                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[11px] font-medium text-blue-800 shrink-0">Items:</span>
                      {(() => {
                        const uniformIds = (fee as any).uniformDetails?.uniformId || [];
                        const uniformIdArray = Array.isArray(uniformIds) ? uniformIds : [uniformIds];
                        const uniformNames = (fee as any).uniformDetails?.uniformNames || [];

                        if (uniformNames.length > 0) {
                          return uniformNames.map((name: string, index: number) => {
                            let uniformId = uniformIdArray[index];
                            if (!uniformId && allUniforms.length > 0) {
                              const cleanName = name.replace(/^\d+\s*x\s*/, '');
                              const matchedUniform = allUniforms.find(u => u.name === cleanName || u.name === name);
                              uniformId = matchedUniform?.id;
                            }

                            const isCollected = uniformId ? previouslyCollectedItems.includes(uniformId) : false;
                            const totalQty = uniformTrackingRecord?.selectedQuantities?.[uniformId!] || 1;
                            const colQty = uniformTrackingRecord?.collectedQuantities?.[uniformId!] ?? (isCollected ? totalQty : 0);
                            const isFullyCollected = colQty >= totalQty && colQty > 0;
                            const isPartiallyCollected = colQty > 0 && colQty < totalQty;

                            let sizeInfo = null;
                            if (uniformId && uniformTrackingRecord) {
                              const selectedSize = uniformTrackingRecord.selectedSizes?.[uniformId];
                              if (selectedSize) {
                                const inventory = uniformInventory.find(i => i.uniformId === uniformId);
                                if (inventory) {
                                  const stockItem = inventory.stock.find(s => s.size === selectedSize);
                                  const stock = stockItem?.quantity || 0;
                                  sizeInfo = {
                                    size: selectedSize,
                                    available: stock > 0
                                  };
                                }
                              }
                            }

                            return (
                              <div
                                key={index}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] ${
                                  isFullyCollected
                                    ? 'bg-green-100 border border-green-300 text-green-800'
                                    : isPartiallyCollected
                                    ? 'bg-amber-100 border border-amber-300 text-amber-900'
                                    : 'bg-white border border-gray-300 text-gray-700'
                                }`}
                              >
                                {isFullyCollected ? (
                                  <>
                                    <span className="text-green-600 font-bold">✓</span>
                                    <span className="line-through">{name} ({colQty}/{totalQty})</span>
                                    {sizeInfo && (
                                      <span className="text-[9px] text-green-600 ml-0.5">({sizeInfo.size})</span>
                                    )}
                                  </>
                                ) : isPartiallyCollected ? (
                                  <>
                                    <span className="text-amber-600 font-bold">◐</span>
                                    <span>{name} ({colQty}/{totalQty})</span>
                                    {sizeInfo && (
                                      <span className="text-[9px] text-amber-700 ml-0.5">({sizeInfo.size})</span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span className="text-gray-400">○</span>
                                    <span>{name} (0/{totalQty})</span>
                                    {sizeInfo && (
                                      <span className={`text-[9px] ml-0.5 ${sizeInfo.available ? 'text-blue-600' : 'text-red-600'}`}>
                                        ({sizeInfo.size}{sizeInfo.available ? '' : ' - Out'})
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          });
                        }

                        return <span className="text-gray-500 text-[11px]">No items listed</span>;
                      })()}
                    </div>

                    {(fee as any).uniformDetails?.discountAmount > 0 && (
                      <span className="text-[10px] font-medium text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200 shrink-0">
                        Discount Applied: {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format((fee as any).uniformDetails.discountAmount)}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setIsUniformTrackingExpanded(!isUniformTrackingExpanded)}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium shrink-0 ml-auto"
                  >
                    {isUniformTrackingExpanded ? (
                      <>
                        <CaretUp className="h-3.5 w-3.5" />
                        <span>Hide Tracking</span>
                      </>
                    ) : (
                      <>
                        <CaretDown className="h-3.5 w-3.5" />
                        <span>View Tracking</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Expandable Uniform Tracking Section */}
              {isUniformTrackingExpanded && (
                <div className="mt-2 p-3 rounded-md border border-indigo-200 bg-indigo-50">
                  {isUniformTrackingLoading ? (
                    <div className="text-sm text-gray-600">Loading tracking information...</div>
                  ) : uniformTrackingRecord ? (
                    <div className="space-y-3">
                      {/* Collection Status */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Collection Status:</span>
                        <Badge
                          variant={effectiveCollectionStatus === 'collected' ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {effectiveCollectionStatus === 'collected'
                            ? '📦 Collected'
                            : effectiveCollectionStatus === 'partial'
                            ? '◐ Partial'
                            : '⏱️ Pending'}
                        </Badge>
                      </div>

                      {/* Collected Items */}
                      {trackingUniforms.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-gray-700 mb-1.5 flex justify-between items-center">
                            <span>Uniform Items ({previouslyCollectedItems.length}/{trackingUniforms.length} collected):</span>
                          </p>
                          <div className="space-y-1">
                            {trackingUniforms.map((uniform) => {
                              const isCollected = previouslyCollectedItems.includes(uniform.id);

                              // Helper to get size status
                              const inventory = uniformInventory.find(i => i.uniformId === uniform.id);
                              let sizeStatus: { status: 'available' | 'out' | 'unspecified' | 'no-inventory', size?: string, stock?: number } = { status: 'no-inventory' };

                              if (inventory && inventory.sizes.length > 0) {
                                const size = uniformTrackingRecord.selectedSizes?.[uniform.id];
                                if (!size) {
                                  sizeStatus = { status: 'unspecified' };
                                } else {
                                  const stockItem = inventory.stock.find(s => s.size === size);
                                  const stock = stockItem?.quantity || 0;
                                  sizeStatus = stock > 0
                                    ? { status: 'available', size, stock }
                                    : { status: 'out', size, stock: 0 };
                                }
                              }

                              return (
                                <div
                                  key={uniform.id}
                                  className={`flex items-center justify-between p-2 rounded border text-xs ${isCollected
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-white border-gray-200'
                                    }`}
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <span className={isCollected ? 'text-green-700 font-medium' : 'text-gray-700 font-medium'}>
                                      {uniform.name}
                                    </span>

                                    {/* Size Badge */}
                                    {!isCollected && (
                                      <div className="flex items-center gap-1">
                                        {sizeStatus.status === 'available' && (
                                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] px-1 py-0 h-4 font-normal">
                                            Size: {sizeStatus.size}
                                          </Badge>
                                        )}
                                        {sizeStatus.status === 'out' && (
                                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[9px] px-1 py-0 h-4 font-normal">
                                            Size: {sizeStatus.size} (Out of Stock)
                                          </Badge>
                                        )}
                                        {sizeStatus.status === 'unspecified' && (
                                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] px-1 py-0 h-4 font-normal">
                                            No Size Selected
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                    {isCollected && uniformTrackingRecord.selectedSizes?.[uniform.id] && (
                                      <span className="text-[10px] text-green-600">Size: {uniformTrackingRecord.selectedSizes[uniform.id]}</span>
                                    )}
                                  </div>

                                  {(() => {
                                    const totalQty = uniformTrackingRecord.selectedQuantities?.[uniform.id] || 1;
                                    const colQty = uniformTrackingRecord.collectedQuantities?.[uniform.id] ?? (isCollected ? totalQty : 0);
                                    if (colQty >= totalQty && colQty > 0) {
                                      return (
                                        <Badge variant="outline" className="text-[10px] bg-green-100 text-green-800 border-green-300">
                                          ✓ Collected ({colQty}/{totalQty})
                                        </Badge>
                                      );
                                    } else if (colQty > 0) {
                                      return (
                                        <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                                          ◐ Partial ({colQty}/{totalQty})
                                        </Badge>
                                      );
                                    }
                                    return <span className="text-[10px] text-gray-400">Pending (0/{totalQty})</span>;
                                  })()}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Collection History */}
                      {uniformTrackingRecord.history && uniformTrackingRecord.history.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-1.5">📜 Collection History:</p>
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {uniformTrackingRecord.history
                              .filter(h =>
                                h.type === 'collection' ||
                                Boolean(h.collectedItems?.length) ||
                                h.collectionStatus === 'collected'
                              )
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .map((historyItem, index) => (
                                <div key={index} className="text-xs bg-white rounded border p-2">
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="text-gray-500">
                                      {new Date(historyItem.date).toLocaleDateString()} {new Date(historyItem.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  {(historyItem.releasedBy || historyItem.receivedBy) && (
                                    <div className="text-gray-700 text-xs">
                                      Released by: {historyItem.releasedBy || historyItem.receivedBy}
                                    </div>
                                  )}
                                  {historyItem.collectedItems && historyItem.collectedItems.length > 0 && (
                                    <div className="text-blue-600 text-xs mt-1">
                                      📦 Collected: {historyItem.collectedItems.length} item(s)
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Record Collection Button */}
                      {effectiveCollectionStatus !== 'collected' && (
                        <Button
                          onClick={() => setIsCollectionModalOpen(true)}
                          size="sm"
                          variant="outline"
                          className="w-full text-xs"
                        >
                          <Package className="w-3 h-3 mr-1" />
                          Record Collection
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-amber-700">
                      {uniformTrackingError
                        ? 'Tracking status is temporarily unavailable. Collection is disabled to protect existing records.'
                        : 'No tracking information available.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 sm:gap-2">
        <div className="rounded-md sm:rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 sm:px-3 sm:py-2">
          <p className="text-[9px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-sm lg:text-base font-bold leading-tight text-slate-900 break-all">
            <span className="sm:hidden">{formatCurrencyCompact(fee.amount)}</span>
            <span className="hidden sm:inline">{formatCurrency(fee.amount)}</span>
          </p>
        </div>

        <div className="rounded-md sm:rounded-lg border border-green-200 bg-green-50 px-1.5 py-1 sm:px-3 sm:py-2">
          <p className="text-[9px] sm:text-xs font-semibold uppercase tracking-wide text-green-700">Paid</p>
          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-sm lg:text-base font-bold leading-tight text-green-700 break-all">
            <span className="sm:hidden">{formatCurrencyCompact(totalPaid)}</span>
            <span className="hidden sm:inline">{formatCurrency(totalPaid)}</span>
          </p>
        </div>

        <div className="rounded-md sm:rounded-lg border border-red-200 bg-red-50 px-1.5 py-1 sm:px-3 sm:py-2">
          <p className="text-[9px] sm:text-xs font-semibold uppercase tracking-wide text-red-700">Balance</p>
          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-sm lg:text-base font-bold leading-tight text-red-700 break-all">
            <span className="sm:hidden">{formatCurrencyCompact(balance)}</span>
            <span className="hidden sm:inline">{formatCurrency(balance)}</span>
          </p>
        </div>
      </div>


      {/* Payment History - Ultra Compact with collapsible/expandable */}
      {sortedPayments.length > 0 ? (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-xs font-medium text-gray-900">Payment History</h4>
            {hasMorePayments && (
              <button
                onClick={() => setIsPaymentHistoryExpanded(!isPaymentHistoryExpanded)}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 px-1 py-0.5"
              >
                {isPaymentHistoryExpanded ? (
                  <>
                    <CaretUp className="h-2.5 w-2.5" />
                    <span className="hidden sm:inline">Less</span>
                  </>
                ) : (
                  <>
                    <CaretDown className="h-2.5 w-2.5" />
                    <span className="hidden sm:inline">All ({sortedPayments.length})</span>
                    <span className="sm:hidden">({sortedPayments.length})</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Mobile: Ultra compact single column */}
          <div className="block md:hidden space-y-1">
            {displayedPayments.map((payment) => (
              <div
                key={payment.id}
                className="bg-gray-50 p-1.5 rounded border border-gray-200"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-gray-900 whitespace-nowrap">
                      {new Intl.NumberFormat('en-UG', {
                        style: 'currency',
                        currency: 'UGX',
                        maximumFractionDigits: 0
                      }).format(payment.amount)}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(payment.paymentDate || '').toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: '2-digit'
                      })}
                    </span>
                    {payment.reverted && (
                      <span className="px-1 py-0.5 text-[9px] font-medium rounded bg-red-100 text-red-800">
                        REV
                      </span>
                    )}
                    {(payment as any).isCarryForwardPayment && (
                      <span className="px-1 py-0.5 text-[9px] font-medium rounded bg-blue-100 text-blue-800">
                        CF
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <span className="text-[10px] text-gray-600 truncate max-w-[60px]">
                      {payment.paidBy?.name?.split(' ')[0] || 'Unknown'}
                    </span>
                    <button
                      onClick={() => handlePrintReceipt(payment)}
                      className="text-blue-600 hover:text-blue-800 p-0.5 rounded hover:bg-blue-50 transition-colors"
                      title="Print"
                    >
                      <Printer className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleSendSMS(payment)}
                      className="text-green-600 hover:text-green-800 p-0.5 rounded hover:bg-green-50 transition-colors"
                      title="SMS"
                    >
                      <ChatCircle className="h-3 w-3" />
                    </button>
                    {!payment.reverted && (
                      <button
                        onClick={() => handleRevertPayment(payment)}
                        className="text-red-600 hover:text-red-800 p-0.5 rounded hover:bg-red-50 transition-colors"
                        title="Revert"
                      >
                        <ArrowCounterClockwise className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                {(payment.notes || (payment as any).originalTerm || payment.id) && (
                  <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {payment.notes && (
                      <span className="text-[10px] text-gray-500 truncate max-w-[120px]">
                        {payment.notes}
                      </span>
                    )}
                    {(payment as any).originalTerm && (payment as any).originalYear && (
                      <span className="text-[10px] text-blue-600">
                        {(payment as any).originalTerm} {(payment as any).originalYear}
                      </span>
                    )}
                    {payment.id && (
                      <div className="flex-shrink-0">
                        <PaymentSignatureDisplay payment={payment} className="text-[10px]" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: Ultra compact table layout */}
          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-full">
              {/* Table Header - Ultra compact */}
              <div className="grid grid-cols-12 gap-1 px-2 py-1 bg-gray-100 rounded-t border-b border-gray-200 text-[10px] font-medium text-gray-700">
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Amount</div>
                <div className="col-span-5">Received By</div>
                <div className="col-span-3 text-right">Actions</div>
              </div>

              {/* Table Body - Ultra compact */}
              <div className="bg-white rounded-b divide-y divide-gray-200">
                {displayedPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="grid grid-cols-12 gap-1 px-2 py-1 hover:bg-gray-50 transition-colors"
                  >
                    {/* Date Column */}
                    <div className="col-span-2 flex items-center">
                      <div className="text-[11px] text-gray-900">
                        {new Date(payment.paymentDate || '').toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit'
                        })}
                      </div>
                    </div>

                    {/* Amount Column */}
                    <div className="col-span-2 flex items-center">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-medium text-gray-900">
                          {new Intl.NumberFormat('en-UG', {
                            style: 'currency',
                            currency: 'UGX',
                            maximumFractionDigits: 0
                          }).format(payment.amount)}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {payment.reverted && (
                            <span className="px-1 py-0.5 text-[9px] font-medium rounded bg-red-100 text-red-800">
                              REV
                            </span>
                          )}
                          {(payment as any).isCarryForwardPayment && (
                            <span className="px-1 py-0.5 text-[9px] font-medium rounded bg-blue-100 text-blue-800">
                              CF
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Received By Column */}
                    <div className="col-span-5 flex items-center">
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span className="text-[11px] text-gray-900 truncate">
                          {payment.paidBy?.name || 'Unknown'}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {payment.notes && (
                            <span className="text-[10px] text-gray-500 truncate max-w-[200px]">
                              {payment.notes}
                            </span>
                          )}
                          {(payment as any).originalTerm && (payment as any).originalYear && (
                            <span className="text-[10px] text-blue-600 whitespace-nowrap">
                              {(payment as any).originalTerm} {(payment as any).originalYear}
                            </span>
                          )}
                          {payment.id && (
                            <div className="flex-shrink-0">
                              <PaymentSignatureDisplay payment={payment} className="text-[10px]" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions Column */}
                    <div className="col-span-3 flex items-center justify-end gap-0.5">
                      <button
                        onClick={() => handlePrintReceipt(payment)}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                        title="Print Receipt"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleSendSMS(payment)}
                        className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition-colors"
                        title="Send SMS Receipt"
                      >
                        <ChatCircle className="h-3.5 w-3.5" />
                      </button>
                      {!payment.reverted && (
                        <button
                          onClick={() => handleRevertPayment(payment)}
                          className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                          title="Revert Payment"
                        >
                          <ArrowCounterClockwise className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <div className="text-[11px] text-gray-500">No payments recorded</div>
        </div>
      )}

      {fee.isAssignmentFee && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleGenerateAssignmentCard}
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs sm:text-sm font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 hover:scale-95 origin-center"
          >
            <IdentificationCard className="w-4 h-4 mr-1.5" />
            Card
          </button>
        </div>
      )}

      {/* Collection Modal for Uniform Fees */}
      {UniformFeesIntegrationService.isUniformFee(fee) && uniformTrackingRecord && (
        <CollectionModal
          isOpen={isCollectionModalOpen}
          onClose={() => setIsCollectionModalOpen(false)}
          onSubmit={handleCollectionSubmit}
          uniforms={trackingUniforms}
          selectionMode={uniformTrackingRecord.selectionMode}
          previouslyCollectedItems={previouslyCollectedItems}
          selectedSizes={uniformTrackingRecord.selectedSizes || {}}
          selectedQuantities={uniformTrackingRecord.selectedQuantities || {}}
          collectedQuantities={uniformTrackingRecord.collectedQuantities || {}}
          uniformInventory={uniformInventory}
          onUnmark={handleUnmarkItem}
        />
      )}
    </div>
  );
} 
