'use client';

import React from 'react';
import { ArrowLeft, Download, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ProcurementItem, ProcurementPurchase } from '@/types';

interface ItemDetailViewProps {
  itemId: string;
  item: ProcurementItem | null;
  purchases: ProcurementPurchase[];
  onBack: () => void;
}

export function ItemDetailView({ itemId, item, purchases, onBack }: ItemDetailViewProps) {
  const itemPurchases = React.useMemo(() => {
    const purchasesForItem = purchases
      .filter((purchase) => purchase.itemId === itemId)
      .sort((left, right) => new Date(right.purchaseDate).getTime() - new Date(left.purchaseDate).getTime());

    return purchasesForItem.map((purchase, index) => ({
      ...purchase,
      lastPurchasePrice: purchasesForItem[index + 1]?.unitCost,
    }));
  }, [itemId, purchases]);

  const totalQuantity = React.useMemo(
    () => itemPurchases.reduce((sum, purchase) => sum + purchase.quantity, 0),
    [itemPurchases]
  );
  const totalCost = React.useMemo(
    () => itemPurchases.reduce((sum, purchase) => sum + purchase.totalCost, 0),
    [itemPurchases]
  );
  const priceHistory = React.useMemo(() => {
    const purchasesByDate = new Map<string, ProcurementPurchase[]>();
    for (const purchase of itemPurchases) {
      const records = purchasesByDate.get(purchase.purchaseDate) || [];
      records.push(purchase);
      purchasesByDate.set(purchase.purchaseDate, records);
    }

    return [...purchasesByDate.entries()]
      .map(([date, records]) => {
        const quantity = records.reduce((sum, purchase) => sum + purchase.quantity, 0);
        const cost = records.reduce((sum, purchase) => sum + purchase.totalCost, 0);
        return { date, price: quantity > 0 ? cost / quantity : 0, quantity };
      })
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
      .map((entry) => ({ ...entry, date: new Date(entry.date).toLocaleDateString() }));
  }, [itemPurchases]);

  const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;
  
  const getUnitText = (item: ProcurementItem) => {
    return item.customUnit || item.unit;
  };
  
  if (!item) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-600">This procurement item is no longer available.</p>
          <Button className="mt-4" variant="outline" onClick={onBack}>Back to Procurement</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Procurement
          </Button>
          <h2 className="text-2xl font-bold">{item?.name}</h2>
          <Badge variant="outline">{item?.category}</Badge>
        </div>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export History
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Quantity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalQuantity.toLocaleString()} {item ? getUnitText(item) : ''}
            </div>
            <p className="text-xs text-muted-foreground">All-time total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
            <p className="text-xs text-muted-foreground">All-time spending</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Average Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalQuantity > 0 ? totalCost / totalQuantity : 0)}
            </div>
            <p className="text-xs text-muted-foreground">Per {item ? getUnitText(item) : 'unit'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Price Trend Chart */}
      {priceHistory.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Price Trend</CardTitle>
            <CardDescription>Unit price changes over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={priceHistory}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#8884d8" 
                    name="Unit Price"
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Purchase History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase History</CardTitle>
          <CardDescription>{itemPurchases.length} purchase records found</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Procured By</TableHead>
                <TableHead>Academic Period</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemPurchases.map((purchase) => {
                const dateStr = new Date(purchase.purchaseDate).toLocaleDateString();
                const priceDiff = purchase.lastPurchasePrice ? 
                  ((purchase.unitCost - purchase.lastPurchasePrice) / purchase.lastPurchasePrice) * 100 : 0;
                
                return (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-medium">{dateStr}</TableCell>
                    <TableCell>{purchase.quantity} {item ? getUnitText(item) : ''}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span>{formatCurrency(purchase.unitCost)}</span>
                        {priceDiff !== 0 && (
                          <div className="flex items-center">
                            {priceDiff > 0 ? (
                              <TrendingUp className="w-3 h-3 text-red-500" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-green-500" />
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(purchase.totalCost)}</TableCell>
                    <TableCell>{purchase.supplierName || '-'}</TableCell>
                    <TableCell>{purchase.procuredBy}</TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <div>{purchase.termName}</div>
                        <div className="text-gray-500">{purchase.academicYearName}</div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {itemPurchases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                    No purchase records found for this item
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Item Details */}
      <Card>
        <CardHeader>
          <CardTitle>Item Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <p className="text-gray-600">{item?.description || item?.useCase || 'No description available'}</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Item Specifications</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Category:</span>
                  <span>{item?.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Unit of Measurement:</span>
                  <span>{item ? getUnitText(item) : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Created:</span>
                  <span>{item?.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <Badge variant={item?.isActive ? 'default' : 'secondary'}>
                    {item?.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
