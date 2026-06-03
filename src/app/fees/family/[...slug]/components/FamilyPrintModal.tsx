import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileText, List, Receipt } from '@phosphor-icons/react';

// Types
import type { Pupil, AcademicYear, SchoolSettings } from '@/types';

interface FeePayment {
  id: string;
  amount: number;
  paymentDate: string;
  balance: number;
  paidBy?: { name: string };
  term: string;
  academicYear: string;
  feeStructureId: string;
}

interface FeeWithPayment {
  feeStructureId: string;
  name: string;
  amount: number;
  paid: number;
  balance: number;
  lastPayment: FeePayment | null;
  originalAmount?: number;
  termId: string;
  isCurrentTerm: boolean;
  isCarryForward: boolean;
  discount?: {
    name: string;
    type: 'percentage' | 'fixed';
    amount: number;
  };
}

interface FeesInfo {
  type: 'total';
  totalFees: number;
  totalPaid: number;
  balance: number;
  lastPayment: FeePayment | null;
  applicableFees: Array<FeeWithPayment>;
}

interface FamilyPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyPupils: Pupil[];
  feesInfo: Record<string, FeesInfo>;
  selectedAcademicYear?: AcademicYear | null;
  selectedTerm?: string;
  familyId: string;
}

type PrintOption = 'summary' | 'detailed' | 'receipts';

