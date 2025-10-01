'use client';

import React, { useState } from 'react';
import { Plus, Edit, Trash2, Eye, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { ProcurementService } from '@/lib/services/procurement.service';
import type { ProcurementItem, ProcurementCategory, ProcurementUnit, CreateProcurementItemData } from '@/types';

interface ItemManagementProps {
  items: ProcurementItem[];
  setItems: (items: ProcurementItem[]) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export function ItemManagement({ items, setItems, searchTerm, setSearchTerm }: ItemManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ProcurementItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateProcurementItemData>({
    name: '',
    category: 'Other',
    unit: 'Pieces',
    customUnit: '',
    useCase: '',
    description: '',
    stockTracking: false,
    reorderLevel: 0,
  });

  const categories: ProcurementCategory[] = [
    'Foodstuff', 'Class Utility', 'Office Utility', 'Tools', 
    'Equipment', 'Infrastructure', 'Transport', 'Medical', 'Other'
  ];

  const units: ProcurementUnit[] = [
    'Kg', 'Litres', 'Dozens', 'Pieces', 'Packets', 'Bags', 
    'Boxes', 'Metres', 'Bundles', 'Sets', 'Rolls', 'Bottles', 'Cans', 'Other'
  ];

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.useCase.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && item.isActive) || 
                         (statusFilter === 'inactive' && !item.isActive);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Other',
      unit: 'Pieces',
      customUnit: '',
      useCase: '',
      description: '',
      stockTracking: false,
      reorderLevel: 0,
    });
  };

  const handleAdd = async () => {
    try {
      setLoading(true);
      const id = await ProcurementService.createItem(formData);
      
      const newItem: ProcurementItem = {
        id,
        ...formData,
        isActive: true,
        totalQuantityPurchased: 0,
        totalAmountSpent: 0,
        createdAt: new Date().toISOString(),
      };

      setItems([...items, newItem]);
      setIsAddDialogOpen(false);
      resetForm();
      
      toast({
        title: "Success",
        description: "Item created successfully.",
      });
    } catch (error) {
      console.error('Error creating item:', error);
      toast({
        title: "Error",
        description: "Failed to create item. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedItem) return;

    try {
      setLoading(true);
      await ProcurementService.updateItem(selectedItem.id, formData);
      
      const updatedItems = items.map(item =>
        item.id === selectedItem.id
          ? { ...item, ...formData, updatedAt: new Date().toISOString() }
          : item
      );
      
      setItems(updatedItems);
      setIsEditDialogOpen(false);
      setSelectedItem(null);
      resetForm();
      
      toast({
        title: "Success",
        description: "Item updated successfully.",
      });
    } catch (error) {
      console.error('Error updating item:', error);
      toast({
        title: "Error",
        description: "Failed to update item. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      setLoading(true);
      await ProcurementService.deleteItem(itemId);
      setItems(items.filter(item => item.id !== itemId));
      
      toast({
        title: "Success",
        description: "Item deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Error",
        description: "Failed to delete item. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (itemId: string, isActive: boolean) => {
    try {
      await ProcurementService.updateItem(itemId, { isActive });
      
      const updatedItems = items.map(item =>
        item.id === itemId
          ? { ...item, isActive, updatedAt: new Date().toISOString() }
          : item
      );
      
      setItems(updatedItems);
      
      toast({
        title: "Success",
        description: `Item ${isActive ? 'activated' : 'deactivated'} successfully.`,
      });
    } catch (error) {
      console.error('Error updating item status:', error);
      toast({
        title: "Error",
        description: "Failed to update item status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (item: ProcurementItem) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      unit: item.unit,
      customUnit: item.customUnit || '',
      useCase: item.useCase,
      description: item.description || '',
      stockTracking: item.stockTracking || false,
      reorderLevel: item.reorderLevel || 0,
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Item Management</h2>
          <p className="text-gray-600">Manage your procurement items master list</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Item</DialogTitle>
              <DialogDescription>
                Create a new procurement item for the master list
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Rice, Brooms, A4 Papers"
                />
              </div>

              <div>
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={(value: ProcurementCategory) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="unit">Unit of Measurement *</Label>
                <Select value={formData.unit} onValueChange={(value: ProcurementUnit) => setFormData({ ...formData, unit: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.unit === 'Other' && (
                <div>
                  <Label htmlFor="customUnit">Custom Unit</Label>
                  <Input
                    id="customUnit"
                    value={formData.customUnit}
                    onChange={(e) => setFormData({ ...formData, customUnit: e.target.value })}
                    placeholder="Enter custom unit"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="useCase">Use Case / Purpose *</Label>
                <Input
                  id="useCase"
                  value={formData.useCase}
                  onChange={(e) => setFormData({ ...formData, useCase: e.target.value })}
                  placeholder="e.g., Porridge for P.1, Cleaning, Staff office use"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional details about the item"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="stockTracking"
                  checked={formData.stockTracking}
                  onCheckedChange={(checked) => setFormData({ ...formData, stockTracking: checked })}
                />
                <Label htmlFor="stockTracking">Enable stock tracking</Label>
              </div>

              {formData.stockTracking && (
                <div>
                  <Label htmlFor="reorderLevel">Reorder Level</Label>
                  <Input
                    id="reorderLevel"
                    type="number"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })}
                    placeholder="Minimum stock level"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={loading || !formData.name || !formData.useCase}>
                {loading ? 'Creating...' : 'Create Item'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search items..."
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Items ({filteredItems.length})</CardTitle>
          <CardDescription>
            Manage your procurement items master list
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Use Case</TableHead>
                <TableHead>Total Purchased</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.category}</Badge>
                    </TableCell>
                    <TableCell>{item.customUnit || item.unit}</TableCell>
                    <TableCell className="max-w-48 truncate" title={item.useCase}>
                      {item.useCase}
                    </TableCell>
                    <TableCell>
                      {item.totalQuantityPurchased || 0}
                    </TableCell>
                    <TableCell>
                      UGX {(item.totalAmountSpent || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={item.isActive}
                          onCheckedChange={(checked) => handleToggleStatus(item.id, checked)}
                          size="sm"
                        />
                        <Badge variant={item.isActive ? 'default' : 'secondary'}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(item)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Item</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{item.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(item.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No items found. {searchTerm && "Try adjusting your search terms."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
            <DialogDescription>
              Update item details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Item Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Rice, Brooms, A4 Papers"
              />
            </div>

            <div>
              <Label htmlFor="edit-category">Category *</Label>
              <Select value={formData.category} onValueChange={(value: ProcurementCategory) => setFormData({ ...formData, category: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-unit">Unit of Measurement *</Label>
              <Select value={formData.unit} onValueChange={(value: ProcurementUnit) => setFormData({ ...formData, unit: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map(unit => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.unit === 'Other' && (
              <div>
                <Label htmlFor="edit-customUnit">Custom Unit</Label>
                <Input
                  id="edit-customUnit"
                  value={formData.customUnit}
                  onChange={(e) => setFormData({ ...formData, customUnit: e.target.value })}
                  placeholder="Enter custom unit"
                />
              </div>
            )}

            <div>
              <Label htmlFor="edit-useCase">Use Case / Purpose *</Label>
              <Input
                id="edit-useCase"
                value={formData.useCase}
                onChange={(e) => setFormData({ ...formData, useCase: e.target.value })}
                placeholder="e.g., Porridge for P.1, Cleaning, Staff office use"
              />
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details about the item"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="edit-stockTracking"
                checked={formData.stockTracking}
                onCheckedChange={(checked) => setFormData({ ...formData, stockTracking: checked })}
              />
              <Label htmlFor="edit-stockTracking">Enable stock tracking</Label>
            </div>

            {formData.stockTracking && (
              <div>
                <Label htmlFor="edit-reorderLevel">Reorder Level</Label>
                <Input
                  id="edit-reorderLevel"
                  type="number"
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })}
                  placeholder="Minimum stock level"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={loading || !formData.name || !formData.useCase}>
              {loading ? 'Updating...' : 'Update Item'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 