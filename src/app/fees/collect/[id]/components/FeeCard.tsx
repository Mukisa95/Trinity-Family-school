import React from 'react';
import { CurrencyCircleDollar, Receipt, IdentificationCard, Printer, ChatCircle, ArrowCounterClockwise, TShirt } from '@phosphor-icons/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { UniformFeesIntegrationService } from '@/lib/services/uniform-fees-integration.service';
import { PaymentSignatureDisplay } from './PaymentSignatureDisplay';
import type { AcademicYear, PaymentRecord, Pupil } from '@/types';

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
    type: 'fixed' | 'percentage';
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
}

export function FeeCard({ fee, pupil, onPayment, onRevertPayment, selectedTerm, selectedAcademicYear }: FeeCardProps) {
  const totalPaid = fee.paid || 0;
  // For carry forward fees, use the pre-calculated balance to avoid double-counting payments
  const balance = fee.id === 'previous-balance' ? (fee.balance || 0) : ((fee.amount || 0) - totalPaid);
  const { data: schoolSettings } = useSchoolSettings();

  const handlePrintReceipt = async (payment: PaymentRecord) => {
    // Create a clean, simple receipt PDF
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 120], // Standard receipt size
      orientation: 'portrait'
    });

    const currentDate = new Date().toLocaleString();
    const paymentDate = new Date(payment.paymentDate).toLocaleDateString();
    
    // Generate receipt number using actual payment data
    const receiptNumber = payment.id.slice(-8).toUpperCase();
    
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

    // Save the PDF
    const fileName = `receipt-${receiptNumber}-${pupil.firstName}-${pupil.lastName}.pdf`;
    doc.save(fileName);
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

  const handleGenerateAssignmentCard = () => {
    // Will be implemented in later phases
    console.log('Generate assignment card for fee:', fee.id);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-indigo-100 p-3 sm:p-4">
      {/* Fee Header - Compact and responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-medium text-gray-900 break-words leading-tight">{fee.name}</h3>
          {fee.description && (
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 break-words">{fee.description}</p>
          )}
          
          {/* Discount Information - Compact */}
          {fee.discount && (
            <div className="p-2.5 mt-2 rounded-md border border-purple-100 bg-purple-50 hover:border-purple-200 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                <div className="font-medium text-purple-900 text-sm">{fee.discount.name}</div>
                <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800 self-start">active</span>
              </div>
              <div className="text-xs sm:text-sm text-purple-700 mt-1">
                Amount: {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.discount.amount)}
              </div>
              <div className="text-xs sm:text-sm text-purple-600 mt-0.5 break-words">
                Applied to: {fee.name} ({new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.originalAmount || fee.amount)})
              </div>
              <div className="text-xs sm:text-sm text-purple-600 mt-0.5">
                {selectedTerm} - {selectedAcademicYear?.name}
              </div>
            </div>
          )}

          {/* Previous Balance Breakdown - Compact */}
          {fee.id === 'previous-balance' && fee.feeBreakdown && (
            <div className="mt-2.5">
              <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5">Outstanding Balances:</p>
              <div className="max-h-40 sm:max-h-48 overflow-y-auto">
                {Object.entries(fee.feeBreakdown.reduce((acc, item) => {
                  const key = `${item.term} ${item.year}`;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(item);
                  return acc;
                }, {} as Record<string, Array<{name: string; amount: number; paid: number; balance: number; term: string; year: string}>>))
                .map(([termYear, items]) => (
                  <div key={termYear} className="mb-3 last:mb-0">
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-800 mb-1.5">{termYear}</h4>
                    {items.map((item, index) => (
                      <div key={index} className="ml-1.5 sm:ml-3 flex justify-between items-center py-0.5 text-xs sm:text-sm border-b border-gray-100 last:border-0 gap-2">
                        <span className="text-gray-600 min-w-0 flex-1 break-words">{item.name}</span>
                        <div className="text-right whitespace-nowrap">
                          <div className="text-gray-900 font-medium">
                            {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(item.balance)}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="mt-1 ml-1.5 sm:ml-3 pt-1 flex justify-between items-center text-xs sm:text-sm font-medium">
                      <span className="text-gray-700">Term Total:</span>
                      <span className="text-gray-900 whitespace-nowrap">
                        {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(
                          items.reduce((sum, item) => sum + item.balance, 0)
                        )}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="mt-2.5 pt-1.5 border-t border-gray-200">
                  <div className="flex justify-between items-center font-medium">
                    <span className="text-gray-900 text-xs sm:text-sm">Total Outstanding Balance:</span>
                    <span className="text-sm sm:text-base text-red-600 whitespace-nowrap font-bold">
                      {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.amount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Uniform Details */}
          {UniformFeesIntegrationService.isUniformFee(fee) && (
            <div className="mt-2 p-2.5 rounded-md border border-blue-100 bg-blue-50">
              <div className="flex items-center gap-1.5 mb-1">
                <TShirt size={14} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Uniform Details</span>
              </div>
              <div className="text-xs text-blue-700 space-y-0.5">
                <div>Selection: {(fee as any).uniformDetails?.selectionMode || 'Unknown'}</div>
                <div>Items: {(fee as any).uniformDetails?.uniformNames?.join(', ') || 'N/A'}</div>
                {(fee as any).uniformDetails?.discountAmount > 0 && (
                  <div className="text-purple-600">
                    Discount Applied: {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format((fee as any).uniformDetails.discountAmount)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fee Category and Status Tags - Compact */}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
              {fee.category}
            </span>
            
            {/* Uniform fee indicator */}
            {UniformFeesIntegrationService.isUniformFee(fee) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                <TShirt size={12} />
                Uniform
              </span>
            )}
            
            {fee.isRequired ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Required
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                Optional
              </span>
            )}
            {!fee.isRequired && balance > 0 && (
              <span className="text-xs text-gray-500 italic mt-0.5 sm:mt-0 sm:ml-1 block sm:inline">
                (Balance will not be carried forward to next term)
              </span>
            )}
            {!fee.isRequired && balance === 0 && (
              <span className="text-xs text-gray-500 italic mt-0.5 sm:mt-0 sm:ml-1 block sm:inline">
                (Optional fee)
              </span>
            )}
          </div>
        </div>
        
        {/* Amount Display - Compact and responsive */}
        <div className="text-right sm:text-right flex-shrink-0">
          <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
            {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(fee.amount)}
          </p>
          {totalPaid > 0 && (
            <div className="mt-1 space-y-0.5">
              <p className="text-xs sm:text-sm text-gray-600">
                Paid: <span className="font-medium text-green-600">
                  {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(totalPaid)}
                </span>
              </p>
              <p className="text-xs sm:text-sm text-gray-600">
                Balance: <span className="font-medium text-red-600">
                  {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(balance)}
                </span>
              </p>
            </div>
          )}
          <div className="mt-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              balance === 0 ? 'bg-green-100 text-green-800' :
              totalPaid > 0 ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {balance === 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID'}
            </span>
          </div>
        </div>
      </div>

      {/* Payment History - Compact and optimized */}
      {fee.payments?.length ? (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <h4 className="text-xs sm:text-sm font-medium text-gray-900 mb-2">Payment History</h4>
          <div className="space-y-1.5 max-h-40 sm:max-h-48 overflow-y-auto">
            {fee.payments.map((payment) => (
              <div
                key={payment.id}
                className="bg-gray-50 dark:bg-gray-800 p-2.5 rounded-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col sm:flex-row sm:gap-2 sm:items-center">
                    <span className="text-xs sm:text-sm font-medium">
                      {new Intl.NumberFormat('en-UG', {
                        style: 'currency',
                        currency: 'UGX',
                      }).format(payment.amount)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(payment.paymentDate || '').toLocaleDateString()}
                    </span>
                    {payment.reverted && (
                      <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800 self-start sm:self-auto">
                        REVERTED
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Paid by {payment.paidBy?.name || 'Unknown'}
                    {(payment as any).isCarryForwardPayment && (
                      <span className="ml-1.5 px-1 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        Carry Forward
                      </span>
                    )}
                  </div>
                  {/* Digital Signature Display */}
                  {payment.id && (
                    <div className="mt-1">
                      <PaymentSignatureDisplay payment={payment} className="text-xs" />
                    </div>
                  )}
                  {payment.notes && (
                    <div className="text-xs text-gray-500 mt-0.5 break-words">
                      {payment.notes}
                    </div>
                  )}
                  {(payment as any).originalTerm && (payment as any).originalYear && (
                    <div className="text-xs text-blue-600 mt-0.5">
                      Original: {(payment as any).originalTerm} - {(payment as any).originalYear}
                    </div>
                  )}
                  {payment.reverted && payment.revertedBy && (
                    <div className="text-xs text-red-500 mt-0.5">
                      Reverted by {payment.revertedBy.name} on {new Date(payment.revertedAt || '').toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="flex gap-1.5 self-end sm:self-auto">
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
      ) : (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <div className="text-xs sm:text-sm text-gray-500">No payments recorded</div>
        </div>
      )}

      {/* Actions - Compact and responsive */}
      <div className="mt-3 flex flex-col sm:flex-row justify-end gap-1.5">
        {fee.isAssignmentFee && (
          <button
            onClick={handleGenerateAssignmentCard}
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs sm:text-sm font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 hover:scale-95 origin-center"
          >
            <IdentificationCard className="w-4 h-4 mr-1.5" />
            Card
          </button>
        )}
        <button
          onClick={() => onPayment(fee, balance, totalPaid)}
          className="inline-flex items-center justify-center px-3 py-1.5 border border-indigo-200 shadow-sm text-xs sm:text-sm font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 transition-all duration-300 hover:scale-95 origin-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {balance === 0 ? (
            <>
              <Receipt className="w-4 h-4 mr-1.5" />
              View Receipt
            </>
          ) : (
            <>
              <CurrencyCircleDollar className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">{totalPaid > 0 ? 'Make Another Payment' : 'Make Payment'}</span>
              <span className="sm:hidden">{totalPaid > 0 ? 'Pay More' : 'Pay'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
} 