export function FamilyPrintModal({ 
  isOpen, 
  onClose, 
  familyPupils,
  feesInfo,
  selectedAcademicYear,
  selectedTerm,
  familyId
}: FamilyPrintModalProps) {
  const [selectedOption, setSelectedOption] = useState<PrintOption>('summary');
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePrint = async () => {
    setIsGenerating(true);
    try {
      switch (selectedOption) {
        case 'summary':
          await generateFamilySummaryPDF();
          break;
        case 'detailed':
          await generateFamilyDetailedPDF();
          break;
        case 'receipts':
          await generateFamilyReceiptsPDF();
          break;
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
    
    onClose();
  };

  const generateFamilySummaryPDF = async () => {
    // Calculate family totals
    const familyTotalFees = familyPupils.reduce((sum, pupil) => {
      const summary = feesInfo[pupil.id];
      return sum + (summary?.totalFees || 0);
    }, 0);
    
    const familyTotalPaid = familyPupils.reduce((sum, pupil) => {
      const summary = feesInfo[pupil.id];
      return sum + (summary?.totalPaid || 0);
    }, 0);
    
    const familyBalance = familyTotalFees - familyTotalPaid;

    // Generate HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Family Fees Summary - ${familyId}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.5;
            color: #0f172a;
            background: #ffffff;
            font-size: 13px;
          }
          
          .header {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: white;
            padding: 24px 20px;
            text-align: center;
            border-radius: 12px 12px 0 0;
            margin-bottom: 16px;
            box-shadow: 0 4px 20px rgba(15, 23, 42, 0.1);
            position: relative;
            overflow: hidden;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 100%);
            pointer-events: none;
          }
          
          .school-name {
            font-size: 28px;
            font-weight: 800;
            margin-bottom: 4px;
            letter-spacing: -0.5px;
            position: relative;
            z-index: 1;
          }
          
          .document-title {
            font-size: 16px;
            font-weight: 500;
            opacity: 0.9;
            position: relative;
            z-index: 1;
          }
          
          .family-info {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          
          .info-item {
            display: flex;
            flex-direction: column;
          }
          
          .info-label {
            font-size: 11px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 4px;
          }
          
          .info-value {
            font-size: 14px;
            color: #0f172a;
            font-weight: 700;
          }
          
          .summary-section {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          }
          
          .section-title {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 3px solid #3b82f6;
            position: relative;
          }
          
          .section-title::after {
            content: '';
            position: absolute;
            bottom: -3px;
            left: 0;
            width: 30px;
            height: 3px;
            background: linear-gradient(90deg, #3b82f6, #1d4ed8);
            border-radius: 2px;
          }
          
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }
          
          .summary-card {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 16px;
            text-align: center;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
          }
          
          .summary-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #3b82f6, #1d4ed8);
          }
          
          .summary-label {
            font-size: 11px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 8px;
          }
          
          .summary-value {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.3px;
          }
          
          .pupils-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
          }
          
          .pupils-table th,
          .pupils-table td {
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid #f1f5f9;
          }
          
          .pupils-table th {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            font-weight: 700;
            color: #374151;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            border-bottom: 2px solid #e2e8f0;
          }
          
          .pupils-table td {
            font-size: 13px;
            color: #0f172a;
            font-weight: 500;
          }
          
          .pupils-table tr:hover {
            background: #f8fafc;
          }
          
          .pupils-table tr:last-child td {
            border-bottom: none;
          }
          
          .footer {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            color: #64748b;
            font-size: 11px;
            font-weight: 500;
          }
          
          @media print {
            body { margin: 0; }
            .no-print { display: none !important; }
            .header { box-shadow: none; }
            .summary-section, .family-info { box-shadow: none; }
            .pupils-table { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="school-name">Trinity Family Schools</div>
          <div class="document-title">Family Fees Summary</div>
        </div>
        
        <div class="family-info">
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Family ID</div>
              <div class="info-value">${familyId}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Academic Year</div>
              <div class="info-value">${selectedAcademicYear?.name || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Term</div>
              <div class="info-value">${selectedTerm || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Generated</div>
              <div class="info-value">${new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>
        
        <div class="summary-section">
          <div class="section-title">Family Summary</div>
          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-label">Total Fees</div>
              <div class="summary-value">UGX ${familyTotalFees.toLocaleString()}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Total Paid</div>
              <div class="summary-value">UGX ${familyTotalPaid.toLocaleString()}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Outstanding</div>
              <div class="summary-value">UGX ${familyBalance.toLocaleString()}</div>
            </div>
          </div>
        </div>
        
        <div class="summary-section">
          <div class="section-title">Pupils Breakdown</div>
          <table class="pupils-table">
            <thead>
              <tr>
                <th>Pupil Name</th>
                <th>Class</th>
                <th>Section</th>
                <th>Total Fees</th>
                <th>Paid</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${familyPupils.map(pupil => {
                const summary = feesInfo[pupil.id];
                return `
                  <tr>
                    <td>${pupil.firstName} ${pupil.lastName}</td>
                    <td>${pupil.className || 'N/A'}</td>
                    <td>${pupil.section || 'N/A'}</td>
                    <td>UGX ${(summary?.totalFees || 0).toLocaleString()}</td>
                    <td>UGX ${(summary?.totalPaid || 0).toLocaleString()}</td>
                    <td>UGX ${(summary?.balance || 0).toLocaleString()}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="footer">
          <p>This document was generated on ${new Date().toLocaleString()}</p>
          <p>Trinity Family Schools - Family Fees Management System</p>
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
      }, 500);
    }
  };

  const generateFamilyDetailedPDF = async () => {
    // Generate detailed breakdown for each pupil
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Family Detailed Fees Statement - ${familyId}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.5;
            color: #0f172a;
            background: #ffffff;
            font-size: 13px;
          }
          
          .header {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: white;
            padding: 24px 20px;
            text-align: center;
            border-radius: 12px 12px 0 0;
            margin-bottom: 16px;
            box-shadow: 0 4px 20px rgba(15, 23, 42, 0.1);
            position: relative;
            overflow: hidden;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 100%);
            pointer-events: none;
          }
          
          .school-name {
            font-size: 28px;
            font-weight: 800;
            margin-bottom: 4px;
            letter-spacing: -0.5px;
            position: relative;
            z-index: 1;
          }
          
          .document-title {
            font-size: 16px;
            font-weight: 500;
            opacity: 0.9;
            position: relative;
            z-index: 1;
          }
          
          .family-info {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          
          .info-item {
            display: flex;
            flex-direction: column;
          }
          
          .info-label {
            font-size: 11px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 4px;
          }
          
          .info-value {
            font-size: 14px;
            color: #0f172a;
            font-weight: 700;
          }
          
          .pupil-section {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            page-break-inside: avoid;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          }
          
          .pupil-header {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 16px;
            position: relative;
            overflow: hidden;
          }
          
          .pupil-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #3b82f6, #1d4ed8);
          }
          
          .pupil-name {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 8px;
            letter-spacing: -0.3px;
          }
          
          .pupil-details {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            font-size: 13px;
            color: #64748b;
            font-weight: 500;
          }
          
          .section-title {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 3px solid #3b82f6;
            position: relative;
          }
          
          .section-title::after {
            content: '';
            position: absolute;
            bottom: -3px;
            left: 0;
            width: 30px;
            height: 3px;
            background: linear-gradient(90deg, #3b82f6, #1d4ed8);
            border-radius: 2px;
          }
          
          .fees-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
          }
          
          .fees-table th,
          .fees-table td {
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid #f1f5f9;
          }
          
          .fees-table th {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            font-weight: 700;
            color: #374151;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            border-bottom: 2px solid #e2e8f0;
          }
          
          .fees-table td {
            font-size: 13px;
            color: #0f172a;
            font-weight: 500;
          }
          
          .fees-table tr:hover {
            background: #f8fafc;
          }
          
          .fees-table tr:last-child td {
            border-bottom: none;
          }
          
          .fee-type-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 16px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
          }
          
          .badge-current {
            background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
            color: #1e40af;
            border: 1px solid #93c5fd;
          }
          
          .badge-carryforward {
            background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);
            color: #ea580c;
            border: 1px solid #fb923c;
          }
          
          .badge-uniform {
            background: linear-gradient(135deg, #e9d5ff 0%, #ddd6fe 100%);
            color: #7c3aed;
            border: 1px solid #c4b5fd;
          }
          
          .pupil-summary {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 16px;
            margin-top: 16px;
            position: relative;
            overflow: hidden;
          }
          
          .pupil-summary::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #3b82f6, #1d4ed8);
          }
          
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }
          
          .summary-item {
            text-align: center;
          }
          
          .summary-label {
            font-size: 11px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 4px;
          }
          
          .summary-value {
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.3px;
          }
          
          .footer {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            color: #64748b;
            font-size: 11px;
            font-weight: 500;
          }
          
          @media print {
            body { margin: 0; }
            .no-print { display: none !important; }
            .header { box-shadow: none; }
            .pupil-section, .family-info { box-shadow: none; }
            .fees-table { box-shadow: none; }
            .pupil-section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="school-name">Trinity Family Schools</div>
          <div class="document-title">Family Detailed Fees Statement</div>
        </div>
        
        <div class="family-info">
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Family ID</div>
              <div class="info-value">${familyId}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Academic Year</div>
              <div class="info-value">${selectedAcademicYear?.name || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Term</div>
              <div class="info-value">${selectedTerm || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Generated</div>
              <div class="info-value">${new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>
        
        <div class="summary-section">
          <div class="section-title">Family Summary</div>
          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-label">Total Fees</div>
              <div class="summary-value">UGX ${familyPupils.reduce((sum, pupil) => {
                const summary = feesInfo[pupil.id];
                return sum + (summary?.totalFees || 0);
              }, 0).toLocaleString()}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Total Paid</div>
              <div class="summary-value">UGX ${familyPupils.reduce((sum, pupil) => {
                const summary = feesInfo[pupil.id];
                return sum + (summary?.totalPaid || 0);
              }, 0).toLocaleString()}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Outstanding</div>
              <div class="summary-value">UGX ${familyPupils.reduce((sum, pupil) => {
                const summary = feesInfo[pupil.id];
                return sum + (summary?.balance || 0);
              }, 0).toLocaleString()}</div>
            </div>
          </div>
        </div>
        
        ${familyPupils.map(pupil => {
          const summary = feesInfo[pupil.id];
          const applicableFees = summary?.applicableFees || [];
          
          return `
            <div class="pupil-section">
              <div class="pupil-header">
                <div class="pupil-name">${pupil.firstName} ${pupil.lastName}</div>
                <div class="pupil-details">
                  <div><strong>Class:</strong> ${pupil.className || 'N/A'}</div>
                  <div><strong>Section:</strong> ${pupil.section || 'N/A'}</div>
                  <div><strong>Registration:</strong> ${pupil.registrationDate ? new Date(pupil.registrationDate).toLocaleDateString() : 'N/A'}</div>
                </div>
              </div>
              
              <div class="section-title">Fee Breakdown</div>
              
              <table class="fees-table">
                <thead>
                  <tr>
                    <th>Fee Name</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Paid</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  ${applicableFees.map((fee: FeeWithPayment) => {
                    const feeType = fee.isCarryForward ? 'carryforward' : 
                                   fee.feeStructureId.startsWith('uniform') ? 'uniform' : 'current';
                    const feeTypeLabel = fee.isCarryForward ? 'Carry Forward' : 
                                        fee.feeStructureId.startsWith('uniform') ? 'Uniform' : 'Current Term';
                    
                    return `
                      <tr>
                        <td>
                          <div>${fee.name}</div>
                          ${fee.discount ? `
                            <div style="font-size: 12px; color: #7c3aed; margin-top: 2px;">
                              Discount: ${fee.discount.name} (${fee.discount.type === 'percentage' ? `${fee.discount.amount}%` : `UGX ${fee.discount.amount.toLocaleString()}`})
                            </div>
                          ` : ''}
                        </td>
                        <td>
                          <span class="fee-type-badge badge-${feeType}">${feeTypeLabel}</span>
                        </td>
                        <td>UGX ${fee.amount.toLocaleString()}</td>
                        <td>UGX ${fee.paid.toLocaleString()}</td>
                        <td>UGX ${fee.balance.toLocaleString()}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
              
              <div class="pupil-summary">
                <div class="summary-grid">
                  <div class="summary-item">
                    <div class="summary-label">Total Fees</div>
                    <div class="summary-value">UGX ${(summary?.totalFees || 0).toLocaleString()}</div>
                  </div>
                  <div class="summary-item">
                    <div class="summary-label">Total Paid</div>
                    <div class="summary-value">UGX ${(summary?.totalPaid || 0).toLocaleString()}</div>
                  </div>
                  <div class="summary-item">
                    <div class="summary-label">Outstanding</div>
                    <div class="summary-value">UGX ${(summary?.balance || 0).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
        
        <div class="footer">
          <p>This document was generated on ${new Date().toLocaleString()}</p>
          <p>Trinity Family Schools - Family Fees Management System</p>
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
      }, 500);
    }
  };

  const generateFamilyReceiptsPDF = async () => {
    // For now, use the same as summary - we can enhance this later
    await generateFamilySummaryPDF();
  };

  const handleClose = () => {
    setSelectedOption('summary');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600" />
            Print Family Statement
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select the type of document you want to print:
          </p>
          
          <div className="space-y-3">
            <div 
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedOption === 'summary' 
                  ? 'border-indigo-500 bg-indigo-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedOption('summary')}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-indigo-600" />
                <div>
                  <div className="font-medium text-gray-900">Summary</div>
                  <div className="text-sm text-gray-500">Family overview with totals and pupil breakdown</div>
                </div>
              </div>
            </div>
            
            <div 
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedOption === 'detailed' 
                  ? 'border-indigo-500 bg-indigo-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedOption('detailed')}
            >
              <div className="flex items-center gap-3">
                <List className="w-5 h-5 text-indigo-600" />
                <div>
                  <div className="font-medium text-gray-900">Detailed</div>
                  <div className="text-sm text-gray-500">Complete fee breakdown for each pupil</div>
                </div>
              </div>
            </div>
            
            <div 
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedOption === 'receipts' 
                  ? 'border-indigo-500 bg-indigo-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedOption('receipts')}
            >
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-indigo-600" />
                <div>
                  <div className="font-medium text-gray-900">Receipts</div>
                  <div className="text-sm text-gray-500">Payment receipts for all family members</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handlePrint}
            disabled={isGenerating}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Printer className="w-4 h-4 mr-2" />
            {isGenerating ? 'Generating...' : 'Print'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
