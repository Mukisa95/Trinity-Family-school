'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Search, Filter, Calendar, Receipt, List, Layers, MoreVertical, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { ProcurementService } from '@/lib/services/procurement.service';
import { DigitalSignature } from './DigitalSignature';
import type { 
  ProcurementPurchase, 
  ProcurementItem, 
  PaymentMethod,
  ViewPeriodType,
  CreateProcurementPurchaseData,
  AcademicYear,
  Term,
  SystemUser
} from '@/types';

interface PurchaseManagementProps {
  purchases: ProcurementPurchase[];
  setPurchases: (purchases: ProcurementPurchase[]) => void;
  items: ProcurementItem[];
  viewPeriod: ViewPeriodType;
  currentAcademicYear: string;
  currentTerm: string;
  purchaseViewMode: 'list' | 'stacked';
  setPurchaseViewMode: (mode: 'list' | 'stacked') => void;
  academicYears: AcademicYear[];
  availableTerms: Term[];
  currentWeek: number;
  currentMonth: number;
}

interface StackedPurchaseItem {
  itemId: string;
  itemName: string;
  itemCategory: string;
  purchases: ProcurementPurchase[];
  totalQuantity: number;
  totalCost: number;
  averageUnitCost: number;
  purchaseCount: number;
}

export function PurchaseManagement({ 
  purchases, 
  setPurchases, 
  items, 
  viewPeriod,
  currentAcademicYear,
  currentTerm,
  purchaseViewMode,
  setPurchaseViewMode,
  academicYears,
  availableTerms,
  currentWeek,
  currentMonth
}: PurchaseManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<ProcurementPurchase | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [itemFilter, setItemFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // Digital signature state
  const [authenticatedUser, setAuthenticatedUser] = useState<SystemUser | null>(null);
  const [showDigitalSignature, setShowDigitalSignature] = useState(false);
  const [editAuthenticatedUser, setEditAuthenticatedUser] = useState<SystemUser | null>(null);
  const [showEditDigitalSignature, setShowEditDigitalSignature] = useState(false);

  // Get the real academic year and term objects from the props
  const academicYear = academicYears.find(year => year.id === currentAcademicYear) || {
    id: currentAcademicYear,
    name: currentAcademicYear,
    startDate: `${currentAcademicYear}-01-01`,
    endDate: `${currentAcademicYear}-12-31`,
    terms: [],
    isActive: false,
    isLocked: false
  };

  const term = availableTerms.find(t => t.id === currentTerm) || {
    id: currentTerm,
    name: currentTerm,
    startDate: `${currentAcademicYear}-01-01`,
    endDate: `${currentAcademicYear}-04-30`,
    isCurrent: false
  };

  // Helper function to get period description
  const getPeriodDescription = (): string => {
    const selectedYear = academicYears.find(year => year.id === currentAcademicYear);
    const yearName = selectedYear?.name || currentAcademicYear;
    
    switch (viewPeriod) {
      case 'Year':
        return `Purchase records for ${yearName}`;
      case 'Term':
        const selectedTerm = availableTerms.find(t => t.id === currentTerm);
        return `Purchase records for ${yearName} - ${selectedTerm?.name || currentTerm}`;
      case 'Month':
        const monthName = new Date(parseInt(yearName), currentMonth - 1, 1).toLocaleDateString('en-US', {month: 'long'});
        return `Purchase records for ${monthName} ${yearName}`;
      case 'Week':
        return `Purchase records for Week ${currentWeek} of ${yearName}`;
      default:
        return `Purchase records for ${yearName} - ${term.name}`;
    }
  };

  // Form state - updated to remove procuredBy field
  const [formData, setFormData] = useState<Omit<CreateProcurementPurchaseData, 'procuredBy'> & { procuredBy?: string }>({
    itemId: '',
    quantity: 0,
    unitCost: 0,
    supplierName: '',
    supplierContact: '',
    paymentMethod: 'Cash',
    purchaseDate: new Date().toISOString().split('T')[0], // Always current date
    invoiceNumber: '',
    receiptNumber: '',
    notes: '',
    academicYearId: currentAcademicYear,
    termId: currentTerm
  });

  const paymentMethods: PaymentMethod[] = [
    'Cash', 'Bank Transfer', 'Mobile Money', 'Cheque', 'Credit Card', 'Other'
  ];

  const categories = ['Foodstuff', 'Class Utility', 'Office Utility', 'Tools', 'Equipment', 'Other'];
  const activeItems = items.filter(item => item.isActive);

  // Filter purchases based on search and category filters (time filtering is now handled by parent)
  const filteredPurchases = purchases.filter(purchase => {
    const matchesSearch = purchase.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         purchase.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         purchase.procuredBy.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || purchase.itemCategory === categoryFilter;
    const matchesItem = itemFilter === 'all' || purchase.itemId === itemFilter;

    return matchesSearch && matchesCategory && matchesItem;
  });

  // Create stacked view data
  const stackedPurchases: StackedPurchaseItem[] = React.useMemo(() => {
    const grouped = filteredPurchases.reduce((acc, purchase) => {
      if (!acc[purchase.itemId]) {
        acc[purchase.itemId] = {
          itemId: purchase.itemId,
          itemName: purchase.itemName || 'Unknown Item',
          itemCategory: purchase.itemCategory || 'Other',
          purchases: [],
          totalQuantity: 0,
          totalCost: 0,
          averageUnitCost: 0,
          purchaseCount: 0
        };
      }
      
      acc[purchase.itemId].purchases.push(purchase);
      acc[purchase.itemId].totalQuantity += purchase.quantity;
      acc[purchase.itemId].totalCost += purchase.totalCost;
      acc[purchase.itemId].purchaseCount++;
      
      return acc;
    }, {} as Record<string, StackedPurchaseItem>);

    // Calculate average unit cost
    Object.values(grouped).forEach(item => {
      item.averageUnitCost = item.totalQuantity > 0 ? item.totalCost / item.totalQuantity : 0;
      // Sort purchases by date descending
      item.purchases.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
    });

    return Object.values(grouped).sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [filteredPurchases]);

  const resetForm = () => {
    setFormData({
      itemId: '',
      quantity: 0,
      unitCost: 0,
      supplierName: '',
      supplierContact: '',
      paymentMethod: 'Cash',
      purchaseDate: new Date().toISOString().split('T')[0], // Always current date
      invoiceNumber: '',
      receiptNumber: '',
      notes: '',
      academicYearId: currentAcademicYear,
      termId: currentTerm
    });
    setAuthenticatedUser(null);
    setShowDigitalSignature(false);
  };

  // Handle digital signature completion for new purchases
  const handleDigitalSignatureComplete = (user: SystemUser) => {
    setAuthenticatedUser(user);
    setShowDigitalSignature(false);
    setFormData(prev => ({
      ...prev,
      procuredBy: `${user.firstName} ${user.lastName}` // Set the full name
    }));
  };

  // Handle digital signature completion for editing purchases
  const handleEditDigitalSignatureComplete = (user: SystemUser) => {
    setEditAuthenticatedUser(user);
    setShowEditDigitalSignature(false);
    setFormData(prev => ({
      ...prev,
      procuredBy: `${user.firstName} ${user.lastName}` // Set the full name
    }));
  };

  const handleAdd = async () => {
    if (!authenticatedUser) {
      toast({
        title: "Authentication Required",
        description: "Please authenticate with your credentials before recording the purchase.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Create purchase data with authenticated user info
      const purchaseData: CreateProcurementPurchaseData = {
        ...formData,
        procuredBy: `${authenticatedUser.firstName} ${authenticatedUser.lastName}`,
        procuredByUserId: authenticatedUser.id, // Store user ID for audit trail
        procuredByUsername: `${authenticatedUser.firstName} ${authenticatedUser.lastName}`.trim() || authenticatedUser.username
      };

      const id = await ProcurementService.createPurchase(purchaseData, academicYear, term);
      
      // Find the item details
      const item = items.find(i => i.id === formData.itemId);
      
      const newPurchase: ProcurementPurchase = {
        id,
        ...purchaseData,
        itemName: item?.name || 'Unknown Item',
        itemCategory: item?.category || 'Other',
        totalCost: formData.quantity * formData.unitCost,
        academicYearName: academicYear.name,
        termName: term.name,
        weekNumber: 1, // This would be calculated properly
        monthNumber: new Date().getMonth() + 1,
        createdAt: new Date().toISOString(),
      };

      setPurchases([...purchases, newPurchase]);
      setIsAddDialogOpen(false);
      resetForm();
      
      toast({
        title: "Success",
        description: `Purchase recorded successfully. Authenticated by ${authenticatedUser.firstName} ${authenticatedUser.lastName}.`,
      });
    } catch (error) {
      console.error('Error creating purchase:', error);
      toast({
        title: "Error",
        description: "Failed to record purchase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedPurchase) return;

    // Check if user re-authenticated for editing
    if (!editAuthenticatedUser) {
      toast({
        title: "Authentication Required",
        description: "Please re-authenticate to modify this purchase record.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Create update data with authenticated user info
      const updateData: Partial<CreateProcurementPurchaseData> & { 
        procuredBy: string; 
        modifiedBy?: string; 
        modifiedByUserId?: string; 
        modifiedByUsername?: string; 
      } = {
        ...formData,
        procuredBy: formData.procuredBy || `${editAuthenticatedUser.firstName} ${editAuthenticatedUser.lastName}`,
        modifiedBy: `${editAuthenticatedUser.firstName} ${editAuthenticatedUser.lastName}`,
        modifiedByUserId: editAuthenticatedUser.id,
        modifiedByUsername: `${editAuthenticatedUser.firstName} ${editAuthenticatedUser.lastName}`.trim() || editAuthenticatedUser.username
      };

      await ProcurementService.updatePurchase(selectedPurchase.id, updateData);
      
      const updatedPurchases = purchases.map(purchase =>
        purchase.id === selectedPurchase.id
          ? { 
              ...purchase, 
              ...updateData, 
              totalCost: formData.quantity * formData.unitCost,
              updatedAt: new Date().toISOString() 
            }
          : purchase
      );
      
      setPurchases(updatedPurchases);
      setIsEditDialogOpen(false);
      setSelectedPurchase(null);
      setEditAuthenticatedUser(null);
      setShowEditDigitalSignature(false);
      resetForm();
      
      toast({
        title: "Success",
        description: `Purchase updated successfully. Modified by ${editAuthenticatedUser.firstName} ${editAuthenticatedUser.lastName}.`,
      });
    } catch (error) {
      console.error('Error updating purchase:', error);
      toast({
        title: "Error",
        description: "Failed to update purchase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (purchaseId: string) => {
    try {
      setLoading(true);
      await ProcurementService.deletePurchase(purchaseId);
      setPurchases(purchases.filter(purchase => purchase.id !== purchaseId));
      
      toast({
        title: "Success",
        description: "Purchase deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting purchase:', error);
      toast({
        title: "Error",
        description: "Failed to delete purchase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (purchase: ProcurementPurchase) => {
    setSelectedPurchase(purchase);
    setFormData({
      itemId: purchase.itemId,
      quantity: purchase.quantity,
      unitCost: purchase.unitCost,
      supplierName: purchase.supplierName || '',
      supplierContact: purchase.supplierContact || '',
      paymentMethod: purchase.paymentMethod,
      procuredBy: purchase.procuredBy,
      purchaseDate: purchase.purchaseDate,
      invoiceNumber: purchase.invoiceNumber || '',
      receiptNumber: purchase.receiptNumber || '',
      notes: purchase.notes || '',
      academicYearId: purchase.academicYearId,
      termId: purchase.termId
    });
    setEditAuthenticatedUser(null);
    setShowEditDigitalSignature(false);
    setIsEditDialogOpen(true);
  };

  const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Purchase Management</h2>
          <p className="text-gray-600">
            {getPeriodDescription()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <ToggleGroup type="single" value={purchaseViewMode} onValueChange={(value) => setPurchaseViewMode(value as 'list' | 'stacked')}>
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="w-4 h-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="stacked" aria-label="Stacked view">
              <Layers className="w-4 h-4" />
            </ToggleGroupItem>
          </ToggleGroup>

          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Add Purchase
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record New Purchase</DialogTitle>
                <DialogDescription>
                  Add a new procurement purchase for {getPeriodDescription().replace('Purchase records for ', '')}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Digital Signature Section */}
                <div className="border-2 border-dashed border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <h4 className="font-medium text-blue-800">Staff Authentication</h4>
                  </div>
                  
                  {!authenticatedUser ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        Staff authentication is required to record purchases. Click below to authenticate.
                      </p>
                      <Button 
                        onClick={() => setShowDigitalSignature(true)}
                        variant="outline"
                        className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Authenticate Staff Member
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <Shield className="w-5 h-5 text-green-600" />
                        <div className="flex-1">
                          <div className="font-medium text-green-800">
                            {authenticatedUser.firstName} {authenticatedUser.lastName}
                          </div>
                          <div className="text-sm text-green-600">
                            {authenticatedUser.username} • {authenticatedUser.role}
                          </div>
                        </div>
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          Authenticated
                        </Badge>
                      </div>
                      <Button 
                        onClick={() => {
                          setAuthenticatedUser(null);
                          setFormData(prev => ({ ...prev, procuredBy: undefined }));
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        Change Authentication
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Purchase Details Form */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="itemId">Select Item *</Label>
                    <Select value={formData.itemId} onValueChange={(value) => setFormData({ ...formData, itemId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an item" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeItems.map(item => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} ({item.category})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="quantity">Quantity *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="unitCost">Unit Cost (UGX) *</Label>
                      <Input
                        id="unitCost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.unitCost}
                        onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="supplierName">Supplier Name</Label>
                      <Input
                        id="supplierName"
                        value={formData.supplierName}
                        onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                        placeholder="Supplier name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="supplierContact">Supplier Contact</Label>
                      <Input
                        id="supplierContact"
                        value={formData.supplierContact}
                        onChange={(e) => setFormData({ ...formData, supplierContact: e.target.value })}
                        placeholder="Phone/Email"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="paymentMethod">Payment Method *</Label>
                      <Select value={formData.paymentMethod} onValueChange={(value: PaymentMethod) => setFormData({ ...formData, paymentMethod: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentMethods.map(method => (
                            <SelectItem key={method} value={method}>{method}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Academic Year and Term Info - Non-editable */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Academic Year</Label>
                      <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm font-medium text-blue-700">
                        {academicYear.name}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Auto-detected</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Term</Label>
                      <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm font-medium text-blue-700">
                        {term.name}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Auto-detected</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Purchase Date</Label>
                      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                        {new Date(formData.purchaseDate).toLocaleDateString()}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Today's date (non-editable)</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="invoiceNumber">Invoice Number</Label>
                      <Input
                        id="invoiceNumber"
                        value={formData.invoiceNumber}
                        onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                        placeholder="Invoice #"
                      />
                    </div>
                    <div>
                      <Label htmlFor="receiptNumber">Receipt Number</Label>
                      <Input
                        id="receiptNumber"
                        value={formData.receiptNumber}
                        onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })}
                        placeholder="Receipt #"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Total Cost</Label>
                      <div className="px-3 py-2 bg-gray-50 rounded-md text-sm font-bold text-green-600">
                        {formatCurrency(formData.quantity * formData.unitCost)}
                      </div>
                    </div>
                    <div></div>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAdd} 
                  disabled={loading || !formData.itemId || !formData.quantity || !formData.unitCost || !authenticatedUser}
                >
                  {loading ? 'Recording...' : 'Record Purchase'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Digital Signature Dialog for Add */}
      <Dialog open={showDigitalSignature} onOpenChange={setShowDigitalSignature}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Staff Authentication</DialogTitle>
            <DialogDescription>
              Verify your identity to record this purchase
            </DialogDescription>
          </DialogHeader>
          
          <DigitalSignature
            onSignatureComplete={handleDigitalSignatureComplete}
            onCancel={() => setShowDigitalSignature(false)}
            disabled={loading}
          />
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search purchases..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={itemFilter} onValueChange={setItemFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                {activeItems.map(item => (
                  <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Purchases Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {purchaseViewMode === 'stacked' ? 'Stacked Purchase Records' : 'Purchase Records'} 
              ({purchaseViewMode === 'stacked' ? stackedPurchases.length : filteredPurchases.length})
            </span>
            <Badge variant="outline">
              {purchaseViewMode === 'stacked' ? 'Stacked View' : 'List View'}
            </Badge>
          </CardTitle>
          <CardDescription>
            {getPeriodDescription()}
            {purchaseViewMode === 'stacked' && ' (grouped by item)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {purchaseViewMode === 'list' ? (
            // List View
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Procured By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell>{new Date(purchase.purchaseDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="font-medium">{purchase.itemName}</div>
                      <Badge variant="outline" className="text-xs">{purchase.itemCategory}</Badge>
                    </TableCell>
                    <TableCell>{purchase.quantity}</TableCell>
                    <TableCell>{formatCurrency(purchase.unitCost)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(purchase.totalCost)}</TableCell>
                    <TableCell>{purchase.supplierName || '-'}</TableCell>
                    <TableCell>{purchase.procuredBy}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => openEditDialog(purchase)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(purchase.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPurchases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No purchases found for the selected period and filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            // Stacked View
            <div className="space-y-4">
              {stackedPurchases.map((stackedItem) => (
                <div key={stackedItem.itemId} className="border rounded-lg">
                  {/* Item Header */}
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="font-medium text-lg">{stackedItem.itemName}</div>
                        <Badge variant="outline">{stackedItem.itemCategory}</Badge>
                      </div>
                      <div className="text-sm text-gray-600 grid grid-cols-4 gap-6 text-right">
                        <div>
                          <div className="font-medium">{stackedItem.purchaseCount}</div>
                          <div className="text-xs">Purchases</div>
                        </div>
                        <div>
                          <div className="font-medium">{stackedItem.totalQuantity.toLocaleString()}</div>
                          <div className="text-xs">Total Qty</div>
                        </div>
                        <div>
                          <div className="font-medium">{formatCurrency(stackedItem.averageUnitCost)}</div>
                          <div className="text-xs">Avg Unit Cost</div>
                        </div>
                        <div>
                          <div className="font-medium text-lg">{formatCurrency(stackedItem.totalCost)}</div>
                          <div className="text-xs">Total Cost</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Purchase Details */}
                  <div className="divide-y">
                    {stackedItem.purchases.map((purchase, index) => (
                      <div key={purchase.id} className="px-4 py-3 flex items-center">
                        {/* Tree line visual */}
                        <div className="w-8 flex justify-center">
                          <div className="relative">
                            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-px bg-gray-300 h-full"></div>
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-gray-300 rounded-full"></div>
                            {index === stackedItem.purchases.length - 1 && (
                              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 w-px bg-white h-1/2"></div>
                            )}
                          </div>
                        </div>
                        
                        {/* Purchase data */}
                        <div className="flex-1 grid grid-cols-6 gap-4 items-center">
                          <div className="text-sm">
                            {new Date(purchase.purchaseDate).toLocaleDateString()}
                          </div>
                          <div className="text-sm">
                            {purchase.quantity.toLocaleString()}
                          </div>
                          <div className="text-sm">
                            {formatCurrency(purchase.unitCost)}
                          </div>
                          <div className="text-sm font-medium">
                            {formatCurrency(purchase.totalCost)}
                          </div>
                          <div className="text-sm">
                            {purchase.supplierName || '-'}
                          </div>
                          <div className="text-sm">
                            {purchase.procuredBy}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="ml-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => openEditDialog(purchase)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(purchase.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {stackedPurchases.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No purchases found for the selected period and filters
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog - Updated with digital signature */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setSelectedPurchase(null);
          setEditAuthenticatedUser(null);
          setShowEditDigitalSignature(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Purchase</DialogTitle>
            <DialogDescription>
              Update purchase details - authentication required for changes
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Digital Signature Section for Edit */}
            <div className="border-2 border-dashed border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-amber-600" />
                <h4 className="font-medium text-amber-800">Re-authentication Required</h4>
              </div>
              
              {!editAuthenticatedUser ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Please re-authenticate to modify this purchase record.
                  </p>
                  <Button 
                    onClick={() => setShowEditDigitalSignature(true)}
                    variant="outline"
                    className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Re-authenticate
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <Shield className="w-5 h-5 text-green-600" />
                    <div className="flex-1">
                      <div className="font-medium text-green-800">
                        {editAuthenticatedUser.firstName} {editAuthenticatedUser.lastName}
                      </div>
                      <div className="text-sm text-green-600">
                        {editAuthenticatedUser.username} • {editAuthenticatedUser.role}
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      Authenticated
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Copy the form fields from add dialog here with edit- prefixes */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-itemId">Select Item *</Label>
                <Select value={formData.itemId} onValueChange={(value) => setFormData({ ...formData, itemId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an item" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-quantity">Quantity *</Label>
                  <Input
                    id="edit-quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-unitCost">Unit Cost (UGX) *</Label>
                  <Input
                    id="edit-unitCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.unitCost}
                    onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-supplierName">Supplier Name</Label>
                  <Input
                    id="edit-supplierName"
                    value={formData.supplierName}
                    onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                    placeholder="Supplier name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-supplierContact">Supplier Contact</Label>
                  <Input
                    id="edit-supplierContact"
                    value={formData.supplierContact}
                    onChange={(e) => setFormData({ ...formData, supplierContact: e.target.value })}
                    placeholder="Phone/Email"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-purchaseDate">Purchase Date *</Label>
                <Input
                  id="edit-purchaseDate"
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                />
              </div>

              <div className="text-sm font-medium">
                Total Cost: {formatCurrency(formData.quantity * formData.unitCost)}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEdit} 
              disabled={loading || !formData.itemId || !formData.quantity || !formData.unitCost || !editAuthenticatedUser}
            >
              {loading ? 'Updating...' : 'Update Purchase'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Digital Signature Dialog for Edit */}
      <Dialog open={showEditDigitalSignature} onOpenChange={setShowEditDigitalSignature}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Re-authenticate</DialogTitle>
            <DialogDescription>
              Verify your identity to modify this purchase record
            </DialogDescription>
          </DialogHeader>
          
          <DigitalSignature
            onSignatureComplete={handleEditDigitalSignatureComplete}
            onCancel={() => setShowEditDigitalSignature(false)}
            disabled={loading}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
} 