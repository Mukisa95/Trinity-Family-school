'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Package,
    AlertTriangle,
    ArrowRightLeft,
    TrendingUp,
    Search,
    Plus,
    Filter,
    LayoutGrid,
    List,
    RefreshCw,
    FileBarChart,
    Clock,
    Warehouse,
    DollarSign,
    Shirt
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/common/page-header';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { detectCurrentAcademicYear, detectCurrentTerm } from '@/lib/utils/academic-year-utils';
import {
    useInventoryItems,
    useInventorySummary,
    useLowStockItems,
    useIssuedItems,
    useRecentTransactions
} from '@/lib/hooks/use-inventory';
import type {
    InventoryItem,
    InventoryCategory,
    ItemCondition,
    InventoryLocation,
    InventoryFilters,
    AcademicYear,
    Term
} from '@/types';

// Import sub-components
import { ItemManagement } from '@/components/inventory/ItemManagement';
import { StockDashboard } from '@/components/inventory/StockDashboard';
import { IssueReturnPanel } from '@/components/inventory/IssueReturnPanel';
import { TransactionHistory } from '@/components/inventory/TransactionHistory';
import { InventoryReports } from '@/components/inventory/InventoryReports';

// Category colors for visual consistency
const categoryColors: Record<InventoryCategory, string> = {
    'Furniture': 'bg-amber-500',
    'Electronics': 'bg-blue-500',
    'Laboratory': 'bg-purple-500',
    'Sports': 'bg-green-500',
    'Library': 'bg-indigo-500',
    'Kitchen': 'bg-orange-500',
    'Classroom': 'bg-cyan-500',
    'Office': 'bg-slate-500',
    'Transport': 'bg-rose-500',
    'Medical': 'bg-red-500',
    'Cleaning': 'bg-teal-500',
    'Other': 'bg-gray-500'
};

// Condition colors
const conditionColors: Record<ItemCondition, string> = {
    'New': 'bg-emerald-500 text-white',
    'Good': 'bg-green-500 text-white',
    'Fair': 'bg-yellow-500 text-black',
    'Poor': 'bg-orange-500 text-white',
    'Damaged': 'bg-red-500 text-white',
    'Under Repair': 'bg-blue-500 text-white',
    'Disposed': 'bg-gray-500 text-white'
};

