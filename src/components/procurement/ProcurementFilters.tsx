'use client';

import React, { useState } from 'react';
import { Filter, X, Calendar, DollarSign, Package, User, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { 
  ProcurementCategory,
  PaymentMethod,
  ViewPeriodType,
  ProcurementFilters as FilterType
} from '@/types';

interface ProcurementFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
  onClearFilters: () => void;
  availableSuppliers?: string[];
  availableItems?: Array<{ id: string; name: string; category: ProcurementCategory }>;
  viewPeriod: ViewPeriodType;
  setViewPeriod: (period: ViewPeriodType) => void;
}

export function ProcurementFilters({ 
  filters, 
  onFiltersChange, 
  onClearFilters,
  availableSuppliers = [],
  availableItems = [],
  viewPeriod,
  setViewPeriod
}: ProcurementFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const categories: ProcurementCategory[] = [
    'Foodstuff', 'Class Utility', 'Office Utility', 'Tools', 'Equipment', 'Other'
  ];

  const paymentMethods: PaymentMethod[] = [
    'Cash', 'Bank Transfer', 'Mobile Money', 'Cheque', 'Credit Card', 'Other'
  ];

  const periodTypes: ViewPeriodType[] = ['Week', 'Month', 'Term', 'Year'];

  const handleFilterChange = (key: keyof FilterType, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handleArrayFilterChange = (key: keyof FilterType, value: string, checked: boolean) => {
    const currentArray = (filters[key] as string[]) || [];
    const newArray = checked 
      ? [...currentArray, value]
      : currentArray.filter(item => item !== value);
    
    onFiltersChange({
      ...filters,
      [key]: newArray
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    
    if (filters.startDate || filters.endDate) count++;
    if (filters.categoryIds && filters.categoryIds.length > 0) count++;
    if (filters.supplierNames && filters.supplierNames.length > 0) count++;
    if (filters.itemIds && filters.itemIds.length > 0) count++;
    if (filters.paymentMethods && filters.paymentMethods.length > 0) count++;
    if (filters.minAmount !== undefined && filters.minAmount > 0) count++;
    if (filters.maxAmount !== undefined && filters.maxAmount > 0) count++;
    
    return count;
  };

  const clearSpecificFilter = (filterKey: keyof FilterType) => {
    const newFilters = { ...filters };
    
    switch (filterKey) {
      case 'startDate':
        newFilters.startDate = undefined;
        break;
      case 'endDate':
        newFilters.endDate = undefined;
        break;
      case 'categoryIds':
        newFilters.categoryIds = [];
        break;
      case 'supplierNames':
        newFilters.supplierNames = [];
        break;
      case 'itemIds':
        newFilters.itemIds = [];
        break;
      case 'paymentMethods':
        newFilters.paymentMethods = [];
        break;
      case 'minAmount':
        newFilters.minAmount = undefined;
        break;
      case 'maxAmount':
        newFilters.maxAmount = undefined;
        break;
    }
    
    onFiltersChange(newFilters);
  };

  const activeFiltersCount = getActiveFiltersCount();

  const handleViewPeriodChange = (value: string) => {
    setViewPeriod(value as ViewPeriodType);
  };

  const getDateDescription = () => {
    const now = new Date();
    
    switch (viewPeriod) {
      case 'Week':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Go to Sunday
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Go to Saturday
        return `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;
        
      case 'Month':
        return now.toLocaleString('default', { month: 'long', year: 'numeric' });
        
      case 'Term':
        // This is a placeholder - would be replaced with actual term dates
        return 'Current Term';
        
      case 'Year':
        return now.getFullYear().toString();
        
      default:
        return '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <CardTitle>Advanced Filters</CardTitle>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">{activeFiltersCount}</Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {activeFiltersCount > 0 && (
              <Button variant="outline" size="sm" onClick={onClearFilters}>
                <X className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </div>
        <CardDescription>
          Filter procurement data by various criteria
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Basic Filters - Always Visible */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search items, suppliers..."
                value=""
                onChange={() => {}}
                className="pl-10"
              />
            </div>
          </div>

          {/* Date Range */}
          <div>
            <Label>Start Date</Label>
            <Input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div>
            <Label>End Date</Label>
            <Input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>

          {/* Period Type */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-md px-3 py-1 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4 mr-2" />
              <span>{getDateDescription()}</span>
            </div>
            
            <Select value={viewPeriod} onValueChange={handleViewPeriodChange}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="View Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Week">Week</SelectItem>
                <SelectItem value="Month">Month</SelectItem>
                <SelectItem value="Term">Term</SelectItem>
                <SelectItem value="Year">Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters Display */}
        {activeFiltersCount > 0 && (
          <div>
            <Label className="text-sm font-medium">Active Filters:</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {(filters.startDate || filters.endDate) && (
                <Badge variant="outline" className="flex items-center gap-1">
                  Date Range
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => {
                      clearSpecificFilter('startDate');
                      clearSpecificFilter('endDate');
                    }}
                  />
                </Badge>
              )}
              
              {filters.categoryIds && filters.categoryIds.length > 0 && (
                <Badge variant="outline" className="flex items-center gap-1">
                  Categories: {filters.categoryIds.length}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => clearSpecificFilter('categoryIds')}
                  />
                </Badge>
              )}
              
              {filters.supplierNames && filters.supplierNames.length > 0 && (
                <Badge variant="outline" className="flex items-center gap-1">
                  Suppliers: {filters.supplierNames.length}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => clearSpecificFilter('supplierNames')}
                  />
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Advanced Filters - Expandable */}
        {isExpanded && (
          <>
            <Separator />
            
            <div className="space-y-6">
              {/* Categories */}
              <div>
                <Label className="text-base font-medium flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Categories
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                  {categories.map(category => (
                    <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category}`}
                        checked={filters.categoryIds?.includes(category) || false}
                        onCheckedChange={(checked) => 
                          handleArrayFilterChange('categoryIds', category, checked as boolean)
                        }
                      />
                      <Label 
                        htmlFor={`category-${category}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {category}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <Label className="text-base font-medium flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Payment Methods
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                  {paymentMethods.map(method => (
                    <div key={method} className="flex items-center space-x-2">
                      <Checkbox
                        id={`payment-${method}`}
                        checked={filters.paymentMethods?.includes(method) || false}
                        onCheckedChange={(checked) => 
                          handleArrayFilterChange('paymentMethods', method, checked as boolean)
                        }
                      />
                      <Label 
                        htmlFor={`payment-${method}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {method}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Amount Range */}
              <div>
                <Label className="text-base font-medium flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Amount Range (UGX)
                </Label>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <Label htmlFor="minAmount" className="text-sm">Minimum Amount</Label>
                    <Input
                      id="minAmount"
                      type="number"
                      placeholder="0"
                      value={filters.minAmount || ''}
                      onChange={(e) => handleFilterChange('minAmount', e.target.value ? Number(e.target.value) : undefined)}
                      min="0"
                      step="1000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxAmount" className="text-sm">Maximum Amount</Label>
                    <Input
                      id="maxAmount"
                      type="number"
                      placeholder="No limit"
                      value={filters.maxAmount || ''}
                      onChange={(e) => handleFilterChange('maxAmount', e.target.value ? Number(e.target.value) : undefined)}
                      min="0"
                      step="1000"
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Quick Filter Presets */}
        <div>
          <Label className="text-sm font-medium">Quick Filters:</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
                const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
                handleFilterChange('dateRange', { from: startOfWeek, to: endOfWeek });
              }}
            >
              This Week
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                handleFilterChange('dateRange', { from: startOfMonth, to: endOfMonth });
              }}
            >
              This Month
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleFilterChange('categoryIds', ['Foodstuff']);
              }}
            >
              Food Items
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleFilterChange('minAmount', 100000);
              }}
            >
              High Value (&gt;100k)
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 