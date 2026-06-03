"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DigitalSignatureDisplay, CompactSignature, DetailedSignature } from '@/components/common/digital-signature-display';
import { PaymentSignatureDisplay } from '@/app/fees/collect/[id]/components/PaymentSignatureDisplay';
import { RequirementSignatureDisplay } from '@/components/common/requirement-signature-display';
import { UniformSignatureDisplay } from '@/components/common/uniform-signature-display';
import { useRecordSignatures } from '@/lib/hooks/use-digital-signature';
import { Shield, CreditCard, Package, FileCheck, User, Clock } from 'lucide-react';

/**
 * COMPREHENSIVE DIGITAL SIGNATURE INTEGRATION EXAMPLES
 * 
 * This component shows you exactly how to add digital signatures to your UI.
 * Copy these patterns to your existing components to make signatures visible.
 */

export function DigitalSignatureExamples() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Digital Signature Integration Examples</h1>
        <p className="text-gray-600">Copy these patterns to add digital signatures to your components</p>
      </div>

      {/* 1. FEE PAYMENT SIGNATURES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-600" />
            Fee Payment Signatures
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Payment Record Example</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Tuition Fee Payment</span>
                <Badge variant="outline" className="bg-green-50 text-green-700">UGX 500,000</Badge>
              </div>
              <div className="text-xs text-gray-500">
                Payment Date: March 15, 2024
              </div>
              {/* This shows what the signature looks like */}
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <Shield className="w-3 h-3" />
                <span>Collected by John Doe • Mar 15, 2024 14:30</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">How to Add to Your FeeCard Component:</h4>
            <pre className="text-xs bg-blue-100 p-2 rounded overflow-x-auto text-blue-900">
{`// 1. Import the component
import { PaymentSignatureDisplay } from './PaymentSignatureDisplay';

// 2. Add to your payment history section:
{fee.payments?.map((payment) => (
  <div key={payment.id} className="payment-item">
    <div className="payment-amount">
      {formatCurrency(payment.amount)}
    </div>
    
    {/* ADD THIS LINE */}
    <PaymentSignatureDisplay 
      payment={payment} 
      className="text-xs mt-1" 
    />
  </div>
))}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* 2. REQUIREMENT COLLECTION SIGNATURES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-600" />
            Requirement Collection Signatures
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Requirement Example</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Birth Certificate</span>
                <Badge className="bg-green-100 text-green-800">Collected</Badge>
              </div>
              {/* This shows what requirement signatures look like */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-blue-600">
                  <FileCheck className="w-3 h-3" />
                  <span>Assigned by Mary Smith • Mar 10, 2024</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <Package className="w-3 h-3" />
                  <span>Collected by John Doe • Mar 15, 2024</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="font-medium text-purple-900 mb-2">How to Add to Your Requirement Components:</h4>
            <pre className="text-xs bg-purple-100 p-2 rounded overflow-x-auto text-purple-900">
{`// 1. Import the component
import { RequirementSignatureDisplay } from '@/components/common/requirement-signature-display';

// 2. Add to your requirement item:
<div className="requirement-item">
  <div className="requirement-name">{requirement.name}</div>
  <div className="requirement-status">{requirement.status}</div>
  
  {/* ADD THIS LINE */}
  <RequirementSignatureDisplay 
    recordId={requirement.id} 
    showActions={['created', 'payment', 'collection']}
    className="text-xs mt-1"
  />
</div>`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* 3. UNIFORM TRACKING SIGNATURES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            Uniform Tracking Signatures
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Uniform Order Example</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">School Uniform Set</span>
                <Badge className="bg-blue-100 text-blue-800">Paid</Badge>
              </div>
              {/* ADD THIS TO YOUR UNIFORM DISPLAYS */}
              <UniformSignatureExample uniformId="example-uniform-789" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. EXAM RESULT SIGNATURES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" />
            Exam Result Signatures
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Exam Result Example</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Mathematics - Term 1 Exam</span>
                <Badge className="bg-green-100 text-green-800">Grade: A</Badge>
              </div>
              {/* ADD THIS TO YOUR EXAM DISPLAYS */}
              <ExamSignatureExample examId="example-exam-101" />
            </div>
          </div>

          <div className="bg-red-50 p-4 rounded-lg">
            <h4 className="font-medium text-red-900 mb-2">How to Add to Your Exam Components:</h4>
            <pre className="text-xs bg-red-100 p-2 rounded overflow-x-auto">
{`// In your exam result display:
<div className="exam-result">
  <div className="subject-name">{exam.subject}</div>
  <div className="grade">{exam.grade}</div>
  
  {/* ADD THIS LINE */}
  <ExamResultSignatureDisplay 
    examId={exam.id}
    pupilId={pupil.id}
    className="text-xs mt-1"
  />
</div>`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* 5. SIGNATURE VARIANTS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-gray-600" />
            Signature Display Variants
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Inline Variant */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-2">Inline (Default)</h5>
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <Shield className="w-3 h-3" />
                <span>Collected by John Doe • Mar 15, 2024</span>
              </div>
              <p className="text-xs text-gray-600 mt-2">Best for: Lists, tables, compact displays</p>
            </div>

            {/* Badge Variant */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-2">Badge</h5>
              <Badge variant="outline" className="bg-blue-50 text-blue-600">
                <Shield className="w-3 h-3 mr-1" />
                Collected by John Doe
              </Badge>
              <p className="text-xs text-gray-600 mt-2">Best for: Status indicators, quick reference</p>
            </div>

            {/* Detailed Variant */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-2">Detailed</h5>
              <div className="border rounded-lg p-3 bg-muted/20">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-full bg-primary/10">
                    <Shield className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">Collected</div>
                      <Badge variant="outline" className="bg-blue-50 text-blue-600">Staff</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>John Doe</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Mar 15, 2024 14:30</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">Best for: Forms, detailed views, audit trails</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6. INTEGRATION CHECKLIST */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" />
            Quick Integration Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Steps to Add Signatures:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>Import the signature component</li>
                <li>Add the component to your JSX</li>
                <li>Pass the record ID</li>
                <li>Choose the appropriate variant</li>
                <li>Test with real data</li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Available Components:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                <li><code className="bg-gray-100 px-1 rounded">PaymentSignatureDisplay</code></li>
                <li><code className="bg-gray-100 px-1 rounded">RequirementSignatureDisplay</code></li>
                <li><code className="bg-gray-100 px-1 rounded">UniformSignatureDisplay</code></li>
                <li><code className="bg-gray-100 px-1 rounded">DigitalSignatureDisplay</code></li>
                <li><code className="bg-gray-100 px-1 rounded">CompactSignature</code></li>
                <li><code className="bg-gray-100 px-1 rounded">DetailedSignature</code></li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">🚀 Quick Start:</h4>
            <p className="text-sm text-yellow-800">
              To see digital signatures in action immediately, add this line to any component where you display payments, requirements, or other records:
            </p>
            <pre className="text-xs bg-yellow-100 p-2 rounded mt-2 text-yellow-900">
{`<PaymentSignatureDisplay payment={paymentRecord} className="text-xs" />`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Example Components (these show how the signatures would look)

function FeePaymentSignatureExample({ paymentId }: { paymentId: string }) {
  const { data: signatures, isLoading } = useRecordSignatures('fee_payment', paymentId);

  if (isLoading) {
    return <div className="text-xs text-gray-400">Loading signature...</div>;
  }

  if (!signatures || signatures.length === 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Shield className="w-3 h-3" />
        <span>Collected by John Doe • Mar 15, 2024 14:30</span>
      </div>
    );
  }

  const latestSignature = signatures[0];
  return (
    <DigitalSignatureDisplay
      signature={latestSignature.signature}
      action="Collected"
      variant="inline"
      className="text-xs"
    />
  );
}

function RequirementSignatureExample({ requirementId }: { requirementId: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-blue-600">
        <FileCheck className="w-3 h-3" />
        <span>Assigned by Mary Smith • Mar 10, 2024</span>
      </div>
      <div className="flex items-center gap-1 text-xs text-green-600">
        <Package className="w-3 h-3" />
        <span>Collected by John Doe • Mar 15, 2024</span>
      </div>
    </div>
  );
}

function UniformSignatureExample({ uniformId }: { uniformId: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-purple-600">
        <CreditCard className="w-3 h-3" />
        <span>Payment by Jane Parent • Mar 12, 2024</span>
      </div>
      <div className="flex items-center gap-1 text-xs text-blue-600">
        <Package className="w-3 h-3" />
        <span>Items collected by Store Keeper • Mar 16, 2024</span>
      </div>
    </div>
  );
}

function ExamSignatureExample({ examId }: { examId: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-red-600">
        <Shield className="w-3 h-3" />
        <span>Results recorded by Math Teacher • Mar 20, 2024</span>
      </div>
    </div>
  );
}

function SignatureVariantExample({ variant }: { variant: 'inline' | 'badge' | 'detailed' }) {
  const mockSignature = {
    userName: 'John Doe',
    userRole: 'Staff',
    timestamp: new Date().toISOString(),
    sessionId: 'session-123',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...'
  };

  return (
    <DigitalSignatureDisplay
      signature={mockSignature}
      action="Collected"
      variant={variant}
      showFullDetails={variant === 'detailed'}
      className="text-xs"
    />
  );
}

export default DigitalSignatureExamples; 