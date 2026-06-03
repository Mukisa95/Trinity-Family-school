'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ProcurementService } from '@/lib/services/procurement.service';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ProcurementItem, ProcurementPurchase } from '@/types';

interface ItemDetailViewProps {
  itemId: string;
  onBack: () => void;
}

export function ItemDetailView({ itemId, onBack }: ItemDetailViewProps) {
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<ProcurementItem | null>(null);
  const [purchases, setPurchases] = useState<ProcurementPurchase[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    const loadItemData = async () => {
      try {
        setLoading(true);
        
        // Load item details and purchase history
        const [itemData, purchasesData] = await Promise.all([
          ProcurementService.getItemById(itemId),
          ProcurementService.getPurchasesByItem(itemId)
        ]);
        
        if (!itemData) {
          toast({
            title: "Error",
            description: "Item not found",
            variant: "destructive",
          });
          onBack();
          return;
        }
        
        setItem(itemData);
        setPurchases(purchasesData.sort((a, b) => 
          new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
        ));
        
        // Calculate totals
        const totalQty = purchasesData.reduce((sum, p) => sum + p.quantity, 0);
        const totalAmt = purchasesData.reduce((sum, p) => sum + p.totalCost, 0);
        setTotalQuantity(totalQty);
        setTotalCost(totalAmt);
        
        // Create price history for the chart
        const priceData = [];
        const purchasesByDate = {};
        
        // Group purchases by date
        purchasesData.forEach(purchase => {
          const date = purchase.purchaseDate;
          if (!purchasesByDate[date]) {
            purchasesByDate[date] = [];
          }
          purchasesByDate[date].push(purchase);
        });
        
        // Calculate average price per date
        Object.entries(purchasesByDate).forEach(([date, purchasesList]) => {
          const purchases = purchasesList as ProcurementPurchase[];
          const totalCost = purchases.reduce((sum, p) => sum + p.totalCost, 0);
          const totalQty = purchases.reduce((sum, p) => sum + p.quantity, 0);
          const avgPrice = totalQty > 0 ? totalCost / totalQty : 0;
          
          priceData.push({
            date: new Date(date).toLocaleDateString(),
            price: avgPrice,
            quantity: totalQty
          });
        });
        
        // Sort by date ascending for the chart
        priceData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setPriceHistory(priceData);
        
      } catch (error) {
        console.error('Error loading item data:', error);
        toast({
          title: "Error",
          description: "Failed to load item data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadItemData();
  }, [itemId, onBack]);

  const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;
  
  const getUnitText = (item: ProcurementItem) => {
    return item.customUnit || item.unit;
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading item data...</p>
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
          <CardDescription>{purchases.length} purchase records found</CardDescription>
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
              {purchases.map((purchase) => {
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
              {purchases.length === 0 && (
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