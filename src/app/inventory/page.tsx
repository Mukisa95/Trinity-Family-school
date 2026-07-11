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
import { GlassPageTopBar, GlassActionDock, GlassActionButton, GlassPageSearchInput } from "@/components/common/glass-page-top-bar";
import { GlassSummaryBar } from "@/components/common/glass-summary-bar";
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
        <div className="min-h-screen pb-12">
            <GlassPageTopBar
                title="Inventory Management"
                subtitle="Track and manage school property, assets, and equipment"
                backHref="/dashboard"
                backLabel="Dashboard"
                meta={
                    <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-full border border-slate-200/50 backdrop-blur-sm">
                        {[
                            { id: 'overview', label: 'Overview' },
                            { id: 'items', label: 'Items' },
                            { id: 'issue-return', label: 'Issue/Return' },
                            { id: 'transactions', label: 'History' },
                            { id: 'reports', label: 'Reports' }
                        ].map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "h-6 px-3 rounded-full text-[10px] font-semibold transition-all duration-205",
                                        isActive
                                            ? "bg-white text-indigo-700 shadow-sm font-bold"
                                            : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                }
                actionsLeading={
                    activeTab === 'items' ? (
                        <div className="flex items-center gap-2">
                            <GlassPageSearchInput
                                placeholder="Search items..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                containerClassName="w-[140px] sm:w-[180px] lg:w-[220px]"
                            />
                        </div>
                    ) : undefined
                }
                actions={
                    <GlassActionDock>
                        {activeTab === 'items' && (
                            <>
                                <GlassActionButton
                                    label="Filters"
                                    icon={<Filter className="h-4 w-4" />}
                                    tone={hasActiveFilters ? "violet" : "slate"}
                                    onClick={() => setFiltersExpanded(!filtersExpanded)}
                                    title="Toggle Filters"
                                />
                                <GlassActionButton
                                    label={viewMode === 'cards' ? "List View" : "Card View"}
                                    icon={viewMode === 'cards' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                                    tone="slate"
                                    onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
                                    title="Toggle View Mode"
                                />
                                <GlassActionButton
                                    label="Refresh"
                                    icon={<RefreshCw className="h-4 w-4" />}
                                    tone="slate"
                                    onClick={() => refetchItems()}
                                    title="Refresh items list"
                                />
                            </>
                        )}
                        <a href="/inventory/uniforms">
                            <GlassActionButton
                                label="Uniforms"
                                icon={<Shirt className="h-4 w-4" />}
                                tone="purple"
                                title="Uniforms Inventory"
                            />
                        </a>
                    </GlassActionDock>
                }
            className="mb-1.5"
            />

            <GlassSummaryBar
                left={
                    <div className="flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-indigo-500" />
                        <span className="text-xs sm:text-sm font-black tracking-wider text-indigo-900 dark:text-indigo-200 uppercase">
                            Inventory Overview
                        </span>
                    </div>
                }
                right={
                    <>
                        <div className="flex items-center gap-1 bg-blue-50/80 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                            <span className="text-blue-700/85 dark:text-blue-300 font-medium">Total Items:</span>
                            <span className="font-bold text-blue-700 dark:text-blue-400">{summary?.totalItems || 0}</span>
                        </div>
                        <div className={cn(
                            "flex items-center gap-1 border px-2 py-0.5 rounded-md text-[10px] sm:text-xs",
                            (summary?.lowStockCount || 0) > 0
                                ? "bg-amber-50/80 border-amber-100/50 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400"
                                : "bg-emerald-50/80 border-emerald-100/50 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400"
                        )}>
                            <span className="font-medium">Low Stock:</span>
                            <span className="font-bold">{summary?.lowStockCount || 0}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-purple-50/80 dark:bg-purple-950/20 border border-purple-100/50 dark:border-purple-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                            <span className="text-purple-700/85 dark:text-purple-300 font-medium">Items Issued:</span>
                            <span className="font-bold text-purple-700 dark:text-purple-400">{issuedItems?.length || 0}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-green-50/80 dark:bg-green-950/20 border border-green-100/50 dark:border-green-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                            <span className="text-green-700/85 dark:text-green-300 font-medium">Total Value:</span>
                            <span className="font-bold text-green-750 dark:text-green-400 font-tabular-nums">{formatCurrency(summary?.totalValue || 0)}</span>
                        </div>
                    </>
                }
            />

            <div className="max-w-none px-4 sm:px-6 lg:px-8 py-4 space-y-6">
                {/* Stats moved to GlassSummaryBar above */}

                {/* Main Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    {/* TabsList hidden - replaced by topbar select */}

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
