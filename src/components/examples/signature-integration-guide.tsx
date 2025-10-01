"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, CreditCard, Package, FileCheck, AlertCircle } from 'lucide-react';

/**
 * SIMPLE DIGITAL SIGNATURE INTEGRATION GUIDE
 * 
 * This shows you exactly how to add digital signatures to your UI components
 */

export function SignatureIntegrationGuide() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Digital Signature Integration Guide</h1>
        <p className="text-gray-600">Follow these steps to make digital signatures visible in your UI</p>
      </div>

      {/* PROBLEM EXPLANATION */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <AlertCircle className="w-5 h-5" />
            Why You Don't See Signatures Yet
          </CardTitle>
        </CardHeader>
        <CardContent className="text-orange-700">
          <p className="mb-3">
            The digital signature system is fully implemented in the backend, but the UI components 
            haven't been updated to display them yet. Here's how to fix that:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>The signature data is being stored when actions happen</li>
            <li>The display components exist and are ready to use</li>
            <li>You just need to add them to your existing UI components</li>
          </ul>
        </CardContent>
      </Card>

      {/* STEP 1: FEE PAYMENTS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-600" />
            Step 1: Add Signatures to Fee Payments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">What it will look like:</h4>
            <div className="bg-white p-3 border rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Tuition Fee Payment</span>
                <Badge className="bg-green-100 text-green-800">UGX 500,000</Badge>
              </div>
              <div className="text-xs text-gray-500 mb-1">
                Payment Date: March 15, 2024
              </div>
              {/* This is what the signature will look like */}
              <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                <Shield className="w-3 h-3" />
                <span>Collected by John Doe • Mar 15, 2024 14:30</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">How to add it:</h4>
            <div className="space-y-2 text-sm text-blue-800">
              <p><strong>File to edit:</strong> <code>src/app/fees/collect/[id]/components/FeeCard.tsx</code></p>
              <p><strong>Location:</strong> In the payment history section, around line 375</p>
            </div>
            <pre className="text-xs bg-blue-100 p-3 rounded mt-2 text-blue-900 overflow-x-auto">
{`// 1. Add this import at the top:
import { PaymentSignatureDisplay } from './PaymentSignatureDisplay';

// 2. Find the payment history section and add this after the payment details:
{fee.payments?.map((payment) => (
  <div key={payment.id} className="payment-item">
    {/* Your existing payment display code */}
    <div className="text-xs text-gray-500 mt-0.5">
      Paid by {payment.paidBy?.name || 'Unknown'}
    </div>
    
    {/* ADD THIS NEW LINE */}
    {payment.id && (
      <PaymentSignatureDisplay payment={payment} className="text-xs mt-1" />
    )}
  </div>
))}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* STEP 2: REQUIREMENTS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-600" />
            Step 2: Add Signatures to Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">What it will look like:</h4>
            <div className="bg-white p-3 border rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Birth Certificate</span>
                <Badge className="bg-green-100 text-green-800">Collected</Badge>
              </div>
              {/* This is what the signatures will look like */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  <FileCheck className="w-3 h-3" />
                  <span>Assigned by Mary Smith • Mar 10, 2024</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                  <Package className="w-3 h-3" />
                  <span>Collected by John Doe • Mar 15, 2024</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="font-medium text-purple-900 mb-2">How to add it:</h4>
            <div className="space-y-2 text-sm text-purple-800">
              <p><strong>File to edit:</strong> <code>src/app/requirement-tracking/page.tsx</code> (or wherever you display requirements)</p>
              <p><strong>Location:</strong> In the requirement item display</p>
            </div>
            <pre className="text-xs bg-purple-100 p-3 rounded mt-2 text-purple-900 overflow-x-auto">
{`// 1. Add this import at the top:
import { RequirementSignatureDisplay } from '@/components/common/requirement-signature-display';

// 2. Add this to your requirement display:
<div className="requirement-item">
  <div className="requirement-name">{requirement.name}</div>
  <div className="requirement-status">{requirement.status}</div>
  
  {/* ADD THIS NEW LINE */}
  <RequirementSignatureDisplay 
    recordId={requirement.id} 
    showActions={['created', 'payment', 'collection']}
    className="text-xs mt-2"
  />
</div>`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* STEP 3: QUICK TEST */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <Shield className="w-5 h-5" />
            Step 3: Quick Test
          </CardTitle>
        </CardHeader>
        <CardContent className="text-green-700">
          <div className="space-y-3">
            <p className="font-medium">To test if signatures are working:</p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Make a fee payment in your app</li>
              <li>Check if you see "Collected by [Name] • [Date]" below the payment</li>
              <li>If you don't see it, the component isn't added yet</li>
              <li>If you see "Loading signature..." it means the backend is working</li>
            </ol>
            
            <div className="bg-green-100 p-3 rounded mt-3">
              <p className="text-sm font-medium text-green-900">💡 Pro Tip:</p>
              <p className="text-sm text-green-800">
                Start with just the fee payments first. Once you see those working, 
                add signatures to other components using the same pattern.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AVAILABLE COMPONENTS */}
      <Card>
        <CardHeader>
          <CardTitle>Available Signature Components</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Ready-to-use Components:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                <li><code className="bg-gray-100 px-1 rounded">PaymentSignatureDisplay</code></li>
                <li><code className="bg-gray-100 px-1 rounded">RequirementSignatureDisplay</code></li>
                <li><code className="bg-gray-100 px-1 rounded">UniformSignatureDisplay</code></li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Generic Components:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                <li><code className="bg-gray-100 px-1 rounded">DigitalSignatureDisplay</code></li>
                <li><code className="bg-gray-100 px-1 rounded">CompactSignature</code></li>
                <li><code className="bg-gray-100 px-1 rounded">DetailedSignature</code></li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SignatureIntegrationGuide; 