"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/common/page-header';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  Percent,
  DollarSign,
  Calendar,
  Users,
  BookOpen
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { formatDiscountDisplay } from '@/lib/utils/discount-utils';
import { 
  useAllDynamicDiscounts, 
  useDeleteDynamicDiscount, 
  useToggleDynamicDiscount 
} from '@/lib/hooks/use-dynamic-discounts';
import { useActiveUniforms } from '@/lib/hooks/use-uniforms';
import { useClasses } from '@/lib/hooks/use-classes';
import type { DynamicDiscount } from '@/types';

export default function DiscountsPage() {
  const [selectedDiscount, setSelectedDiscount] = useState<DynamicDiscount | null>(null);

  const { data: discounts = [], isLoading } = useAllDynamicDiscounts();
  const { data: uniforms = [] } = useActiveUniforms();
  const { data: classes = [] } = useClasses();
  const deleteDiscountMutation = useDeleteDynamicDiscount();
  const toggleDiscountMutation = useToggleDynamicDiscount();

  const getUniformNames = (uniformIds?: string | string[]) => {
    if (!uniformIds) return 'All uniforms';
    
    const ids = Array.isArray(uniformIds) ? uniformIds : [uniformIds];
    const names = ids.map(id => uniforms.find(u => u.id === id)?.name || 'Unknown').join(', ');
    return names.length > 50 ? `${names.substring(0, 50)}...` : names;
  };

  const getClassName = (classId?: string) => {
    if (!classId) return 'All classes';
    return classes.find(c => c.id === classId)?.name || 'Unknown class';
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const action = currentStatus ? 'disable' : 'enable';
    const message = currentStatus 
      ? 'Are you sure you want to disable this discount?\n\nThis will:\n• Stop applying to NEW uniform assignments\n• NOT affect existing pupils who already have this discount\n• Can be re-enabled later'
      : 'Are you sure you want to enable this discount?\n\nThis will:\n• Start applying to NEW uniform assignments\n• Only affect future assignments, not past ones';
      
    if (window.confirm(message)) {
      try {
        await toggleDiscountMutation.mutateAsync({ id, isActive: !currentStatus });
        alert(`Discount ${action}d successfully`);
      } catch (error) {
        console.error('Error toggling discount status:', error);
        alert(`Failed to ${action} discount`);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this discount? This action cannot be undone.')) {
      try {
        await deleteDiscountMutation.mutateAsync(id);
        alert('Discount deleted successfully');
      } catch (error) {
        console.error('Error deleting discount:', error);
        alert('Failed to delete discount');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader 
        title="Dynamic Discounts Management"
        actions={
          <Button onClick={() => {/* TODO: Open create modal */}}>
            <Plus className="mr-2 h-4 w-4" />
            Add Dynamic Discount
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Discounts</p>
                <p className="text-2xl font-bold">{discounts.length}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Percent className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Discounts</p>
                <p className="text-2xl font-bold">{discounts.filter(d => d.isActive).length}</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <ToggleRight className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Uniform-Specific</p>
                <p className="text-2xl font-bold">{discounts.filter(d => d.uniformId).length}</p>
              </div>
              <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Class-Specific</p>
                <p className="text-2xl font-bold">{discounts.filter(d => d.classId).length}</p>
              </div>
              <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                <Users className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Dynamic Discounts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading discounts...</div>
          ) : discounts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No dynamic discounts found.</p>
              <Button className="mt-4" onClick={() => {/* TODO: Open create modal */}}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Discount
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Discount Details</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Applies To</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discounts.map((discount) => (
                    <TableRow key={discount.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{discount.reason}</div>
                          <div className="text-sm text-gray-500">
                            {getUniformNames(discount.uniformId)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {discount.valueType === 'percentage' ? (
                            <Percent className="h-4 w-4 text-blue-500" />
                          ) : (
                            <DollarSign className="h-4 w-4 text-green-500" />
                          )}
                          <span className="font-medium">
                            {formatDiscountDisplay(discount.valueType, discount.value)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div>Mode: <Badge variant="outline">{discount.selectionMode || 'All'}</Badge></div>
                          {discount.gender && <div>Gender: {discount.gender}</div>}
                          {discount.section && <div>Section: {discount.section}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {discount.classId ? getClassName(discount.classId) : 'All classes'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={discount.isActive ? 'default' : 'secondary'}>
                          {discount.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3" />
                          {formatDate(discount.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleStatus(discount.id, discount.isActive)}
                            title={discount.isActive ? 'Deactivate' : 'Activate'}
                            disabled={toggleDiscountMutation.isPending}
                          >
                            {discount.isActive ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDiscount(discount)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(discount.id)}
                            title="Delete"
                            disabled={deleteDiscountMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 