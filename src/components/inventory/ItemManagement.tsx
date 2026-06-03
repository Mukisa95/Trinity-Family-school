'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Plus,
    Edit2,
    Trash2,
    Package,
    Eye,
    X,
    AlertTriangle,
    MapPin,
    Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    useCreateInventoryItem,
    useUpdateInventoryItem,
    useDeleteInventoryItem
} from '@/lib/hooks/use-inventory';
import type {
    InventoryItem,
    InventoryCategory,
    ItemCondition,
    InventoryLocation,
    InventoryUnit,
    CreateInventoryItemData,
    AcademicYear,
    Term
} from '@/types';

// Constants
const CATEGORIES: InventoryCategory[] = [
    'Furniture', 'Electronics', 'Laboratory', 'Sports', 'Library',
    'Kitchen', 'Classroom', 'Office', 'Transport', 'Medical', 'Cleaning', 'Other'
];

const CONDITIONS: ItemCondition[] = [
    'New', 'Good', 'Fair', 'Poor', 'Damaged', 'Under Repair', 'Disposed'
];

const LOCATIONS: InventoryLocation[] = [
    'Main Store', 'Classroom', 'Laboratory', 'Library', 'Kitchen',
    'Office', 'Sports Ground', 'Medical Room', 'Staff Room', 'Assembly Hall', 'Dormitory', 'Other'
];

const UNITS: InventoryUnit[] = [
    'Pieces', 'Sets', 'Pairs', 'Boxes', 'Cartons', 'Rolls', 'Litres', 'Kg', 'Other'
];

interface ItemManagementProps {
    items: InventoryItem[];
    isLoading: boolean;
    viewMode: 'cards' | 'table';
    filtersExpanded: boolean;
    selectedCategory: InventoryCategory | 'all';
    selectedCondition: ItemCondition | 'all';
    selectedLocation: InventoryLocation | 'all';
    onCategoryChange: (category: InventoryCategory | 'all') => void;
    onConditionChange: (condition: ItemCondition | 'all') => void;
    onLocationChange: (location: InventoryLocation | 'all') => void;
    onClearFilters: () => void;
    hasActiveFilters: boolean;
    categoryColors: Record<InventoryCategory, string>;
    conditionColors: Record<ItemCondition, string>;
    formatCurrency: (amount: number) => string;
    academicYear: AcademicYear | null;
    term: Term | null;
}

const emptyFormData: Partial<CreateInventoryItemData> = {
    name: '',
    category: 'Other',
    description: '',
    quantity: 0,
    unit: 'Pieces',
    condition: 'New',
    location: 'Main Store',
    isActive: true
};

