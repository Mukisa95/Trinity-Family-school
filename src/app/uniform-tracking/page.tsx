"use client";
import { SmartBackButton } from "@/components/common/SmartBackButton";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/page-header';
import { UniformTrackingModal } from '@/components/common/uniform-tracking-modal';
import { PaymentModal } from '@/components/common/payment-modal';
import { CollectionModal } from '@/components/common/collection-modal';
import { TrackingRecordCard } from '@/components/uniform-tracking/TrackingRecordCard';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Plus,
  Edit,
  DollarSign,
  Package,
  ArrowLeft,
  Loader2,
  Trash2,
  RotateCcw,
  AlertCircle,
  Eye,
  MoreHorizontal,
  CheckCircle,
  Clock,
  CreditCard
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { usePupil } from '@/lib/hooks/use-pupils';
import { useUniformsByFilter, useActiveUniforms } from '@/lib/hooks/use-uniforms';
import {
  useUniformTrackingByPupil,
  useCreateUniformTracking,
  useUpdateUniformTracking,
  useDeleteUniformTracking
} from '@/lib/hooks/use-uniform-tracking';
import {
  useUniformInventory,
  useIncrementStockBatch
} from '@/lib/hooks/use-uniform-inventory';
import { useQueryClient } from '@tanstack/react-query';
import type {
  UniformTracking,
  UniformItem,
  UniformHistory,
  CreateUniformTrackingData,
  PaymentStatus,
  CollectionStatus,
  UniformGender,
  UniformSection
} from '@/types';
import { Alert, AlertDescription } from '@/components/ui/alert';