export default function InventoryPage() {
    // State
    const [activeTab, setActiveTab] = useState('overview');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<InventoryCategory | 'all'>('all');
    const [selectedCondition, setSelectedCondition] = useState<ItemCondition | 'all'>('all');
    const [selectedLocation, setSelectedLocation] = useState<InventoryLocation | 'all'>('all');
    const [isMobile, setIsMobile] = useState(false);

    // Academic year context
    const { data: academicYears, isLoading: academicYearsLoading } = useAcademicYears();
    const [activeAcademicYear, setActiveAcademicYear] = useState<AcademicYear | null>(null);
    const [activeTerm, setActiveTerm] = useState<Term | null>(null);

    // Apply filters
    const filters: InventoryFilters = {
        searchTerm: searchTerm || undefined,
        categories: selectedCategory !== 'all' ? [selectedCategory] : undefined,
        conditions: selectedCondition !== 'all' ? [selectedCondition] : undefined,
        locations: selectedLocation !== 'all' ? [selectedLocation] : undefined,
        isActive: true
    };

    // Data queries
    const { data: items, isLoading: itemsLoading, refetch: refetchItems } = useInventoryItems(filters);
    const { data: summary, isLoading: summaryLoading } = useInventorySummary();
    const { data: lowStockItems, isLoading: lowStockLoading } = useLowStockItems();
    const { data: issuedItems, isLoading: issuedLoading } = useIssuedItems();
    const { data: recentTransactions, isLoading: transactionsLoading } = useRecentTransactions(5);

    // Detect screen size
    useEffect(() => {
        const checkScreenSize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    // Set active academic year/term based on current date
    useEffect(() => {
        if (academicYears && academicYears.length > 0) {
            const currentYear = detectCurrentAcademicYear(academicYears);
            if (currentYear) {
                setActiveAcademicYear(currentYear);
                const currentTerm = detectCurrentTerm(currentYear);
                if (currentTerm) {
                    setActiveTerm(currentTerm);
                }
            }
        }
    }, [academicYears]);

    // Clear filters
    const clearFilters = () => {
        setSearchTerm('');
        setSelectedCategory('all');
        setSelectedCondition('all');
        setSelectedLocation('all');
    };

    const hasActiveFilters = searchTerm || selectedCategory !== 'all' || selectedCondition !== 'all' || selectedLocation !== 'all';

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-UG', {
            style: 'currency',
            currency: 'UGX',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    // Loading state
    const isLoading = itemsLoading || summaryLoading || academicYearsLoading;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-blue-950/20 dark:to-indigo-950/30">
            <div className="container mx-auto px-4 py-6 max-w-7xl">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <PageHeader
                        title="Inventory Management"
                        description="Track and manage school property, assets, and equipment"
                        icon={Warehouse}
                    />
                    <a href="/inventory/uniforms">
                        <Button className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                            <Shirt className="h-4 w-4" />
                            Uniforms Inventory
                        </Button>
                    </a>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {/* Total Items */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-blue-100 text-sm font-medium">Total Items</p>
                                        {summaryLoading ? (
                                            <Skeleton className="h-8 w-16 bg-blue-400/30" />
                                        ) : (
                                            <p className="text-2xl font-bold">{summary?.totalItems || 0}</p>
                                        )}
                                    </div>
                                    <div className="h-12 w-12 bg-blue-400/30 rounded-full flex items-center justify-center">
                                        <Package className="h-6 w-6" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Low Stock Alerts */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Card className={cn(
                            "border-0 shadow-lg",
                            (summary?.lowStockCount || 0) > 0
                                ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white"
                                : "bg-gradient-to-br from-emerald-500 to-green-500 text-white"
                        )}>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white/80 text-sm font-medium">Low Stock</p>
                                        {summaryLoading ? (
                                            <Skeleton className="h-8 w-16 bg-white/30" />
                                        ) : (
                                            <p className="text-2xl font-bold">{summary?.lowStockCount || 0}</p>
                                        )}
                                    </div>
                                    <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center">
                                        <AlertTriangle className="h-6 w-6" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Currently Issued */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Card className="bg-gradient-to-br from-purple-500 to-violet-600 text-white border-0 shadow-lg">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-purple-100 text-sm font-medium">Items Issued</p>
                                        {issuedLoading ? (
                                            <Skeleton className="h-8 w-16 bg-purple-400/30" />
                                        ) : (
                                            <p className="text-2xl font-bold">{issuedItems?.length || 0}</p>
                                        )}
                                    </div>
                                    <div className="h-12 w-12 bg-purple-400/30 rounded-full flex items-center justify-center">
                                        <ArrowRightLeft className="h-6 w-6" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Total Value */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 shadow-lg">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-emerald-100 text-sm font-medium">Total Value</p>
                                        {summaryLoading ? (
                                            <Skeleton className="h-8 w-20 bg-emerald-400/30" />
                                        ) : (
                                            <p className="text-xl font-bold">{formatCurrency(summary?.totalValue || 0)}</p>
                                        )}
                                    </div>
                                    <div className="h-12 w-12 bg-emerald-400/30 rounded-full flex items-center justify-center">
                                        <DollarSign className="h-6 w-6" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                {/* Main Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <TabsList className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border shadow-sm h-auto flex-wrap p-1">
                            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                                <LayoutGrid className="h-4 w-4 mr-2" />
                                {!isMobile && "Overview"}
                            </TabsTrigger>
                            <TabsTrigger value="items" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                                <Package className="h-4 w-4 mr-2" />
                                {!isMobile && "Items"}
                            </TabsTrigger>
                            <TabsTrigger value="issue-return" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                {!isMobile && "Issue/Return"}
                            </TabsTrigger>
                            <TabsTrigger value="transactions" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                                <Clock className="h-4 w-4 mr-2" />
                                {!isMobile && "History"}
                            </TabsTrigger>
                            <TabsTrigger value="reports" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                                <FileBarChart className="h-4 w-4 mr-2" />
                                {!isMobile && "Reports"}
                            </TabsTrigger>
                        </TabsList>

                        {/* Search and Actions - show on items tab */}
                        {activeTab === 'items' && (
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1 md:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search items..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 bg-white dark:bg-slate-800"
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setFiltersExpanded(!filtersExpanded)}
                                    className={cn(hasActiveFilters && "border-blue-500 text-blue-500")}
                                >
                                    <Filter className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
                                >
                                    {viewMode === 'cards' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => refetchItems()}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Tab Contents */}
                    <AnimatePresence mode="wait">
                        <TabsContent value="overview" className="mt-0">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <StockDashboard
                                    summary={summary}
                                    lowStockItems={lowStockItems || []}
                                    recentTransactions={recentTransactions || []}
                                    isLoading={isLoading}
                                    categoryColors={categoryColors}
                                    conditionColors={conditionColors}
                                    formatCurrency={formatCurrency}
                                    onViewAllItems={() => setActiveTab('items')}
                                    onViewLowStock={() => {
                                        setActiveTab('items');
                                        setSelectedCondition('all');
                                    }}
                                />
                            </motion.div>
                        </TabsContent>

                        <TabsContent value="items" className="mt-0">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <ItemManagement
                                    items={items || []}
                                    isLoading={itemsLoading}
                                    viewMode={viewMode}
                                    filtersExpanded={filtersExpanded}
                                    selectedCategory={selectedCategory}
                                    selectedCondition={selectedCondition}
                                    selectedLocation={selectedLocation}
                                    onCategoryChange={setSelectedCategory}
                                    onConditionChange={setSelectedCondition}
                                    onLocationChange={setSelectedLocation}
                                    onClearFilters={clearFilters}
                                    hasActiveFilters={hasActiveFilters}
                                    categoryColors={categoryColors}
                                    conditionColors={conditionColors}
                                    formatCurrency={formatCurrency}
                                    academicYear={activeAcademicYear}
                                    term={activeTerm}
                                />
                            </motion.div>
                        </TabsContent>

                        <TabsContent value="issue-return" className="mt-0">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <IssueReturnPanel
                                    items={items || []}
                                    issuedItems={issuedItems || []}
                                    isLoading={itemsLoading || issuedLoading}
                                    academicYear={activeAcademicYear}
                                    term={activeTerm}
                                    formatCurrency={formatCurrency}
                                />
                            </motion.div>
                        </TabsContent>

                        <TabsContent value="transactions" className="mt-0">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <TransactionHistory
                                    academicYear={activeAcademicYear}
                                    term={activeTerm}
                                />
                            </motion.div>
                        </TabsContent>

                        <TabsContent value="reports" className="mt-0">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <InventoryReports
                                    summary={summary}
                                    items={items || []}
                                    isLoading={isLoading}
                                    formatCurrency={formatCurrency}
                                    categoryColors={categoryColors}
                                />
                            </motion.div>
                        </TabsContent>
                    </AnimatePresence>
                </Tabs>
            </div>
        </div>
    );
}