export function ItemManagement({
    items,
    isLoading,
    viewMode,
    filtersExpanded,
    selectedCategory,
    selectedCondition,
    selectedLocation,
    onCategoryChange,
    onConditionChange,
    onLocationChange,
    onClearFilters,
    hasActiveFilters,
    categoryColors,
    conditionColors,
    formatCurrency,
    academicYear,
    term
}: ItemManagementProps) {
    // State
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [formData, setFormData] = useState<Partial<CreateInventoryItemData>>(emptyFormData);

    // Mutations
    const createItem = useCreateInventoryItem();
    const updateItem = useUpdateInventoryItem();
    const deleteItem = useDeleteInventoryItem();

    const handleInputChange = (field: keyof CreateInventoryItemData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAddItem = async () => {
        try {
            if (!formData.name?.trim()) {
                toast.error('Item name is required');
                return;
            }

            await createItem.mutateAsync(formData as CreateInventoryItemData);
            toast.success('Item added successfully');
            setIsAddDialogOpen(false);
            setFormData(emptyFormData);
        } catch (error) {
            toast.error('Failed to add item');
            console.error(error);
        }
    };

    const handleEditItem = async () => {
        try {
            if (!selectedItem) return;

            await updateItem.mutateAsync({
                id: selectedItem.id,
                data: formData
            });
            toast.success('Item updated successfully');
            setIsEditDialogOpen(false);
            setSelectedItem(null);
            setFormData(emptyFormData);
        } catch (error) {
            toast.error('Failed to update item');
            console.error(error);
        }
    };

    const handleDeleteItem = async () => {
        try {
            if (!deleteItemId) return;

            await deleteItem.mutateAsync(deleteItemId);
            toast.success('Item deleted successfully');
            setDeleteItemId(null);
        } catch (error) {
            toast.error('Failed to delete item');
            console.error(error);
        }
    };

    const openEditDialog = (item: InventoryItem) => {
        setSelectedItem(item);
        setFormData({
            name: item.name,
            category: item.category,
            description: item.description,
            serialNumber: item.serialNumber,
            assetTag: item.assetTag,
            quantity: item.quantity,
            unit: item.unit,
            reorderLevel: item.reorderLevel,
            condition: item.condition,
            location: item.location,
            customLocation: item.customLocation,
            assignedTo: item.assignedTo,
            unitValue: item.unitValue,
            purchaseDate: item.purchaseDate,
            warrantyExpiry: item.warrantyExpiry,
            supplierName: item.supplierName,
            isActive: item.isActive
        });
        setIsEditDialogOpen(true);
    };

    const openViewDialog = (item: InventoryItem) => {
        setSelectedItem(item);
        setIsViewDialogOpen(true);
    };

    // Item Form Component
    const ItemForm = ({ isEdit = false }: { isEdit?: boolean }) => (
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <Label htmlFor="name">Item Name *</Label>
                    <Input
                        id="name"
                        value={formData.name || ''}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="e.g., Student Desk"
                    />
                </div>

                <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select
                        value={formData.category}
                        onValueChange={(v) => handleInputChange('category', v)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                            {CATEGORIES.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label htmlFor="condition">Condition *</Label>
                    <Select
                        value={formData.condition}
                        onValueChange={(v) => handleInputChange('condition', v as ItemCondition)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                            {CONDITIONS.map(cond => (
                                <SelectItem key={cond} value={cond}>{cond}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input
                        id="quantity"
                        type="number"
                        min="0"
                        value={formData.quantity || 0}
                        onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
                    />
                </div>

                <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Select
                        value={formData.unit}
                        onValueChange={(v) => handleInputChange('unit', v as InventoryUnit)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                            {UNITS.map(unit => (
                                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label htmlFor="location">Location *</Label>
                    <Select
                        value={formData.location}
                        onValueChange={(v) => handleInputChange('location', v as InventoryLocation)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                            {LOCATIONS.map(loc => (
                                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label htmlFor="customLocation">Specific Room/Area</Label>
                    <Input
                        id="customLocation"
                        value={formData.customLocation || ''}
                        onChange={(e) => handleInputChange('customLocation', e.target.value)}
                        placeholder="e.g., Room 101"
                    />
                </div>

                <div>
                    <Label htmlFor="reorderLevel">Reorder Level</Label>
                    <Input
                        id="reorderLevel"
                        type="number"
                        min="0"
                        value={formData.reorderLevel || ''}
                        onChange={(e) => handleInputChange('reorderLevel', parseInt(e.target.value) || undefined)}
                        placeholder="Alert when below"
                    />
                </div>

                <div>
                    <Label htmlFor="unitValue">Unit Value (UGX)</Label>
                    <Input
                        id="unitValue"
                        type="number"
                        min="0"
                        value={formData.unitValue || ''}
                        onChange={(e) => handleInputChange('unitValue', parseInt(e.target.value) || undefined)}
                        placeholder="Value per unit"
                    />
                </div>

                <div>
                    <Label htmlFor="assetTag">Asset Tag</Label>
                    <Input
                        id="assetTag"
                        value={formData.assetTag || ''}
                        onChange={(e) => handleInputChange('assetTag', e.target.value)}
                        placeholder="e.g., TFS-FUR-001"
                    />
                </div>

                <div>
                    <Label htmlFor="serialNumber">Serial Number</Label>
                    <Input
                        id="serialNumber"
                        value={formData.serialNumber || ''}
                        onChange={(e) => handleInputChange('serialNumber', e.target.value)}
                        placeholder="Manufacturer serial"
                    />
                </div>

                <div>
                    <Label htmlFor="assignedTo">Assigned To</Label>
                    <Input
                        id="assignedTo"
                        value={formData.assignedTo || ''}
                        onChange={(e) => handleInputChange('assignedTo', e.target.value)}
                        placeholder="Department or person"
                    />
                </div>

                <div>
                    <Label htmlFor="supplierName">Supplier</Label>
                    <Input
                        id="supplierName"
                        value={formData.supplierName || ''}
                        onChange={(e) => handleInputChange('supplierName', e.target.value)}
                        placeholder="Supplier name"
                    />
                </div>

                <div>
                    <Label htmlFor="purchaseDate">Purchase Date</Label>
                    <DatePicker
                        date={formData.purchaseDate ? new Date(formData.purchaseDate) : undefined}
                        setDate={(d) => handleInputChange('purchaseDate', d ? format(d, 'yyyy-MM-dd') : undefined)}
                        placeholder="Pick purchase date"
                    />
                </div>

                <div>
                    <Label htmlFor="warrantyExpiry">Warranty Expiry</Label>
                    <DatePicker
                        date={formData.warrantyExpiry ? new Date(formData.warrantyExpiry) : undefined}
                        setDate={(d) => handleInputChange('warrantyExpiry', d ? format(d, 'yyyy-MM-dd') : undefined)}
                        placeholder="Pick warranty expiry"
                    />
                </div>

                <div className="col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        value={formData.description || ''}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Additional details about the item"
                        rows={3}
                    />
                </div>
            </div>
        </div>
    );

    // Loading state
    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <Skeleton key={i} className="h-48" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <AnimatePresence>
                {filtersExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <Card className="border-0 shadow-sm bg-white/80 dark:bg-slate-800/80">
                            <CardContent className="p-4">
                                <div className="flex flex-wrap gap-4">
                                    <div className="flex-1 min-w-[150px]">
                                        <Label className="text-xs mb-1 block">Category</Label>
                                        <Select value={selectedCategory} onValueChange={(v) => onCategoryChange(v as any)}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Categories</SelectItem>
                                                {CATEGORIES.map(cat => (
                                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex-1 min-w-[150px]">
                                        <Label className="text-xs mb-1 block">Condition</Label>
                                        <Select value={selectedCondition} onValueChange={(v) => onConditionChange(v as any)}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Conditions</SelectItem>
                                                {CONDITIONS.map(cond => (
                                                    <SelectItem key={cond} value={cond}>{cond}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex-1 min-w-[150px]">
                                        <Label className="text-xs mb-1 block">Location</Label>
                                        <Select value={selectedLocation} onValueChange={(v) => onLocationChange(v as any)}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Locations</SelectItem>
                                                {LOCATIONS.map(loc => (
                                                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {hasActiveFilters && (
                                        <Button variant="ghost" size="sm" onClick={onClearFilters} className="self-end">
                                            <X className="h-4 w-4 mr-1" />
                                            Clear
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header with Add Button */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-muted-foreground text-sm">
                        {items.length} item{items.length !== 1 ? 's' : ''} found
                    </p>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add Item
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Add New Inventory Item</DialogTitle>
                            <DialogDescription>
                                Register a new item in the school inventory.
                            </DialogDescription>
                        </DialogHeader>
                        <ItemForm />
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleAddItem} disabled={createItem.isPending}>
                                {createItem.isPending ? 'Adding...' : 'Add Item'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Items Display */}
            {items.length === 0 ? (
                <Card className="border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Package className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground text-center">
                            {hasActiveFilters
                                ? 'No items match your filters'
                                : 'No inventory items yet. Add your first item to get started.'}
                        </p>
                        {!hasActiveFilters && (
                            <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add First Item
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : viewMode === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((item, index) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Card className="h-full border-0 shadow-md hover:shadow-lg transition-shadow bg-white dark:bg-slate-800">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <CardTitle className="text-base line-clamp-1">{item.name}</CardTitle>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-xs">
                                                    {item.category}
                                                </Badge>
                                                <Badge className={cn("text-xs", conditionColors[item.condition])}>
                                                    {item.condition}
                                                </Badge>
                                            </div>
                                        </div>
                                        {item.reorderLevel && item.quantity <= item.reorderLevel && (
                                            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <p className="text-muted-foreground text-xs">Quantity</p>
                                            <p className="font-semibold">{item.quantity} {item.unit}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Value</p>
                                            <p className="font-semibold">{formatCurrency(item.totalValue || 0)}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <MapPin className="h-3 w-3" />
                                        {item.location}
                                        {item.customLocation && ` - ${item.customLocation}`}
                                    </div>

                                    {item.assetTag && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Tag className="h-3 w-3" />
                                            {item.assetTag}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 pt-2 border-t">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openViewDialog(item)}
                                            className="flex-1"
                                        >
                                            <Eye className="h-4 w-4 mr-1" />
                                            View
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openEditDialog(item)}
                                            className="flex-1"
                                        >
                                            <Edit2 className="h-4 w-4 mr-1" />
                                            Edit
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDeleteItemId(item.id)}
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <Card className="border-0 shadow-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Condition</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Value</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {item.name}
                                            {item.reorderLevel && item.quantity <= item.reorderLevel && (
                                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{item.category}</TableCell>
                                    <TableCell>{item.quantity} {item.unit}</TableCell>
                                    <TableCell>
                                        <Badge className={cn("text-xs", conditionColors[item.condition])}>
                                            {item.condition}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{item.location}</TableCell>
                                    <TableCell>{formatCurrency(item.totalValue || 0)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => openViewDialog(item)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setDeleteItemId(item.id)}
                                                className="text-red-500 hover:text-red-600"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Inventory Item</DialogTitle>
                        <DialogDescription>
                            Update the item details below.
                        </DialogDescription>
                    </DialogHeader>
                    <ItemForm isEdit />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleEditItem} disabled={updateItem.isPending}>
                            {updateItem.isPending ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Dialog */}
            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{selectedItem?.name}</DialogTitle>
                    </DialogHeader>
                    {selectedItem && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline">{selectedItem.category}</Badge>
                                <Badge className={conditionColors[selectedItem.condition]}>
                                    {selectedItem.condition}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Quantity</p>
                                    <p className="font-medium">{selectedItem.quantity} {selectedItem.unit}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Total Value</p>
                                    <p className="font-medium">{formatCurrency(selectedItem.totalValue || 0)}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Location</p>
                                    <p className="font-medium">{selectedItem.location}</p>
                                </div>
                                {selectedItem.customLocation && (
                                    <div>
                                        <p className="text-muted-foreground">Specific Area</p>
                                        <p className="font-medium">{selectedItem.customLocation}</p>
                                    </div>
                                )}
                                {selectedItem.assetTag && (
                                    <div>
                                        <p className="text-muted-foreground">Asset Tag</p>
                                        <p className="font-medium">{selectedItem.assetTag}</p>
                                    </div>
                                )}
                                {selectedItem.serialNumber && (
                                    <div>
                                        <p className="text-muted-foreground">Serial Number</p>
                                        <p className="font-medium">{selectedItem.serialNumber}</p>
                                    </div>
                                )}
                                {selectedItem.reorderLevel && (
                                    <div>
                                        <p className="text-muted-foreground">Reorder Level</p>
                                        <p className="font-medium">{selectedItem.reorderLevel}</p>
                                    </div>
                                )}
                                {selectedItem.assignedTo && (
                                    <div>
                                        <p className="text-muted-foreground">Assigned To</p>
                                        <p className="font-medium">{selectedItem.assignedTo}</p>
                                    </div>
                                )}
                            </div>

                            {selectedItem.description && (
                                <div>
                                    <p className="text-muted-foreground text-sm">Description</p>
                                    <p className="text-sm">{selectedItem.description}</p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Item</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this item? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteItem}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            {deleteItem.isPending ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
