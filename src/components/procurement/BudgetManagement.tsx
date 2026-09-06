'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarRange, Edit, ListPlus, Loader2, Plus, Trash2, TrendingUp, WalletCards } from 'lucide-react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/contexts/auth-context';
import { ProcurementService } from '@/lib/services/procurement.service';
import { buildBudgetLine, calculateBudgetTotal, replaceBudgetLine } from '@/lib/utils/procurement-budget';
import type { AcademicYear, BudgetItem, BudgetPeriodType, CreateProcurementBudgetData, ProcurementBudget, ProcurementItem, ProcurementPurchase, Term } from '@/types';

interface BudgetManagementProps {
  budgets: ProcurementBudget[];
  onBudgetsChanged: () => Promise<void>;
  items: ProcurementItem[];
  purchases: ProcurementPurchase[];
  academicYears: AcademicYear[];
  availableTerms: Term[];
  currentAcademicYear: string;
  currentTerm: string;
}

type PlanForm = {
  name: string;
  description: string;
  periodType: BudgetPeriodType;
  academicYearId: string;
  termId: string;
};

type LineForm = {
  itemId: string;
  quantity: string;
  estimatedUnitPrice: string;
  priority: BudgetItem['priority'];
  notes: string;
};

const emptyLine: LineForm = { itemId: '', quantity: '', estimatedUnitPrice: '', priority: 'Medium', notes: '' };

