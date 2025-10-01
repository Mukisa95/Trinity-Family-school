'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

// UI Components
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

// Icons
import { 
  CurrencyCircleDollar, 
  Receipt, 
  Printer, 
  ArrowCircleLeft, 
  Users, 
  ArrowCounterClockwise 
} from '@phosphor-icons/react';

// Services and Hooks
import { AcademicYearsService } from '@/lib/services/academic-years.service';
import { PupilsService } from '@/lib/services/pupils.service';

// Types
import type { AcademicYear, Pupil } from '@/types';
import type { SelectedFee } from './types';

// Component imports
import { FeeCard } from './components/FeeCard';
import { PaymentModal } from './components/PaymentModal';
import { PrintModal } from './components/PrintModal';

// Hooks
import { usePupilFees } from './hooks/usePupilFees';
import { usePaymentProcessing } from './hooks/usePaymentProcessing';

export default function PupilFeesCollectionV2() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  
  const pupilId = params.id as string;
  const shouldOpenSummary = searchParams.get('openSummary') === 'true';

  // State management
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<AcademicYear | null>(null);
  const [lastPaymentTimestamp, setLastPaymentTimestamp] = useState<number>(0);

  // Modal states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  
  // Selected items
  const [selectedFee, setSelectedFee] = useState<SelectedFee | null>(null);

  // Fetch academic years
  const { data: academicYears = [], isLoading: isLoadingAcademicYears } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const years = await AcademicYearsService.getAllAcademicYears();
      return years;
    }
  });

  // Set default academic year and term when data is loaded
  useEffect(() => {
    if (academicYears.length > 0 && !selectedAcademicYear) {
      // Find the current active academic year
      const currentYear = academicYears.find(year => year.isActive);
      if (currentYear) {
        setSelectedAcademicYear(currentYear);
        // Find the current term
        const currentTerm = currentYear.terms.find(term => term.isCurrent);
        if (currentTerm) {
          setSelectedTerm(currentTerm.name);
        }
      }
    }
  }, [academicYears, selectedAcademicYear]);

  // Fetch pupil details
  const { data: pupil, isLoading: isPupilLoading } = useQuery({
    queryKey: ['pupil', pupilId],
    queryFn: async () => {
      const pupilData = await PupilsService.getPupilById(pupilId);
      return pupilData;
    },
    enabled: !!pupilId
  });

  // Use custom hooks for data fetching
  const {
    pupilFees,
    isLoading: isPupilFeesLoading,
    refetch,
    termTotals
  } = usePupilFees({
    pupilId,
    pupil: pupil || undefined,
    selectedTerm,
    selectedAcademicYear,
    lastPaymentTimestamp
  });

  // Use payment processing hook
  const { processPayment, isProcessing } = usePaymentProcessing({
    pupilId,
    selectedTerm,
    selectedAcademicYear,
    onPaymentSuccess: () => {
      setLastPaymentTimestamp(Date.now());
      setIsPaymentModalOpen(false);
      setSelectedFee(null);
    },
    onPaymentError: (error) => {
      console.error('Payment error:', error);
    }
  });

  // Handler functions
  const handleMakePayment = (fee: any, balance: number, totalPaid: number) => {
    setSelectedFee({
      feeId: fee.id,
      name: fee.name,
      amount: fee.amount,
      balance,
      amountPaid: totalPaid
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (data: { amount: number }) => {
    if (!selectedFee) return;
    
    try {
      await processPayment({
        feeId: selectedFee.feeId,
        amount: data.amount,
        balance: selectedFee.balance
      });
    } catch (error) {
      console.error('Payment submission error:', error);
    }
  };

  const handleRefreshData = async () => {
    try {
      setLastPaymentTimestamp(Date.now());
      await queryClient.invalidateQueries({ queryKey: ['pupil-fees'] });
      await refetch();
      toast({
        title: "Data Refreshed",
        description: "Fee data has been refreshed successfully",
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: "Failed to refresh data",
      });
    }
  };

  const handlePrint = async (selectedFees: any[]) => {
    // Will be implemented in later phases
    console.log('Print fees:', selectedFees);
    toast({
      title: "Print Feature",
      description: "Print functionality will be implemented in later phases",
    });
  };

  // Render term fees
  const renderTermFees = (term: string) => {
    if (pupilFees.length === 0) {
      return (
        <div className="text-center py-12">
          <CurrencyCircleDollar className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No fees found</h3>
          <p className="mt-1 text-sm text-gray-500">
            There are no applicable fees configured for this term and class.
          </p>
        </div>
      );
    }

    return (
      <div className="mt-6 space-y-6">
        {pupilFees.map((fee: any) => (
          <FeeCard
            key={fee.id}
            fee={fee}
            onPayment={handleMakePayment}
            selectedTerm={selectedTerm}
            selectedAcademicYear={selectedAcademicYear}
          />
        ))}
      </div>
    );
  };

  if (isPupilLoading || isPupilFeesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-20">
      {/* Header */}
      <div className="bg-white/80 border-b shadow-sm backdrop-blur-xl sticky top-0 z-10 border-b-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <Link
                  href="/fees/collection"
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition-all duration-300 hover:scale-95 origin-center"
                >
                  <ArrowCircleLeft className="w-4 h-4" weight="bold" />
                  <span className="text-sm font-medium">Back to Fees</span>
                </Link>
              </div>
              <h1 className="text-xl font-bold text-indigo-900">
                Fees Collection - {pupil ? (
                  <Link
                    href={`/pupil-detail?id=${pupil.id}`}
                    className="text-indigo-900 hover:text-indigo-700 hover:underline transition-all duration-300 hover:scale-95 inline-block origin-center"
                  >
                    {pupil.firstName} {pupil.lastName}
                  </Link>
                ) : 'Loading...'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                ID: {pupil?.admissionNumber || 'Loading...'} | 
                Class: {pupil?.className || 'Loading...'} | 
                Section: {pupil?.section || 'N/A'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={handleRefreshData}
                variant="outline"
                className="flex items-center gap-2 transition-all duration-300 hover:scale-95 origin-center"
              >
                <ArrowCounterClockwise size={20} />
                Refresh
              </Button>
              <Button
                onClick={() => setIsPrintModalOpen(true)}
                variant="outline"
                className="flex items-center gap-2 transition-all duration-300 hover:scale-95 origin-center"
              >
                <Printer size={20} />
                Print Statement
              </Button>
              {/* {pupil?.familyId && (
                <Link
                  href={`/pupils/${pupil.id}/family-fees`}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-200 shadow-sm text-sm font-medium rounded-lg text-indigo-700 bg-white hover:bg-indigo-50 transition-all duration-300 hover:scale-95 origin-center"
                >
                  <Users size={20} />
                  Family Accounts
                </Link>
              )} */}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-6">
          {/* Academic Year Selection */}
          <div className="mb-6">
            <select
              value={selectedAcademicYear?.id || ''}
              onChange={(e) => {
                const year = academicYears.find(year => year.id === e.target.value);
                setSelectedAcademicYear(year || null);
              }}
              className="w-48 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-white text-gray-700 font-medium hover:border-gray-300 transition-colors"
              disabled={isLoadingAcademicYears}
            >
              <option value="">Select Academic Year</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name} {year.isActive ? '(Current)' : year.isLocked ? '(Locked)' : '(Upcoming)'}
                </option>
              ))}
            </select>
          </div>

          {/* Grand Totals Summary */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="bg-indigo-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-indigo-600 mb-1">Total Fees</h3>
              <p className="text-2xl font-bold text-indigo-900">
                {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(termTotals.totalFees)}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-600 mb-1">Total Paid</h3>
              <p className="text-2xl font-bold text-green-900">
                {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(termTotals.totalPaid)}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-red-600 mb-1">Balance</h3>
              <p className="text-2xl font-bold text-red-900">
                {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(termTotals.totalBalance)}
              </p>
            </div>
          </div>

          {/* Term Tabs */}
          <Tabs value={selectedTerm} onValueChange={setSelectedTerm}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="Term 1">Term 1</TabsTrigger>
              <TabsTrigger value="Term 2">Term 2</TabsTrigger>
              <TabsTrigger value="Term 3">Term 3</TabsTrigger>
            </TabsList>
            <TabsContent value="Term 1">
              {renderTermFees('Term 1')}
            </TabsContent>
            <TabsContent value="Term 2">
              {renderTermFees('Term 2')}
            </TabsContent>
            <TabsContent value="Term 3">
              {renderTermFees('Term 3')}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modals */}
      {selectedFee && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedFee(null);
          }}
          onSubmit={handlePaymentSubmit}
          fee={selectedFee}
        />
      )}

      <PrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        fees={pupilFees}
        onPrint={handlePrint}
      />
    </div>
  );
} 