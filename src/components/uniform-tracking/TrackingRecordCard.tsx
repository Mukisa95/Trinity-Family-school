
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Package,
    Edit,
    RotateCcw,
    Trash2,
    CreditCard,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { formatCurrency } from '@/lib/utils';
import type { UniformTracking, UniformItem, UniformInventoryItem } from '@/types';

interface TrackingRecordCardProps {
    record: UniformTracking;
    finalEligibleUniforms: UniformItem[];
    uniformInventory: UniformInventoryItem[];
    onPay: (record: UniformTracking) => void;
    onCollect: (record: UniformTracking) => void;
    onUndo: (record: UniformTracking) => void;
    onEdit: (record: UniformTracking) => void;
    onRevert: (record: UniformTracking) => void;
    onDelete: (record: UniformTracking) => void;
}

export function TrackingRecordCard({
    record,
    finalEligibleUniforms,
    uniformInventory,
    onPay,
    onCollect,
    onUndo,
    onEdit,
    onRevert,
    onDelete
}: TrackingRecordCardProps) {
    const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false);
    const [isCollectionHistoryOpen, setIsCollectionHistoryOpen] = useState(false);

    // --- Helper Functions ---
    const getUniformName = (uniformId: string | string[]) => {
        if (Array.isArray(uniformId)) {
            return uniformId.map(id => finalEligibleUniforms.find(u => u.id === id)?.name || 'Unknown Uniform').join(', ');
        }
        return finalEligibleUniforms.find(u => u.id === uniformId)?.name || 'Unknown Uniform';
    };

    const getUniformIdsArray = (uniformId: string | string[]): string[] => {
        return Array.isArray(uniformId) ? uniformId : [uniformId];
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

    const getDiscountAmount = (record: UniformTracking) => {
        if (record.originalAmount && record.finalAmount) {
            return record.originalAmount - record.finalAmount;
        }
        return 0;
    };

    const getFinalAmount = (record: UniformTracking) => {
        return record.finalAmount || getTotalAmount(record.uniformId);
    };

    const getBalance = (record: UniformTracking) => {
        const totalAmount = getFinalAmount(record);
        return totalAmount - record.paidAmount;
    };

    const isFullyCollected = (record: UniformTracking) => {
        if (record.collectionStatus === 'collected') return true;
        if (!record.collectedItems || !Array.isArray(record.uniformId)) return false;
        return record.uniformId.every(id => record.collectedItems?.includes(id));
    };

    const getSizeStatusForUniform = (record: UniformTracking, uniformId: string) => {
        const inventory = uniformInventory.find(i => i.uniformId === uniformId);

        if (!inventory || inventory.sizes.length === 0) {
            return { status: 'no-inventory' as const };
        }

        const size = record.selectedSizes?.[uniformId];

        if (!size) {
            return { status: 'unspecified' as const };
        }

        const stockItem = inventory.stock.find(s => s.size === size);
        const stock = stockItem?.quantity || 0;

        if (stock > 0) {
            return { status: 'available' as const, size, stock };
        } else {
            return { status: 'out' as const, size, stock: 0 };
        }
    };


    // --- Filter History ---
    // Fixed: Exclude 'reverted' from payment history key check to prevent 'COLLECTION REVERTED' showing up
    const paymentHistory = record.history?.filter(h =>
        h.paidAmount !== 0 || h.receivedBy?.toLowerCase().includes('payment')
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];

    const collectionHistory = record.history?.filter(h =>
        (h.collectedItems && h.collectedItems.length > 0) || h.receivedBy?.toLowerCase().includes('collection')
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];

    const visiblePaymentHistory = isPaymentHistoryOpen ? paymentHistory : paymentHistory.slice(0, 2);
    const visibleCollectionHistory = isCollectionHistoryOpen ? collectionHistory : collectionHistory.slice(0, 2);

    return (
        <div className="p-4 sm:p-6 hover:bg-gray-50 transition-colors border-b last:border-0 border-gray-100">
            {/* Mobile-first card layout */}
            <div className="flex flex-col gap-4">
                {/* Header Row: Icon + Name + Actions */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Left: Icon & Name */}
                    <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                            <Package className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h3 className="text-base font-semibold text-gray-900">
                                    {getUniformName(record.uniformId)}
                                </h3>
                                <Badge
                                    variant="outline"
                                    className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                                >
                                    {record.selectionMode === 'full' ? 'Full Set' :
                                        record.selectionMode === 'partial' ? 'Multiple Items' :
                                            'Single Item'}
                                </Badge>
                                {getDiscountAmount(record) > 0 && (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-primary/80 text-xs bg-green-100 text-green-800 border-green-200 cursor-pointer">
                                                🎉 Discounted
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-3">
                                            <div className="space-y-2">
                                                <h4 className="font-medium text-sm leading-none">Discount Details</h4>
                                                <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                                                    <span className="text-muted-foreground">Original:</span>
                                                    <span className="font-mono text-right">{formatCurrency(getTotalAmount(record.uniformId))}</span>
                                                    <span className="text-green-600">Discount:</span>
                                                    <span className="font-mono text-right text-green-600">-{formatCurrency(getDiscountAmount(record))}</span>
                                                    <div className="col-span-2 border-t my-1"></div>
                                                    <span className="font-medium">Final:</span>
                                                    <span className="font-mono text-right font-medium">{formatCurrency(getFinalAmount(record))}</span>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>
                            {/* Status Badges - Moved here for better visibility */}
                            <div className="flex flex-wrap gap-2 mt-1">
                                <Badge
                                    variant={record.paymentStatus === 'paid' ? 'default' :
                                        record.paymentStatus === 'partial' ? 'secondary' : 'outline'}
                                    className="text-[10px] h-5"
                                >
                                    {record.paymentStatus === 'paid' ? '✅ Paid' :
                                        record.paymentStatus === 'partial' ? '⏳ Partial' : '💰 Unpaid'}
                                </Badge>

                                <Badge
                                    variant={record.collectionStatus === 'collected' ? 'default' : 'outline'}
                                    className="text-[10px] h-5"
                                >
                                    {record.collectionStatus === 'collected' ? '📦 Collected' : '⏱️ Pending'}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                        {getBalance(record) > 0 && (
                            <Button
                                onClick={() => onPay(record)}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-xs h-8"
                            >
                                <CreditCard className="w-3 h-3 mr-1" />
                                Pay
                            </Button>
                        )}

                        {!isFullyCollected(record) && (
                            <Button
                                onClick={() => onCollect(record)}
                                variant="outline"
                                size="sm"
                                className="text-xs h-8"
                            >
                                <Package className="w-3 h-3 mr-1" />
                                {record.collectedItems && record.collectedItems.length > 0 ? 'Collect Rem.' : 'Collect'}
                            </Button>
                        )}

                        {/* Undo Collection Button */}
                        {(record.collectionStatus === 'collected' || (record.collectedItems && record.collectedItems.length > 0)) && (
                            <Button
                                onClick={() => onUndo(record)}
                                variant="outline"
                                size="sm"
                                className="text-xs border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 h-8"
                                title="Undo collection and restore stock"
                            >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Undo
                            </Button>
                        )}

                        <Button
                            onClick={() => onEdit(record)}
                            variant="outline"
                            size="sm"
                            className="text-xs h-8"
                        >
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                        </Button>

                        {/* Revert Payment Button */}
                        <Button
                            onClick={() => {
                                if (record.paidAmount <= 0) {
                                    alert('No payments to revert for this uniform item.');
                                    return;
                                }
                                onRevert(record);
                            }}
                            variant="outline"
                            size="sm"
                            disabled={record.paidAmount <= 0}
                            className={`text-xs h-8 ${record.paidAmount > 0
                                ? 'border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700'
                                : 'border-gray-200 text-gray-400'
                                }`}
                            title={record.paidAmount <= 0 ? 'No payments to revert' : 'Revert all payments'}
                        >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Revert
                        </Button>

                        {/* Delete Button */}
                        <Button
                            onClick={() => onDelete(record)}
                            variant="outline"
                            size="sm"
                            className="text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-8"
                        >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                        </Button>
                    </div>
                </div>

                {/* Content Body */}
                <div className="pl-0 sm:pl-[52px]"> {/* Align with text, skipping icon width */}
                    {/* Size Status Display */}
                    {getUniformIdsArray(record.uniformId).length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {getUniformIdsArray(record.uniformId).map(uniformId => {
                                const uniformName = finalEligibleUniforms.find(u => u.id === uniformId)?.name || 'Unknown';
                                const sizeStatus = getSizeStatusForUniform(record, uniformId);

                                return (
                                    <div key={uniformId} className="flex items-center gap-1.5 text-xs">
                                        <span className="text-gray-600 truncate max-w-[100px]" title={uniformName}>
                                            {uniformName.length > 12 ? uniformName.substring(0, 12) + '...' : uniformName}:
                                        </span>
                                        {sizeStatus.status === 'available' && (
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0">
                                                ✓ {sizeStatus.size}
                                            </Badge>
                                        )}
                                        {sizeStatus.status === 'out' && (
                                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0">
                                                ⚠ {sizeStatus.size} (Out)
                                            </Badge>
                                        )}
                                        {sizeStatus.status === 'unspecified' && (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">
                                                🔸 Unspecified
                                            </Badge>
                                        )}
                                        {sizeStatus.status === 'no-inventory' && (
                                            <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-[10px] px-1.5 py-0">
                                                —
                                            </Badge>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Financials Grid - Single Row */}
                    <div className="grid grid-cols-3 gap-4 bg-gray-50/50 p-4 rounded-md mb-4 text-center">
                        {/* Amount To Pay */}
                        <div>
                            <p className="text-gray-500 text-xs mb-1">{getDiscountAmount(record) > 0 ? 'Amount to Pay' : 'Amount'}</p>
                            <p className="font-medium text-indigo-900 text-sm sm:text-base">{formatCurrency(getFinalAmount(record))}</p>
                        </div>

                        {/* Paid */}
                        <div>
                            <p className="text-gray-500 text-xs mb-1">Paid</p>
                            <p className="font-medium text-green-700 text-sm sm:text-base">{formatCurrency(record.paidAmount)}</p>
                        </div>

                        {/* Balance */}
                        <div>
                            <p className="text-gray-500 text-xs mb-1">Balance</p>
                            <p className={`font-bold text-sm sm:text-base ${getBalance(record) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(getBalance(record))}
                            </p>
                        </div>
                    </div>

                    {/* History Sections - Split Columns */}
                    {(paymentHistory.length > 0 || collectionHistory.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Payment History Column */}
                            {paymentHistory.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-medium text-gray-700">💳 Payment History</p>
                                        <span className="text-[10px] text-gray-400 bg-white px-1.5 py-0.5 rounded border">{paymentHistory.length}</span>
                                    </div>

                                    <div className="space-y-2">
                                        {visiblePaymentHistory.map((historyItem, index) => (
                                            <div key={index} className="text-xs bg-white rounded border p-2 shadow-sm">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-gray-500">
                                                        {new Date(historyItem.date).toLocaleDateString()}
                                                    </span>
                                                    {historyItem.paidAmount !== 0 && (
                                                        <span className={`font-medium ${historyItem.paidAmount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {historyItem.paidAmount > 0 ? '+' : ''}{formatCurrency(historyItem.paidAmount)}
                                                        </span>
                                                    )}
                                                </div>
                                                {historyItem.receivedBy && (
                                                    <div className="text-gray-700 text-[10px] truncate" title={historyItem.receivedBy}>
                                                        {historyItem.receivedBy}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {paymentHistory.length > 2 && (
                                        <button
                                            onClick={() => setIsPaymentHistoryOpen(!isPaymentHistoryOpen)}
                                            className="w-full text-center mt-2 text-[10px] text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 py-1 hover:bg-blue-50 rounded transition-colors"
                                        >
                                            {isPaymentHistoryOpen ? (
                                                <>Show Less <ChevronUp className="w-3 h-3" /></>
                                            ) : (
                                                <>View All ({paymentHistory.length}) <ChevronDown className="w-3 h-3" /></>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Collection History Column */}
                            {collectionHistory.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-medium text-gray-700">📦 Collection History</p>
                                        <span className="text-[10px] text-gray-400 bg-white px-1.5 py-0.5 rounded border">{collectionHistory.length}</span>
                                    </div>

                                    <div className="space-y-2">
                                        {visibleCollectionHistory.map((historyItem, index) => (
                                            <div key={index} className="text-xs bg-white rounded border p-2 shadow-sm">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-gray-500">
                                                        {new Date(historyItem.date).toLocaleDateString()}
                                                    </span>
                                                    <span className={`text-[10px] px-1.5 rounded-full ${historyItem.collectionStatus === 'collected' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                        {historyItem.collectionStatus === 'collected' ? 'Collected' : 'Pending'}
                                                    </span>
                                                </div>
                                                {historyItem.collectedItems && historyItem.collectedItems.length > 0 ? (
                                                    <div className="text-gray-700 text-[10px] truncate" title={getUniformName(historyItem.collectedItems)}>
                                                        Items: {getUniformName(historyItem.collectedItems)}
                                                    </div>
                                                ) : (
                                                    <div className="text-gray-700 text-[10px] truncate" title={historyItem.receivedBy}>
                                                        {historyItem.receivedBy}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {collectionHistory.length > 2 && (
                                        <button
                                            onClick={() => setIsCollectionHistoryOpen(!isCollectionHistoryOpen)}
                                            className="w-full text-center mt-2 text-[10px] text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 py-1 hover:bg-blue-50 rounded transition-colors"
                                        >
                                            {isCollectionHistoryOpen ? (
                                                <>Show Less <ChevronUp className="w-3 h-3" /></>
                                            ) : (
                                                <>View All ({collectionHistory.length}) <ChevronDown className="w-3 h-3" /></>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
