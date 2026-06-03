'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
    Package,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    ArrowRight,
    Clock,
    MapPin
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type {
    InventorySummary,
    InventoryItem,
    InventoryTransaction,
    InventoryCategory,
    ItemCondition,
    StockLevel
} from '@/types';

interface StockDashboardProps {
    summary: InventorySummary | undefined;
    lowStockItems: InventoryItem[];
    recentTransactions: InventoryTransaction[];
    isLoading: boolean;
    categoryColors: Record<InventoryCategory, string>;
    conditionColors: Record<ItemCondition, string>;
    formatCurrency: (amount: number) => string;
    onViewAllItems: () => void;
    onViewLowStock: () => void;
}

export function StockDashboard({
    summary,
    lowStockItems,
    recentTransactions,
    isLoading,
    categoryColors,
    conditionColors,
    formatCurrency,
    onViewAllItems,
    onViewLowStock
}: StockDashboardProps) {

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-48 w-full" />
                </div>
                <div className="space-y-6">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-48 w-full" />
                </div>
            </div>
        );
    }

    // Calculate category distribution
    const categoryData = summary?.byCategory
        ? Object.entries(summary.byCategory)
            .filter(([_, data]) => data.itemCount > 0)
            .sort((a, b) => b[1].totalValue - a[1].totalValue)
        : [];

    const totalItems = summary?.totalItems || 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Charts and Distribution */}
            <div className="lg:col-span-2 space-y-6">
                {/* Category Distribution */}
                <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="h-5 w-5 text-blue-500" />
                            Inventory by Category
                        </CardTitle>
                        <CardDescription>Distribution of items across categories</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {categoryData.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">
                                    No inventory items yet. Add your first item to get started.
                                </p>
                            ) : (
                                categoryData.slice(0, 6).map(([category, data], index) => (
                                    <motion.div
                                        key={category}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="space-y-2"
                                    >
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("h-3 w-3 rounded-full", categoryColors[category as InventoryCategory])} />
                                                <span className="font-medium">{category}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-muted-foreground">
                                                <span>{data.itemCount} items</span>
                                                <span className="font-medium text-foreground">{formatCurrency(data.totalValue)}</span>
                                            </div>
                                        </div>
                                        <Progress
                                            value={(data.itemCount / totalItems) * 100}
                                            className="h-2"
                                        />
                                    </motion.div>
                                ))
                            )}
                        </div>
                        {categoryData.length > 6 && (
                            <Button variant="ghost" size="sm" onClick={onViewAllItems} className="mt-4 w-full">
                                View all categories
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Condition Summary */}
                <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Item Conditions</CardTitle>
                        <CardDescription>Current condition of all inventory items</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {summary?.byCondition && Object.entries(summary.byCondition).map(([condition, count]) => (
                                <Badge
                                    key={condition}
                                    className={cn("px-3 py-1", conditionColors[condition as ItemCondition])}
                                >
                                    {condition}: {count}
                                </Badge>
                            ))}
                            {(!summary?.byCondition || Object.keys(summary.byCondition).length === 0) && (
                                <p className="text-muted-foreground text-sm">No condition data available</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Transactions */}
                <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Clock className="h-5 w-5 text-purple-500" />
                            Recent Activity
                        </CardTitle>
                        <CardDescription>Latest inventory movements</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {recentTransactions.length === 0 ? (
                            <p className="text-muted-foreground text-center py-6">
                                No recent transactions
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {recentTransactions.map((transaction, index) => (
                                    <motion.div
                                        key={transaction.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-medium",
                                                transaction.type === 'purchase' || transaction.type === 'return' ? 'bg-green-500' :
                                                    transaction.type === 'issue' ? 'bg-blue-500' :
                                                        transaction.type === 'dispose' || transaction.type === 'damage' || transaction.type === 'loss' ? 'bg-red-500' :
                                                            'bg-slate-500'
                                            )}>
                                                {transaction.type === 'purchase' ? '+' :
                                                    transaction.type === 'issue' ? '→' :
                                                        transaction.type === 'return' ? '←' : '•'}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{transaction.itemName}</p>
                                                <p className="text-xs text-muted-foreground capitalize">
                                                    {transaction.type} • {transaction.quantity} units
                                                    {transaction.issuedTo && ` to ${transaction.issuedTo}`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(transaction.transactionDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Right Column - Alerts and Quick Stats */}
            <div className="space-y-6">
                {/* Low Stock Alerts */}
                <Card className={cn(
                    "border-0 shadow-lg",
                    lowStockItems.length > 0
                        ? "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-l-4 border-l-amber-500"
                        : "bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm"
                )}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <AlertTriangle className={cn("h-5 w-5", lowStockItems.length > 0 ? "text-amber-500" : "text-muted-foreground")} />
                            Low Stock Alerts
                            {lowStockItems.length > 0 && (
                                <Badge variant="destructive" className="ml-auto">{lowStockItems.length}</Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {lowStockItems.length === 0 ? (
                            <div className="text-center py-6">
                                <div className="h-12 w-12 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3">
                                    <Package className="h-6 w-6 text-green-600" />
                                </div>
                                <p className="text-muted-foreground text-sm">All items are well stocked!</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {lowStockItems.slice(0, 5).map((item, index) => (
                                    <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-800"
                                    >
                                        <div>
                                            <p className="font-medium text-sm">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">{item.category}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-amber-600">{item.quantity}</p>
                                            <p className="text-xs text-muted-foreground">
                                                min: {item.reorderLevel}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                                {lowStockItems.length > 5 && (
                                    <Button variant="ghost" size="sm" onClick={onViewLowStock} className="w-full">
                                        View all {lowStockItems.length} alerts
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Location Summary */}
                <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-indigo-500" />
                            By Location
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {summary?.byLocation && Object.keys(summary.byLocation).length > 0 ? (
                            <div className="space-y-2">
                                {Object.entries(summary.byLocation)
                                    .sort((a, b) => b[1].totalQuantity - a[1].totalQuantity)
                                    .slice(0, 6)
                                    .map(([location, data]) => (
                                        <div key={location} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                                            <span className="text-muted-foreground">{location}</span>
                                            <span className="font-medium">{data.itemCount} items</span>
                                        </div>
                                    ))
                                }
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-center py-4 text-sm">
                                No location data available
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Button className="w-full justify-start" variant="outline" onClick={onViewAllItems}>
                            <Package className="h-4 w-4 mr-2" />
                            View All Items
                        </Button>
                        <Button className="w-full justify-start" variant="outline" onClick={onViewLowStock}>
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Check Low Stock
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