function budgetLineId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `budget-line-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(amount || 0);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function BudgetManagement({
  budgets,
  onBudgetsChanged,
  items,
  purchases,
  academicYears,
  availableTerms,
  currentAcademicYear,
  currentTerm,
}: BudgetManagementProps) {
  const { user, canPerformAction } = useAuth();
  const canCreate = canPerformAction('procurement', 'budget', 'create_budget');
  const canEdit = canPerformAction('procurement', 'budget', 'edit_budget');
  const [activeTab, setActiveTab] = useState('budgets');
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [comparisonBudgetId, setComparisonBudgetId] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLineOpen, setIsLineOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<BudgetItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [planForm, setPlanForm] = useState<PlanForm>({
    name: '',
    description: '',
    periodType: 'Annual',
    academicYearId: currentAcademicYear,
    termId: currentTerm,
  });
  const [lineForm, setLineForm] = useState<LineForm>(emptyLine);

  useEffect(() => {
    setPlanForm(previous => ({
      ...previous,
      academicYearId: previous.academicYearId || currentAcademicYear,
      termId: previous.termId || currentTerm,
    }));
  }, [currentAcademicYear, currentTerm]);

  useEffect(() => {
    if (!comparisonBudgetId && budgets[0]) setComparisonBudgetId(budgets[0].id);
    if (comparisonBudgetId && !budgets.some(budget => budget.id === comparisonBudgetId)) setComparisonBudgetId(budgets[0]?.id || '');
  }, [budgets, comparisonBudgetId]);

  const selectedBudget = budgets.find(budget => budget.id === selectedBudgetId) || null;
  const comparisonBudget = budgets.find(budget => budget.id === comparisonBudgetId) || null;
  const activeItems = items.filter(item => item.isActive);

  const comparisonRows = useMemo(() => {
    if (!comparisonBudget) return [];
    const start = new Date(comparisonBudget.startDate).getTime();
    const end = new Date(comparisonBudget.endDate).getTime();
    return comparisonBudget.budgetItems.map(line => {
      const actualPurchases = purchases.filter(purchase => {
        const time = new Date(purchase.purchaseDate).getTime();
        return purchase.itemId === line.itemId && time >= start && time <= end;
      });
      return {
        line,
        actualQuantity: actualPurchases.reduce((total, purchase) => total + purchase.quantity, 0),
        actualCost: actualPurchases.reduce((total, purchase) => total + purchase.totalCost, 0),
      };
    });
  }, [comparisonBudget, purchases]);

  const resetPlanForm = () => setPlanForm({ name: '', description: '', periodType: 'Annual', academicYearId: currentAcademicYear, termId: currentTerm });

  const handleCreateBudget = async () => {
    const academicYear = academicYears.find(year => year.id === planForm.academicYearId);
    const term = availableTerms.find(entry => entry.id === planForm.termId)
      || academicYear?.terms?.find(entry => entry.id === planForm.termId);
    if (!planForm.name.trim()) {
      toast({ title: 'Budget name required', description: 'Give this complete school expenditure plan a clear name.', variant: 'destructive' });
      return;
    }
    if (!academicYear) {
      toast({ title: 'Academic year required', description: 'Choose the academic year covered by this budget.', variant: 'destructive' });
      return;
    }
    if (planForm.periodType === 'Term' && !term) {
      toast({ title: 'Term required', description: 'Choose the term covered by this budget.', variant: 'destructive' });
      return;
    }
    const data: CreateProcurementBudgetData = {
      name: planForm.name.trim(),
      ...(planForm.description.trim() ? { description: planForm.description.trim() } : {}),
      periodType: planForm.periodType,
      academicYearId: academicYear.id,
      ...(planForm.periodType === 'Term' ? { termId: term!.id } : {}),
      startDate: planForm.periodType === 'Term' ? term!.startDate : academicYear.startDate,
      endDate: planForm.periodType === 'Term' ? term!.endDate : academicYear.endDate,
      budgetItems: [],
      status: 'Draft',
      ...(user ? { createdBy: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username } : {}),
    };
    try {
      setSaving(true);
      const id = await ProcurementService.createBudget(data, academicYear, term);
      await onBudgetsChanged();
      setSelectedBudgetId(id);
      setIsCreateOpen(false);
      resetPlanForm();
      toast({ title: 'Budget created', description: 'The school expenditure plan is ready. You can now add all expected items.' });
    } catch (error) {
      console.error('Unable to create Procurement budget:', error);
      toast({ title: 'Budget not saved', description: error instanceof Error ? error.message : 'Check the budget details and try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openAddLine = () => {
    setEditingLine(null);
    setLineForm(emptyLine);
    setIsLineOpen(true);
  };

  const openEditLine = (line: BudgetItem) => {
    setEditingLine(line);
    setLineForm({
      itemId: line.itemId,
      quantity: String(line.estimatedQuantity),
      estimatedUnitPrice: line.costEstimated && typeof line.estimatedUnitPrice === 'number' ? String(line.estimatedUnitPrice) : '',
      priority: line.priority || 'Medium',
      notes: line.notes || '',
    });
    setIsLineOpen(true);
  };

  const handleSaveLine = async () => {
    if (!selectedBudget) return;
    const item = activeItems.find(entry => entry.id === lineForm.itemId);
    const quantity = Number(lineForm.quantity);
    const price = lineForm.estimatedUnitPrice.trim() ? Number(lineForm.estimatedUnitPrice) : undefined;
    if (!item) {
      toast({ title: 'Choose an item', description: 'Select the expected expenditure item.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ title: 'Quantity required', description: 'Enter a quantity greater than zero.', variant: 'destructive' });
      return;
    }
    if (price !== undefined && (!Number.isFinite(price) || price <= 0)) {
      toast({ title: 'Check estimated price', description: 'Leave the amount blank or enter an amount greater than zero.', variant: 'destructive' });
      return;
    }
    if (!editingLine && selectedBudget.budgetItems.some(line => line.itemId === item.id)) {
      toast({ title: 'Item already listed', description: 'Edit the existing line instead of adding the same item twice.', variant: 'destructive' });
      return;
    }
    const line = buildBudgetLine({ id: editingLine?.id || budgetLineId(), item, quantity, estimatedUnitPrice: price, notes: lineForm.notes, priority: lineForm.priority });
    try {
      setSaving(true);
      await ProcurementService.updateBudget(selectedBudget.id, { budgetItems: replaceBudgetLine(selectedBudget.budgetItems, line) });
      await onBudgetsChanged();
      setIsLineOpen(false);
      setEditingLine(null);
      setLineForm(emptyLine);
      toast({ title: editingLine ? 'Budget item updated' : 'Budget item added', description: `${item.name} is now part of the complete school budget.` });
    } catch (error) {
      console.error('Unable to save budget item:', error);
      toast({ title: 'Item not saved', description: 'The budget was not changed. Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const removeLine = async (lineId: string) => {
    if (!selectedBudget) return;
    try {
      setSaving(true);
      await ProcurementService.updateBudget(selectedBudget.id, { budgetItems: selectedBudget.budgetItems.filter(line => line.id !== lineId) });
      await onBudgetsChanged();
      toast({ title: 'Budget item removed' });
    } catch (error) {
      console.error('Unable to remove budget item:', error);
      toast({ title: 'Item not removed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteBudget = async (budgetId: string) => {
    try {
      setSaving(true);
      await ProcurementService.deleteBudget(budgetId);
      setSelectedBudgetId(null);
      await onBudgetsChanged();
      toast({ title: 'Budget deleted' });
    } catch (error) {
      console.error('Unable to delete Procurement budget:', error);
      toast({ title: 'Budget not deleted', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (selectedBudget) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Button type="button" variant="ghost" className="mb-2 min-h-11 px-2" onClick={() => setSelectedBudgetId(null)}><ArrowLeft className="mr-2 h-4 w-4" />All budgets</Button>
            <h2 className="text-xl font-bold text-slate-950">{selectedBudget.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{selectedBudget.description || 'Complete estimated school expenditure plan'}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700"><Badge variant="outline">{selectedBudget.academicYearName || selectedBudget.academicYearId}</Badge><Badge variant="outline">{selectedBudget.periodType === 'Term' ? selectedBudget.termName || 'Term budget' : 'Annual budget'}</Badge><Badge variant="secondary">{selectedBudget.status}</Badge></div>
          </div>
          {canEdit && <Button type="button" className="min-h-11" onClick={openAddLine}><ListPlus className="mr-2 h-4 w-4" />Add item</Button>}
        </div>

        <div className="grid gap-3 sm:grid-cols-3"><SummaryCard label="Items planned" value={String(selectedBudget.budgetItems.length)} /><SummaryCard label="Estimated total" value={formatCurrency(calculateBudgetTotal(selectedBudget.budgetItems))} /><SummaryCard label="Period" value={`${formatDate(selectedBudget.startDate)} – ${formatDate(selectedBudget.endDate)}`} /></div>

        {selectedBudget.budgetItems.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center"><WalletCards className="mx-auto h-8 w-8 text-slate-400" /><h3 className="mt-3 font-semibold">This budget has no items yet</h3><p className="mt-1 text-sm text-slate-600">Add every expected school expenditure. Amounts can be left blank until quotations are available.</p>{canEdit && <Button type="button" className="mt-4 min-h-11" onClick={openAddLine}><Plus className="mr-2 h-4 w-4" />Add first item</Button>}</div>
        ) : <BudgetLines items={selectedBudget.budgetItems} canEdit={canEdit} saving={saving} onEdit={openEditLine} onRemove={removeLine} />}

        <Dialog open={isLineOpen} onOpenChange={open => { setIsLineOpen(open); if (!open) setEditingLine(null); }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader><DialogTitle>{editingLine ? 'Edit budget item' : 'Add item to budget'}</DialogTitle><DialogDescription>The amount is optional. You can save the item and quantity now, then add the estimate later.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label htmlFor="budget-item">Item</Label><Select value={lineForm.itemId} onValueChange={itemId => setLineForm(previous => ({ ...previous, itemId }))} disabled={Boolean(editingLine)}><SelectTrigger id="budget-item" className="min-h-11"><SelectValue placeholder="Choose an item" /></SelectTrigger><SelectContent>{activeItems.map(item => <SelectItem key={item.id} value={item.id}>{item.name} ({item.unit})</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="budget-quantity">Quantity</Label><Input id="budget-quantity" className="min-h-11" inputMode="decimal" type="number" min="0.01" step="any" value={lineForm.quantity} onChange={event => setLineForm(previous => ({ ...previous, quantity: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="budget-price">Estimated price per unit <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="budget-price" className="min-h-11" inputMode="numeric" type="number" min="1" value={lineForm.estimatedUnitPrice} onChange={event => setLineForm(previous => ({ ...previous, estimatedUnitPrice: event.target.value }))} placeholder="Leave blank if unknown" /></div></div>
              <div className="space-y-2"><Label htmlFor="budget-priority">Priority</Label><Select value={lineForm.priority} onValueChange={value => setLineForm(previous => ({ ...previous, priority: value as BudgetItem['priority'] }))}><SelectTrigger id="budget-priority" className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{['Low', 'Medium', 'High', 'Critical'].map(priority => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="budget-line-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="budget-line-notes" value={lineForm.notes} onChange={event => setLineForm(previous => ({ ...previous, notes: event.target.value }))} /></div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="min-h-11" onClick={() => setIsLineOpen(false)}>Cancel</Button><Button type="button" className="min-h-11" disabled={saving} onClick={handleSaveLine}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingLine ? 'Save changes' : 'Add to budget'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-bold text-slate-950 sm:text-2xl">School Budget Management</h2><p className="mt-1 text-sm text-slate-600">Each budget is one complete school expenditure plan containing a list of expected items.</p></div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto min-h-11 w-full justify-start overflow-x-auto sm:w-auto"><TabsTrigger value="budgets" className="min-h-10">Budget plans</TabsTrigger><TabsTrigger value="comparison" className="min-h-10">Budget vs actual</TabsTrigger></TabsList>
        <TabsContent value="budgets" className="space-y-4">
          <div className="flex justify-end">{canCreate && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild><Button className="min-h-11"><Plus className="mr-2 h-4 w-4" />Create school budget</Button></DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader><DialogTitle>Create a school budget</DialogTitle><DialogDescription>Create the complete expenditure plan first. After saving it, add all expected items to its list.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="budget-name">Budget name</Label><Input id="budget-name" className="min-h-11" value={planForm.name} onChange={event => setPlanForm(previous => ({ ...previous, name: event.target.value }))} placeholder="For example: 2026 Annual School Budget" /></div>
                  <div className="space-y-2"><Label htmlFor="budget-description">Description <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="budget-description" value={planForm.description} onChange={event => setPlanForm(previous => ({ ...previous, description: event.target.value }))} /></div>
                  <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="budget-period">Budget period</Label><Select value={planForm.periodType} onValueChange={(periodType: BudgetPeriodType) => setPlanForm(previous => ({ ...previous, periodType }))}><SelectTrigger id="budget-period" className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Annual">Full academic year</SelectItem><SelectItem value="Term">One term</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="budget-year">Academic year</Label><Select value={planForm.academicYearId} onValueChange={academicYearId => setPlanForm(previous => ({ ...previous, academicYearId, termId: '' }))}><SelectTrigger id="budget-year" className="min-h-11"><SelectValue placeholder="Choose year" /></SelectTrigger><SelectContent>{academicYears.map(year => <SelectItem key={year.id} value={year.id}>{year.name}</SelectItem>)}</SelectContent></Select></div></div>
                  {planForm.periodType === 'Term' && <div className="space-y-2"><Label htmlFor="budget-term">Term</Label><Select value={planForm.termId} onValueChange={termId => setPlanForm(previous => ({ ...previous, termId }))}><SelectTrigger id="budget-term" className="min-h-11"><SelectValue placeholder="Choose term" /></SelectTrigger><SelectContent>{(academicYears.find(year => year.id === planForm.academicYearId)?.terms || availableTerms).map(term => <SelectItem key={term.id} value={term.id}>{term.name}</SelectItem>)}</SelectContent></Select></div>}
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="min-h-11" onClick={() => setIsCreateOpen(false)}>Cancel</Button><Button type="button" className="min-h-11" disabled={saving} onClick={handleCreateBudget}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create budget</Button></div>
              </DialogContent>
            </Dialog>
          )}</div>
          {budgets.length === 0 ? <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center"><WalletCards className="mx-auto h-8 w-8 text-slate-400" /><h3 className="mt-3 font-semibold">No school budgets yet</h3><p className="mt-1 text-sm text-slate-600">Create a plan, then build its complete list of expected expenditure.</p></div> : (
            <div className="grid gap-4 lg:grid-cols-2">{budgets.map(budget => <BudgetCard key={budget.id} budget={budget} canEdit={canEdit} onView={() => setSelectedBudgetId(budget.id)} onAdd={() => { setSelectedBudgetId(budget.id); setEditingLine(null); setLineForm(emptyLine); setIsLineOpen(true); }} onDelete={() => deleteBudget(budget.id)} />)}</div>
          )}
        </TabsContent>
        <TabsContent value="comparison" className="space-y-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="h-5 w-5" />Budget vs actual expenditure</CardTitle><CardDescription>Select one complete budget to compare its item list with purchases made during its dates.</CardDescription></CardHeader><CardContent><Label htmlFor="comparison-budget">Budget plan</Label><Select value={comparisonBudgetId} onValueChange={setComparisonBudgetId}><SelectTrigger id="comparison-budget" className="mt-2 min-h-11 w-full sm:max-w-md"><SelectValue placeholder="Choose a budget" /></SelectTrigger><SelectContent>{budgets.map(budget => <SelectItem key={budget.id} value={budget.id}>{budget.name}</SelectItem>)}</SelectContent></Select></CardContent></Card>
          {comparisonBudget && <ComparisonTable rows={comparisonRows} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-white p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>;
}

function BudgetCard({ budget, canEdit, onView, onAdd, onDelete }: { budget: ProcurementBudget; canEdit: boolean; onView: () => void; onAdd: () => void; onDelete: () => void }) {
  return <Card className="overflow-hidden"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="truncate text-lg">{budget.name}</CardTitle><CardDescription className="mt-1 line-clamp-2">{budget.description || 'Complete school expenditure plan'}</CardDescription></div><Badge variant="secondary">{budget.status}</Badge></div></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-muted-foreground">Items</span><p className="font-semibold">{budget.budgetItems.length}</p></div><div><span className="text-muted-foreground">Estimated total</span><p className="font-semibold">{formatCurrency(calculateBudgetTotal(budget.budgetItems))}</p></div></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarRange className="h-4 w-4" />{formatDate(budget.startDate)} – {formatDate(budget.endDate)}</div><div className="flex flex-wrap gap-2"><Button type="button" className="min-h-11 flex-1" onClick={onView}>View budget</Button>{canEdit && <Button type="button" variant="outline" className="min-h-11" onClick={onAdd}><Plus className="mr-2 h-4 w-4" />Add item</Button>}{canEdit && <AlertDialog><AlertDialogTrigger asChild><Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11 text-destructive" aria-label={`Delete ${budget.name}`}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this entire budget?</AlertDialogTitle><AlertDialogDescription>This removes the plan and every item in it. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep budget</AlertDialogCancel><AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete budget</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div></CardContent></Card>;
}

function BudgetLines({ items, canEdit, saving, onEdit, onRemove }: { items: BudgetItem[]; canEdit: boolean; saving: boolean; onEdit: (line: BudgetItem) => void; onRemove: (id: string) => void }) {
  return <Card><CardHeader><CardTitle className="text-lg">Complete expenditure list</CardTitle><CardDescription>Items without an estimated amount remain valid and can be priced later.</CardDescription></CardHeader><CardContent><div className="space-y-3 md:hidden">{items.map(line => <div key={line.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{line.itemName}</p><p className="text-sm text-muted-foreground">{line.estimatedQuantity} {line.itemUnit || 'units'} · {line.priority || 'Medium'} priority</p></div><p className="text-sm font-semibold">{line.costEstimated ? formatCurrency(line.estimatedTotalCost) : 'Amount pending'}</p></div>{line.notes && <p className="mt-2 text-sm text-slate-600">{line.notes}</p>}{canEdit && <LineActions line={line} saving={saving} onEdit={onEdit} onRemove={onRemove} />}</div>)}</div><div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Quantity</TableHead><TableHead>Estimated unit price</TableHead><TableHead>Estimated total</TableHead><TableHead>Priority</TableHead>{canEdit && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader><TableBody>{items.map(line => <TableRow key={line.id}><TableCell><p className="font-medium">{line.itemName}</p>{line.notes && <p className="max-w-xs truncate text-xs text-muted-foreground">{line.notes}</p>}</TableCell><TableCell>{line.estimatedQuantity} {line.itemUnit || 'units'}</TableCell><TableCell>{line.costEstimated && typeof line.estimatedUnitPrice === 'number' ? formatCurrency(line.estimatedUnitPrice) : 'Not entered'}</TableCell><TableCell className="font-medium">{line.costEstimated ? formatCurrency(line.estimatedTotalCost) : 'Pending'}</TableCell><TableCell><Badge variant="outline">{line.priority || 'Medium'}</Badge></TableCell>{canEdit && <TableCell><LineActions line={line} saving={saving} onEdit={onEdit} onRemove={onRemove} /></TableCell>}</TableRow>)}</TableBody></Table></div></CardContent></Card>;
}

function LineActions({ line, saving, onEdit, onRemove }: { line: BudgetItem; saving: boolean; onEdit: (line: BudgetItem) => void; onRemove: (id: string) => void }) {
  return <div className="mt-2 flex justify-end gap-2"><Button type="button" variant="outline" size="sm" className="min-h-11" disabled={saving} onClick={() => onEdit(line)}><Edit className="mr-2 h-4 w-4" />Edit</Button><AlertDialog><AlertDialogTrigger asChild><Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11 text-destructive" disabled={saving} aria-label={`Remove ${line.itemName}`}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove this budget item?</AlertDialogTitle><AlertDialogDescription>The rest of the school budget will remain unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onRemove(line.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove item</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>;
}

function ComparisonTable({ rows }: { rows: Array<{ line: BudgetItem; actualQuantity: number; actualCost: number }> }) {
  return <Card><CardHeader><CardTitle className="text-lg">Item comparison</CardTitle></CardHeader><CardContent>{rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">This budget has no items to compare yet.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Budgeted</TableHead><TableHead>Purchased</TableHead><TableHead>Difference</TableHead></TableRow></TableHeader><TableBody>{rows.map(({ line, actualQuantity, actualCost }) => <TableRow key={line.id}><TableCell className="font-medium">{line.itemName}</TableCell><TableCell><p>{line.estimatedQuantity} {line.itemUnit || 'units'}</p><p className="text-xs text-muted-foreground">{line.costEstimated ? formatCurrency(line.estimatedTotalCost) : 'Amount not estimated'}</p></TableCell><TableCell><p>{actualQuantity} {line.itemUnit || 'units'}</p><p className="text-xs text-muted-foreground">{formatCurrency(actualCost)}</p></TableCell><TableCell>{line.costEstimated ? formatCurrency(actualCost - line.estimatedTotalCost) : 'Estimate pending'}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>;
}
