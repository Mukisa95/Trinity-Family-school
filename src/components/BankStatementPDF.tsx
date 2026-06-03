"use client";

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { formatCurrency } from '../utils/format';
import { PDFSignatureService } from '@/lib/services/pdf-signature.service';
import { PDFSignatureBlock } from './common/pdf-signature-block';
import type { Pupil, Account, Transaction } from '@/types';

interface BankStatementPDFProps {
  pupil: Pupil;
  account: Account;
  transactions: Transaction[];
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 5,
  },
  accountInfo: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    fontWeight: 'bold',
    width: '40%',
  },
  value: {
    width: '60%',
  },
  table: {
    marginTop: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e9ecef',
    padding: 8,
    fontWeight: 'bold',
    borderBottom: '1 solid #dee2e6',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1 solid #f8f9fa',
  },
  tableRowAlt: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderBottom: '1 solid #f8f9fa',
  },
  col1: { width: '15%' },
  col2: { width: '20%' },
  col3: { width: '35%' },
  col4: { width: '15%' },
  col5: { width: '15%' },
  footer: {
    marginTop: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#6c757d',
  },
  summary: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#e3f2fd',
    borderRadius: 5,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});

const BankStatementPDF: React.FC<BankStatementPDFProps> = ({
  pupil,
  account,
  transactions,
  dateRange
}) => {
  const formatTransactionType = (type: string) => {
    switch (type.toLowerCase()) {
      case 'deposit':
        return 'Deposit';
      case 'withdrawal':
        return 'Withdrawal';
      case 'loan_disbursement':
        return 'Loan Disbursement';
      case 'loan_repayment':
        return 'Loan Payment';
      default:
        return type;
    }
  };

  const getTransactionAmount = (transaction: Transaction) => {
    const isDebit = ['withdrawal', 'loan_repayment'].includes(transaction.type.toLowerCase());
    return isDebit ? `-${formatCurrency(transaction.amount)}` : `+${formatCurrency(transaction.amount)}`;
  };

  const openingBalance = transactions.length > 0 ? 
    transactions[transactions.length - 1].balance - transactions[transactions.length - 1].amount : 
    account.balance;

  const closingBalance = account.balance;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>BANK STATEMENT</Text>
          <Text style={styles.subtitle}>
            Statement Period: {format(dateRange.startDate, 'dd/MM/yyyy')} - {format(dateRange.endDate, 'dd/MM/yyyy')}
          </Text>
          <Text style={styles.subtitle}>
            Generated on: {format(new Date(), 'dd/MM/yyyy HH:mm')}
          </Text>
        </View>

        {/* Account Information */}
        <View style={styles.accountInfo}>
          <Text style={styles.summaryTitle}>Account Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Account Holder:</Text>
            <Text style={styles.value}>{pupil.firstName} {pupil.lastName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Student ID:</Text>
            <Text style={styles.value}>{pupil.admissionNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Account Number:</Text>
            <Text style={styles.value}>{account.accountNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Account Name:</Text>
            <Text style={styles.value}>{account.accountName}</Text>
          </View>
          {pupil.className && (
            <View style={styles.row}>
              <Text style={styles.label}>Class:</Text>
              <Text style={styles.value}>{pupil.className}</Text>
            </View>
          )}
        </View>

        {/* Balance Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Balance Summary</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Opening Balance:</Text>
            <Text style={styles.value}>{formatCurrency(openingBalance)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Closing Balance:</Text>
            <Text style={styles.value}>{formatCurrency(closingBalance)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total Transactions:</Text>
            <Text style={styles.value}>{transactions.length}</Text>
          </View>
        </View>

        {/* Transactions Table */}
        <View style={styles.table}>
          <Text style={styles.summaryTitle}>Transaction History</Text>
          
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Date</Text>
            <Text style={styles.col2}>Type</Text>
            <Text style={styles.col3}>Description</Text>
            <Text style={styles.col4}>Amount</Text>
            <Text style={styles.col5}>Balance</Text>
          </View>

          {/* Table Rows */}
          {transactions.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={{ width: '100%', textAlign: 'center', fontStyle: 'italic' }}>
                No transactions found for the selected period
              </Text>
            </View>
          ) : (
            transactions.map((transaction, index) => (
              <View key={transaction.id} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.col1}>
                  {format(new Date(transaction.transactionDate), 'dd/MM/yyyy')}
                </Text>
                <Text style={styles.col2}>
                  {formatTransactionType(transaction.type)}
                </Text>
                <Text style={styles.col3}>
                  {transaction.description}
                </Text>
                <Text style={styles.col4}>
                  {getTransactionAmount(transaction)}
                </Text>
                <Text style={styles.col5}>
                  {formatCurrency(transaction.balance)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Digital Signatures */}
        <PDFSignatureBlock
          recordType="banking_transaction"
          recordId={account.id}
          includeActions={['created', 'transaction', 'deposit', 'withdrawal']}
          maxSignatures={3}
          showTimestamp={true}
          showUserRole={true}
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Text>This is a computer-generated statement and does not require a signature.</Text>
          <Text>For any queries, please contact the school administration.</Text>
        </View>
      </Page>
    </Document>
  );
};

export default BankStatementPDF; 