'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { ProcurementService } from '@/lib/services/procurement.service';
import type { 
  ProcurementBudget, 
  ProcurementItem, 
  ProcurementPurchase,
  ViewPeriodType
} from '@/types';

interface BudgetManagementProps {
  budgets: ProcurementBudget[];
  setBudgets: (budgets: ProcurementBudget[]) => void;
  items: ProcurementItem[];
}

interface BudgetVsActualItem {
  itemId: string;
  itemName: string;
  category: string;
  budgetedQuantity: number;
  budgetedCost: number;
  actualQuantity: number;
  actualCost: number;
  quantityVariance: number;
  costVariance: number;
  quantityVariancePercent: number;
  costVariancePercent: number;
  status: 'over' | 'under' | 'on-target';
}

interface PeriodSelection {
  type: ViewPeriodType;
  year: string;
  term?: string;
  month?: string;
}

export function BudgetManagement({ budgets, setBudgets, items }: BudgetManagementProps) {
  const [activeTab, setActiveTab] = useState('budgets');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Period selection for budget comparison
  const [comparisonPeriod, setComparisonPeriod] = useState<PeriodSelection>({
    type: 'Term',
    year: new Date().getFullYear().toString(),
    term: `term-1-${new Date().getFullYear()}`
  });

  const [purchases, setPurchases] = useState<ProcurementPurchase[]>([]);
  const [budgetVsActual, setBudgetVsActual] = useState<BudgetVsActualItem[]>([]);

  // Form state for adding budgets
  const [formData, setFormData] = useState({
    itemId: '',
    budgetedQuantity: 0,
    budgetedCost: 0,
    period: comparisonPeriod,
    notes: ''
  });

  const availableYears = [
    { id: '2022', name: '2022' },
    { id: '2023', name: '2023' },
    { id: '2024', name: '2024' },
    { id: '2025', name: '2025' },
    { id: '2026', name: '2026' }
  ];

  const availableTerms = [
    { id: 'term-1', name: 'Term 1' },
    { id: 'term-2', name: 'Term 2' },
    { id: 'term-3', name: 'Term 3' }
  ];

  const availableMonths = [
    { id: '01', name: 'January' },
    { id: '02', name: 'February' },
    { id: '03', name: 'March' },
    { id: '04', name: 'April' },
    { id: '05', name: 'May' },
    { id: '06', name: 'June' },
    { id: '07', name: 'July' },
    { id: '08', name: 'August' },
    { id: '09', name: 'September' },
    { id: '10', name: 'October' },
    { id: '11', name: 'November' },
    { id: '12', name: 'December' }
  ];

  // Fetch purchases for comparison
  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        const purchasesData = await ProcurementService.getPurchases();
        setPurchases(purchasesData);
      } catch (error) {
        console.error('Error fetching purchases:', error);
      }
    };
    
    fetchPurchases();
  }, []);

  // Calculate budget vs actual when data changes
  useEffect(() => {
    calculateBudgetVsActual();
  }, [budgets, purchases, comparisonPeriod]);

  const calculateBudgetVsActual = () => {
    // Filter purchases based on selected period
    const filteredPurchases = purchases.filter(purchase => {
      const purchaseDate = new Date(purchase.purchaseDate);
      const purchaseYear = purchaseDate.getFullYear().toString();
      
      if (purchaseYear !== comparisonPeriod.year) return false;
      
      if (comparisonPeriod.type === 'Year') {
        return true;
      } else if (comparisonPeriod.type === 'Term') {
        return purchase.termId === `${comparisonPeriod.term}-${comparisonPeriod.year}`;
      } else if (comparisonPeriod.type === 'Month') {
        const purchaseMonth = (purchaseDate.getMonth() + 1).toString().padStart(2, '0');
        return purchaseMonth === comparisonPeriod.month;
      }
      
      return false;
    });

    // Filter budgets for the same period and extract budget items
    const filteredBudgetItems: Array<{itemId: string, budgetedQuantity: number, budgetedCost: number}> = [];
    
    budgets.forEach(budget => {
      // Check if budget matches the selected period
      const budgetMatches = budget.academicYearId === comparisonPeriod.year;
      
      if (budgetMatches && budget.budgetItems) {
        budget.budgetItems.forEach(budgetItem => {
          filteredBudgetItems.push({
            itemId: budgetItem.itemId,
            budgetedQuantity: budgetItem.estimatedQuantity,
            budgetedCost: budgetItem.estimatedTotalCost
          });
        });
      }
    });

    // Calculate comparison data
    const comparisonData: BudgetVsActualItem[] = [];
    
    // Get all unique items from both budgets and purchases
    const allItemIds = new Set([
      ...filteredBudgetItems.map(b => b.itemId),
      ...filteredPurchases.map(p => p.itemId)
    ]);

    allItemIds.forEach(itemId => {
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      const budgetData = filteredBudgetItems.find(b => b.itemId === itemId);
      const itemPurchases = filteredPurchases.filter(p => p.itemId === itemId);

      const budgetedQuantity = budgetData?.budgetedQuantity || 0;
      const budgetedCost = budgetData?.budgetedCost || 0;
      const actualQuantity = itemPurchases.reduce((sum, p) => sum + p.quantity, 0);
      const actualCost = itemPurchases.reduce((sum, p) => sum + p.totalCost, 0);

      const quantityVariance = actualQuantity - budgetedQuantity;
      const costVariance = actualCost - budgetedCost;
      const quantityVariancePercent = budgetedQuantity > 0 ? (quantityVariance / budgetedQuantity) * 100 : 0;
      const costVariancePercent = budgetedCost > 0 ? (costVariance / budgetedCost) * 100 : 0;

      let status: 'over' | 'under' | 'on-target' = 'on-target';
      if (Math.abs(costVariancePercent) > 10) {
        status = costVariancePercent > 0 ? 'over' : 'under';
      }

      comparisonData.push({
        itemId,
        itemName: item.name,
        category: item.category,
        budgetedQuantity,
        budgetedCost,
        actualQuantity,
        actualCost,
        quantityVariance,
        costVariance,
        quantityVariancePercent,
        costVariancePercent,
        status
      });
    });

    setBudgetVsActual(comparisonData);
  };

  const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;

  const getVarianceColor = (variance: number, isPercentage: boolean = false) => {
    if (Math.abs(variance) < (isPercentage ? 10 : 1000)) return 'text-green-600';
    return variance > 0 ? 'text-red-600' : 'text-green-600';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'over':
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Over Budget</Badge>;
      case 'under':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Under Budget</Badge>;
      default:
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">On Target</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Budget Management</h2>
        <p className="text-gray-600">Manage procurement budgets and track actual spending</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="budgets">Budget Planning</TabsTrigger>
          <TabsTrigger value="comparison">Budget vs Actual</TabsTrigger>
        </TabsList>

        <TabsContent value="budgets" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Budget Planning</CardTitle>
                  <CardDescription>
                    Create and manage procurement budgets for different periods
                  </CardDescription>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Budget
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Budget</DialogTitle>
                      <DialogDescription>Add a new budget item for a specific period</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Select Item</Label>
                        <Select value={formData.itemId} onValueChange={(value) => setFormData({...formData, itemId: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose an item" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map(item => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name} ({item.category})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Budgeted Quantity</Label>
                          <Input
                            type="number"
                            value={formData.budgetedQuantity}
                            onChange={(e) => setFormData({...formData, budgetedQuantity: parseFloat(e.target.value) || 0})}
                          />
                        </div>
                        <div>
                          <Label>Budgeted Cost (UGX)</Label>
                          <Input
                            type="number"
                            value={formData.budgetedCost}
                            onChange={(e) => setFormData({...formData, budgetedCost: parseFloat(e.target.value) || 0})}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                      <Button>Create Budget</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                Budget planning features coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          {/* Period Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Period Selection</CardTitle>
              <CardDescription>
                Choose the period for budget vs actual comparison
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div>
                  <Label>Period Type</Label>
                  <Select 
                    value={comparisonPeriod.type} 
                    onValueChange={(value: ViewPeriodType) => 
                      setComparisonPeriod({...comparisonPeriod, type: value})
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Year">Year</SelectItem>
                      <SelectItem value="Term">Term</SelectItem>
                      <SelectItem value="Month">Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Year</Label>
                  <Select 
                    value={comparisonPeriod.year} 
                    onValueChange={(value) => 
                      setComparisonPeriod({...comparisonPeriod, year: value})
                    }
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map(year => (
                        <SelectItem key={year.id} value={year.id}>{year.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {comparisonPeriod.type === 'Term' && (
                  <div>
                    <Label>Term</Label>
                    <Select 
                      value={comparisonPeriod.term} 
                      onValueChange={(value) => 
                        setComparisonPeriod({...comparisonPeriod, term: value})
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTerms.map(term => (
                          <SelectItem key={term.id} value={term.id}>{term.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {comparisonPeriod.type === 'Month' && (
                  <div>
                    <Label>Month</Label>
                    <Select 
                      value={comparisonPeriod.month} 
                      onValueChange={(value) => 
                        setComparisonPeriod({...comparisonPeriod, month: value})
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMonths.map(month => (
                          <SelectItem key={month.id} value={month.id}>{month.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Budget vs Actual Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Budget vs. Actual Comparison
              </CardTitle>
              <CardDescription>
                Compare budgeted amounts with actual spending for {comparisonPeriod.year}
                {comparisonPeriod.type === 'Term' && comparisonPeriod.term && ` - ${comparisonPeriod.term}`}
                {comparisonPeriod.type === 'Month' && comparisonPeriod.month && ` - ${availableMonths.find(m => m.id === comparisonPeriod.month)?.name}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Budgeted Qty & Cost</TableHead>
                    <TableHead>Actual Qty & Cost</TableHead>
                    <TableHead>Variance (Quantity)</TableHead>
                    <TableHead>Variance (Cost)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetVsActual.map((item) => (
                    <TableRow key={item.itemId}>
                      <TableCell className="font-medium">{item.itemName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{item.budgetedQuantity.toLocaleString()} units</div>
                          <div className="font-medium">{formatCurrency(item.budgetedCost)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{item.actualQuantity.toLocaleString()} units</div>
                          <div className="font-medium">{formatCurrency(item.actualCost)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`text-sm ${getVarianceColor(item.quantityVariance)}`}>
                          <div className="flex items-center gap-1">
                            {item.quantityVariance > 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : item.quantityVariance < 0 ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                            {Math.abs(item.quantityVariance).toLocaleString()}
                          </div>
                          <div className="text-xs">
                            ({item.quantityVariancePercent > 0 ? '+' : ''}{item.quantityVariancePercent.toFixed(1)}%)
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`text-sm ${getVarianceColor(item.costVariance)}`}>
                          <div className="flex items-center gap-1">
                            {item.costVariance > 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : item.costVariance < 0 ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                            {formatCurrency(Math.abs(item.costVariance))}
                          </div>
                          <div className="text-xs">
                            ({item.costVariancePercent > 0 ? '+' : ''}{item.costVariancePercent.toFixed(1)}%)
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(item.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {budgetVsActual.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No budget or purchase data found for the selected period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 