'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
    Shirt,
    PackageCheck
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
    Term,
    ItemRequest
} from '@/types';

// Import sub-components
import { ItemManagement } from '@/components/inventory/ItemManagement';
import { StockDashboard } from '@/components/inventory/StockDashboard';
import { IssueReturnPanel } from '@/components/inventory/IssueReturnPanel';
import { TransactionHistory } from '@/components/inventory/TransactionHistory';
import { InventoryReports } from '@/components/inventory/InventoryReports';
import { ItemReleaseQueuePanel } from '@/components/inventory/ItemReleaseQueuePanel';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/contexts/auth-context';
import { useItemReleaseQueue } from '@/lib/hooks/use-item-requests';

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
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, canAccessPage, canPerformAction } = useAuth();
    const canViewInventory = canAccessPage('inventory', 'dashboard');
    const canViewRelease = canAccessPage('item_requests', 'release')
        && canPerformAction('item_requests', 'release', 'view_release_queue');
    const requestedTab = searchParams.get('tab');
    const focusedRequestId = searchParams.get('requestId');

    // State
    const [activeTab, setActiveTab] = useState(() => (
        (requestedTab === 'release' && canViewRelease) || (!canViewInventory && canViewRelease)
            ? 'release'
            : 'overview'
    ));
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<InventoryCategory | 'all'>('all');
    const [selectedCondition, setSelectedCondition] = useState<ItemCondition | 'all'>('all');
    const [selectedLocation, setSelectedLocation] = useState<InventoryLocation | 'all'>('all');
    const [isMobile, setIsMobile] = useState(false);
    const [releaseAlertOpen, setReleaseAlertOpen] = useState(false);
    const [alertRequest, setAlertRequest] = useState<ItemRequest | null>(null);

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
    const inventoryQueriesEnabled = canViewInventory && activeTab !== 'release';
    const { data: items, isLoading: itemsLoading, refetch: refetchItems } = useInventoryItems(filters, { enabled: inventoryQueriesEnabled });
    const { data: summary, isLoading: summaryLoading } = useInventorySummary({ enabled: inventoryQueriesEnabled });
    const { data: lowStockItems, isLoading: lowStockLoading } = useLowStockItems({ enabled: inventoryQueriesEnabled });
    const { data: issuedItems, isLoading: issuedLoading } = useIssuedItems({ enabled: inventoryQueriesEnabled });
    const { data: recentTransactions, isLoading: transactionsLoading } = useRecentTransactions(5, { enabled: inventoryQueriesEnabled });
    const { data: releaseRequests = [], isLoading: releaseRequestsLoading } = useItemReleaseQueue(canViewRelease);

    useEffect(() => {
        if (requestedTab === 'release' && canViewRelease) {
            setActiveTab('release');
        } else if (!canViewInventory && canViewRelease) {
            setActiveTab('release');
        } else if (!canViewInventory && !canViewRelease) {
            setActiveTab('overview');
        }
    }, [canViewInventory, canViewRelease, requestedTab]);

    useEffect(() => {
        if (!canViewRelease || releaseRequestsLoading || activeTab === 'release' || releaseRequests.length === 0 || !user?.id) return;

        const storageKey = `trinity:inventory-release-alerts:${user.id}`;
        let dismissedIds: string[] = [];
        try {
            const stored = sessionStorage.getItem(storageKey);
            const parsed = stored ? JSON.parse(stored) : [];
            dismissedIds = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
        } catch {
            dismissedIds = [];
        }
        const unseenRequest = releaseRequests.find(request => !dismissedIds.includes(request.id));
        if (unseenRequest) {
            setAlertRequest(unseenRequest);
            setReleaseAlertOpen(true);
        }
    }, [activeTab, canViewRelease, releaseRequests, releaseRequestsLoading, user?.id]);

    const dismissReleaseAlert = () => {
        if (user?.id) {
            try {
                sessionStorage.setItem(
                    `trinity:inventory-release-alerts:${user.id}`,
                    JSON.stringify(releaseRequests.map(request => request.id)),
                );
            } catch {
                // The persistent Release button remains available if browser storage is unavailable.
            }
        }
        setReleaseAlertOpen(false);
        setAlertRequest(null);
    };

    const openReleaseQueue = () => {
        dismissReleaseAlert();
        setActiveTab('release');
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.set('tab', 'release');
        router.replace(`/inventory?${nextParams.toString()}`, { scroll: false });
    };

    const openInventoryTab = (tabId: string) => {
        if (tabId === 'release') {
            openReleaseQueue();
            return;
        }
        setActiveTab(tabId);
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete('tab');
        nextParams.delete('requestId');
        const nextQuery = nextParams.toString();
        router.replace(nextQuery ? `/inventory?${nextQuery}` : '/inventory', { scroll: false });
    };

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

    const hasActiveFilters = Boolean(searchTerm) || selectedCategory !== 'all' || selectedCondition !== 'all' || selectedLocation !== 'all';

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
                subtitle={activeTab === 'release' ? 'Review and respond to staff item requests' : 'Track and manage school property, assets, and equipment'}
                backHref="/dashboard"
                backLabel="Dashboard"
                meta={
                    <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-full border border-slate-200/50 backdrop-blur-sm">
                        {[
                            ...(canViewInventory ? [
                                { id: 'overview', label: 'Overview' },
                                { id: 'items', label: 'Items' },
                                { id: 'issue-return', label: 'Issue/Return' },
                                { id: 'transactions', label: 'History' },
                                { id: 'reports', label: 'Reports' },
                            ] : []),
                            ...(canViewRelease ? [{ id: 'release', label: releaseRequests.length > 0 ? `Release (${releaseRequests.length})` : 'Release' }] : []),
                        ].map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => openInventoryTab(tab.id)}
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
                actions={(canViewInventory || (canViewRelease && releaseRequests.length > 0)) ? (
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
                        {canViewRelease && releaseRequests.length > 0 && activeTab !== 'release' && (
                            <GlassActionButton
                                label="Release"
                                icon={<PackageCheck className="h-4 w-4" />}
                                badge={releaseRequests.length > 99 ? '99+' : releaseRequests.length}
                                tone="orange"
                                onClick={openReleaseQueue}
                                title={`Open ${releaseRequests.length} active release request${releaseRequests.length === 1 ? '' : 's'}`}
                                aria-label={`Open ${releaseRequests.length} active release request${releaseRequests.length === 1 ? '' : 's'}`}
                            />
                        )}
                        {canViewInventory && (
                            <GlassActionButton
                                href="/inventory/uniforms"
                                label="Uniforms"
                                icon={<Shirt className="h-4 w-4" />}
                                tone="purple"
                                title="Uniforms Inventory"
                            />
                        )}
                    </GlassActionDock>
                ) : undefined}
            className="mb-1.5"
            />

            {activeTab === 'release' ? (
                <GlassSummaryBar
                    left={
                        <div className="flex items-center gap-2">
                            <PackageCheck className="h-4 w-4 text-orange-600" />
                            <span className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200 sm:text-sm">Release requests</span>
                        </div>
                    }
                    right={
                        <>
                            <div className="flex items-center gap-1 rounded-md border border-orange-100/50 bg-orange-50/80 px-2 py-0.5 text-[10px] text-orange-800 dark:border-orange-900/30 dark:bg-orange-950/20 dark:text-orange-200 sm:text-xs">
                                <span className="font-medium">Active:</span>
                                <span className="font-bold tabular-nums">{releaseRequests.length}</span>
                            </div>
                            <div className="flex items-center gap-1 rounded-md border border-emerald-100/50 bg-emerald-50/80 px-2 py-0.5 text-[10px] text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-200 sm:text-xs">
                                <span className="font-medium">Ready:</span>
                                <span className="font-bold tabular-nums">{releaseRequests.filter(request => request.canRelease).length}</span>
                            </div>
                        </>
                    }
                />
            ) : canViewInventory ? <GlassSummaryBar
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
            /> : null}

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

                        <TabsContent value="release" className="mt-0">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <ItemReleaseQueuePanel
                                    requests={releaseRequests}
                                    isLoading={releaseRequestsLoading}
                                    focusRequestId={focusedRequestId}
                                />
                            </motion.div>
                        </TabsContent>
                    </AnimatePresence>
                </Tabs>
            </div>

            <Dialog open={releaseAlertOpen} onOpenChange={(open) => { if (!open) dismissReleaseAlert(); }}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 pr-8">
                            <PackageCheck className="h-5 w-5 text-orange-600" />
                            New item request
                        </DialogTitle>
                        <DialogDescription>A staff member is waiting for an Inventory response.</DialogDescription>
                    </DialogHeader>
                    {alertRequest && (
                        <div className="space-y-3 rounded-xl border border-orange-200 bg-orange-50/70 p-4 text-sm text-slate-800 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-slate-100">
                            <p><span className="font-semibold">Who:</span> {alertRequest.requesterName}{alertRequest.requesterDepartment ? ` · ${alertRequest.requesterDepartment}` : ''}</p>
                            <p><span className="font-semibold">What:</span> {alertRequest.itemName}</p>
                            <p><span className="font-semibold">How much:</span> {alertRequest.quantity} {alertRequest.unit}</p>
                            <p><span className="font-semibold">Reason:</span> {alertRequest.reason}</p>
                            <Badge variant="outline" className={alertRequest.canRelease ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}>
                                {alertRequest.canRelease ? 'Stock is available' : alertRequest.catalogItemId ? 'Restocking may be needed' : 'Item is not yet in shared items'}
                            </Badge>
                            {releaseRequests.length > 1 && <p className="text-xs font-medium text-slate-600 dark:text-slate-300">There are {releaseRequests.length - 1} more active request{releaseRequests.length === 2 ? '' : 's'} in the queue.</p>}
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" className="min-h-11" onClick={dismissReleaseAlert}>Close</Button>
                        <Button type="button" className="min-h-11 gap-2 bg-orange-600 hover:bg-orange-700" onClick={openReleaseQueue}>
                            <PackageCheck className="h-4 w-4" /> Open release queue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
