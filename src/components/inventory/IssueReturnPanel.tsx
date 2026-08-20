'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/common/date-picker';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    ArrowRightLeft,
    Send,
    RotateCcw,
    Package,
    Clock,
    AlertCircle,
    CheckCircle,
    User,
    Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/lib/contexts/auth-context';
import {
    useRecordTransaction,
    useMarkItemReturned
} from '@/lib/hooks/use-inventory';
import type {
    InventoryItem,
    IssuedItem,
    InventoryLocation,
    ItemCondition,
    AcademicYear,
    Term,
    CreateInventoryTransactionData
} from '@/types';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { useFormValidation } from '@/lib/utils/form-validation';

const LOCATIONS: InventoryLocation[] = [
    'Main Store', 'Classroom', 'Laboratory', 'Library', 'Kitchen',
    'Office', 'Sports Ground', 'Medical Room', 'Staff Room', 'Assembly Hall', 'Dormitory', 'Other'
];

const CONDITIONS: ItemCondition[] = [
    'New', 'Good', 'Fair', 'Poor', 'Damaged'
];

interface IssueReturnPanelProps {
    items: InventoryItem[];
    issuedItems: IssuedItem[];
    isLoading: boolean;
    academicYear: AcademicYear | null;
    term: Term | null;
    formatCurrency: (amount: number) => string;
}

