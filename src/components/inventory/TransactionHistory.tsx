'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/common/date-picker';
import { format } from 'date-fns';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Clock,
    Search,
    Filter,
    Download,
    Calendar,
    User,
    Package,
    ArrowUpRight,
    ArrowDownLeft,
    RefreshCw,
    Trash2,
    Wrench
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
    useInventoryTransactions
} from '@/lib/hooks/use-inventory';
import type {
    InventoryTransaction,
    InventoryTransactionType,
    TransactionFilters,
    AcademicYear,
    Term
} from '@/types';

const TRANSACTION_TYPES: InventoryTransactionType[] = [
    'purchase', 'issue', 'return', 'transfer', 'repair', 'dispose', 'adjustment', 'stocktake', 'damage', 'loss'
];

const transactionTypeConfig: Record<InventoryTransactionType, { icon: React.ElementType; color: string; label: string }> = {
    purchase: { icon: ArrowDownLeft, color: 'text-green-500 bg-green-100 dark:bg-green-900/30', label: 'Purchase' },
    issue: { icon: ArrowUpRight, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30', label: 'Issue' },
    return: { icon: ArrowDownLeft, color: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30', label: 'Return' },
    transfer: { icon: RefreshCw, color: 'text-cyan-500 bg-cyan-100 dark:bg-cyan-900/30', label: 'Transfer' },
    repair: { icon: Wrench, color: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30', label: 'Repair' },
    dispose: { icon: Trash2, color: 'text-red-500 bg-red-100 dark:bg-red-900/30', label: 'Dispose' },
    adjustment: { icon: RefreshCw, color: 'text-slate-500 bg-slate-100 dark:bg-slate-900/30', label: 'Adjustment' },
    stocktake: { icon: Package, color: 'text-indigo-500 bg-indigo-100 dark:bg-indigo-900/30', label: 'Stocktake' },
    damage: { icon: Trash2, color: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30', label: 'Damage' },
    loss: { icon: Trash2, color: 'text-red-600 bg-red-100 dark:bg-red-900/30', label: 'Loss' }
};

interface TransactionHistoryProps {
    academicYear: AcademicYear | null;
    term: Term | null;
}

export function TransactionHistory({
    academicYear,
    term
}: TransactionHistoryProps) {
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState<InventoryTransactionType | 'all'>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Build filters
    const filters: TransactionFilters = {
        searchTerm: searchTerm || undefined,
        types: selectedType !== 'all' ? [selectedType] : undefined,
        dateRange: dateFrom && dateTo ? { startDate: dateFrom, endDate: dateTo } : undefined,
        academicYearId: academicYear?.id,
        termId: term?.id
    };

    const { data: transactions, isLoading, refetch } = useInventoryTransactions(filters);

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedType('all');
        setDateFrom('');
        setDateTo('');
    };

    const hasActiveFilters = searchTerm || selectedType !== 'all' || dateFrom || dateTo;

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search transactions..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="w-[150px]">
                            <Select value={selectedType} onValueChange={(v) => setSelectedType(v as any)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    {TRANSACTION_TYPES.map(type => (
                                        <SelectItem key={type} value={type} className="capitalize">
                                            {transactionTypeConfig[type].label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <DatePicker
                                date={dateFrom ? new Date(dateFrom) : undefined}
                                setDate={(d) => setDateFrom(d ? format(d, 'yyyy-MM-dd') : '')}
                                placeholder="From date"
                            />
                            <span className="text-muted-foreground">to</span>
                            <DatePicker
                                date={dateTo ? new Date(dateTo) : undefined}
                                setDate={(d) => setDateTo(d ? format(d, 'yyyy-MM-dd') : '')}
                                placeholder="To date"
                            />
                        </div>

                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters}>
                                Clear
                            </Button>
                        )}

                        <Button variant="outline" size="icon" onClick={() => refetch()}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-purple-500" />
                        Transaction History
                    </CardTitle>
                    <CardDescription>
                        {transactions?.length || 0} transactions found
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!transactions || transactions.length === 0 ? (
                        <div className="text-center py-12">
                            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">
                                {hasActiveFilters
                                    ? 'No transactions match your filters'
                                    : 'No transactions recorded yet'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Quantity</TableHead>
                                        <TableHead>Stock Change</TableHead>
                                        <TableHead>Details</TableHead>
                                        <TableHead>Processed By</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map((transaction, index) => {
                                        const config = transactionTypeConfig[transaction.type];
                                        const Icon = config.icon;

                                        return (
                                            <motion.tr
                                                key={transaction.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.03 }}
                                                className="group"
                                            >
                                                <TableCell className="whitespace-nowrap">
                                                    <div className="flex items-center gap-1 text-sm">
                                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                                        {new Date(transaction.transactionDate).toLocaleDateString()}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className={cn(
                                                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
                                                        config.color
                                                    )}>
                                                        <Icon className="h-3 w-3" />
                                                        {config.label}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{transaction.itemName}</p>
                                                        <p className="text-xs text-muted-foreground">{transaction.itemCategory}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {transaction.quantity}
                                                </TableCell>
                                                <TableCell>
                                                    {transaction.previousQuantity !== undefined && transaction.newQuantity !== undefined ? (
                                                        <div className="flex items-center gap-1 text-sm">
                                                            <span className="text-muted-foreground">{transaction.previousQuantity}</span>
                                                            <span className="text-muted-foreground">→</span>
                                                            <span className={cn(
                                                                "font-medium",
                                                                transaction.newQuantity > transaction.previousQuantity ? "text-green-600" :
                                                                    transaction.newQuantity < transaction.previousQuantity ? "text-red-600" : ""
                                                            )}>
                                                                {transaction.newQuantity}
                                                            </span>
                                                        </div>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm">
                                                        {transaction.issuedTo && (
                                                            <div className="flex items-center gap-1">
                                                                <User className="h-3 w-3 text-muted-foreground" />
                                                                <span>{transaction.issuedTo}</span>
                                                            </div>
                                                        )}
                                                        {transaction.toLocation && !transaction.issuedTo && (
                                                            <span className="text-muted-foreground">{transaction.toLocation}</span>
                                                        )}
                                                        {transaction.purpose && (
                                                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                                {transaction.purpose}
                                                            </p>
                                                        )}
                                                        {!transaction.issuedTo && !transaction.toLocation && !transaction.purpose && (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm">
                                                        <p>{transaction.processedBy}</p>
                                                        {transaction.processedByUsername && (
                                                            <p className="text-xs text-muted-foreground">@{transaction.processedByUsername}</p>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </motion.tr>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
