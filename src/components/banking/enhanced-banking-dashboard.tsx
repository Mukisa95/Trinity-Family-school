"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Camera, 
  Database, 
  DollarSign, 
  TrendingUp,
  TrendingDown,
  CreditCard,
  History,
  Calendar,
  Building2,
  AlertCircle,
  CheckCircle,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import type { 
  Pupil, 
  AcademicYear, 
  Term,
  EnhancedAccount,
  EnhancedTransaction,
  EnhancedLoan
} from "@/types";
import { PupilHistoricalSelector } from "@/components/common/pupil-historical-selector";
import { 
  useEnhancedAccountByPupil,
  useEnhancedTransactionsByPupil,
  useEnhancedLoansByPupil,
  useEnhancedBankingHistory
} from "@/lib/hooks/use-enhanced-banking";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";

interface EnhancedBankingDashboardProps {
  pupilId?: string;
  initialAcademicYearId?: string;
  initialTermId?: string;
  showHistoricalAnalysis?: boolean;
}

export function EnhancedBankingDashboard({
  pupilId,
  initialAcademicYearId,
  initialTermId,
  showHistoricalAnalysis = true
}: EnhancedBankingDashboardProps) {
  const [selectedPupil, setSelectedPupil] = React.useState<Pupil | null>(null);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = React.useState(initialAcademicYearId);
  const [selectedTermId, setSelectedTermId] = React.useState(initialTermId);

  const effectivePupilId = pupilId || selectedPupil?.id;

  // Fetch academic years for historical analysis
  const { data: academicYears } = useAcademicYears();

  // Enhanced banking data with snapshot integration
  const { 
    data: enhancedAccount, 
    isLoading: accountLoading, 
    error: accountError 
  } = useEnhancedAccountByPupil(
    effectivePupilId || '',
    selectedAcademicYearId,
    selectedTermId
  );

  const { 
    data: transactions, 
    isLoading: transactionsLoading 
  } = useEnhancedTransactionsByPupil(
    effectivePupilId || '',
    selectedAcademicYearId,
    selectedTermId
  );

  const { 
    data: loans, 
    isLoading: loansLoading 
  } = useEnhancedLoansByPupil(
    effectivePupilId || '',
    selectedAcademicYearId,
    selectedTermId
  );

  // Historical analysis for multi-year view
  const { 
    data: bankingHistory, 
    isLoading: historyLoading 
  } = useEnhancedBankingHistory(
    effectivePupilId || '',
    showHistoricalAnalysis ? academicYears?.map(ay => ay.id) : undefined
  );

  const handlePupilChange = (pupil: Pupil | null) => {
    setSelectedPupil(pupil);
  };

  const handleAcademicContextChange = (academicYearId: string, termId: string) => {
    setSelectedAcademicYearId(academicYearId);
    setSelectedTermId(termId);
  };

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    if (!transactions || !loans) return null;

    const totalDeposits = transactions
      .filter(t => t.type === 'DEPOSIT')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalWithdrawals = transactions
      .filter(t => t.type === 'WITHDRAWAL')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalLoansAmount = loans.reduce((sum, l) => sum + l.amount, 0);
    const totalLoansRepaid = loans.reduce((sum, l) => sum + l.amountRepaid, 0);
    const outstandingLoans = totalLoansAmount - totalLoansRepaid;

    const activeLoans = loans.filter(l => l.status === 'ACTIVE');
    const paidLoans = loans.filter(l => l.status === 'PAID');

    return {
      totalDeposits,
      totalWithdrawals,
      netFlow: totalDeposits - totalWithdrawals,
      totalLoansAmount,
      totalLoansRepaid,
      outstandingLoans,
      activeLoansCount: activeLoans.length,
      paidLoansCount: paidLoans.length,
      currentBalance: enhancedAccount?.balance || 0,
      availableBalance: (enhancedAccount?.balance || 0) - outstandingLoans
    };
  }, [transactions, loans, enhancedAccount]);

  // Data source indicator
  const getDataSourceInfo = (snapshotData?: any) => {
    if (!snapshotData) return { source: 'live', icon: Database, color: 'bg-blue-500' };
    return snapshotData.dataSource === 'snapshot' 
      ? { source: 'snapshot', icon: Camera, color: 'bg-amber-500' }
      : { source: 'live', icon: Database, color: 'bg-blue-500' };
  };

  if (accountError) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load banking data. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Pupil Selector with Historical Context */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Enhanced Banking Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PupilHistoricalSelector
            selectedPupil={selectedPupil}
            onPupilChange={handlePupilChange}
            selectedAcademicYearId={selectedAcademicYearId}
            selectedTermId={selectedTermId}
            onAcademicContextChange={handleAcademicContextChange}
            showDataSourceIndicator={true}
          />
        </CardContent>
      </Card>

      {effectivePupilId && (
        <>
          {/* Account Overview with Snapshot Context */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Account Overview
                </span>
                {enhancedAccount?.pupilSnapshotData && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    {(() => {
                      const { source, icon: Icon, color } = getDataSourceInfo(enhancedAccount.pupilSnapshotData);
                      return (
                        <>
                          <div className={`w-2 h-2 rounded-full ${color}`} />
                          <Icon className="h-3 w-3" />
                          {source === 'snapshot' ? 'Historical Data' : 'Live Data'}
                        </>
                      );
                    })()}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {accountLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : enhancedAccount ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      UGX {enhancedAccount.balance.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">Current Balance</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">
                      {enhancedAccount.accountNumber}
                    </div>
                    <div className="text-sm text-muted-foreground">Account Number</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">
                      {enhancedAccount.pupilSnapshotData?.section || 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">Section</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">
                      {enhancedAccount.pupilSnapshotData?.admissionNumber || 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">Admission #</div>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No banking account found for this pupil.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Summary Statistics */}
          {summaryStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        UGX {summaryStats.totalDeposits.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Deposits</div>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-red-600">
                        UGX {summaryStats.totalWithdrawals.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Withdrawals</div>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-amber-600">
                        UGX {summaryStats.outstandingLoans.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Outstanding Loans</div>
                    </div>
                    <Clock className="h-8 w-8 text-amber-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">
                        UGX {summaryStats.availableBalance.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Available Balance</div>
                    </div>
                    <CheckCircle className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recent Transactions with Historical Context */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : transactions?.length ? (
                <div className="space-y-3">
                  {transactions.slice(0, 10).map((transaction) => {
                    const { source, icon: Icon, color } = getDataSourceInfo(transaction.pupilSnapshotData);
                    return (
                      <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${color}`} />
                          <Icon className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{transaction.description}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(transaction.transactionDate), 'PPP')} • 
                              {transaction.pupilSnapshotData ? 
                                `${transaction.pupilSnapshotData.section} Section` : 
                                'Current Data'
                              }
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${
                            ['DEPOSIT', 'LOAN_DISBURSEMENT'].includes(transaction.type) 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            {['DEPOSIT', 'LOAN_DISBURSEMENT'].includes(transaction.type) ? '+' : '-'}
                            UGX {transaction.amount.toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Balance: UGX {transaction.balance.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No transactions found for the selected period.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Historical Analysis (if enabled) */}
          {showHistoricalAnalysis && bankingHistory && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Multi-Year Banking Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bankingHistory.map((yearData) => {
                      const academicYear = academicYears?.find(ay => ay.id === yearData.academicYearId);
                      return (
                        <Card key={yearData.academicYearId} className="border-2">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg">
                              {academicYear?.name || yearData.academicYearId}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm">Deposits:</span>
                              <span className="font-medium text-green-600">
                                UGX {yearData.totalDeposits.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm">Withdrawals:</span>
                              <span className="font-medium text-red-600">
                                UGX {yearData.totalWithdrawals.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm">Loans:</span>
                              <span className="font-medium text-amber-600">
                                UGX {yearData.totalLoans.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm">Transactions:</span>
                              <span className="font-medium">
                                {yearData.totalTransactions}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
} 