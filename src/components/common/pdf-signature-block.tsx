"use client";

import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { PDFSignatureService } from '@/lib/services/pdf-signature.service';
import type { RecordType, AuditTrailEntry } from '@/types/digital-signature';

interface PDFSignatureBlockProps {
  recordType: RecordType;
  recordId: string;
  includeActions?: string[];
  maxSignatures?: number;
  showTimestamp?: boolean;
  showUserRole?: boolean;
}

const styles = StyleSheet.create({
  signatureContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    borderLeft: '3px solid #3b82f6',
  },
  signatureTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  signatureItem: {
    fontSize: 10,
    color: '#374151',
    marginBottom: 4,
  },
  userName: {
    fontWeight: 'bold',
  },
  userRole: {
    color: '#6b7280',
  },
  timestamp: {
    color: '#9ca3af',
  },
});

export const PDFSignatureBlock: React.FC<PDFSignatureBlockProps> = ({
  recordType,
  recordId,
  includeActions = ['created', 'updated', 'payment', 'collection'],
  maxSignatures = 3,
  showTimestamp = true,
  showUserRole = true,
}) => {
  const [signatures, setSignatures] = useState<AuditTrailEntry[]>([]);

  useEffect(() => {
    const loadSignatures = async () => {
      try {
        const signatureData = await PDFSignatureService.getSignaturesForPDF(
          recordType,
          recordId,
          {
            includeActions,
            maxSignatures,
            showTimestamp,
            showUserRole,
          }
        );
        setSignatures(signatureData.signatures);
      } catch (error) {
        console.error('Error loading signatures for PDF:', error);
      }
    };

    loadSignatures();
  }, [recordType, recordId, includeActions, maxSignatures, showTimestamp, showUserRole]);

  if (signatures.length === 0) {
    return null;
  }

  const getActionLabel = (action: string): string => {
    if (action.includes('created')) return 'Created by';
    if (action.includes('updated')) return 'Updated by';
    if (action.includes('payment')) return 'Payment by';
    if (action.includes('collect')) return 'Collected by';
    if (action.includes('approved')) return 'Approved by';
    if (action.includes('recorded')) return 'Recorded by';
    return 'Processed by';
  };

  return (
    <View style={styles.signatureContainer}>
      <Text style={styles.signatureTitle}>Digital Signatures</Text>
      {signatures.map((signature, index) => (
        <View key={index} style={styles.signatureItem}>
          <Text>
            {getActionLabel(signature.action)}{' '}
            <Text style={styles.userName}>{signature.signature.userName}</Text>
            {showUserRole && (
              <Text style={styles.userRole}> ({signature.signature.userRole})</Text>
            )}
            {showTimestamp && (
              <Text style={styles.timestamp}>
                {' '}on {new Date(signature.timestamp).toLocaleDateString()}
              </Text>
            )}
          </Text>
        </View>
      ))}
    </View>
  );
}; 