function UniformTrackingContent() {
  const searchParams = useSearchParams();
  const pupilId = searchParams.get('id');

  // State for modals
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<UniformTracking | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPaymentRecord, setSelectedPaymentRecord] = useState<UniformTracking | null>(null);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [selectedCollectionRecord, setSelectedCollectionRecord] = useState<UniformTracking | null>(null);

  // Custom delete confirmation state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<UniformTracking | null>(null);

  // Hooks
  const { data: pupil, isLoading: pupilLoading } = usePupil(pupilId || '');
  const { data: trackingRecords = [], isLoading: trackingLoading } = useUniformTrackingByPupil(pupilId || '');

  // Get eligible uniforms based on pupil's gender, class, and section
  const getUniformGender = (pupilGender: string | undefined): UniformGender | undefined => {
    if (!pupilGender || pupilGender === '') return undefined;
    const gender = pupilGender.toLowerCase();
    if (gender === 'male' || gender === 'female') return gender as UniformGender;
    return undefined;
  };

  const getUniformSection = (pupilSection: string | undefined): UniformSection | undefined => {
    if (!pupilSection || pupilSection === '') return undefined;
    if (pupilSection === 'Day' || pupilSection === 'Boarding') return pupilSection as UniformSection;
    return undefined;
  };

  const { data: eligibleUniforms = [], isLoading: uniformsLoading, error: uniformsError } = useUniformsByFilter({
    gender: getUniformGender(pupil?.gender),
    classId: pupil?.classId,
    section: getUniformSection(pupil?.section)
  }, !!pupil);

  // Fallback to all active uniforms if filtering fails or returns empty
  const { data: allActiveUniforms = [] } = useActiveUniforms();
  const finalEligibleUniforms = eligibleUniforms.length > 0 ? eligibleUniforms : allActiveUniforms;

  // Mutations
  const createTrackingMutation = useCreateUniformTracking();
  const updateTrackingMutation = useUpdateUniformTracking();
  const deleteTrackingMutation = useDeleteUniformTracking();
  const incrementStockBatch = useIncrementStockBatch();

  // Uniform inventory for size/stock tracking
  const { data: uniformInventory = [] } = useUniformInventory();

  // Query client for invalidating caches
  const queryClient = useQueryClient();

  if (!pupilId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Pupil Selected</h2>
          <p className="text-gray-600 mb-6">Please select a pupil to view their uniform tracking.</p>
          <SmartBackButton
            fallbackHref="/pupils"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pupils
          </SmartBackButton>
        </div>
      </div>
    );
  }

  if (pupilLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
          <p className="text-gray-600">Getting pupil information</p>
        </div>
      </div>
    );
  }

  if (!pupil) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Pupil Not Found</h2>
          <p className="text-gray-600 mb-6">The selected pupil could not be found.</p>
          <SmartBackButton
            fallbackHref="/pupils"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pupils
          </SmartBackButton>
        </div>
      </div>
    );
  }

  // Helper functions
  const getUniformName = (uniformId: string | string[]) => {
    if (Array.isArray(uniformId)) {
      return uniformId.map(id => finalEligibleUniforms.find(u => u.id === id)?.name || 'Unknown Uniform').join(', ');
    }
    return finalEligibleUniforms.find(u => u.id === uniformId)?.name || 'Unknown Uniform';
  };

  const getTotalAmount = (uniformId: string | string[]) => {
    if (Array.isArray(uniformId)) {
      return uniformId.reduce((total, id) => {
        const uniform = finalEligibleUniforms.find(u => u.id === id);
        return total + (uniform?.price || 0);
      }, 0);
    }
    const uniform = finalEligibleUniforms.find(u => u.id === uniformId);
    return uniform?.price || 0;
  };

  const getBalance = (record: UniformTracking) => {
    const totalAmount = record.finalAmount || getTotalAmount(record.uniformId);
    return totalAmount - record.paidAmount;
  };

  const getDiscountAmount = (record: UniformTracking) => {
    if (record.originalAmount && record.finalAmount) {
      return record.originalAmount - record.finalAmount;
    }
    return 0;
  };

  const getFinalAmount = (record: UniformTracking) => {
    return record.finalAmount || getTotalAmount(record.uniformId);
  };

  const isFullyCollected = (record: UniformTracking) => {
    if (record.collectionStatus === 'collected') return true;
    if (!record.collectedItems || !Array.isArray(record.uniformId)) return false;
    return record.uniformId.every(id => record.collectedItems?.includes(id));
  };

  // Helper to get size status for a specific uniform in a tracking record
  const getSizeStatusForUniform = (record: UniformTracking, uniformId: string): {
    status: 'available' | 'out' | 'unspecified' | 'no-inventory';
    size?: string;
    stock?: number
  } => {
    const inventory = uniformInventory.find(i => i.uniformId === uniformId);

    // No inventory configured for this uniform
    if (!inventory || inventory.sizes.length === 0) {
      return { status: 'no-inventory' };
    }

    const size = record.selectedSizes?.[uniformId];

    // No size specified
    if (!size) {
      return { status: 'unspecified' };
    }

    // Check stock for the selected size
    const stockItem = inventory.stock.find(s => s.size === size);
    const stock = stockItem?.quantity || 0;

    if (stock > 0) {
      return { status: 'available', size, stock };
    } else {
      return { status: 'out', size, stock: 0 };
    }
  };

  // Get uniform IDs as array
  const getUniformIdsArray = (uniformId: string | string[]): string[] => {
    return Array.isArray(uniformId) ? uniformId : [uniformId];
  };

  // Modal handlers
  const handleOpenTrackingModal = () => {
    setSelectedRecord(null);
    setIsTrackingModalOpen(true);
  };

  const handleOpenEditModal = (record: UniformTracking) => {
    setSelectedRecord(record);
    setIsTrackingModalOpen(true);
  };

  const handleCloseTrackingModal = () => {
    setIsTrackingModalOpen(false);
    setSelectedRecord(null);
  };

  const handleTrackingSubmit = async (trackingData: Omit<UniformTracking, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (selectedRecord) {
        await updateTrackingMutation.mutateAsync({
          id: selectedRecord.id,
          data: trackingData
        });
      } else {
        await createTrackingMutation.mutateAsync(trackingData);
      }
      handleCloseTrackingModal();
    } catch (error) {
      console.error('Error submitting tracking data:', error);
      alert('Failed to save tracking record. Please try again.');
    }
  };

  const handleOpenPaymentModal = (record: UniformTracking) => {
    setSelectedPaymentRecord(record);
    setIsPaymentModalOpen(true);
  };

  const handleClosePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setSelectedPaymentRecord(null);
  };

  const handlePaymentSubmit = async (amount: number) => {
    if (!selectedPaymentRecord) return;

    try {
      const newPaidAmount = selectedPaymentRecord.paidAmount + amount;
      const finalAmount = getFinalAmount(selectedPaymentRecord);
      const previousBalance = finalAmount - selectedPaymentRecord.paidAmount;
      const newBalance = finalAmount - newPaidAmount;
      const newPaymentStatus: PaymentStatus =
        newPaidAmount >= finalAmount ? 'paid' :
          newPaidAmount > 0 ? 'partial' : 'pending';

      // Create detailed history entry for this payment
      const historyEntry: UniformHistory = {
        date: new Date().toISOString(),
        paymentStatus: newPaymentStatus,
        paidAmount: amount, // Individual payment amount
        collectionStatus: selectedPaymentRecord.collectionStatus,
        // Use receivedBy field to store payment details for clarity
        receivedBy: `Payment: ${formatCurrency(amount)} | Balance Before: ${formatCurrency(previousBalance)} | Balance After: ${formatCurrency(newBalance)} | Total Paid: ${formatCurrency(newPaidAmount)}`
      };

      const updatedRecord = {
        ...selectedPaymentRecord,
        paidAmount: newPaidAmount,
        paymentStatus: newPaymentStatus,
        paymentDate: newPaymentStatus === 'paid' ? new Date().toISOString() : selectedPaymentRecord.paymentDate,
        history: [...(selectedPaymentRecord.history || []), historyEntry]
      };

      await updateTrackingMutation.mutateAsync({
        id: selectedPaymentRecord.id,
        data: updatedRecord
      });

      handleClosePaymentModal();
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Failed to process payment. Please try again.');
    }
  };

  const handleOpenCollectionModal = (record: UniformTracking) => {
    setSelectedCollectionRecord(record);
    setIsCollectionModalOpen(true);
  };

  const handleCloseCollectionModal = () => {
    setIsCollectionModalOpen(false);
    setSelectedCollectionRecord(null);
  };

  const handleCollectionSubmit = async (
    collectedItems: string[],
    isFullCollection: boolean,
    collectionSizes: Record<string, string>,
    collectionQuantities?: Record<string, number>
  ) => {
    if (!selectedCollectionRecord) return;

    try {
      // Reduce stock for collected items that have sizes specified
      const stockReductions = collectedItems
        .filter(itemId => collectionSizes[itemId]) // Only items with size selected
        .map(itemId => ({
          uniformId: itemId,
          size: collectionSizes[itemId],
          quantity: collectionQuantities?.[itemId] || 1
        }));

      const historyEntry: UniformHistory = {
        date: new Date().toISOString(),
        paymentStatus: selectedCollectionRecord.paymentStatus,
        paidAmount: 0, // Collection entries don't change payment amounts
        collectionStatus: selectedCollectionRecord.collectionStatus,
        collectedItems,
        receivedBy: `PARTIAL COLLECTION | Items Collected: ${collectedItems.length} items | ${getUniformName(collectedItems).substring(0, 50)}${collectedItems.length > 1 ? '...' : ''}`
      };

      const allHistory = [...(selectedCollectionRecord.history || []), historyEntry];

      if (isFullCollection) {
        allHistory.push({
          date: new Date().toISOString(),
          paymentStatus: selectedCollectionRecord.paymentStatus,
          paidAmount: 0, // Collection entries don't change payment amounts
          collectionStatus: 'collected',
          receivedBy: `FULL COLLECTION COMPLETED | All uniform items have been collected`
        });
      }

      // Merge collection sizes with existing selected sizes
      const mergedSizes = {
        ...(selectedCollectionRecord.selectedSizes || {}),
        ...collectionSizes
      };

      const mergedCollectedQuantities: Record<string, number> = {
        ...(selectedCollectionRecord.collectedQuantities || {})
      };
      collectedItems.forEach(itemId => {
        const added = collectionQuantities?.[itemId] || 1;
        mergedCollectedQuantities[itemId] = (mergedCollectedQuantities[itemId] || 0) + added;
      });

      const allCollectedItems = [...new Set([
        ...(selectedCollectionRecord.history?.flatMap(h => h.collectedItems || []) || []),
        ...collectedItems
      ])].filter(Boolean);

      const updatedRecord = {
        ...selectedCollectionRecord,
        collectionStatus: (isFullCollection ? 'collected' : 'pending') as CollectionStatus,
        collectionDate: isFullCollection ? new Date().toISOString() : selectedCollectionRecord.collectionDate,
        collectedItems: allCollectedItems,
        selectedSizes: mergedSizes,
        collectedQuantities: mergedCollectedQuantities,
        history: allHistory
      };

      await updateTrackingMutation.mutateAsync({
        id: selectedCollectionRecord.id,
        data: updatedRecord,
        stockReductions,
      });

      handleCloseCollectionModal();
    } catch (error) {
      console.error('Error updating collection status:', error);
      alert('Failed to update collection status. Please try again.');
      throw error;
    }
  };

  // Custom delete confirmation handlers
  const handleOpenDeleteConfirm = (record: UniformTracking) => {
    setRecordToDelete(record);
    setIsDeleteConfirmOpen(true);
  };

  const handleCloseDeleteConfirm = () => {
    setIsDeleteConfirmOpen(false);
    setRecordToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;

    try {
      console.log('Deleting record:', recordToDelete.id);
      await deleteTrackingMutation.mutateAsync(recordToDelete.id);
      console.log('Deletion successful');
      alert('Uniform tracking record has been successfully deleted!');
      handleCloseDeleteConfirm();
    } catch (error) {
      console.error('Error deleting tracking record:', error);
      alert('Failed to delete tracking record. Please try again.');
    }
  };

  const handleDeleteTracking = async (id: string) => {
    try {
      console.log('Starting delete process for ID:', id);
      const record = trackingRecords.find(r => r.id === id);
      console.log('Found record:', record);

      const confirmDelete = window.confirm(`🗑️ DELETE CONFIRMATION\n\nAre you sure you want to PERMANENTLY DELETE this uniform tracking record?\n\nUniform: ${record ? getUniformName(record.uniformId) : 'this uniform'}\nPaid Amount: ${record ? formatCurrency(record.paidAmount) : 'N/A'}\n\n⚠️ This action CANNOT be undone!\n\nClick OK to DELETE or Cancel to keep the record.`);
      console.log('User confirmed deletion:', confirmDelete);

      if (!confirmDelete) {
        console.log('User cancelled deletion');
        return;
      }

      console.log('Calling deleteTrackingMutation...');
      await deleteTrackingMutation.mutateAsync(id);
      console.log('Deletion successful');
      alert('Uniform tracking record has been successfully deleted!');
    } catch (error) {
      console.error('Error deleting tracking record:', error);
      alert('Failed to delete tracking record. Please try again.');
    }
  };

  const handleRevertPayment = async (record: UniformTracking) => {
    try {
      const confirmRevert = window.confirm(`Are you sure you want to revert all payments for ${getUniformName(record.uniformId)}? This will reset the paid amount to 0.`);

      if (!confirmRevert) return;

      const revertedAmount = record.paidAmount;
      const finalAmount = getFinalAmount(record);

      const historyEntry: UniformHistory = {
        date: new Date().toISOString(),
        paymentStatus: 'pending',
        paidAmount: -revertedAmount, // Negative amount to show reversal
        collectionStatus: record.collectionStatus,
        receivedBy: `PAYMENT REVERTED | Amount Reverted: ${formatCurrency(revertedAmount)} | Previous Balance: ${formatCurrency(finalAmount - revertedAmount)} | New Balance: ${formatCurrency(finalAmount)}`
      };

      const updatedRecord = {
        ...record,
        paidAmount: 0,
        paymentStatus: 'pending' as PaymentStatus,
        paymentDate: undefined,
        history: [...(record.history || []), historyEntry]
      };

      await updateTrackingMutation.mutateAsync({
        id: record.id,
        data: updatedRecord
      });

      alert('Payment has been successfully reverted!');
    } catch (error) {
      console.error('Error reverting payment:', error);
      alert('Failed to revert payment. Please try again.');
    }
  };

  const handleUndoCollection = async (record: UniformTracking) => {
    try {
      const confirmUndo = window.confirm(`Are you sure you want to undo the collection for ${getUniformName(record.uniformId)}? This will return items to inventory.`);

      if (!confirmUndo) return;

      // Restore stock for collected items that have sizes
      const itemsToRestore = (record.collectedItems || [])
        .filter(itemId => record.selectedSizes?.[itemId])
        .map(itemId => ({
          uniformId: itemId,
          size: record.selectedSizes![itemId],
          quantity: 1
        }));

      if (itemsToRestore.length > 0) {
        await incrementStockBatch.mutateAsync(itemsToRestore);
      }

      const historyEntry: UniformHistory = {
        date: new Date().toISOString(),
        paymentStatus: record.paymentStatus,
        paidAmount: 0,
        collectionStatus: 'pending', // Reverted to pending
        receivedBy: `COLLECTION REVERTED | Items Returned: ${itemsToRestore.length} | Stock Restored`
      };

      const updatedRecord = {
        ...record,
        collectionStatus: 'pending' as CollectionStatus,
        collectedItems: [], // Clear collected items
        collectionDate: undefined,
        history: [...(record.history || []), historyEntry]
      };

      await updateTrackingMutation.mutateAsync({
        id: record.id,
        data: updatedRecord
      });

      // Invalidate queries to sync with fees collection page
      queryClient.invalidateQueries({ queryKey: ['uniform-fees'] });
      queryClient.invalidateQueries({ queryKey: ['uniform-inventory'] });

      alert('Collection has been successfully undone!');
    } catch (error) {
      console.error('Error undoing collection:', error);
      alert('Failed to undo collection. Please try again.');
    }
  };

  // Calculate summary stats
  const totalAssigned = trackingRecords.reduce((sum, record) => sum + getFinalAmount(record), 0);
  const totalPaid = trackingRecords.reduce((sum, record) => sum + record.paidAmount, 0);
  const totalOutstanding = trackingRecords.reduce((sum, record) => sum + getBalance(record), 0);
  const totalItems = trackingRecords.length;
  const collectedItems = trackingRecords.filter(r => r.collectionStatus === 'collected').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-20">
      {/* Modern Header */}
      <div className="bg-white/80 border-b shadow-sm backdrop-blur-xl sticky top-0 z-10 border-b-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-4">
            {/* Navigation and Actions */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <SmartBackButton
                  fallbackHref={`/pupil-detail?id=${pupil.id}`}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition-all duration-300 hover:scale-95"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">Back to Profile</span>
                </SmartBackButton>
              </div>

              <Button
                onClick={handleOpenTrackingModal}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-300"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Uniform
              </Button>
            </div>

            {/* Title and Student Info */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-indigo-900 mb-2">
                👕 Uniform Tracking
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-indigo-600">{pupil.firstName} {pupil.lastName}</span>
                  <span className="text-gray-400">•</span>
                  <span>{pupil.admissionNumber}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>{pupil.className || 'No Class'}</span>
                  <span className="text-gray-400">•</span>
                  <span>{pupil.section}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary Cards */}
        {trackingRecords.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Assigned */}
            <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600">Total Assigned</h3>
                    <p className="text-2xl font-bold text-indigo-900">
                      {formatCurrency(totalAssigned)}
                    </p>
                  </div>
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Package className="w-5 h-5 text-indigo-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Paid */}
            <Card className="border-green-100 bg-gradient-to-br from-green-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600">Total Paid</h3>
                    <p className="text-2xl font-bold text-green-700">
                      {formatCurrency(totalPaid)}
                    </p>
                  </div>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Outstanding Balance */}
            <Card className="border-red-100 bg-gradient-to-br from-red-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600">Outstanding</h3>
                    <p className="text-2xl font-bold text-red-700">
                      {formatCurrency(totalOutstanding)}
                    </p>
                  </div>
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items Count */}
            <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600">Items Assigned</h3>
                    <p className="text-2xl font-bold text-blue-700">{totalItems}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {collectedItems} collected
                    </p>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tracking Records */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Uniform Records</CardTitle>
            <p className="text-sm text-gray-600">Track uniform assignments, payments, and collections</p>
          </CardHeader>
          <CardContent className="p-0">
            {trackingLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : trackingRecords.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Package className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No uniforms assigned yet</h3>
                <p className="text-gray-600 mb-6">Get started by adding the first uniform assignment for this pupil.</p>
                <Button
                  onClick={handleOpenTrackingModal}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Uniform
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {trackingRecords.map((record) => (
                  <TrackingRecordCard
                    key={record.id}
                    record={record}
                    finalEligibleUniforms={finalEligibleUniforms}
                    uniformInventory={uniformInventory}
                    onPay={() => handleOpenPaymentModal(record)}
                    onCollect={() => handleOpenCollectionModal(record)}
                    onUndo={() => handleUndoCollection(record)}
                    onEdit={() => handleOpenEditModal(record)}
                    onRevert={() => {
                      if (record.paidAmount <= 0) {
                        alert('No payments to revert for this uniform item.');
                        return;
                      }
                      handleRevertPayment(record);
                    }}
                    onDelete={() => {
                      // First try the test confirm
                      try {
                        const testConfirm = window.confirm('Are you sure you want to delete this record?');
                        if (testConfirm) {
                          handleDeleteTracking(record.id);
                        }
                      } catch (error) {
                        console.log('window.confirm failed:', error);
                        handleOpenDeleteConfirm(record);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      {pupil && (
        <UniformTrackingModal
          isOpen={isTrackingModalOpen}
          onClose={handleCloseTrackingModal}
          onSubmit={handleTrackingSubmit}
          pupilId={pupil.id}
          selectedRecord={selectedRecord}
          eligibleUniforms={finalEligibleUniforms}
        />
      )}



      {selectedPaymentRecord && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={handleClosePaymentModal}
          onSubmit={handlePaymentSubmit}
          fullAmount={getFinalAmount(selectedPaymentRecord)}
          paidAmount={selectedPaymentRecord.paidAmount}
          balance={getBalance(selectedPaymentRecord)}
        />
      )}

      {selectedCollectionRecord && (
        <CollectionModal
          isOpen={isCollectionModalOpen}
          onClose={handleCloseCollectionModal}
          onSubmit={handleCollectionSubmit}
          uniforms={Array.isArray(selectedCollectionRecord.uniformId)
            ? finalEligibleUniforms.filter(u => selectedCollectionRecord.uniformId.includes(u.id))
            : finalEligibleUniforms.filter(u => u.id === selectedCollectionRecord.uniformId)
          }
          selectionMode={selectedCollectionRecord.selectionMode}
          previouslyCollectedItems={selectedCollectionRecord.history
            ?.flatMap(h => h.collectedItems || [])
            .filter(Boolean) || []
          }
          selectedSizes={selectedCollectionRecord.selectedSizes || {}}
          selectedQuantities={selectedCollectionRecord.selectedQuantities || {}}
          collectedQuantities={selectedCollectionRecord.collectedQuantities || {}}
          uniformInventory={uniformInventory}
        />
      )}

      {/* Custom Delete Confirmation Modal */}
      {isDeleteConfirmOpen && recordToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Confirmation</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-gray-700">
                Are you sure you want to permanently delete this uniform tracking record?
              </p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="text-sm"><strong>Uniform:</strong> {getUniformName(recordToDelete.uniformId)}</p>
                <p className="text-sm"><strong>Paid Amount:</strong> {formatCurrency(recordToDelete.paidAmount)}</p>
                <p className="text-sm"><strong>Status:</strong> {recordToDelete.paymentStatus} payment, {recordToDelete.collectionStatus} collection</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                onClick={handleCloseDeleteConfirm}
                variant="outline"
                className="px-4"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-4"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UniformTrackingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
          <p className="text-gray-600">Getting uniform tracking data</p>
        </div>
      </div>
    }>
      <UniformTrackingContent />
    </Suspense>
  );
}
