'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    FileBarChart,
    Download,
    PieChart,
    BarChart3,
    TrendingUp,
    Package,
    DollarSign,
    MapPin,
    AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useValueReport } from '@/lib/hooks/use-inventory';
import type {
    InventorySummary,
    InventoryItem,
    InventoryCategory
} from '@/types';

interface InventoryReportsProps {
    summary: InventorySummary | undefined;
    items: InventoryItem[];
    isLoading: boolean;
    formatCurrency: (amount: number) => string;
    categoryColors: Record<InventoryCategory, string>;
}

export function InventoryReports({
    summary,
    items,
    isLoading,
    formatCurrency,
    categoryColors
}: InventoryReportsProps) {
    const [activeReport, setActiveReport] = useState('overview');

    // Value report data
    const { data: valueReport, isLoading: valueLoading } = useValueReport();

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    // Calculate report data
    const categoryStats = summary?.byCategory
        ? Object.entries(summary.byCategory)
            .filter(([_, data]) => data.itemCount > 0)
            .sort((a, b) => b[1].totalValue - a[1].totalValue)
        : [];

    const locationStats = summary?.byLocation
        ? Object.entries(summary.byLocation)
            .filter(([_, data]) => data.itemCount > 0)
            .sort((a, b) => b[1].totalQuantity - a[1].totalQuantity)
        : [];

    const conditionStats = summary?.byCondition
        ? Object.entries(summary.byCondition)
            .filter(([_, count]) => count > 0)
        : [];

    const lowStockItems = items.filter(i =>
        i.reorderLevel !== undefined && i.quantity <= i.reorderLevel
    );

    return (
        <div className="space-y-6">
            <Tabs value={activeReport} onValueChange={setActiveReport}>
                <TabsList className="bg-white/80 dark:bg-slate-800/80 border">
                    <TabsTrigger value="overview">
                        <PieChart className="h-4 w-4 mr-2" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="value">
                        <DollarSign className="h-4 w-4 mr-2" />
                        Asset Value
                    </TabsTrigger>
                    <TabsTrigger value="stock">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Stock Status
                    </TabsTrigger>
                </TabsList>

                {/* Overview Report */}
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Category Distribution */}
                        <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <PieChart className="h-5 w-5 text-blue-500" />
                                    By Category
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {categoryStats.map(([category, data], index) => (
                                        <div key={category} className="space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("h-3 w-3 rounded-full", categoryColors[category as InventoryCategory])} />
                                                    <span>{category}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-medium">{data.itemCount}</span>
                                                    <span className="text-muted-foreground ml-2 text-xs">
                                                        ({((data.itemCount / (summary?.totalItems || 1)) * 100).toFixed(0)}%)
                                                    </span>
                                                </div>
                                            </div>
                                            <Progress
                                                value={(data.itemCount / (summary?.totalItems || 1)) * 100}
                                                className="h-1.5"
                                            />
                                        </div>
                                    ))}
                                    {categoryStats.length === 0 && (
                                        <p className="text-muted-foreground text-center py-4">No data available</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Location Distribution */}
                        <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-green-500" />
                                    By Location
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {locationStats.map(([location, data], index) => (
                                        <div key={location} className="space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <span>{location}</span>
                                                <div className="text-right">
                                                    <span className="font-medium">{data.itemCount} items</span>
                                                    <span className="text-muted-foreground ml-2 text-xs">
                                                        ({data.totalQuantity} units)
                                                    </span>
                                                </div>
                                            </div>
                                            <Progress
                                                value={(data.totalQuantity / (summary?.totalQuantity || 1)) * 100}
                                                className="h-1.5"
                                            />
                                        </div>
                                    ))}
                                    {locationStats.length === 0 && (
                                        <p className="text-muted-foreground text-center py-4">No data available</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Condition Summary */}
                        <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Package className="h-5 w-5 text-purple-500" />
                                    Condition Status
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-3">
                                    {conditionStats.map(([condition, count]) => (
                                        <div
                                            key={condition}
                                            className={cn(
                                                "p-3 rounded-lg text-center",
                                                condition === 'New' || condition === 'Good' ? 'bg-green-50 dark:bg-green-900/20' :
                                                    condition === 'Fair' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                                                        condition === 'Poor' || condition === 'Damaged' ? 'bg-red-50 dark:bg-red-900/20' :
                                                            'bg-slate-50 dark:bg-slate-900/20'
                                            )}
                                        >
                                            <p className="text-2xl font-bold">{count}</p>
                                            <p className="text-xs text-muted-foreground">{condition}</p>
                                        </div>
                                    ))}
                                </div>
                                {conditionStats.length === 0 && (
                                    <p className="text-muted-foreground text-center py-4">No data available</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Quick Stats */}
                        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-indigo-500" />
                                    Summary Statistics
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                                        <p className="text-2xl font-bold text-blue-600">{summary?.totalItems || 0}</p>
                                        <p className="text-xs text-muted-foreground">Total Item Types</p>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                                        <p className="text-2xl font-bold text-green-600">{summary?.totalQuantity || 0}</p>
                                        <p className="text-xs text-muted-foreground">Total Units</p>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                                        <p className="text-2xl font-bold text-purple-600">{formatCurrency(summary?.totalValue || 0)}</p>
                                        <p className="text-xs text-muted-foreground">Total Value</p>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                                        <p className={cn(
                                            "text-2xl font-bold",
                                            (summary?.lowStockCount || 0) > 0 ? "text-amber-600" : "text-green-600"
                                        )}>
                                            {summary?.lowStockCount || 0}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Low Stock Items</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Value Report */}
                <TabsContent value="value" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-emerald-100 text-sm">Total Asset Value</p>
                                        <p className="text-3xl font-bold">{formatCurrency(valueReport?.totalAssetValue || 0)}</p>
                                    </div>
                                    <DollarSign className="h-12 w-12 text-emerald-300/50" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-blue-100 text-sm">Total Items</p>
                                        <p className="text-3xl font-bold">{valueReport?.totalItemCount || 0}</p>
                                    </div>
                                    <Package className="h-12 w-12 text-blue-300/50" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-violet-600 text-white">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-purple-100 text-sm">Average Value/Item</p>
                                        <p className="text-3xl font-bold">
                                            {formatCurrency(
                                                (valueReport?.totalAssetValue || 0) / Math.max(valueReport?.totalItemCount || 1, 1)
                                            )}
                                        </p>
                                    </div>
                                    <TrendingUp className="h-12 w-12 text-purple-300/50" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Value by Category */}
                    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
                        <CardHeader>
                            <CardTitle className="text-lg">Value by Category</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {valueReport?.valueByCategory && Object.entries(valueReport.valueByCategory)
                                    .filter(([_, value]) => value > 0)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([category, value]) => (
                                        <div key={category} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("h-3 w-3 rounded-full", categoryColors[category as InventoryCategory])} />
                                                <span className="font-medium">{category}</span>
                                            </div>
                                            <span className="font-bold">{formatCurrency(value)}</span>
                                        </div>
                                    ))
                                }
                            </div>
                        </CardContent>
                    </Card>

                    {/* Top Value Items */}
                    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
                        <CardHeader>
                            <CardTitle className="text-lg">Top Value Items</CardTitle>
                            <CardDescription>Highest value items in inventory</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {valueReport?.topValueItems && valueReport.topValueItems.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Item</TableHead>
                                            <TableHead className="text-right">Quantity</TableHead>
                                            <TableHead className="text-right">Unit Value</TableHead>
                                            <TableHead className="text-right">Total Value</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {valueReport.topValueItems.map((item, index) => (
                                            <TableRow key={item.itemId}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted-foreground text-sm">#{index + 1}</span>
                                                        <span className="font-medium">{item.itemName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">{item.quantity}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(item.unitValue)}</TableCell>
                                                <TableCell className="text-right font-bold">{formatCurrency(item.totalValue)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-muted-foreground text-center py-6">No value data available</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Stock Status Report */}
                <TabsContent value="stock" className="space-y-6">
                    {/* Low Stock Items */}
                    <Card className={cn(
                        "border-0 shadow-lg",
                        lowStockItems.length > 0
                            ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-l-4 border-l-amber-500"
                            : "bg-white/80 dark:bg-slate-800/80"
                    )}>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <AlertTriangle className={cn("h-5 w-5", lowStockItems.length > 0 ? "text-amber-500" : "text-muted-foreground")} />
                                Low Stock Items
                                {lowStockItems.length > 0 && (
                                    <Badge variant="destructive">{lowStockItems.length}</Badge>
                                )}
                            </CardTitle>
                            <CardDescription>Items below their reorder level</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {lowStockItems.length === 0 ? (
                                <div className="text-center py-6">
                                    <Package className="h-12 w-12 mx-auto text-green-500 mb-3" />
                                    <p className="text-muted-foreground">All items are adequately stocked!</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Item</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead>Location</TableHead>
                                            <TableHead className="text-right">Current</TableHead>
                                            <TableHead className="text-right">Reorder Level</TableHead>
                                            <TableHead className="text-right">Shortage</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lowStockItems.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">{item.name}</TableCell>
                                                <TableCell>{item.category}</TableCell>
                                                <TableCell>{item.location}</TableCell>
                                                <TableCell className="text-right">
                                                    <span className="text-red-600 font-medium">{item.quantity}</span>
                                                </TableCell>
                                                <TableCell className="text-right">{item.reorderLevel}</TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant="destructive">
                                                        -{(item.reorderLevel || 0) - item.quantity}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    {/* Stock Overview by Location */}
                    <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-indigo-500" />
                                Stock by Location
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {locationStats.map(([location, data]) => (
                                    <div
                                        key={location}
                                        className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium">{location}</span>
                                            <Badge variant="outline">{data.itemCount}</Badge>
                                        </div>
                                        <p className="text-2xl font-bold text-indigo-600">{data.totalQuantity}</p>
                                        <p className="text-xs text-muted-foreground">total units</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
