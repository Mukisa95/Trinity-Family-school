"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Camera, 
  Database, 
  History,
  TrendingUp,
  DollarSign,
  Clock,
  Building2,
  Calendar,
  ArrowRight,
  CheckCircle,
  Info
} from 'lucide-react';
import { EnhancedBankingDashboard } from '@/components/banking/enhanced-banking-dashboard';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import type { Pupil, AcademicYear, Term } from '@/types';

export default function BankingHistoricalDemoPage() {
  const [selectedPupil, setSelectedPupil] = useState<Pupil | null>(null);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');

  const { data: academicYears } = useAcademicYears();

  const getAcademicYearStatus = (academicYear: AcademicYear) => {
    const now = new Date();
    const startDate = new Date(academicYear.startDate);
    const endDate = new Date(academicYear.endDate);
    
    if (now < startDate) return 'future';
    if (now > endDate) return 'past';
    return 'current';
  };

  const getTermStatus = (term: Term, academicYear: AcademicYear) => {
    const now = new Date();
    const termStart = new Date(term.startDate);
    const termEnd = new Date(term.endDate);
    
    if (now < termStart) return 'future';
    if (now > termEnd) return 'past';
    return 'current';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Enhanced Banking System</h1>
          </div>
          <p className="text-gray-600 text-lg">
            Banking system with historical snapshot integration for accurate financial tracking across academic periods
          </p>
        </div>

        {/* How It Works Section */}
        <Card className="mb-8 border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Info className="h-5 w-5" />
              How Enhanced Banking Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white rounded-lg border">
                <Database className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-2">Current/Future Terms</h3>
                <p className="text-sm text-gray-600">
                  Uses live pupil data for ongoing and upcoming terms
                </p>
              </div>
              
              <div className="text-center p-4 bg-white rounded-lg border">
                <ArrowRight className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <h3 className="font-semibold mb-2">Term Completion</h3>
                <p className="text-sm text-gray-600">
                  System automatically creates snapshots when terms end
                </p>
              </div>
              
              <div className="text-center p-4 bg-white rounded-lg border">
                <Camera className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-2">Past Terms</h3>
                <p className="text-sm text-gray-600">
                  Uses historical snapshots to show accurate class/section context
                </p>
              </div>
            </div>

            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Benefits:</strong> Accurate financial reports, proper class context for transactions, 
                and reliable historical data even when pupils change classes or sections.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Academic Year Status Overview */}
        {academicYears && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Academic Years & Data Sources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {academicYears.map((academicYear) => {
                  const status = getAcademicYearStatus(academicYear);
                  const statusConfig = {
                    past: { color: 'bg-amber-500', icon: Camera, label: 'Historical (Snapshots)' },
                    current: { color: 'bg-blue-500', icon: Database, label: 'Current (Live Data)' },
                    future: { color: 'bg-gray-500', icon: Clock, label: 'Future (Live Data)' }
                  };
                  
                  const config = statusConfig[status];
                  
                  return (
                    <Card key={academicYear.id} className="border-2">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold">{academicYear.name}</h3>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${config.color}`} />
                            <config.icon className="h-3 w-3" />
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="text-sm text-gray-600">
                            {new Date(academicYear.startDate).toLocaleDateString()} - 
                            {new Date(academicYear.endDate).toLocaleDateString()}
                          </div>
                          <div className="text-xs p-2 bg-gray-50 rounded">
                            {config.label}
                          </div>
                          
                          {/* Terms Status */}
                          <div className="space-y-1">
                            {academicYear.terms.map((term) => {
                              const termStatus = getTermStatus(term, academicYear);
                              const termConfig = statusConfig[termStatus];
                              
                              return (
                                <div key={term.id} className="flex items-center justify-between text-xs">
                                  <span>{term.name}</span>
                                  <div className="flex items-center gap-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${termConfig.color}`} />
                                    <termConfig.icon className="h-2.5 w-2.5" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-6 text-center">
              <TrendingUp className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="font-semibold text-green-900 mb-2">Financial Accuracy</h3>
              <p className="text-sm text-green-700">
                Transactions linked to correct class/section context from the time they occurred
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-6 text-center">
              <History className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="font-semibold text-blue-900 mb-2">Historical Integrity</h3>
              <p className="text-sm text-blue-700">
                Banking records maintain accurate class assignments even after pupil transfers
              </p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50/50">
            <CardContent className="p-6 text-center">
              <DollarSign className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="font-semibold text-purple-900 mb-2">Audit Trail</h3>
              <p className="text-sm text-purple-700">
                Complete financial audit trail with proper academic context preservation
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Banking Dashboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Try the Enhanced Banking System
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-6">
              Select a pupil and academic term to see how the system automatically uses historical snapshots 
              for past terms and live data for current/future terms.
            </p>
            
            <EnhancedBankingDashboard 
              showHistoricalAnalysis={true}
            />
          </CardContent>
        </Card>

        {/* Technical Implementation Notes */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Technical Implementation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Enhanced Data Types
                </h4>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• <code>EnhancedTransaction</code> - Transactions with snapshot context</li>
                  <li>• <code>EnhancedLoan</code> - Loans with historical class data</li>
                  <li>• <code>EnhancedAccount</code> - Accounts with complete history</li>
                  <li>• Academic year/term tracking on all banking operations</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Snapshot Integration
                </h4>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• Automatic snapshot creation when terms end</li>
                  <li>• Historical data enrichment for financial records</li>
                  <li>• Smart fallback to live data when snapshots unavailable</li>
                  <li>• Visual indicators showing data source (snapshot vs live)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 