export function IssueReturnPanel({
    items,
    issuedItems,
    isLoading,
    academicYear,
    term,
    formatCurrency
}: IssueReturnPanelProps) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'issue' | 'return'>('issue');

    // Issue form state
    const [issueDialogOpen, setIssueDialogOpen] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [issueQuantity, setIssueQuantity] = useState(1);
    const [issuedTo, setIssuedTo] = useState('');
    const [issuedToRole, setIssuedToRole] = useState('');
    const [purpose, setPurpose] = useState('');
    const [toLocation, setToLocation] = useState<InventoryLocation>('Classroom');
    const [expectedReturnDate, setExpectedReturnDate] = useState('');
    const [issueNotes, setIssueNotes] = useState('');

    // Return form state
    const [returnDialogOpen, setReturnDialogOpen] = useState(false);
    const [selectedIssuedItem, setSelectedIssuedItem] = useState<IssuedItem | null>(null);
    const [returnQuantity, setReturnQuantity] = useState(1);
    const [returnCondition, setReturnCondition] = useState<ItemCondition>('Good');
    const [returnNotes, setReturnNotes] = useState('');

    // Mutations
    const recordTransaction = useRecordTransaction();
    const markReturned = useMarkItemReturned();

    const selectedItem = items.find(i => i.id === selectedItemId);
    const issueValidation = useFormValidation([
        { id: 'issue-item', label: 'Inventory item', value: selectedItemId, required: true, message: 'Choose the inventory item to issue.' },
        {
            id: 'issue-quantity',
            label: 'Quantity',
            value: issueQuantity,
            required: true,
            validate: value => selectedItem && Number(value) > selectedItem.quantity ? `Enter no more than the ${selectedItem.quantity} available item${selectedItem.quantity === 1 ? '' : 's'}.` : undefined,
        },
        { id: 'issuedTo', label: 'Issue to', value: issuedTo, required: true, message: 'Enter the person or department receiving the item.' },
    ]);

    const resetIssueForm = () => {
        setSelectedItemId('');
        setIssueQuantity(1);
        setIssuedTo('');
        setIssuedToRole('');
        setPurpose('');
        setToLocation('Classroom');
        setExpectedReturnDate('');
        setIssueNotes('');
    };

    const resetReturnForm = () => {
        setSelectedIssuedItem(null);
        setReturnQuantity(1);
        setReturnCondition('Good');
        setReturnNotes('');
    };

    const handleIssueItem = async () => {
        try {
            if (!issueValidation.validateAll().isValid || !academicYear || !term) return;

            const transactionData: CreateInventoryTransactionData = {
                itemId: selectedItemId,
                type: 'issue',
                quantity: issueQuantity,
                issuedTo,
                issuedToRole,
                purpose,
                toLocation,
                expectedReturnDate: expectedReturnDate || undefined,
                notes: issueNotes || undefined,
                processedBy: user?.username || 'System',
                processedByUserId: user?.id,
                processedByUsername: user?.username,
                transactionDate: new Date().toISOString().split('T')[0],
                academicYearId: academicYear.id,
                termId: term.id
            };

            await recordTransaction.mutateAsync({
                data: transactionData,
                academicYear,
                term
            });

            toast.success('Item issued successfully');
            setIssueDialogOpen(false);
            resetIssueForm();
        } catch (error: any) {
            issueValidation.setSubmissionError(error.message || 'The item could not be issued. Your entries have been preserved.');
            console.error(error);
        }
    };

    const handleReturnItem = async () => {
        try {
            if (!selectedIssuedItem) return;

            // First record the return transaction
            if (academicYear && term) {
                const transactionData: CreateInventoryTransactionData = {
                    itemId: selectedIssuedItem.itemId,
                    type: 'return',
                    quantity: returnQuantity,
                    issuedTo: selectedIssuedItem.issuedTo,
                    conditionAfter: returnCondition,
                    notes: returnNotes || undefined,
                    processedBy: user?.username || 'System',
                    processedByUserId: user?.id,
                    processedByUsername: user?.username,
                    transactionDate: new Date().toISOString().split('T')[0],
                    academicYearId: academicYear.id,
                    termId: term.id
                };

                await recordTransaction.mutateAsync({
                    data: transactionData,
                    academicYear,
                    term
                });
            }

            // Mark the issued item as returned
            await markReturned.mutateAsync({
                issuedItemId: selectedIssuedItem.id,
                returnData: {
                    actualReturnDate: new Date().toISOString().split('T')[0],
                    returnedQuantity: returnQuantity,
                    returnCondition,
                    notes: returnNotes
                }
            });

            toast.success('Item returned successfully');
            setReturnDialogOpen(false);
            resetReturnForm();
        } catch (error: any) {
            toast.error(error.message || 'Failed to return item');
            console.error(error);
        }
    };

    const openReturnDialog = (issuedItem: IssuedItem) => {
        setSelectedIssuedItem(issuedItem);
        setReturnQuantity(issuedItem.quantity - (issuedItem.returnedQuantity || 0));
        setReturnDialogOpen(true);
    };

    // Calculate overdue items
    const overdueItems = issuedItems.filter(item => {
        if (!item.expectedReturnDate) return false;
        return new Date(item.expectedReturnDate) < new Date() && item.status === 'issued';
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-48" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'issue' | 'return')}>
                <TabsList className="bg-white/80 dark:bg-slate-800/80 border">
                    <TabsTrigger value="issue" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                        <Send className="h-4 w-4 mr-2" />
                        Issue Items
                    </TabsTrigger>
                    <TabsTrigger value="return" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Return Items
                        {issuedItems.length > 0 && (
                            <Badge variant="secondary" className="ml-2">{issuedItems.length}</Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* Issue Tab */}
                <TabsContent value="issue" className="space-y-4">
                    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Send className="h-5 w-5 text-blue-500" />
                                Issue Inventory Items
                            </CardTitle>
                            <CardDescription>
                                Issue items to staff, departments, or specific locations
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                onClick={() => setIssueDialogOpen(true)}
                                disabled={!academicYear || !term || items.length === 0}
                                className="gap-2"
                            >
                                <ArrowRightLeft className="h-4 w-4" />
                                Issue New Item
                            </Button>

                            {(!academicYear || !term) && (
                                <p className="text-sm text-amber-600 mt-2">
                                    <AlertCircle className="h-4 w-4 inline mr-1" />
                                    Please ensure an academic year and term are active
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Available Items for Issue */}
                    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
                        <CardHeader>
                            <CardTitle className="text-lg">Available Items</CardTitle>
                            <CardDescription>Items with stock available for issue</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {items.filter(i => i.quantity > 0).length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">
                                    No items available for issue
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {items.filter(i => i.quantity > 0).slice(0, 9).map(item => (
                                        <motion.div
                                            key={item.id}
                                            whileHover={{ scale: 1.02 }}
                                            className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:border-blue-500 transition-colors"
                                            onClick={() => {
                                                setSelectedItemId(item.id);
                                                setIssueDialogOpen(true);
                                            }}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-sm">{item.name}</p>
                                                    <p className="text-xs text-muted-foreground">{item.category}</p>
                                                </div>
                                                <Badge variant="outline">{item.quantity} {item.unit}</Badge>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Return Tab */}
                <TabsContent value="return" className="space-y-4">
                    {/* Overdue Alert */}
                    {overdueItems.length > 0 && (
                        <Card className="border-0 shadow-lg bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border-l-4 border-l-red-500">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-red-600 flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5" />
                                    Overdue Items ({overdueItems.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {overdueItems.map(item => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg"
                                        >
                                            <div>
                                                <p className="font-medium">{item.itemName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Issued to {item.issuedTo} • Due: {new Date(item.expectedReturnDate!).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => openReturnDialog(item)}
                                            >
                                                Process Return
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Currently Issued Items */}
                    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-purple-500" />
                                Currently Issued Items
                            </CardTitle>
                            <CardDescription>
                                Items that are currently out and need to be returned
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {issuedItems.filter(i => i.status === 'issued').length === 0 ? (
                                <div className="text-center py-8">
                                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                                    <p className="text-muted-foreground">All items have been returned!</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Item</TableHead>
                                            <TableHead>Issued To</TableHead>
                                            <TableHead>Quantity</TableHead>
                                            <TableHead>Issue Date</TableHead>
                                            <TableHead>Due Date</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {issuedItems.filter(i => i.status === 'issued' || i.status === 'overdue').map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">{item.itemName}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <User className="h-3 w-3" />
                                                        {item.issuedTo}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {item.returnedQuantity
                                                        ? `${item.quantity - item.returnedQuantity} of ${item.quantity}`
                                                        : item.quantity
                                                    }
                                                </TableCell>
                                                <TableCell>{new Date(item.issueDate).toLocaleDateString()}</TableCell>
                                                <TableCell>
                                                    {item.expectedReturnDate
                                                        ? new Date(item.expectedReturnDate).toLocaleDateString()
                                                        : '-'
                                                    }
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={item.status === 'overdue' ? 'destructive' : 'outline'}
                                                        className="capitalize"
                                                    >
                                                        {item.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => openReturnDialog(item)}
                                                    >
                                                        <RotateCcw className="h-4 w-4 mr-1" />
                                                        Return
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Issue Dialog */}
            <Dialog open={issueDialogOpen} onOpenChange={(open) => { if (open) issueValidation.resetValidation(); setIssueDialogOpen(open); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Issue Inventory Item</DialogTitle>
                        <DialogDescription>
                            Issue an item to a person or department
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <FormErrorSummary errors={issueValidation.errors} submissionError={issueValidation.submissionError} onSelectError={issueValidation.focusField} />
                        <div>
                            <Label htmlFor="issue-item" className={issueValidation.getFieldError('issue-item') ? 'text-red-700' : undefined}>Item <span className="text-red-600">*</span></Label>
                            <Select value={selectedItemId} onValueChange={(value) => { setSelectedItemId(value); issueValidation.handleFieldChange('issue-item'); }}>
                                <SelectTrigger id="issue-item" {...issueValidation.getFieldProps('issue-item')}>
                                    <SelectValue placeholder="Select item to issue" />
                                </SelectTrigger>
                                <SelectContent>
                                    {items.filter(i => i.quantity > 0).map(item => (
                                        <SelectItem key={item.id} value={item.id}>
                                            {item.name} ({item.quantity} available)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldError error={issueValidation.getFieldError('issue-item')} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="issue-quantity" className={issueValidation.getFieldError('issue-quantity') ? 'text-red-700' : undefined}>Quantity <span className="text-red-600">*</span></Label>
                                <Input
                                    id="issue-quantity"
                                    type="number"
                                    min="1"
                                    max={selectedItem?.quantity || 1}
                                    value={issueQuantity}
                                    onChange={(e) => { setIssueQuantity(parseInt(e.target.value) || 1); issueValidation.handleFieldChange('issue-quantity'); }}
                                    {...issueValidation.getFieldProps('issue-quantity')}
                                />
                                <FieldError error={issueValidation.getFieldError('issue-quantity')} />
                            </div>
                            <div>
                                <Label htmlFor="toLocation">Location</Label>
                                <Select value={toLocation} onValueChange={(v) => setToLocation(v as InventoryLocation)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LOCATIONS.map(loc => (
                                            <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="issuedTo" className={issueValidation.getFieldError('issuedTo') ? 'text-red-700' : undefined}>Issue To <span className="text-red-600">*</span></Label>
                            <Input
                                id="issuedTo"
                                value={issuedTo}
                                onChange={(e) => { setIssuedTo(e.target.value); issueValidation.handleFieldChange('issuedTo'); }}
                                placeholder="Name of person/department"
                                {...issueValidation.getFieldProps('issuedTo')}
                            />
                            <FieldError error={issueValidation.getFieldError('issuedTo')} />
                        </div>

                        <div>
                            <Label htmlFor="issuedToRole">Role/Position</Label>
                            <Input
                                id="issuedToRole"
                                value={issuedToRole}
                                onChange={(e) => setIssuedToRole(e.target.value)}
                                placeholder="e.g., Teacher, Lab Technician"
                            />
                        </div>

                        <div>
                            <Label htmlFor="purpose">Purpose</Label>
                            <Input
                                id="purpose"
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                                placeholder="Why is this item needed?"
                            />
                        </div>

                        <div>
                            <Label htmlFor="expectedReturnDate">Expected Return Date</Label>
                            <DatePicker
                                date={expectedReturnDate ? new Date(expectedReturnDate) : undefined}
                                setDate={(d) => setExpectedReturnDate(d ? format(d, 'yyyy-MM-dd') : '')}
                                placeholder="Pick return date"
                            />
                        </div>

                        <div>
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                value={issueNotes}
                                onChange={(e) => setIssueNotes(e.target.value)}
                                placeholder="Additional notes..."
                                rows={2}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleIssueItem}
                            disabled={recordTransaction.isPending}
                        >
                            {recordTransaction.isPending ? 'Processing...' : 'Issue Item'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Return Dialog */}
            <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Process Return</DialogTitle>
                        <DialogDescription>
                            {selectedIssuedItem?.itemName} - issued to {selectedIssuedItem?.issuedTo}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="returnQuantity">Quantity Returning</Label>
                                <Input
                                    id="returnQuantity"
                                    type="number"
                                    min="1"
                                    max={selectedIssuedItem ? selectedIssuedItem.quantity - (selectedIssuedItem.returnedQuantity || 0) : 1}
                                    value={returnQuantity}
                                    onChange={(e) => setReturnQuantity(parseInt(e.target.value) || 1)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="returnCondition">Condition</Label>
                                <Select value={returnCondition} onValueChange={(v) => setReturnCondition(v as ItemCondition)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CONDITIONS.map(cond => (
                                            <SelectItem key={cond} value={cond}>{cond}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="returnNotes">Notes</Label>
                            <Textarea
                                id="returnNotes"
                                value={returnNotes}
                                onChange={(e) => setReturnNotes(e.target.value)}
                                placeholder="Any issues or observations..."
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleReturnItem}
                            disabled={markReturned.isPending || recordTransaction.isPending}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {markReturned.isPending || recordTransaction.isPending ? 'Processing...' : 'Confirm Return'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
