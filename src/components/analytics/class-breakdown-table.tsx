"use client";

import { motion } from 'framer-motion';
import { CollectionRateBar } from './collection-rate-bar';
import type { ClassCollectionStats } from '@/lib/services/collection-analytics.service';
import { Users, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface ClassBreakdownTableProps {
  data: ClassCollectionStats[];
  isLoading?: boolean;
}

export function ClassBreakdownTable({ data, isLoading = false }: ClassBreakdownTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <p className="text-gray-500">No class data available</p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return `UGX ${amount.toLocaleString()}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-indigo-100">
        <h3 className="text-lg font-bold text-indigo-900">Collection by Class</h3>
        <p className="text-sm text-indigo-600 mt-1">Detailed breakdown of fee collection per class</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Class
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pupils
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expected
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Collected
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Outstanding
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Collection Rate
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((classData, index) => (
              <motion.tr
                key={classData.classId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="hover:bg-gray-50 transition-colors"
              >
                {/* Class Name */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{classData.className}</div>
                    <div className="text-xs text-gray-500">{classData.classCode}</div>
                  </div>
                </td>

                {/* Pupils Count with breakdown */}
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{classData.pupilCount}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 mt-1">
                    <div className="flex items-center gap-1" title="Fully Paid">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span className="text-xs text-green-600">{classData.paidPupils}</span>
                    </div>
                    <div className="flex items-center gap-1" title="Partially Paid">
                      <Clock className="w-3 h-3 text-yellow-500" />
                      <span className="text-xs text-yellow-600">{classData.partiallyPaidPupils}</span>
                    </div>
                    <div className="flex items-center gap-1" title="Unpaid">
                      <AlertCircle className="w-3 h-3 text-red-500" />
                      <span className="text-xs text-red-600">{classData.unpaidPupils}</span>
                    </div>
                  </div>
                </td>

                {/* Expected Amount */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatCurrency(classData.expectedAmount)}
                  </div>
                </td>

                {/* Collected Amount */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-green-600">
                    {formatCurrency(classData.collectedAmount)}
                  </div>
                </td>

                {/* Outstanding Amount */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className={`text-sm font-medium ${classData.outstandingAmount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {formatCurrency(classData.outstandingAmount)}
                  </div>
                </td>

                {/* Collection Rate */}
                <td className="px-6 py-4">
                  <div className="w-32">
                    <CollectionRateBar 
                      rate={classData.collectionRate}
                      showPercentage={true}
                      height="sm"
                      animated={false}
                    />
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>

          {/* Footer with totals */}
          <tfoot className="bg-gray-50 font-medium">
            <tr>
              <td className="px-6 py-4 text-sm text-gray-900">Total</td>
              <td className="px-6 py-4 text-center text-sm text-gray-900">
                {data.reduce((sum, c) => sum + c.pupilCount, 0)}
              </td>
              <td className="px-6 py-4 text-right text-sm text-gray-900">
                {formatCurrency(data.reduce((sum, c) => sum + c.expectedAmount, 0))}
              </td>
              <td className="px-6 py-4 text-right text-sm text-green-600">
                {formatCurrency(data.reduce((sum, c) => sum + c.collectedAmount, 0))}
              </td>
              <td className="px-6 py-4 text-right text-sm text-red-600">
                {formatCurrency(data.reduce((sum, c) => sum + c.outstandingAmount, 0))}
              </td>
              <td className="px-6 py-4">
                {(() => {
                  const totalExpected = data.reduce((sum, c) => sum + c.expectedAmount, 0);
                  const totalCollected = data.reduce((sum, c) => sum + c.collectedAmount, 0);
                  const overallRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;
                  return (
                    <div className="w-32">
                      <CollectionRateBar 
                        rate={overallRate}
                        showPercentage={true}
                        height="sm"
                        animated={false}
                      />
                    </div>
                  );
                })()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

