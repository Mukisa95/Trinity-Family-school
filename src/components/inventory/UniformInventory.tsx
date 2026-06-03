'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
    Shirt,
    Plus,
    X,
    Save,
    Check,
    Settings2,
    Package,
    Search,
    ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useUniforms } from '@/lib/hooks/use-uniforms';
import {
    useUniformInventory,
    useSetUniformSizes,
    useUpdateSizeStock,
    useUpdateUniformStock
} from '@/lib/hooks/use-uniform-inventory';
import type { UniformItem, UniformInventoryItem, UniformSizeStock } from '@/types';
import Link from 'next/link';

// Group colors for visual consistency
const groupColors: Record<string, string> = {
    'Shirts': 'bg-blue-500',
    'Trousers': 'bg-indigo-500',
    'Dresses': 'bg-pink-500',
    'Shoes': 'bg-amber-500',
    'Socks': 'bg-green-500',
    'Sweaters': 'bg-purple-500',
    'Accessories': 'bg-cyan-500',
    'Sportswear': 'bg-orange-500',
    'default': 'bg-slate-500'
};

export function UniformInventory() {
    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [specifySizesOpen, setSpecifySizesOpen] = useState(false);
    const [selectedUniform, setSelectedUniform] = useState<UniformItem | null>(null);
    const [editingSizes, setEditingSizes] = useState<string[]>([]);
    const [newSize, setNewSize] = useState('');
    const [editingStock, setEditingStock] = useState<string | null>(null);
    const [stockValues, setStockValues] = useState<Record<string, number>>({});

    // Data queries
    const { data: uniforms, isLoading: uniformsLoading } = useUniforms();
    const { data: inventory, isLoading: inventoryLoading } = useUniformInventory();

    // Mutations
    const setSizes = useSetUniformSizes();
    const updateStock = useUpdateSizeStock();
    const updateAllStock = useUpdateUniformStock();

    const isLoading = uniformsLoading || inventoryLoading;

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-UG', {
            style: 'currency',
            currency: 'UGX',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    // Get inventory item for a uniform
    const getInventoryItem = (uniformId: string): UniformInventoryItem | undefined => {
        return inventory?.find(i => i.uniformId === uniformId);
    };

    // Open specify sizes dialog
    const handleOpenSpecifySizes = (uniform: UniformItem) => {
        const existingInventory = getInventoryItem(uniform.id);
        setSelectedUniform(uniform);
        setEditingSizes(existingInventory?.sizes || []);
        setSpecifySizesOpen(true);
    };

    // Add a size
    const handleAddSize = () => {
        const trimmed = newSize.trim();
        if (!trimmed) return;
        if (editingSizes.includes(trimmed)) {
            toast.error('Size already exists');
            return;
        }
        setEditingSizes([...editingSizes, trimmed]);
        setNewSize('');
    };

    // Remove a size
    const handleRemoveSize = (size: string) => {
        setEditingSizes(editingSizes.filter(s => s !== size));
    };

    // Save sizes
    const handleSaveSizes = async () => {
        if (!selectedUniform) return;

        try {
            await setSizes.mutateAsync({
                data: {
                    uniformId: selectedUniform.id,
                    uniformName: selectedUniform.name,
                    uniformGroup: selectedUniform.group,
                    sizes: editingSizes
                },
                uniformPrice: selectedUniform.price,
                uniformGender: selectedUniform.gender
            });

            toast.success(`Sizes saved for ${selectedUniform.name}`);
            setSpecifySizesOpen(false);
            setSelectedUniform(null);
            setEditingSizes([]);
        } catch (error: any) {
            toast.error(error.message || 'Failed to save sizes');
        }
    };

    // Start editing stock for an item
    const handleStartEditStock = (inventoryItem: UniformInventoryItem) => {
        setEditingStock(inventoryItem.uniformId);
        const values: Record<string, number> = {};
        inventoryItem.stock.forEach(s => {
            values[s.size] = s.quantity;
        });
        setStockValues(values);
    };

    // Update stock value locally
    const handleStockChange = (size: string, value: number) => {
        setStockValues(prev => ({ ...prev, [size]: Math.max(0, value) }));
    };

    // Save stock for a single size
    const handleSaveStock = async (uniformId: string, size: string) => {
        try {
            await updateStock.mutateAsync({
                uniformId,
                size,
                quantity: stockValues[size] || 0
            });
            toast.success(`Stock updated for size ${size}`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to update stock');
        }
    };

    // Cancel stock editing
    const handleCancelEditStock = () => {
        setEditingStock(null);
        setStockValues({});
    };

    // Save all stock changes
    const handleSaveAllStock = async (inventoryItem: UniformInventoryItem) => {
        try {
            // Construct updated stock array
            const updatedStock = inventoryItem.stock.map(s => ({
                size: s.size,
                quantity: stockValues[s.size] !== undefined ? stockValues[s.size] : s.quantity
            }));

            await updateAllStock.mutateAsync({
                data: {
                    uniformId: inventoryItem.uniformId,
                    stock: updatedStock
                },
                uniformPrice: inventoryItem.uniformPrice
            });

            toast.success('All stock changes saved');
            setEditingStock(null);
            setStockValues({});
        } catch (error: any) {
            toast.error(error.message || 'Failed to save stock changes');
        }
    };

    // Filter uniforms by search
    const filteredUniforms = uniforms?.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.group.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    // All uniforms with their inventory status
    const uniformsWithInventory = filteredUniforms.map(uniform => ({
        uniform,
        inventory: getInventoryItem(uniform.id)
    }));

    // Separate: configured (has sizes) vs unconfigured
    const configuredItems = uniformsWithInventory.filter(item => item.inventory?.sizes?.length);
    const unconfiguredItems = uniformsWithInventory.filter(item => !item.inventory?.sizes?.length);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/40 dark:from-slate-950 dark:via-purple-950/20 dark:to-pink-950/30">
            <div className="container mx-auto px-4 py-6 max-w-7xl">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/inventory">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Shirt className="h-6 w-6 text-purple-500" />
                            Uniform Inventory
                        </h1>
                        <p className="text-muted-foreground">Manage stock levels by size for each uniform item</p>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card className="bg-gradient-to-br from-purple-500 to-violet-600 text-white border-0 shadow-lg">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-purple-100 text-sm">Total Items</p>
                                    <p className="text-2xl font-bold">{uniforms?.length || 0}</p>
                                </div>
                                <Shirt className="h-8 w-8 text-purple-200" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white border-0 shadow-lg">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-100 text-sm">Configured</p>
                                    <p className="text-2xl font-bold">{configuredItems.length}</p>
                                </div>
                                <Settings2 className="h-8 w-8 text-blue-200" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0 shadow-lg">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-amber-100 text-sm">Need Config</p>
                                    <p className="text-2xl font-bold">{unconfiguredItems.length}</p>
                                </div>
                                <Plus className="h-8 w-8 text-amber-200" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 shadow-lg">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-emerald-100 text-sm">Total Stock</p>
                                    <p className="text-2xl font-bold">
                                        {inventory?.reduce((sum, i) => sum + i.totalStock, 0) || 0}
                                    </p>
                                </div>
                                <Package className="h-8 w-8 text-emerald-200" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search and Action */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search uniforms..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white dark:bg-slate-800"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-64 w-full" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Configured Items - Stock Management */}
                        {configuredItems.length > 0 && (
                            <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Package className="h-5 w-5 text-green-500" />
                                        Stock Management
                                    </CardTitle>
                                    <CardDescription>
                                        Enter stock quantities per size for each uniform
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {configuredItems.map(({ uniform, inventory: inv }) => (
                                            <motion.div
                                                key={uniform.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-900/50"
                                            >
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "h-10 w-10 rounded-lg flex items-center justify-center text-white",
                                                            groupColors[uniform.group] || groupColors.default
                                                        )}>
                                                            <Shirt className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium">{uniform.name}</p>
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Badge variant="outline" className="text-xs">{uniform.group}</Badge>
                                                                <span>•</span>
                                                                <span>{formatCurrency(uniform.price)}</span>
                                                                <span>•</span>
                                                                <span className="capitalize">{uniform.gender}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right">
                                                            <p className="text-sm text-muted-foreground">Total Stock</p>
                                                            <p className="text-xl font-bold text-green-600">{inv?.totalStock || 0}</p>
                                                        </div>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleOpenSpecifySizes(uniform)}
                                                        >
                                                            <Settings2 className="h-4 w-4 mr-1" />
                                                            Edit Sizes
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Size Stock Grid */}
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                                    {inv?.stock.map(({ size, quantity }) => (
                                                        <div
                                                            key={size}
                                                            className="p-3 rounded-lg bg-white dark:bg-slate-800 border text-center"
                                                        >
                                                            <p className="text-sm font-medium text-muted-foreground mb-1">Size {size}</p>
                                                            {editingStock === inv.uniformId ? (
                                                                <div className="flex items-center gap-1">
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        value={stockValues[size] ?? quantity}
                                                                        onChange={(e) => handleStockChange(size, parseInt(e.target.value) || 0)}
                                                                        className="h-8 text-center text-lg font-bold"
                                                                    />
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-8 w-8"
                                                                        onClick={() => handleSaveStock(inv.uniformId, size)}
                                                                        disabled={updateStock.isPending}
                                                                    >
                                                                        <Check className="h-4 w-4 text-green-500" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <p
                                                                    className={cn(
                                                                        "text-2xl font-bold cursor-pointer hover:text-purple-600 transition-colors",
                                                                        quantity === 0 && "text-red-500"
                                                                    )}
                                                                    onClick={() => handleStartEditStock(inv)}
                                                                >
                                                                    {quantity}
                                                                </p>
                                                            )}
                                                            <p className="text-xs text-muted-foreground">pieces</p>
                                                        </div>
                                                    ))}
                                                </div>

                                                {editingStock === inv?.uniformId && (
                                                    <div className="mt-4 flex justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={handleCancelEditStock}
                                                        >
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            variant="default"
                                                            size="sm"
                                                            onClick={() => handleSaveAllStock(inv)}
                                                            className="bg-green-600 hover:bg-green-700"
                                                            disabled={updateAllStock.isPending}
                                                        >
                                                            <Save className="h-4 w-4 mr-2" />
                                                            {updateAllStock.isPending ? 'Saving...' : 'Save Changes'}
                                                        </Button>
                                                    </div>
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Unconfigured Items */}
                        {unconfiguredItems.length > 0 && (
                            <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Settings2 className="h-5 w-5 text-amber-500" />
                                        Configure Sizes
                                    </CardTitle>
                                    <CardDescription>
                                        These uniforms need size configuration before you can track stock
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {unconfiguredItems.map(({ uniform }) => (
                                            <motion.div
                                                key={uniform.id}
                                                whileHover={{ scale: 1.02 }}
                                                className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:border-purple-500 transition-colors"
                                                onClick={() => handleOpenSpecifySizes(uniform)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "h-10 w-10 rounded-lg flex items-center justify-center text-white",
                                                        groupColors[uniform.group] || groupColors.default
                                                    )}>
                                                        <Shirt className="h-5 w-5" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-medium">{uniform.name}</p>
                                                        <p className="text-sm text-muted-foreground">{uniform.group}</p>
                                                    </div>
                                                    <Button variant="ghost" size="icon">
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Empty State */}
                        {uniformsWithInventory.length === 0 && (
                            <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
                                <CardContent className="py-12 text-center">
                                    <Shirt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">
                                        {searchTerm ? 'No uniforms match your search' : 'No uniforms found. Add uniforms in Uniform Management first.'}
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </div>

            {/* Specify Sizes Dialog */}
            <Dialog open={specifySizesOpen} onOpenChange={setSpecifySizesOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Configure Sizes</DialogTitle>
                        <DialogDescription>
                            {selectedUniform?.name} - specify which sizes this item comes in
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Add new size */}
                        <div className="flex gap-2">
                            <Input
                                placeholder="Enter size (e.g., 18, M, Large)"
                                value={newSize}
                                onChange={(e) => setNewSize(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddSize()}
                            />
                            <Button onClick={handleAddSize} disabled={!newSize.trim()}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Current sizes */}
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Sizes ({editingSizes.length})</p>
                            {editingSizes.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No sizes added yet</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {editingSizes.map(size => (
                                        <Badge
                                            key={size}
                                            variant="secondary"
                                            className="px-3 py-1.5 text-sm flex items-center gap-1"
                                        >
                                            {size}
                                            <button
                                                onClick={() => handleRemoveSize(size)}
                                                className="ml-1 hover:text-red-500"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Common sizes quick add */}
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Quick Add</p>
                            <div className="flex flex-wrap gap-2">
                                {['16', '18', '20', '22', '24', '26', '28', '30'].map(size => (
                                    <Button
                                        key={size}
                                        variant="outline"
                                        size="sm"
                                        disabled={editingSizes.includes(size)}
                                        onClick={() => setEditingSizes([...editingSizes, size])}
                                    >
                                        {size}
                                    </Button>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {['S', 'M', 'L', 'XL', 'XXL'].map(size => (
                                    <Button
                                        key={size}
                                        variant="outline"
                                        size="sm"
                                        disabled={editingSizes.includes(size)}
                                        onClick={() => setEditingSizes([...editingSizes, size])}
                                    >
                                        {size}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSpecifySizesOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveSizes}
                            disabled={setSizes.isPending || editingSizes.length === 0}
                        >
                            {setSizes.isPending ? 'Saving...' : 'Save Sizes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
