# SurePay Integration Guide

## Table of Contents
1. [Integration Overview](#integration-overview)
2. [Integration Architecture](#integration-architecture)
3. [Your Application APIs](#your-application-apis)
4. [SurePay APIs Required](#surepay-apis-required)
5. [Implementation Workflow](#implementation-workflow)
6. [Data Flow Diagrams](#data-flow-diagrams)
7. [Security Considerations](#security-considerations)
8. [Testing Strategy](#testing-strategy)

---

## Integration Overview

### Goals
1. **Bi-directional Pupil Registration Sync**: Register pupils in your system and automatically sync to SurePay
2. **Payment Capture**: Automatically fetch and record payments made via SurePay
3. **Pay Code Management**: Auto-fetch and store pupil pay codes from SurePay
4. **Promotion Sync**: Automatically update pupil class/grade in SurePay when promoted in your system

### Integration Type
**Hybrid Approach**: 
- **Push Model**: Your system pushes pupil registration and promotion data to SurePay
- **Pull/Webhook Model**: Your system fetches payments from SurePay (via webhook or polling)

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your School System                        │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │   Pupil Reg    │  │   Promotion    │  │     Fees     │  │
│  │   Component    │  │   Component    │  │  Collection  │  │
│  └────────┬───────┘  └────────┬───────┘  └──────▲───────┘  │
│           │                    │                  │          │
│           ▼                    ▼                  │          │
│  ┌──────────────────────────────────────────────┴───────┐  │
│  │         SurePay Integration Service Layer            │  │
│  │  ┌────────────────┐  ┌────────────────────────────┐ │  │
│  │  │ Sync Service   │  │  Payment Webhook Handler   │ │  │
│  │  └────────────────┘  └────────────────────────────┘ │  │
│  └──────────┬────────────────────────────────▲──────────┘  │
│             │                                 │             │
└─────────────┼─────────────────────────────────┼─────────────┘
              │                                 │
              │ HTTPS/REST API                  │ Webhook
              ▼                                 │
┌─────────────────────────────────────────────────────────────┐
│                       SurePay System                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Student    │  │   Payment    │  │   Pay Code       │  │
│  │   Registry   │  │   Processing │  │   Management     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Your Application APIs

These are the internal APIs/services you need to build in your application to handle SurePay integration.

### 1. SurePay Integration Service

**File Location**: `src/lib/services/surepay-integration.service.ts`

```typescript
import { db } from '../firebase';
import { collection, doc, addDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import type { Pupil, PaymentRecord } from '@/types';

interface SurePayConfig {
  apiUrl: string;
  apiKey: string;
  schoolId: string;
  webhookSecret: string;
}

interface SurePayPupilData {
  schoolStudentId: string; // Your admission number
  firstName: string;
  lastName: string;
  otherNames?: string;
  dateOfBirth?: string;
  gender: string;
  classId: string;
  className: string;
  section: string;
  guardians: Array<{
    name: string;
    phone: string;
    email?: string;
    relationship: string;
  }>;
  registrationDate: string;
}

interface SurePayPromotionData {
  schoolStudentId: string;
  fromClassId: string;
  fromClassName: string;
  toClassId: string;
  toClassName: string;
  promotionDate: string;
  academicYearId: string;
}

interface SurePayPayment {
  paymentId: string;
  schoolStudentId: string;
  payCode: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  transactionReference: string;
  payerName: string;
  payerPhone: string;
  feeItems: Array<{
    feeId: string;
    feeName: string;
    amount: number;
  }>;
}

export class SurePayIntegrationService {
  private static config: SurePayConfig = {
    apiUrl: process.env.NEXT_PUBLIC_SUREPAY_API_URL || '',
    apiKey: process.env.SUREPAY_API_KEY || '',
    schoolId: process.env.NEXT_PUBLIC_SUREPAY_SCHOOL_ID || '',
    webhookSecret: process.env.SUREPAY_WEBHOOK_SECRET || ''
  };

  /**
   * Register a pupil in SurePay system
   */
  static async registerPupilInSurePay(pupil: Pupil): Promise<{ success: boolean; payCode?: string; error?: string }> {
    try {
      // Prepare data for SurePay
      const surePayData: SurePayPupilData = {
        schoolStudentId: pupil.admissionNumber,
        firstName: pupil.firstName,
        lastName: pupil.lastName,
        otherNames: pupil.otherNames,
        dateOfBirth: pupil.dateOfBirth,
        gender: pupil.gender,
        classId: pupil.classId,
        className: pupil.className || '',
        section: pupil.section,
        guardians: pupil.guardians.map(g => ({
          name: g.name,
          phone: g.phone,
          email: g.email,
          relationship: g.relationship
        })),
        registrationDate: pupil.registrationDate || new Date().toISOString()
      };

      // Call SurePay API
      const response = await fetch(`${this.config.apiUrl}/students/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-School-ID': this.config.schoolId
        },
        body: JSON.stringify(surePayData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to register pupil in SurePay');
      }

      const result = await response.json();
      
      // Store pay code in your system
      if (result.payCode) {
        await this.storeSurePayData(pupil.id, {
          payCode: result.payCode,
          surePayStudentId: result.studentId,
          registeredAt: new Date().toISOString()
        });
      }

      return { success: true, payCode: result.payCode };
    } catch (error) {
      console.error('Error registering pupil in SurePay:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Sync pupil promotion to SurePay
   */
  static async syncPromotionToSurePay(promotionData: SurePayPromotionData): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.config.apiUrl}/students/promote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-School-ID': this.config.schoolId
        },
        body: JSON.stringify(promotionData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to sync promotion to SurePay');
      }

      return { success: true };
    } catch (error) {
      console.error('Error syncing promotion to SurePay:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Fetch payments from SurePay for a specific pupil
   */
  static async fetchPupilPayments(admissionNumber: string, fromDate?: string): Promise<SurePayPayment[]> {
    try {
      const params = new URLSearchParams({
        schoolStudentId: admissionNumber,
        ...(fromDate && { fromDate })
      });

      const response = await fetch(
        `${this.config.apiUrl}/payments/student?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'X-School-ID': this.config.schoolId
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch payments from SurePay');
      }

      const data = await response.json();
      return data.payments || [];
    } catch (error) {
      console.error('Error fetching pupil payments from SurePay:', error);
      throw error;
    }
  }

  /**
   * Fetch all payments from SurePay since last sync
   */
  static async fetchAllPaymentsSinceLastSync(): Promise<SurePayPayment[]> {
    try {
      // Get last sync timestamp from your database
      const lastSync = await this.getLastSyncTimestamp();
      
      const params = new URLSearchParams({
        fromDate: lastSync || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Default to 7 days ago
      });

      const response = await fetch(
        `${this.config.apiUrl}/payments/school?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'X-School-ID': this.config.schoolId
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch payments from SurePay');
      }

      const data = await response.json();
      
      // Update last sync timestamp
      await this.updateLastSyncTimestamp(new Date().toISOString());
      
      return data.payments || [];
    } catch (error) {
      console.error('Error fetching payments from SurePay:', error);
      throw error;
    }
  }

  /**
   * Process and record SurePay payment in your system
   */
  static async recordSurePayPayment(surePayPayment: SurePayPayment, pupilId: string): Promise<string> {
    try {
      // Find the pupil's current academic year and term
      const { AcademicYearsService } = await import('./academic-years.service');
      const activeYear = await AcademicYearsService.getActiveAcademicYear();
      
      if (!activeYear) {
        throw new Error('No active academic year found');
      }

      // Find current term (you may need to adjust this logic)
      const currentDate = new Date();
      const currentTerm = activeYear.terms.find(term => {
        const termStart = new Date(term.startDate);
        const termEnd = new Date(term.endDate);
        return currentDate >= termStart && currentDate <= termEnd;
      });

      if (!currentTerm) {
        throw new Error('No active term found');
      }

      // Create payment records for each fee item
      const { PaymentsService } = await import('./payments.service');
      const paymentIds: string[] = [];

      for (const feeItem of surePayPayment.feeItems) {
        const paymentRecord = {
          pupilId: pupilId,
          feeStructureId: feeItem.feeId,
          academicYearId: activeYear.id,
          termId: currentTerm.id,
          amount: feeItem.amount,
          paymentDate: surePayPayment.paymentDate,
          paidBy: {
            id: 'surepay-system',
            name: surePayPayment.payerName,
            role: 'Parent'
          },
          notes: `SurePay payment - Transaction: ${surePayPayment.transactionReference}`,
          // Add custom fields to track SurePay origin
          surePayPaymentId: surePayPayment.paymentId,
          surePayTransactionRef: surePayPayment.transactionReference,
          paymentMethod: surePayPayment.paymentMethod
        };

        const paymentId = await PaymentsService.createPayment(paymentRecord as any);
        paymentIds.push(paymentId);
      }

      // Log the sync
      await this.logPaymentSync({
        surePayPaymentId: surePayPayment.paymentId,
        pupilId: pupilId,
        amount: surePayPayment.amount,
        paymentIds: paymentIds,
        syncedAt: new Date().toISOString()
      });

      return paymentIds[0]; // Return first payment ID
    } catch (error) {
      console.error('Error recording SurePay payment:', error);
      throw error;
    }
  }

  /**
   * Fetch pay code for a pupil
   */
  static async fetchPayCode(admissionNumber: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/students/${admissionNumber}/paycode`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'X-School-ID': this.config.schoolId
          }
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.payCode || null;
    } catch (error) {
      console.error('Error fetching pay code:', error);
      return null;
    }
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(payload: string, signature: string): boolean {
    // Implement HMAC verification
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  // Helper methods
  private static async storeSurePayData(pupilId: string, data: any): Promise<void> {
    // Store in additionalIdentifiers
    const pupilRef = doc(db, 'pupils', pupilId);
    await updateDoc(pupilRef, {
      'additionalIdentifiers': [
        { idType: 'SurePay Pay Code', idValue: data.payCode }
      ]
    });
  }

  private static async getLastSyncTimestamp(): Promise<string | null> {
    try {
      const syncRef = doc(db, 'systemSettings', 'surePaySync');
      const syncDoc = await getDocs(query(collection(db, 'systemSettings'), where('id', '==', 'surePaySync')));
      if (!syncDoc.empty) {
        return syncDoc.docs[0].data().lastSyncTimestamp;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private static async updateLastSyncTimestamp(timestamp: string): Promise<void> {
    const syncRef = doc(db, 'systemSettings', 'surePaySync');
    await updateDoc(syncRef, { lastSyncTimestamp: timestamp });
  }

  private static async logPaymentSync(logData: any): Promise<void> {
    await addDoc(collection(db, 'surePaySyncLogs'), {
      ...logData,
      createdAt: new Date().toISOString()
    });
  }
}
```

### 2. Webhook Handler API Route

**File Location**: `src/app/api/webhooks/surepay/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { SurePayIntegrationService } from '@/lib/services/surepay-integration.service';
import { PupilsService } from '@/lib/services/pupils.service';

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('X-SurePay-Signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // Verify webhook signature
    const isValid = SurePayIntegrationService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse the payload
    const payload = JSON.parse(rawBody);
    const { eventType, data } = payload;

    switch (eventType) {
      case 'payment.completed':
        await handlePaymentCompleted(data);
        break;
      
      case 'payment.reversed':
        await handlePaymentReversed(data);
        break;

      default:
        console.log('Unhandled event type:', eventType);
    }

    return NextResponse.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePaymentCompleted(paymentData: any) {
  // Find pupil by admission number
  const allPupils = await PupilsService.getAllPupils();
  const pupil = allPupils.find(p => p.admissionNumber === paymentData.schoolStudentId);

  if (!pupil) {
    console.error('Pupil not found for payment:', paymentData.schoolStudentId);
    return;
  }

  // Record the payment
  await SurePayIntegrationService.recordSurePayPayment(paymentData, pupil.id);
}

async function handlePaymentReversed(paymentData: any) {
  // Implement payment reversal logic
  console.log('Payment reversed:', paymentData);
  // Find the payment in your system and mark as reverted
}
```

### 3. Modified Pupil Registration Service

**Modification to**: `src/lib/services/pupils.service.ts`

Add this method to the `PupilsService` class:

```typescript
static async createPupilWithSurePaySync(pupilData: Omit<Pupil, 'id' | 'createdAt'>): Promise<{ pupilId: string; payCode?: string }> {
  try {
    // First, create pupil in your system
    const pupilId = await this.createPupil(pupilData);
    
    // Then, sync to SurePay
    const pupil = await this.getPupilById(pupilId);
    if (pupil) {
      const surePayResult = await SurePayIntegrationService.registerPupilInSurePay(pupil);
      
      if (surePayResult.success && surePayResult.payCode) {
        return { pupilId, payCode: surePayResult.payCode };
      }
    }
    
    return { pupilId };
  } catch (error) {
    console.error('Error creating pupil with SurePay sync:', error);
    throw error;
  }
}
```

### 4. Modified Promotion Handler

**Modification to**: `src/app/pupils/promote/page.tsx`

Update the `handleProcessPupils` function to include SurePay sync:

```typescript
const handleProcessPupils = async () => {
  // ... existing validation code ...

  try {
    let processedCount = 0;
    
    for (const pupilId of selectedPupilIds) {
      const pupil = allPupils.find(p => p.id === pupilId);
      if (pupil) {
        const historyEntry = {
          date: new Date().toISOString(),
          fromClassId: pupil.classId,
          fromClassName: pupil.className,
          toClassId: toClass.id,
          toClassName: toClass.name,
          type: promotionType,
          notes: `Processed on ${new Date().toLocaleDateString()}`,
          processedBy: "System Admin",
        };

        // Update in your system
        const { id, createdAt, ...updateData } = pupil;
        await updatePupilMutation.mutateAsync({
          id: pupil.id,
          data: {
            ...updateData,
            classId: toClass.id,
            className: toClass.name,
            promotionHistory: [...(pupil.promotionHistory || []), historyEntry],
          }
        });

        // Sync to SurePay
        await SurePayIntegrationService.syncPromotionToSurePay({
          schoolStudentId: pupil.admissionNumber,
          fromClassId: pupil.classId,
          fromClassName: pupil.className || '',
          toClassId: toClass.id,
          toClassName: toClass.name,
          promotionDate: new Date().toISOString(),
          academicYearId: activeAcademicYear?.id || ''
        });

        processedCount++;
      }
    }

    toast({
      title: "Processing Complete",
      description: `${processedCount} pupil(s) processed and synced to SurePay.`,
    });
  } catch (error) {
    // ... error handling ...
  }
};
```

---

## SurePay APIs Required

These are the APIs that SurePay must provide for the integration to work.

### 1. Student Registration API

**Endpoint**: `POST /api/v1/students/register`

**Purpose**: Register a new student in SurePay system

**Request Headers**:
```
Authorization: Bearer {API_KEY}
Content-Type: application/json
X-School-ID: {SCHOOL_ID}
```

**Request Body**:
```json
{
  "schoolStudentId": "ADM2024001",
  "firstName": "John",
  "lastName": "Doe",
  "otherNames": "Michael",
  "dateOfBirth": "2015-05-15",
  "gender": "Male",
  "classId": "class-123",
  "className": "Primary 3",
  "section": "Day",
  "guardians": [
    {
      "name": "Jane Doe",
      "phone": "+256700123456",
      "email": "jane.doe@example.com",
      "relationship": "Mother"
    }
  ],
  "registrationDate": "2024-01-15T10:30:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Student registered successfully",
  "data": {
    "studentId": "sp-student-789",
    "payCode": "PAY-12345678",
    "schoolStudentId": "ADM2024001",
    "registeredAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_STUDENT",
    "message": "Student with this ID already exists"
  }
}
```

---

### 2. Student Promotion/Update API

**Endpoint**: `POST /api/v1/students/promote`

**Purpose**: Update student's class/grade information

**Request Headers**:
```
Authorization: Bearer {API_KEY}
Content-Type: application/json
X-School-ID: {SCHOOL_ID}
```

**Request Body**:
```json
{
  "schoolStudentId": "ADM2024001",
  "fromClassId": "class-123",
  "fromClassName": "Primary 3",
  "toClassId": "class-456",
  "toClassName": "Primary 4",
  "promotionDate": "2024-09-01T00:00:00Z",
  "academicYearId": "ay-2024-2025"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Student promoted successfully",
  "data": {
    "studentId": "sp-student-789",
    "schoolStudentId": "ADM2024001",
    "currentClass": "Primary 4",
    "updatedAt": "2024-09-01T00:00:00Z"
  }
}
```

---

### 3. Get Student Pay Code API

**Endpoint**: `GET /api/v1/students/{schoolStudentId}/paycode`

**Purpose**: Retrieve the pay code for a specific student

**Request Headers**:
```
Authorization: Bearer {API_KEY}
X-School-ID: {SCHOOL_ID}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "schoolStudentId": "ADM2024001",
    "payCode": "PAY-12345678",
    "status": "active",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### 4. Get Student Payments API

**Endpoint**: `GET /api/v1/payments/student?schoolStudentId={id}&fromDate={date}`

**Purpose**: Retrieve all payments for a specific student

**Request Headers**:
```
Authorization: Bearer {API_KEY}
X-School-ID: {SCHOOL_ID}
```

**Query Parameters**:
- `schoolStudentId` (required): The student's admission number
- `fromDate` (optional): ISO 8601 date to fetch payments from

**Response**:
```json
{
  "success": true,
  "data": {
    "studentId": "sp-student-789",
    "schoolStudentId": "ADM2024001",
    "payments": [
      {
        "paymentId": "sp-pay-001",
        "schoolStudentId": "ADM2024001",
        "payCode": "PAY-12345678",
        "amount": 500000,
        "paymentDate": "2024-11-10T14:30:00Z",
        "paymentMethod": "Mobile Money",
        "transactionReference": "MM-20241110-12345",
        "payerName": "Jane Doe",
        "payerPhone": "+256700123456",
        "status": "completed",
        "feeItems": [
          {
            "feeId": "fee-tuition",
            "feeName": "Tuition",
            "amount": 300000
          },
          {
            "feeId": "fee-lunch",
            "feeName": "Lunch",
            "amount": 200000
          }
        ]
      }
    ]
  }
}
```

---

### 5. Get School Payments API

**Endpoint**: `GET /api/v1/payments/school?fromDate={date}&toDate={date}`

**Purpose**: Retrieve all payments for the school within a date range

**Request Headers**:
```
Authorization: Bearer {API_KEY}
X-School-ID: {SCHOOL_ID}
```

**Query Parameters**:
- `fromDate` (optional): ISO 8601 start date
- `toDate` (optional): ISO 8601 end date
- `limit` (optional): Number of records to return (default: 100)
- `offset` (optional): Pagination offset

**Response**:
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "paymentId": "sp-pay-001",
        "schoolStudentId": "ADM2024001",
        "payCode": "PAY-12345678",
        "amount": 500000,
        "paymentDate": "2024-11-10T14:30:00Z",
        "paymentMethod": "Mobile Money",
        "transactionReference": "MM-20241110-12345",
        "payerName": "Jane Doe",
        "payerPhone": "+256700123456",
        "status": "completed",
        "feeItems": [
          {
            "feeId": "fee-tuition",
            "feeName": "Tuition",
            "amount": 300000
          }
        ]
      },
      // ... more payments
    ],
    "pagination": {
      "total": 250,
      "limit": 100,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

### 6. Payment Webhook

**Endpoint**: `POST {YOUR_WEBHOOK_URL}/api/webhooks/surepay`

**Purpose**: Real-time notification when a payment is made

**Request Headers**:
```
Content-Type: application/json
X-SurePay-Signature: {HMAC_SHA256_SIGNATURE}
X-SurePay-Event: payment.completed
```

**Webhook Payload**:
```json
{
  "eventType": "payment.completed",
  "eventId": "evt-123456",
  "timestamp": "2024-11-10T14:30:00Z",
  "data": {
    "paymentId": "sp-pay-001",
    "schoolStudentId": "ADM2024001",
    "payCode": "PAY-12345678",
    "amount": 500000,
    "paymentDate": "2024-11-10T14:30:00Z",
    "paymentMethod": "Mobile Money",
    "transactionReference": "MM-20241110-12345",
    "payerName": "Jane Doe",
    "payerPhone": "+256700123456",
    "status": "completed",
    "feeItems": [
      {
        "feeId": "fee-tuition",
        "feeName": "Tuition",
        "amount": 300000
      },
      {
        "feeId": "fee-lunch",
        "feeName": "Lunch",
        "amount": 200000
      }
    ]
  }
}
```

**Your Response**:
```json
{
  "success": true,
  "message": "Webhook processed"
}
```

---

## Implementation Workflow

### Phase 1: Setup and Configuration (Week 1)

1. **Obtain SurePay Credentials**
   - API Key
   - School ID
   - Webhook Secret
   - API Base URL

2. **Configure Environment Variables**
   ```env
   NEXT_PUBLIC_SUREPAY_API_URL=https://api.surepay.com/v1
   SUREPAY_API_KEY=your_api_key_here
   NEXT_PUBLIC_SUREPAY_SCHOOL_ID=your_school_id
   SUREPAY_WEBHOOK_SECRET=your_webhook_secret
   ```

3. **Create Integration Service**
   - Implement `SurePayIntegrationService` class
   - Add error handling and logging

### Phase 2: Pupil Registration Sync (Week 2)

1. **Update Registration Flow**
   - Modify `src/app/pupils/new/page.tsx`
   - Add SurePay sync after successful pupil creation
   - Display pay code to user

2. **Test Registration**
   - Test with SurePay sandbox/test environment
   - Verify pay code generation
   - Handle errors gracefully

### Phase 3: Payment Integration (Week 3)

1. **Implement Webhook Handler**
   - Create API route for webhook
   - Implement signature verification
   - Test webhook reception

2. **Implement Payment Fetching**
   - Create scheduled job to fetch payments
   - Process and record payments
   - Handle duplicate payment prevention

3. **Create Payment Sync UI**
   - Add manual sync button in fees collection
   - Display sync status and last sync time

### Phase 4: Promotion Sync (Week 4)

1. **Update Promotion Flow**
   - Modify `src/app/pupils/promote/page.tsx`
   - Add SurePay sync after promotion
   - Handle bulk promotions

2. **Test Promotion**
   - Test individual and bulk promotions
   - Verify data consistency

### Phase 5: Testing and Deployment (Week 5)

1. **Integration Testing**
   - End-to-end testing of all flows
   - Error scenario testing
   - Performance testing

2. **Deploy to Production**
   - Configure production credentials
   - Set up monitoring and alerts
   - Train staff on new features

---

## Data Flow Diagrams

### Registration Flow

```
User Registers Pupil in Your System
          │
          ▼
Your System Creates Pupil Record
          │
          ▼
Your System Calls SurePay API
   POST /students/register
          │
          ▼
SurePay Creates Student & Generates Pay Code
          │
          ▼
SurePay Returns Pay Code
          │
          ▼
Your System Stores Pay Code in Pupil Record
          │
          ▼
Display Pay Code to User
```

### Payment Flow (Webhook)

```
Parent Makes Payment via SurePay
          │
          ▼
SurePay Processes Payment
          │
          ▼
SurePay Sends Webhook to Your System
   POST /api/webhooks/surepay
          │
          ▼
Your System Verifies Signature
          │
          ▼
Your System Finds Pupil by Admission Number
          │
          ▼
Your System Creates Payment Record(s)
          │
          ▼
Your System Responds 200 OK
          │
          ▼
Payment Appears in Fees Collection
```

### Payment Flow (Polling - Alternative)

```
Scheduled Job Runs (e.g., every 15 minutes)
          │
          ▼
Your System Calls SurePay API
   GET /payments/school?fromDate={lastSync}
          │
          ▼
SurePay Returns New Payments
          │
          ▼
Your System Processes Each Payment
          │
          ▼
Your System Creates Payment Records
          │
          ▼
Your System Updates Last Sync Timestamp
```

### Promotion Flow

```
User Promotes Pupil(s) in Your System
          │
          ▼
Your System Updates Pupil Class
          │
          ▼
Your System Calls SurePay API
   POST /students/promote
          │
          ▼
SurePay Updates Student Class
          │
          ▼
SurePay Returns Success
          │
          ▼
Display Success Message
```

---

## Security Considerations

### 1. API Authentication

- **Always use HTTPS** for all API communications
- Store API keys in environment variables, never in code
- Use different API keys for development, testing, and production
- Rotate API keys periodically

### 2. Webhook Security

- **Verify webhook signatures** for every incoming request
- Use HMAC-SHA256 for signature verification
- Implement request timestamp validation to prevent replay attacks
- Rate limit webhook endpoint to prevent abuse

```typescript
// Example signature verification
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### 3. Data Privacy

- Only send necessary data to SurePay
- Don't expose sensitive pupil data in logs
- Implement data encryption for sensitive fields
- Comply with data protection regulations

### 4. Error Handling

- Don't expose internal errors to external APIs
- Log all integration errors for debugging
- Implement retry mechanisms for failed API calls
- Set up alerts for integration failures

---

## Testing Strategy

### 1. Unit Tests

Test individual functions:
- `registerPupilInSurePay()`
- `syncPromotionToSurePay()`
- `recordSurePayPayment()`
- `verifyWebhookSignature()`

### 2. Integration Tests

Test API interactions:
- Mock SurePay API responses
- Test error scenarios (network failures, invalid responses)
- Test webhook handling

### 3. End-to-End Tests

Test complete workflows:
1. Register pupil → Verify in SurePay → Check pay code
2. Make payment in SurePay → Verify webhook → Check payment record
3. Promote pupil → Verify in SurePay → Check updated class

### 4. Test Scenarios

#### Registration Tests
- ✅ New pupil registration
- ✅ Pupil with existing admission number
- ✅ Invalid data handling
- ✅ Network failure during registration

#### Payment Tests
- ✅ Single payment processing
- ✅ Multiple payments for same pupil
- ✅ Duplicate payment prevention
- ✅ Invalid webhook signature
- ✅ Payment reversal

#### Promotion Tests
- ✅ Single pupil promotion
- ✅ Bulk pupil promotion
- ✅ Cross-section promotion (Day to Boarding)
- ✅ Failed promotion handling

---

## Additional Recommendations

### 1. Create a Sync Dashboard

Create a dashboard page to monitor SurePay integration:

**Location**: `src/app/settings/surepay-sync/page.tsx`

Features:
- Last sync timestamp
- Total synced pupils
- Total synced payments
- Failed sync attempts
- Manual sync buttons
- Sync logs

### 2. Add Database Tables

Create additional Firebase collections:

```typescript
// Collection: surePaySyncLogs
interface SurePaySyncLog {
  id: string;
  type: 'registration' | 'payment' | 'promotion';
  status: 'success' | 'failed';
  pupilId?: string;
  paymentId?: string;
  errorMessage?: string;
  timestamp: string;
}

// Collection: surePayPaymentMappings
interface SurePayPaymentMapping {
  id: string;
  surePayPaymentId: string;
  localPaymentIds: string[];
  pupilId: string;
  amount: number;
  syncedAt: string;
}
```

### 3. Implement Retry Mechanism

For failed API calls:

```typescript
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 4. Set Up Monitoring

Use logging and monitoring tools:
- Log all API calls and responses
- Set up alerts for integration failures
- Monitor webhook endpoint health
- Track sync performance metrics

---

## Summary Checklist

### Your Team's Responsibilities
- [ ] Implement SurePayIntegrationService
- [ ] Create webhook handler endpoint
- [ ] Modify pupil registration flow
- [ ] Modify promotion flow
- [ ] Implement payment sync logic
- [ ] Create sync dashboard (optional)
- [ ] Set up monitoring and logging
- [ ] Write tests
- [ ] Deploy to production

### SurePay's Responsibilities
- [ ] Provide API documentation
- [ ] Provide API credentials (API Key, School ID)
- [ ] Provide webhook secret
- [ ] Provide sandbox/test environment
- [ ] Implement required APIs:
  - POST /students/register
  - POST /students/promote
  - GET /students/{id}/paycode
  - GET /payments/student
  - GET /payments/school
  - POST {webhook_url} (webhook sender)

### Shared Responsibilities
- [ ] Define fee ID mapping
- [ ] Test integration in sandbox
- [ ] Coordinate production deployment
- [ ] Set up monitoring alerts
- [ ] Document integration process

---

## Next Steps

1. **Contact SurePay**: Request their API documentation and credentials
2. **Review API Specs**: Compare their actual APIs with this document
3. **Set Up Test Environment**: Get sandbox credentials and test
4. **Implement Core Service**: Build the `SurePayIntegrationService`
5. **Test Each Feature**: Test registration, payments, and promotions separately
6. **Deploy Gradually**: Start with one feature at a time
7. **Monitor and Iterate**: Watch for issues and optimize

---

## Support

If you need help implementing any part of this integration:

1. Check SurePay's API documentation
2. Review error logs in your application
3. Test API calls using tools like Postman
4. Contact SurePay support for API issues
5. Review this document for implementation guidance

---

**Document Version**: 1.0  
**Last Updated**: November 15, 2024  
**Author**: AI Assistant

