import type { Pupil, AcademicYear, SchoolSettings } from '@/types';
import type { PupilFee } from '../types';
import { PDFSignatureService } from '@/lib/services/pdf-signature.service';

// PDF generation utility using jsPDF (will need to be installed)
// For now, we'll create the structure and implement basic HTML-to-PDF functionality

interface PDFGenerationOptions {
  pupil: Pupil;
  fees: PupilFee[];
  selectedAcademicYear?: AcademicYear | null;
  selectedTerm?: string;
  includePaymentHistory?: boolean;
  includeSignature?: boolean;
  schoolSettings?: SchoolSettings;
}

interface ReceiptOptions {
  pupil: Pupil;
  fee: PupilFee;
  paymentAmount: number;
  paymentDate: string;
  receiptNumber: string;
  academicYear?: string;
  term?: string;
  schoolSettings?: any; // SchoolSettings type
  paidBy: {
    name: string;
    role: string;
  };
}

/**
 * Generates a comprehensive fee statement PDF
 */
export async function generateFeeStatementPDF(options: PDFGenerationOptions): Promise<void> {
  const {
    pupil,
    fees,
    selectedAcademicYear,
    selectedTerm,
    includePaymentHistory = true,
    includeSignature = true,
    schoolSettings
  } = options;

  // Calculate totals and statistics
  const totalFees = fees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
  const totalPaid = fees.reduce((sum, fee) => sum + (fee.paid || 0), 0);
  const totalBalance = totalFees - totalPaid;
  const paymentProgress = totalFees > 0 ? (totalPaid / totalFees) * 100 : 0;

  // Categorize fees by status
  const paidFees = fees.filter(fee => (fee.balance || 0) === 0);
  const partialFees = fees.filter(fee => (fee.paid || 0) > 0 && (fee.balance || 0) > 0);
  const unpaidFees = fees.filter(fee => (fee.paid || 0) === 0);

  // Generate modern HTML content for PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Fee Statement - ${pupil.firstName} ${pupil.lastName}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          background: #ffffff;
          font-size: 14px;
        }
        
        /* Header Section */
        .header {
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
          color: white;
          padding: 20px 15px;
          text-align: center;
          border-radius: 8px 8px 0 0;
          margin-bottom: 20px;
          box-shadow: 0 2px 10px rgba(30, 64, 175, 0.15);
        }
        .school-logo {
          width: 60px;
          height: 60px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          margin: 0 auto 15px auto;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
        }
        .school-name {
          font-size: 22px;
          font-weight: 800;
          margin-bottom: 5px;
          letter-spacing: -0.5px;
        }
        .document-title {
          font-size: 16px;
          font-weight: 600;
          opacity: 0.9;
          margin-bottom: 10px;
        }
        .generation-date {
          font-size: 14px;
          opacity: 0.8;
          background: rgba(255, 255, 255, 0.1);
          padding: 8px 16px;
          border-radius: 20px;
          display: inline-block;
        }

        /* Student Information Section */
        .student-info {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
          position: relative;
        }
        .student-info::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          border-radius: 12px 12px 0 0;
        }
        .section-title {
          font-size: 18px;
          font-weight: 700;
          color: #1e40af;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .section-title::before {
          content: '👤';
          font-size: 20px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .info-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .info-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .info-value {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        /* Summary Cards */
        .summary-section {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }
        .summary-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
          border: 1px solid #f1f5f9;
          position: relative;
          overflow: hidden;
        }
        .summary-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
        }
        .card-total::before { background: linear-gradient(90deg, #3b82f6, #1e40af); }
        .card-paid::before { background: linear-gradient(90deg, #10b981, #059669); }
        .card-balance::before { background: linear-gradient(90deg, #ef4444, #dc2626); }
        .card-progress::before { background: linear-gradient(90deg, #f59e0b, #d97706); }
        
        .card-icon {
          font-size: 24px;
          margin-bottom: 10px;
        }
        .card-title {
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 8px;
        }
        .card-amount {
          font-size: 20px;
          font-weight: 800;
          margin-bottom: 5px;
        }
        .card-total .card-amount { color: #1e40af; }
        .card-paid .card-amount { color: #059669; }
        .card-balance .card-amount { color: #ef4444; }
        .card-progress .card-amount { color: #f59e0b; }
        .card-description {
          font-size: 12px;
          color: #94a3b8;
        }

        /* Progress Bar */
        .progress-section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
          border: 1px solid #f1f5f9;
          margin-bottom: 30px;
        }
        .progress-title {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 15px;
          color: #1f2937;
        }
        .progress-bar-container {
          background: #f1f5f9;
          border-radius: 10px;
          height: 20px;
          overflow: hidden;
          position: relative;
        }
        .progress-bar {
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          height: 100%;
          border-radius: 10px;
          transition: width 0.3s ease;
          position: relative;
        }
        .progress-bar::after {
          content: '${paymentProgress.toFixed(1)}%';
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: white;
          font-size: 12px;
          font-weight: 600;
        }

        /* Fees Table */
        .table-container {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
          border: 1px solid #f1f5f9;
          margin-bottom: 20px;
        }
        .table-title {
          background: linear-gradient(90deg, #1e40af, #3b82f6);
          color: white;
          padding: 15px;
          font-size: 16px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .table-title::before {
          content: '📋';
          font-size: 16px;
        }
        .fees-table {
          width: 100%;
          border-collapse: collapse;
        }
        .fees-table thead {
          background: #f8fafc;
        }
        .fees-table th {
          padding: 12px 10px;
          text-align: left;
          font-weight: 600;
          color: #374151;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid #e5e7eb;
        }
        .fees-table td {
          padding: 10px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: top;
        }
        .fees-table tbody tr:hover {
          background: #fafbfc;
        }
        .fees-table .amount {
          text-align: right;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
        }
        
        /* Status Badges */
        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .status-paid {
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        .status-partial {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
        }
        .status-unpaid {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        /* Totals Row */
        .totals-row {
          background: #1f2937;
          color: white;
          font-weight: 700;
        }
        .totals-row td {
          padding: 15px 12px;
          border-bottom: none;
          font-size: 15px;
        }
        .totals-row .amount {
          font-size: 16px;
          color: #60a5fa;
        }

        /* Signature Section */
        .signature-section {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 40px;
          margin-top: 40px;
          padding: 30px;
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }
        .signature-box {
          text-align: center;
        }
        .signature-box:first-child {
          border-top: 2px solid #3b82f6;
          padding-top: 20px;
        }
        .signature-title {
          font-size: 16px;
          font-weight: 700;
          color: #1e40af;
          margin-bottom: 30px;
        }

        /* Footer */
        .footer {
          margin-top: 50px;
          padding: 30px 20px;
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          text-align: center;
        }
        .footer-title {
          font-size: 16px;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 15px;
        }
        .footer-disclaimer {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 15px;
          line-height: 1.5;
        }
        .footer-contact {
          font-size: 14px;
          color: #374151;
          font-weight: 600;
        }

        /* Print Optimizations */
        @media print {
          body { margin: 0; padding: 20px; }
          .no-print { display: none !important; }
        }
        @page {
          margin: 0.5in;
          size: A4;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        ${schoolSettings?.generalInfo?.logo ? 
          `<div class="school-logo"><img src="${schoolSettings.generalInfo.logo}" alt="School Logo" style="width: 60px; height: 60px; object-fit: contain;" /></div>` :
          '<div class="school-logo">🏫</div>'
        }
        <div class="school-name">${schoolSettings?.generalInfo?.name || 'SCHOOL NAME'}</div>
        <div class="document-title">STUDENT FEE STATEMENT</div>
        <div class="generation-date">
          Generated on ${new Date().toLocaleDateString('en-UG', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>

      <!-- Student Information -->
      <div class="student-info">
        <div class="section-title">Student Information</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Full Name</span>
            <span class="info-value">${pupil.firstName} ${pupil.lastName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Admission Number</span>
            <span class="info-value">${pupil.admissionNumber}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Class & Section</span>
            <span class="info-value">${pupil.className} ${pupil.section ? `- ${pupil.section}` : ''}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Academic Year</span>
            <span class="info-value">${selectedAcademicYear?.name || 'All Years'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Term</span>
            <span class="info-value">${selectedTerm || 'All Terms'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Statement Period</span>
            <span class="info-value">${fees.length} Fee Items</span>
          </div>
        </div>
      </div>


      <!-- Fees Table -->
      <div class="table-container">
        <div class="table-title">
          Detailed Fee Breakdown
        </div>
      <table class="fees-table">
        <thead>
          <tr>
              <th style="width: 25%;">Fee Details</th>
              <th style="width: 15%;">Category</th>
              <th class="amount" style="width: 15%;">Amount</th>
              <th class="amount" style="width: 15%;">Paid</th>
              <th class="amount" style="width: 15%;">Balance</th>
              <th style="width: 15%;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${fees.map(fee => {
            const balance = fee.balance || 0;
            const paid = fee.paid || 0;
            const status = balance === 0 && paid > 0 ? 'PAID' : 
                          paid > 0 && balance > 0 ? 'PARTIAL' : 'UNPAID';
              const statusClass = `status-${status.toLowerCase()}`;
            
            return `
              <tr>
                <td>
                    <div style="font-weight: 600; color: #1f2937;">${fee.name}</div>
                    ${fee.description ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">${fee.description}</div>` : ''}
                    ${fee.discount ? `<div style="font-size: 11px; color: #059669; margin-top: 4px; font-weight: 600;">
                      💰 Discount: ${fee.discount.type === 'percentage' ? fee.discount.amount + '%' : formatCurrency(fee.discount.amount)}
                    </div>` : ''}
                </td>
                  <td>
                    <span style="background: #f1f5f9; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; color: #475569;">
                      ${fee.category}
                    </span>
                  </td>
                <td class="amount">
                    <div>${formatCurrency(fee.amount || 0)}</div>
                  ${fee.originalAmount && fee.originalAmount !== fee.amount ? 
                      `<div style="font-size: 11px; color: #94a3b8; text-decoration: line-through;">${formatCurrency(fee.originalAmount)}</div>` : ''}
                </td>
                  <td class="amount" style="color: #059669;">${formatCurrency(paid)}</td>
                  <td class="amount" style="color: ${balance > 0 ? '#ef4444' : '#059669'};">${formatCurrency(balance)}</td>
                  <td>
                    <span class="status-badge ${statusClass}">${status}</span>
                  </td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr class="totals-row">
              <td colspan="2"><strong>TOTAL SUMMARY</strong></td>
            <td class="amount">${formatCurrency(totalFees)}</td>
            <td class="amount">${formatCurrency(totalPaid)}</td>
            <td class="amount">${formatCurrency(totalBalance)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      </div>

      ${includeSignature ? `
        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-title">📝 Prepared By</div>
            <div style="margin-top: 30px; font-size: 14px; font-weight: 600;">Finance Office</div>
            <div style="margin-top: 40px; border-top: 1px solid #d1d5db; padding-top: 15px; font-size: 12px; color: #6b7280;">
              Date: ${new Date().toLocaleDateString()}
            </div>
          </div>
          <div class="signature-box">
            <div class="signature-title">✍️ Received By</div>
            <div style="margin-top: 30px; font-size: 14px; font-weight: 600;">Parent/Guardian Signature</div>
            <div style="margin-top: 40px; border-top: 1px solid #d1d5db; padding-top: 15px; font-size: 12px; color: #6b7280;">
              Date: _______________
            </div>
          </div>
        </div>
      ` : ''}

      <div class="footer">
        <div class="footer-title">🏫 ${schoolSettings?.generalInfo?.name || 'SCHOOL NAME'}</div>
        <div class="footer-disclaimer">
          This is a computer-generated statement showing the fee status as of the generation date. 
          Please keep this document for your records and contact the Finance Office for any queries.
        </div>
        <div class="footer-contact">
          📍 ${schoolSettings?.address?.physical || 'N/A'}, ${schoolSettings?.address?.city || 'N/A'}, ${schoolSettings?.address?.country || 'N/A'} | 
          📞 ${schoolSettings?.contact?.phone || 'N/A'} | 
          ✉️ ${schoolSettings?.contact?.email || 'N/A'}
        </div>
      </div>
    </body>
    </html>
  `;

  // Generate PDF using browser's print functionality
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
      setTimeout(() => printWindow.close(), 1000);
    }, 1000);
  }
}

/**
 * Generates a payment receipt PDF with digital signatures
 */
export async function generatePaymentReceiptPDF(options: ReceiptOptions): Promise<void> {
  const { pupil, fee, paymentAmount, paymentDate, receiptNumber, paidBy } = options;

  // Generate clean, simple HTML receipt content
  
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Receipt - ${receiptNumber}</title>
      <style>
        body {
          font-family: 'Courier New', monospace;
          margin: 0;
          padding: 10px;
          color: #000;
          line-height: 1.2;
          font-size: 12px;
          background: #fff;
        }
        .receipt-container {
          max-width: 280px;
          margin: 0 auto;
          border: 1px solid #000;
          background: #fff;
          padding: 5px;
        }
        .receipt-header {
          text-align: center;
          padding: 10px 5px;
          border-bottom: 1px solid #000;
        }
        .school-name {
          font-size: 11px;
          font-weight: bold;
          margin-bottom: 5px;
          text-transform: uppercase;
          word-wrap: break-word;
          max-width: 100%;
        }
        .contact-info {
          font-size: 9px;
          margin-bottom: 3px;
        }
        .address-info {
          font-size: 9px;
          margin-bottom: 5px;
        }
        .receipt-title {
          background: #000;
          color: #fff;
          padding: 8px;
          font-size: 12px;
          font-weight: bold;
          text-align: center;
        }
        .transaction-details {
          padding: 8px 5px;
          border-bottom: 1px solid #000;
        }
        .transaction-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
          font-size: 10px;
        }
        .transaction-left {
          text-align: left;
        }
        .transaction-right {
          text-align: right;
        }
        .section-header {
          background: #f0f0f0;
          padding: 3px 5px;
          font-weight: bold;
          font-size: 10px;
          border-bottom: 1px solid #000;
        }
        .section-content {
          padding: 5px;
        }
        .info-row {
          margin-bottom: 2px;
          font-size: 10px;
        }
        .fee-item {
          margin-bottom: 3px;
          font-size: 10px;
        }
        .fee-name {
          font-weight: bold;
        }
        .fee-id {
          font-size: 9px;
          color: #666;
        }
        .fee-amount {
          text-align: right;
          font-weight: bold;
        }
        .payment-breakdown {
          border-top: 1px solid #000;
          padding: 5px;
        }
        .breakdown-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
          font-size: 10px;
        }
        .total-row {
          font-weight: bold;
          border-top: 1px solid #000;
          padding-top: 2px;
          margin-top: 3px;
        }
        .payment-method {
          margin-top: 5px;
          font-size: 10px;
        }
        .approval-section {
          border-top: 1px solid #000;
          padding: 5px;
        }
        .approval-row {
          margin-bottom: 1px;
          font-size: 9px;
        }
        .footer-section {
          border-top: 1px solid #000;
          padding: 5px;
          text-align: center;
        }
        .items-count {
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 3px;
        }
        .transaction-code {
          font-size: 9px;
          margin-bottom: 3px;
        }
        .thank-you {
          font-size: 10px;
          font-weight: bold;
          margin-bottom: 3px;
        }
        .footer-text {
          font-size: 9px;
          margin-bottom: 2px;
        }
        .copy-indicator {
          font-size: 9px;
          font-weight: bold;
          margin-top: 3px;
        }
        @media print {
          body { margin: 0; padding: 0; }
          .receipt-container { border: none; }
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="receipt-header">
          <div class="school-name">${options.schoolSettings?.generalInfo?.name || 'SCHOOL NAME'}</div>
          <div class="contact-info">Tel: ${options.schoolSettings?.contact?.phone || 'N/A'}</div>
          <div class="address-info">${options.schoolSettings?.address?.physical || 'N/A'}</div>
        </div>

        <div class="receipt-details">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="info-row">Receipt No: ${receiptNumber}</div>
            <div class="info-row">Academic Year: ${options.academicYear || 'N/A'}</div>
            <div class="info-row">Date: ${new Date(paymentDate).toLocaleDateString()}</div>
            <div class="info-row">Term: ${options.term || 'N/A'}</div>
            </div>
          </div>

        <div class="section-header">STUDENT INFORMATION</div>
        <div class="section-content">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="info-row">Name: ${pupil.firstName} ${pupil.lastName}</div>
            <div class="info-row">Class: ${pupil.className}</div>
            <div class="info-row">Admission No: ${pupil.admissionNumber}</div>
            <div class="info-row">Section: ${pupil.section || 'N/A'}</div>
            </div>
          </div>

        <div class="section-header">PAYMENT DETAILS</div>
        <div class="section-content">
          <div class="info-row">Fee: ${fee.name}</div>
          <div class="info-row">Original Amount: ${formatCurrency(fee.amount || 0)}</div>
          <div class="info-row">Amount Paid: ${formatCurrency(paymentAmount)}</div>
          <div class="info-row">Balance: ${formatCurrency((fee.amount || 0) - paymentAmount)}</div>
          <div class="info-row">Received By: ${paidBy.name}</div>
          </div>

        <div class="footer-section">
          <div class="thank-you">THANK YOU</div>
          <div class="footer-text">Keep this receipt for your records</div>
          <div class="footer-text">This is a computer generated receipt</div>
          <div class="footer-text">Generated: ${new Date().toLocaleString()}</div>
          
          <!-- QR Code Section -->
          <div style="margin-top: 10px; text-align: center;">
            <div id="qr-code-container" style="width: 60px; height: 60px; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
              <canvas id="qr-code-canvas" width="60" height="60"></canvas>
            </div>
            </div>
            </div>
          </div>

      <script>
        // Generate QR code when page loads
        window.addEventListener('load', async function() {
          try {
            const QRCode = await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm');
            
            const qrData = JSON.stringify({
              receiptNo: '${receiptNumber}',
              studentName: '${pupil.firstName} ${pupil.lastName}',
              amount: ${paymentAmount},
              date: '${new Date(paymentDate).toLocaleDateString()}',
              fee: '${fee.name}',
              school: '${options.schoolSettings?.generalInfo?.name || 'School'}'
            });
            
            const canvas = document.getElementById('qr-code-canvas');
            if (canvas) {
              await QRCode.toCanvas(canvas, qrData, {
                width: 60,
                margin: 1,
                color: {
                  dark: '#000000',
                  light: '#FFFFFF'
                }
              });
            }
          } catch (error) {
            console.log('QR code generation error:', error);
            // Fallback - show placeholder text
            const container = document.getElementById('qr-code-container');
            if (container) {
              container.innerHTML = '<div style="font-size: 8px; color: #666;">QR Code</div>';
            }
          }
        });
      </script>
    </body>
    </html>
  `;

  // Add digital signatures to the HTML content
  if (fee.id) {
    htmlContent = await PDFSignatureService.addSignaturesToHTML(
      htmlContent,
      'fee_payment',
      fee.id,
      {
        includeActions: ['payment', 'created', 'updated'],
        showTimestamp: true,
        showUserRole: true,
        maxSignatures: 3
      }
    );
  }

  // Generate PDF using browser's print functionality
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }
}

/**
 * Formats currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-UG', { 
    style: 'currency', 
    currency: 'UGX' 
  }).format(amount);
}

/**
 * Generates a bulk fee statement for multiple students (family account)
 */
export async function generateFamilyFeeStatementPDF(
  family: { id: string; name: string },
  students: Array<{ pupil: Pupil; fees: PupilFee[] }>,
  selectedAcademicYear?: AcademicYear | null,
  selectedTerm?: string
): Promise<void> {
  // Calculate family totals
  const familyTotalFees = students.reduce((sum, student) => 
    sum + student.fees.reduce((feeSum, fee) => feeSum + (fee.amount || 0), 0), 0
  );
  const familyTotalPaid = students.reduce((sum, student) => 
    sum + student.fees.reduce((feeSum, fee) => feeSum + (fee.paid || 0), 0), 0
  );
  const familyTotalBalance = familyTotalFees - familyTotalPaid;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Family Fee Statement - ${family.name}</title>
      <style>
        /* Similar styles as individual statement but with family-specific modifications */
        body {
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
          line-height: 1.4;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .school-name {
          font-size: 24px;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 5px;
        }
        .document-title {
          font-size: 18px;
          color: #374151;
          margin-top: 10px;
        }
        .family-summary {
          background: #f8fafc;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
          text-align: center;
        }
        .student-section {
          margin-bottom: 40px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }
        .student-header {
          background: #f9fafb;
          padding: 15px;
          font-weight: bold;
          color: #374151;
        }
        .fees-table {
          width: 100%;
          border-collapse: collapse;
        }
        .fees-table th,
        .fees-table td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }
        .fees-table th {
          background: #f9fafb;
          font-weight: bold;
          color: #374151;
        }
        .amount { text-align: right; }
        .family-totals {
          background: #2563eb;
          color: white;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          margin-top: 30px;
        }
        .totals-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-top: 15px;
        }
        .total-item {
          text-align: center;
        }
        .total-amount {
          font-size: 20px;
          font-weight: bold;
          margin-top: 5px;
        }
        @media print {
          body { margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="school-name">Trinity Family School</div>
        <div class="document-title">FAMILY FEE STATEMENT</div>
        <div style="margin-top: 10px; font-size: 14px; color: #6b7280;">
          Generated on ${new Date().toLocaleDateString('en-UG', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      <div class="family-summary">
        <h2 style="margin-top: 0; color: #1f2937;">Family: ${family.name}</h2>
        <p>Academic Year: ${selectedAcademicYear?.name || 'All Years'} | Term: ${selectedTerm || 'All Terms'}</p>
        <p>Number of Students: ${students.length}</p>
      </div>

      ${students.map(student => {
        const studentTotal = student.fees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
        const studentPaid = student.fees.reduce((sum, fee) => sum + (fee.paid || 0), 0);
        const studentBalance = studentTotal - studentPaid;

        return `
          <div class="student-section">
            <div class="student-header">
              ${student.pupil.firstName} ${student.pupil.lastName} 
              (${student.pupil.admissionNumber}) - ${student.pupil.className}
              <span style="float: right;">
                Total: ${formatCurrency(studentTotal)} | 
                Paid: ${formatCurrency(studentPaid)} | 
                Balance: ${formatCurrency(studentBalance)}
              </span>
            </div>
            <table class="fees-table">
              <thead>
                <tr>
                  <th>Fee Name</th>
                  <th>Category</th>
                  <th class="amount">Amount</th>
                  <th class="amount">Paid</th>
                  <th class="amount">Balance</th>
                </tr>
              </thead>
              <tbody>
                ${student.fees.map(fee => `
                  <tr>
                    <td>${fee.name}</td>
                    <td>${fee.category}</td>
                    <td class="amount">${formatCurrency(fee.amount || 0)}</td>
                    <td class="amount">${formatCurrency(fee.paid || 0)}</td>
                    <td class="amount">${formatCurrency(fee.balance || 0)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }).join('')}

      <div class="family-totals">
        <h3 style="margin-top: 0;">FAMILY TOTALS</h3>
        <div class="totals-grid">
          <div class="total-item">
            <div>Total Fees</div>
            <div class="total-amount">${formatCurrency(familyTotalFees)}</div>
          </div>
          <div class="total-item">
            <div>Total Paid</div>
            <div class="total-amount">${formatCurrency(familyTotalPaid)}</div>
          </div>
          <div class="total-item">
            <div>Total Balance</div>
            <div class="total-amount">${formatCurrency(familyTotalBalance)}</div>
          </div>
        </div>
      </div>

      <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280;">
        <p>This is a computer-generated document. For any queries, please contact the Finance Office.</p>
        <p>Trinity Family School | P.O. Box 123, Kampala, Uganda | Tel: +256 123 456 789</p>
      </div>
    </body>
    </html>
  `;

  // Generate PDF using browser's print functionality
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }
} 