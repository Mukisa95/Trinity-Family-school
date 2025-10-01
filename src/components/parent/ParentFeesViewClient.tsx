'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

// UI Components
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// Icons
import { 
  CurrencyCircleDollar, 
  Receipt, 
  Printer, 
  ArrowCounterClockwise,
  Calendar,
  Clock,
  Check,
  X,
  Info
} from '@phosphor-icons/react';

// Services
import { AcademicYearsService } from '@/lib/services/academic-years.service';
import { PupilsService } from '@/lib/services/pupils.service';

// Utilities
import { getCurrentTerm } from '@/lib/utils/academic-year-utils';

// Types
import type { AcademicYear, Pupil } from '@/types';

// Hooks (reusing the same data fetching logic)
import { usePupilFees } from '@/app/fees/collect/[id]/hooks/usePupilFees';

// Compact Fee Card Component
interface ParentFeeCardProps {
  fee: any;
  selectedTerm: string;
  selectedAcademicYear: AcademicYear | null;
}

function ParentFeeCard({ fee, selectedTerm, selectedAcademicYear }: ParentFeeCardProps) {
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const balance = fee.amount - fee.paid;
  const paymentProgress = fee.amount > 0 ? (fee.paid / fee.amount) * 100 : 0;
  const isFullyPaid = balance <= 0;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-base truncate">{fee.name}</h3>
            {fee.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{fee.description}</p>
            )}
          </div>
          <div className={`ml-3 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
            isFullyPaid ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {isFullyPaid ? (
              <Check className="w-6 h-6 text-green-600" weight="bold" />
            ) : (
              <X className="w-6 h-6 text-red-600" weight="bold" />
            )}
          </div>
        </div>

        {/* Amount Summary - Compact Grid */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center p-2 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Total</div>
            <div className="text-sm font-bold text-gray-900">
              {new Intl.NumberFormat('en-UG', { 
                style: 'currency', 
                currency: 'UGX',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(fee.amount)}
            </div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <div className="text-xs text-green-600 mb-1">Paid</div>
            <div className="text-sm font-bold text-green-700">
              {new Intl.NumberFormat('en-UG', { 
                style: 'currency', 
                currency: 'UGX',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(fee.paid)}
            </div>
          </div>
          <div className="text-center p-2 bg-red-50 rounded-lg">
            <div className="text-xs text-red-600 mb-1">Balance</div>
            <div className="text-sm font-bold text-red-700">
              {new Intl.NumberFormat('en-UG', { 
                style: 'currency', 
                currency: 'UGX',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(balance)}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between items-center text-xs text-gray-600 mb-1">
            <span>Payment Progress</span>
            <span className="font-medium">{Math.round(paymentProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${
                isFullyPaid ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(paymentProgress, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Payment History Toggle */}
        {fee.payments && fee.payments.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPaymentHistory(!showPaymentHistory)}
              className="w-full h-8 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <Receipt className="w-3 h-3 mr-1" />
              {fee.payments.length} Payment{fee.payments.length > 1 ? 's' : ''} 
              {showPaymentHistory ? ' ▲' : ' ▼'}
            </Button>

            {/* Expanded Payment History */}
            {showPaymentHistory && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <div className="text-xs font-medium text-gray-700 mb-2">Payment History</div>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {fee.payments.map((payment: any, index: number) => (
                    <div key={index} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-600">
                          {new Date(payment.paymentDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-green-600">
                          {new Intl.NumberFormat('en-UG', { 
                            style: 'currency', 
                            currency: 'UGX',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          }).format(payment.amount)}
                        </span>
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      </div>
                    </div>
                  ))}
                </div>
                {fee.payments.length > 5 && (
                  <div className="text-center text-xs text-gray-500 mt-2">
                    Showing recent payments
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Fee Breakdown */}
        {fee.feeBreakdown && fee.feeBreakdown.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs font-medium text-gray-700 mb-2">Fee Breakdown</div>
            <div className="space-y-1">
              {fee.feeBreakdown.slice(0, 3).map((item: any, index: number) => (
                <div key={index} className="flex justify-between items-center text-xs">
                  <span className="text-gray-600 truncate flex-1 mr-2">{item.name}</span>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-green-600 font-medium">
                      {new Intl.NumberFormat('en-UG', { 
                        style: 'currency', 
                        currency: 'UGX',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      }).format(item.paid)}
                    </span>
                    <span className="text-gray-400">/</span>
                    <span className="text-gray-900 font-medium">
                      {new Intl.NumberFormat('en-UG', { 
                        style: 'currency', 
                        currency: 'UGX',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      }).format(item.amount)}
                    </span>
                  </div>
                </div>
              ))}
              {fee.feeBreakdown.length > 3 && (
                <div className="text-center text-xs text-gray-500 mt-1">
                  +{fee.feeBreakdown.length - 3} more items
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ParentFeesViewClientProps {
  pupilId: string;
}

export default function ParentFeesViewClient({ pupilId }: ParentFeesViewClientProps) {
  // State management
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<AcademicYear | null>(null);
  const [lastPaymentTimestamp, setLastPaymentTimestamp] = useState<number>(0);

  // Fetch academic years
  const { data: academicYears = [], isLoading: isLoadingAcademicYears } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const years = await AcademicYearsService.getAllAcademicYears();
      return years;
    }
  });

  // Fetch pupil data
  const { data: pupil, isLoading: isPupilLoading } = useQuery({
    queryKey: ['pupil', pupilId],
    queryFn: async () => {
      const pupilData = await PupilsService.getPupilById(pupilId);
      return pupilData;
    },
    enabled: !!pupilId
  });

  // Set default academic year and term when data is loaded
  useEffect(() => {
    if (academicYears.length > 0 && !selectedAcademicYear) {
      // Find the current active academic year
      const currentYear = academicYears.find(year => year.isActive);
      if (currentYear) {
        setSelectedAcademicYear(currentYear);
        
        // Use utility function to get current term more reliably
        const currentTerm = getCurrentTerm(currentYear);
        if (currentTerm) {
          setSelectedTermId(currentTerm.id);
        } else {
          // If no current term by date, check for term marked as current
          const markedCurrentTerm = currentYear.terms.find(term => term.isCurrent);
          if (markedCurrentTerm) {
            setSelectedTermId(markedCurrentTerm.id);
          } else if (currentYear.terms.length > 0) {
            // Fallback to first term if no current term
            setSelectedTermId(currentYear.terms[0].id);
          }
        }
      }
    }
  }, [academicYears, selectedAcademicYear]);

  // Use the same fee fetching hook as the admin version
  const {
    pupilFees,
    isLoading: isPupilFeesLoading,
    refetch,
    termTotals
  } = usePupilFees({
    pupilId,
    pupil: pupil || undefined,
    selectedTermId,
    selectedAcademicYear,
    lastPaymentTimestamp
  });

  const handleRefreshData = async () => {
    try {
      await refetch();
      toast({
        title: "Data Refreshed",
        description: "Fee information has been updated.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: "Could not refresh data. Please try again.",
      });
    }
  };

  const handlePrintSummary = () => {
    // Parent-friendly print functionality
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Fee Summary - ${pupil?.firstName} ${pupil?.lastName}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; font-size: 12px; }
              .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; }
              .totals { background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
              .fee-item { margin-bottom: 10px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px; }
              .payment-item { font-size: 10px; margin: 2px 0; padding: 4px 8px; background: #f0f9ff; border-radius: 4px; }
              .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
              .text-center { text-align: center; }
              .text-green { color: #059669; }
              .text-red { color: #dc2626; }
              .font-bold { font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>Fee Summary Report</h2>
              <p><strong>${pupil?.firstName} ${pupil?.lastName}</strong> | ID: ${pupil?.admissionNumber}</p>
              <p>Class: ${pupil?.className} | Academic Year: ${selectedAcademicYear?.name}</p>
            </div>
            <div class="totals">
              <h3>Summary Overview</h3>
              <div class="grid">
                <div class="text-center">
                  <div>Total Fees</div>
                  <div class="font-bold">${new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(termTotals.totalFees)}</div>
                </div>
                <div class="text-center text-green">
                  <div>Total Paid</div>
                  <div class="font-bold">${new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(termTotals.totalPaid)}</div>
                </div>
                <div class="text-center text-red">
                  <div>Outstanding</div>
                  <div class="font-bold">${new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(termTotals.totalBalance)}</div>
                </div>
              </div>
            </div>
            ${pupilFees.map(fee => `
              <div class="fee-item">
                <h4>${fee.name}</h4>
                <div class="grid">
                  <div>Amount: <strong>${new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(fee.amount)}</strong></div>
                  <div class="text-green">Paid: <strong>${new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(fee.paid)}</strong></div>
                  <div class="text-red">Balance: <strong>${new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(fee.amount - fee.paid)}</strong></div>
                </div>
                ${fee.payments && fee.payments.length > 0 ? `
                  <div style="margin-top: 8px;">
                    <strong>Payment History:</strong>
                    ${fee.payments.map(payment => `
                      <div class="payment-item">
                        ${new Date(payment.paymentDate).toLocaleDateString('en-GB')} - ${new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(payment.amount)}
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
            <div style="margin-top: 20px; text-align: center; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 15px;">
              <p><strong>For payments:</strong> Visit school accounts office | Office Hours: Mon-Fri, 8:00 AM - 5:00 PM</p>
              <p>Generated on: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Render term fees
  const renderTermFees = (term: string) => {
    if (pupilFees.length === 0) {
      return (
        <div className="text-center py-8">
          <CurrencyCircleDollar className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <h3 className="text-sm font-medium text-gray-900 mb-1">No fees found</h3>
          <p className="text-xs text-gray-500">
            No applicable fees for this term and class.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3 mt-4">
        {pupilFees.map((fee: any) => (
          <ParentFeeCard
            key={fee.id}
            fee={fee}
            selectedTerm={selectedTermId}
            selectedAcademicYear={selectedAcademicYear}
          />
        ))}
      </div>
    );
  };

  if (isPupilLoading || isPupilFeesLoading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600 font-medium">Loading fee information...</p>
          <p className="text-xs text-gray-500 mt-1">Fetching your child's fee details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Compact Controls */}
      <div className="space-y-4">
        {/* Academic Year and Term Selection Row */}
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0">
            <select
              value={selectedAcademicYear?.id || ''}
              onChange={(e) => {
                const year = academicYears.find(year => year.id === e.target.value);
                setSelectedAcademicYear(year || null);
              }}
              className="w-32 sm:w-auto px-2 sm:px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              disabled={isLoadingAcademicYears}
            >
              <option value="">Select Year</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name} {year.isActive ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Term Tabs - Compact Version */}
          {selectedAcademicYear && (
            <div className="flex-1 min-w-0">
              <Tabs value={selectedTermId} onValueChange={setSelectedTermId}>
                <TabsList className="grid grid-cols-3 h-8 sm:h-9 w-full">
                  {selectedAcademicYear.terms.map((term) => (
                    <TabsTrigger key={term.id} value={term.id} className="text-xs py-1 px-1">
                      {term.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          )}
        </div>

        {/* Compact Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="text-center">
              <div className="text-xs text-blue-600 mb-1">Total Fees</div>
              <div className="text-sm font-bold text-blue-900">
                {new Intl.NumberFormat('en-UG', { 
                  style: 'currency', 
                  currency: 'UGX',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(termTotals.totalFees)}
              </div>
            </div>
          </Card>
          <Card className="p-3 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="text-center">
              <div className="text-xs text-green-600 mb-1">Paid</div>
              <div className="text-sm font-bold text-green-900">
                {new Intl.NumberFormat('en-UG', { 
                  style: 'currency', 
                  currency: 'UGX',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(termTotals.totalPaid)}
              </div>
            </div>
          </Card>
          <Card className="p-3 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <div className="text-center">
              <div className="text-xs text-red-600 mb-1">Balance</div>
              <div className="text-sm font-bold text-red-900">
                {new Intl.NumberFormat('en-UG', { 
                  style: 'currency', 
                  currency: 'UGX',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(termTotals.totalBalance)}
              </div>
            </div>
          </Card>
        </div>

        {/* Fee Content */}
        {selectedAcademicYear && (
          <div>
            <Tabs value={selectedTermId} onValueChange={setSelectedTermId}>
              {selectedAcademicYear.terms.map((term) => (
                <TabsContent key={term.id} value={term.id} className="mt-0">
                  {renderTermFees(term.name)}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
} 