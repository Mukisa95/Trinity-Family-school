"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DigitalSignatureDisplay, CompactSignature, DetailedSignature } from '@/components/common/digital-signature-display';
import { useDigitalSignatureHelpers } from '@/lib/hooks/use-digital-signature';
import { useAuth } from '@/lib/contexts/auth-context';
import { Shield, CreditCard, Package, FileCheck, User, Clock, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

/**
 * TEST PAGE FOR DIGITAL SIGNATURES
 * 
 * This page demonstrates how digital signatures work and lets you test them
 * Visit: http://localhost:9004/test-signatures
 */

export default function TestSignaturesPage() {
  const { user } = useAuth();
  const { signAction } = useDigitalSignatureHelpers();
  const [testRecordId, setTestRecordId] = useState('');
  const [isCreatingSignature, setIsCreatingSignature] = useState(false);
  const [createdSignatures, setCreatedSignatures] = useState<any[]>([]);

  // Mock signature data for demonstration
  const mockSignatures = [
    {
      id: 'sig-1',
      signature: {
        userName: 'John Doe', // Full name instead of username
        userRole: 'Staff',
        timestamp: new Date().toISOString(),
        sessionId: 'session-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      action: 'payment_collected',
      timestamp: new Date().toISOString()
    },
    {
      id: 'sig-2',
      signature: {
        userName: 'Mary Smith', // Full name instead of username
        userRole: 'Admin',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        sessionId: 'session-456',
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      action: 'requirement_assigned',
      timestamp: new Date(Date.now() - 3600000).toISOString()
    }
  ];

  const handleCreateTestSignature = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to create test signatures",
        variant: "destructive"
      });
      return;
    }

    if (!testRecordId.trim()) {
      toast({
        title: "Record ID Required",
        description: "Please enter a test record ID",
        variant: "destructive"
      });
      return;
    }

    setIsCreatingSignature(true);
    try {
      await signAction(
        'test_record',
        testRecordId,
        'test_action',
        {
          testData: 'This is a test signature',
          amount: 100000,
          timestamp: new Date().toISOString()
        }
      );

      const newSignature = {
        id: `sig-${Date.now()}`,
        signature: {
          userName: `${user.firstName} ${user.lastName}`.trim() || user.username,
          userRole: user.role || 'User',
          timestamp: new Date().toISOString(),
          sessionId: `session-${Date.now()}`,
          ipAddress: 'client-side',
          userAgent: navigator.userAgent
        },
        action: 'test_action',
        timestamp: new Date().toISOString()
      };

      setCreatedSignatures(prev => [newSignature, ...prev]);

      toast({
        title: "Signature Created",
        description: `Test signature created for record: ${testRecordId}`,
        variant: "default"
      });

      setTestRecordId('');
    } catch (error) {
      console.error('Error creating signature:', error);
      toast({
        title: "Error",
        description: "Failed to create test signature",
        variant: "destructive"
      });
    } finally {
      setIsCreatingSignature(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Digital Signatures Test Page</h1>
        <p className="text-gray-600">Test and demonstrate digital signature functionality</p>
        {user && (
          <Badge className="bg-green-100 text-green-800">
            <User className="w-3 h-3 mr-1" />
            Logged in as: {user.firstName} {user.lastName}
          </Badge>
        )}
      </div>

      {/* Test Signature Creation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Create Test Signature
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recordId">Test Record ID</Label>
            <Input
              id="recordId"
              value={testRecordId}
              onChange={(e) => setTestRecordId(e.target.value)}
              placeholder="Enter any test ID (e.g., payment-123)"
              className="max-w-md"
            />
          </div>
          <Button 
            onClick={handleCreateTestSignature}
            disabled={isCreatingSignature || !user}
            className="flex items-center gap-2"
          >
            {isCreatingSignature ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Create Test Signature
              </>
            )}
          </Button>
          {!user && (
            <p className="text-sm text-red-600">Please log in to create signatures</p>
          )}
        </CardContent>
      </Card>

      {/* Signature Variants Demo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-purple-600" />
            Signature Display Variants
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Inline Variant */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Inline Variant (Default)</h4>
              <div className="bg-gray-50 p-3 rounded-lg">
                <DigitalSignatureDisplay
                  signature={mockSignatures[0].signature}
                  action="Collected"
                  variant="inline"
                  className="text-sm"
                />
              </div>
              <p className="text-xs text-gray-600">Best for: Lists, tables, compact displays</p>
            </div>

            {/* Badge Variant */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Badge Variant</h4>
              <div className="bg-gray-50 p-3 rounded-lg">
                <CompactSignature
                  signature={mockSignatures[0].signature}
                  action="Collected"
                  className="text-sm"
                />
              </div>
              <p className="text-xs text-gray-600">Best for: Status indicators, quick reference</p>
            </div>

            {/* Detailed Variant */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Detailed Variant</h4>
              <div className="bg-gray-50 p-3 rounded-lg">
                <DetailedSignature
                  signature={mockSignatures[0].signature}
                  action="Collected"
                  showFullDetails={true}
                  className="text-sm"
                />
              </div>
              <p className="text-xs text-gray-600">Best for: Forms, detailed views, audit trails</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-world Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-600" />
            Real-world Examples
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Fee Payment Example */}
          <div className="bg-white border rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium text-gray-900">Fee Payment Record</h4>
              <Badge className="bg-green-100 text-green-800">UGX 500,000</Badge>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div>Payment Date: {new Date().toLocaleDateString()}</div>
              <div>Paid by: John Parent</div>
              <div className="pt-2 border-t">
                <DigitalSignatureDisplay
                  signature={mockSignatures[0].signature}
                  action="Collected"
                  variant="inline"
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Requirement Example */}
          <div className="bg-white border rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium text-gray-900">Requirement Record</h4>
              <Badge className="bg-blue-100 text-blue-800">Birth Certificate</Badge>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div>Status: Collected</div>
              <div className="pt-2 border-t space-y-1">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-3 h-3 text-blue-600" />
                  <DigitalSignatureDisplay
                    signature={mockSignatures[1].signature}
                    action="Assigned"
                    variant="inline"
                    className="text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Package className="w-3 h-3 text-green-600" />
                  <DigitalSignatureDisplay
                    signature={mockSignatures[0].signature}
                    action="Collected"
                    variant="inline"
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Created Signatures */}
      {createdSignatures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Your Created Signatures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {createdSignatures.map((sig) => (
                <div key={sig.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className="bg-green-100 text-green-800">Test Signature</Badge>
                    <span className="text-xs text-green-600">Just created</span>
                  </div>
                  <DetailedSignature
                    signature={sig.signature}
                    action="Test Action"
                    showFullDetails={true}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integration Guide */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">How to See Signatures in Your App</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 space-y-3">
          <div>
            <h4 className="font-medium mb-2">Step 1: Make a Payment</h4>
            <p className="text-sm">Go to the fee collection page and make a payment. The signature will be automatically created.</p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Step 2: Check Payment History</h4>
            <p className="text-sm">Look at the payment history section in the fee card. You should see "Collected by [Name] • [Date]" below each payment.</p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Step 3: View Other Records</h4>
            <p className="text-sm">Similar signatures will appear in requirement tracking, uniform management, and other areas where actions are recorded.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 