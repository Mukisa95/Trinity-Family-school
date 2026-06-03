# 💳 Fees Payment Push Notification Implementation Plan

## Overview

Implement automatic push notifications when fee payments are made, targeting:
1. **Staff/Admin with fees collection permissions** - Get notified on all devices
2. **Parent(s) of the student** - Get notified on all devices linked to their familyId

## Requirements Analysis

### Notification Recipients

#### Type 1: Staff/Admin with Permissions
- Query users with "fees" module access
- Must have at least `view_only` permission to fees collection
- Include all users with roles: Admin, Staff (with fees permissions)

#### Type 2: Parent Accounts
- Parents are linked to pupils via `familyId`
- A parent can have multiple children (shared familyId)
- Parent accounts in `system_users` collection with role='Parent'
- Query: `where('familyId', '==', pupil.familyId)`

### Notification Content

Must include:
- **Fee Item Name** (e.g., "Tuition - Term 1")
- **Actual Amount** (total fee amount)
- **Amount Paid** (payment amount)
- **Balance** (remaining balance)
- **Time of Payment** (timestamp)
- **Who Received Payment** (staff member name)
- **Pupil Name** (student who made payment)
- **Academic Year & Term**

### Database Collections Involved

1. **payments** - Payment records
2. **system_users** - User accounts (staff, admin, parents)
3. **pupils** - Student records (has familyId)
4. **fee_structures** - Fee definitions
5. **pushSubscriptions** - Web push subscriptions
6. **nativePushTokens** - Native FCM tokens
7. **accessLevels** - User permissions

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    PAYMENT FLOW                                │
└────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌────────────────────────────────────────────────────────────────┐
│          PaymentsService.createPayment()                       │
│                                                                 │
│  1. Create payment record in Firestore                         │
│  2. Return payment ID                                           │
│  3. 🆕 TRIGGER: Send payment notification                      │
└────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌────────────────────────────────────────────────────────────────┐
│       FeesPaymentNotificationService                           │
│                                                                 │
│  Step 1: Get payment details (fee name, amounts, etc.)        │
│  Step 2: Get pupil details (name, familyId)                   │
│  Step 3: Get parent accounts (by familyId)                    │
│  Step 4: Get staff with fees permissions                       │
│  Step 5: Format notification content                          │
│  Step 6: Send via optimizedNotificationService                │
└────────────────────────────────────────────────────────────────┘
                            │
                            ↓
              ┌─────────────┴──────────────┐
              │                            │
              ↓                            ↓
┌──────────────────────┐      ┌──────────────────────┐
│  PARENT DEVICES      │      │  STAFF DEVICES       │
│                      │      │                      │
│  • Web Push          │      │  • Web Push          │
│  • Native FCM        │      │  • Native FCM        │
│  • In-App            │      │  • In-App            │
└──────────────────────┘      └──────────────────────┘
```

## Implementation Steps

### Step 1: Create Fees Payment Notification Service

**File**: `src/lib/services/fees-payment-notification.service.ts`

**Methods:**
- `sendPaymentNotification(paymentId: string, paymentData: PaymentRecord)`
- `getParentsByPupilFamilyId(familyId: string): Promise<User[]>`
- `getUsersWithFeesPermissions(): Promise<User[]>`
- `formatPaymentNotificationContent(paymentDetails): NotificationContent`

### Step 2: Modify PaymentsService

**File**: `src/lib/services/payments.service.ts`

**Changes:**
- After creating payment record, call notification service
- Pass payment ID and payment data to notification service
- Handle notification errors gracefully (don't fail payment if notification fails)

### Step 3: Query Parent Accounts

**Query Logic:**
```typescript
// Get pupil to find familyId
const pupil = await PupilsService.getPupilById(paymentData.pupilId);

// Get all parent accounts with this familyId
const parentsQuery = query(
  collection(db, 'system_users'),
  where('familyId', '==', pupil.familyId),
  where('role', '==', 'Parent'),
  where('isActive', '==', true)
);
```

### Step 4: Query Staff with Fees Permissions

**Query Logic:**
```typescript
// Get all users with fees module access
// Check accessLevels collection for fees module permissions
const usersQuery = query(
  collection(db, 'system_users'),
  where('role', 'in', ['Admin', 'Staff']),
  where('isActive', '==', true)
);

// Filter by checking their accessLevel for fees module
// Users with fees module access (view_only, edit, or full_access)
```

### Step 5: Format Notification

**Notification Structure:**
```typescript
{
  title: "💳 Fee Payment Received",
  description: "Payment of UGX 50,000 for Tuition - Term 1",
  type: 'fees_payment',
  priority: 'high',
  recipients: [...parentUsers, ...staffUsers],
  enablePush: true,
  pushTitle: "💳 Fee Payment Received",
  pushBody: "John Doe paid UGX 50,000 for Tuition - Term 1. Balance: UGX 150,000",
  pushUrl: '/fees/collect/[pupilId]',
  richContent: {
    paymentDetails: {
      pupilName: "John Doe",
      feeItem: "Tuition - Term 1",
      actualAmount: 200000,
      amountPaid: 50000,
      balance: 150000,
      paymentTime: "2025-12-21 10:30 AM",
      receivedBy: "Mrs. Jane Smith (Bursar)",
      academicYear: "2024/2025",
      term: "Term 1"
    }
  }
}
```

## Implementation Code

### 1. Fees Payment Notification Service

```typescript
// src/lib/services/fees-payment-notification.service.ts

import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { optimizedNotificationService } from './optimized-notification.service';
import { PupilsService } from './pupils.service';
import type { PaymentRecord, User, Pupil, FeeStructure } from '@/types';

export interface PaymentNotificationDetails {
  paymentId: string;
  pupilId: string;
  pupilName: string;
  feeStructureId: string;
  feeItemName: string;
  actualAmount: number;
  amountPaid: number;
  balance: number;
  paymentTime: string;
  receivedBy: string;
  academicYear: string;
  term: string;
}

class FeesPaymentNotificationService {
  /**
   * Main method to send payment notification
   */
  async sendPaymentNotification(
    paymentId: string,
    paymentData: PaymentRecord,
    pupilDetails: Pupil,
    feeDetails: FeeStructure,
    balance: number
  ): Promise<void> {
    try {
      console.log(`📤 [Fees Notification] Starting payment notification for payment ${paymentId}`);

      // Step 1: Get parent accounts by familyId
      const parents = await this.getParentsByFamilyId(pupilDetails.familyId);
      console.log(`👨‍👩‍👧 [Fees Notification] Found ${parents.length} parent accounts`);

      // Step 2: Get staff/admin with fees permissions
      const staffWithPermissions = await this.getUsersWithFeesPermissions();
      console.log(`👥 [Fees Notification] Found ${staffWithPermissions.length} staff with fees permissions`);

      // Step 3: Combine recipients
      const allRecipients = [
        ...parents.map(p => ({ type: 'user' as const, value: p.id })),
        ...staffWithPermissions.map(s => ({ type: 'user' as const, value: s.id }))
      ];

      if (allRecipients.length === 0) {
        console.log('⚠️ [Fees Notification] No recipients found, skipping notification');
        return;
      }

      // Step 4: Format notification content
      const notificationContent = this.formatPaymentNotification(
        paymentId,
        paymentData,
        pupilDetails,
        feeDetails,
        balance
      );

      // Step 5: Send notification via optimized service
      console.log(`📨 [Fees Notification] Sending to ${allRecipients.length} recipients`);
      
      await optimizedNotificationService.sendNotificationOptimized({
        ...notificationContent,
        recipients: allRecipients,
        createdBy: paymentData.paidBy.id
      });

      console.log(`✅ [Fees Notification] Payment notification sent successfully`);

    } catch (error) {
      console.error('❌ [Fees Notification] Error sending payment notification:', error);
      // Don't throw error - notification failure shouldn't fail payment
    }
  }

  /**
   * Get parent accounts by familyId
   */
  private async getParentsByFamilyId(familyId: string): Promise<User[]> {
    if (!familyId) {
      console.log('⚠️ [Fees Notification] No familyId provided');
      return [];
    }

    try {
      const parentsQuery = query(
        collection(db, 'system_users'),
        where('familyId', '==', familyId),
        where('role', '==', 'Parent'),
        where('isActive', '==', true)
      );

      const querySnapshot = await getDocs(parentsQuery);
      
      const parents: User[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];

      console.log(`👨‍👩‍👧 [Fees Notification] Found ${parents.length} parent(s) for familyId: ${familyId}`);
      return parents;

    } catch (error) {
      console.error('❌ [Fees Notification] Error getting parents:', error);
      return [];
    }
  }

  /**
   * Get users with fees collection permissions
   */
  private async getUsersWithFeesPermissions(): Promise<User[]> {
    try {
      // Get all admin and staff users
      const usersQuery = query(
        collection(db, 'system_users'),
        where('role', 'in', ['Admin', 'Staff']),
        where('isActive', '==', true)
      );

      const usersSnapshot = await getDocs(usersQuery);
      const usersWithPermissions: User[] = [];

      // Check each user's access level for fees module
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        
        // Admin has full access to everything
        if (userData.role === 'Admin') {
          usersWithPermissions.push({
            id: userDoc.id,
            ...userData
          } as User);
          continue;
        }

        // For staff, check their accessLevel
        if (userData.accessLevel) {
          try {
            const accessLevelDoc = await getDoc(doc(db, 'accessLevels', userData.accessLevel));
            if (accessLevelDoc.exists()) {
              const accessLevelData = accessLevelDoc.data();
              
              // Check if user has fees module permissions
              const feesModule = accessLevelData.modules?.find((m: any) => m.module === 'fees');
              if (feesModule && feesModule.permission !== 'no_access') {
                usersWithPermissions.push({
                  id: userDoc.id,
                  ...userData
                } as User);
              }
            }
          } catch (error) {
            console.error(`Error checking access level for user ${userDoc.id}:`, error);
          }
        }
      }

      console.log(`👥 [Fees Notification] ${usersWithPermissions.length} users have fees permissions`);
      return usersWithPermissions;

    } catch (error) {
      console.error('❌ [Fees Notification] Error getting users with fees permissions:', error);
      return [];
    }
  }

  /**
   * Format payment notification content
   */
  private formatPaymentNotification(
    paymentId: string,
    paymentData: PaymentRecord,
    pupil: Pupil,
    feeStructure: FeeStructure,
    balance: number
  ): any {
    const pupilName = `${pupil.firstName} ${pupil.lastName}`;
    const feeItemName = feeStructure.name;
    const amountPaid = paymentData.amount;
    const actualAmount = feeStructure.amount;
    const receivedBy = paymentData.paidBy.name;
    const paymentTime = new Date(paymentData.paymentDate).toLocaleString('en-UG', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    // Format currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-UG', {
        style: 'currency',
        currency: 'UGX',
        minimumFractionDigits: 0
      }).format(amount);
    };

    return {
      title: '💳 Fee Payment Received',
      description: `${pupilName} paid ${formatCurrency(amountPaid)} for ${feeItemName}`,
      type: 'fees_payment',
      priority: 'high',
      enablePush: true,
      pushTitle: '💳 Fee Payment Received',
      pushBody: `${pupilName} paid ${formatCurrency(amountPaid)} for ${feeItemName}. Balance: ${formatCurrency(balance)}`,
      pushUrl: `/fees/collect/${paymentData.pupilId}`,
      richContent: {
        paymentDetails: {
          paymentId,
          pupilName,
          pupilId: pupil.id,
          feeItem: feeItemName,
          actualAmount,
          amountPaid,
          balance,
          paymentTime,
          receivedBy,
          academicYear: paymentData.academicYearId,
          term: paymentData.termId
        }
      }
    };
  }
}

export const feesPaymentNotificationService = new FeesPaymentNotificationService();
```

### 2. Modify PaymentsService

```typescript
// Update src/lib/services/payments.service.ts

static async createPayment(paymentData: Omit<PaymentRecord, 'id' | 'createdAt'>): Promise<string> {
  try {
    const newPayment = {
      ...paymentData,
      createdAt: Timestamp.now(),
      paymentDate: paymentData.paymentDate || new Date().toISOString()
    };
    
    // Clean undefined values before sending to Firebase
    const cleanedData = cleanUndefinedValues(newPayment);
    
    const docRef = await addDoc(collection(db, PAYMENTS_COLLECTION), cleanedData);
    const paymentId = docRef.id;
    
    // 🆕 TRIGGER NOTIFICATION: Send payment notification in background
    // Don't await to avoid blocking payment creation
    this.sendPaymentNotification(paymentId, newPayment as PaymentRecord).catch(error => {
      console.error('Error sending payment notification:', error);
      // Don't throw - notification failure shouldn't fail payment
    });
    
    return paymentId;
  } catch (error) {
    console.error('Error creating payment:', error);
    throw error;
  }
}

/**
 * 🆕 Send payment notification to parents and staff
 */
private static async sendPaymentNotification(
  paymentId: string,
  paymentData: PaymentRecord
): Promise<void> {
  try {
    // Import services
    const { PupilsService } = await import('./pupils.service');
    const { FeesService } = await import('./fees.service');
    const { feesPaymentNotificationService } = await import('./fees-payment-notification.service');
    
    // Get pupil details
    const pupil = await PupilsService.getPupilById(paymentData.pupilId);
    if (!pupil) {
      console.log('⚠️ Pupil not found for payment notification');
      return;
    }
    
    // Get fee structure details
    const feeStructure = await FeesService.getFeeStructureById(paymentData.feeStructureId);
    if (!feeStructure) {
      console.log('⚠️ Fee structure not found for payment notification');
      return;
    }
    
    // Calculate balance (get all payments for this fee and calculate)
    const allPayments = await this.getPaymentsByFee(
      paymentData.feeStructureId,
      paymentData.pupilId,
      paymentData.academicYearId,
      paymentData.termId
    );
    
    const totalPaid = allPayments.reduce((sum, p) => {
      if (p.reverted) return sum;
      return sum + p.amount;
    }, 0);
    
    const balance = feeStructure.amount - totalPaid;
    
    // Send notification
    await feesPaymentNotificationService.sendPaymentNotification(
      paymentId,
      paymentData,
      pupil,
      feeStructure,
      balance
    );
    
  } catch (error) {
    console.error('Error in payment notification:', error);
    // Don't throw - let payment succeed even if notification fails
  }
}
```

## Testing Plan

### Test Scenario 1: Staff Notification
1. Create payment for a student
2. Verify all staff with fees permissions receive notification
3. Check notification includes all required details
4. Verify notification appears on web, mobile, and in-app

### Test Scenario 2: Parent Notification
1. Create payment for a student with familyId
2. Verify all parent accounts with that familyId receive notification
3. Test with multiple children in same family
4. Verify parent gets notifications for all their children

### Test Scenario 3: Multi-Device
1. Parent signed in on multiple devices
2. Create payment
3. Verify notification appears on ALL devices

### Test Scenario 4: Permission Filtering
1. Staff user without fees permissions
2. Create payment
3. Verify they DON'T receive notification

## Database Indexes Required

```javascript
// Firestore indexes to create:

// 1. system_users - for parent query
{
  collection: 'system_users',
  fields: [
    { fieldPath: 'familyId', order: 'ASCENDING' },
    { fieldPath: 'role', order: 'ASCENDING' },
    { fieldPath: 'isActive', order: 'ASCENDING' }
  ]
}

// 2. system_users - for staff query
{
  collection: 'system_users',
  fields: [
    { fieldPath: 'role', order: 'ASCENDING' },
    { fieldPath: 'isActive', order: 'ASCENDING' }
  ]
}
```

## Error Handling

1. **Payment Creation Must Succeed**: Notification failure should NOT fail payment
2. **Graceful Degradation**: If some recipients can't be notified, notify the rest
3. **Logging**: Comprehensive logging for debugging
4. **Retry Logic**: Consider implementing retry for failed notifications

## Performance Considerations

1. **Async Processing**: Don't block payment creation for notification
2. **Batch Recipients**: Use existing batch processing from optimized service
3. **Caching**: Cache accessLevel lookups to avoid repeated queries
4. **Parallel Queries**: Get parents and staff in parallel

## Security Considerations

1. **Permission Verification**: Double-check permissions before sending
2. **Data Sanitization**: Ensure payment details are safe to send
3. **Privacy**: Parents only see their own children's payments
4. **Access Control**: Staff must have fees module access

## Success Metrics

1. **Delivery Rate**: >95% successful notification delivery
2. **Latency**: Notification sent within 5 seconds of payment
3. **Accuracy**: 100% correct recipient targeting
4. **No Payment Failures**: 0% payment failures due to notification issues

## Rollout Plan

1. **Phase 1**: Implement service and integrate (this document)
2. **Phase 2**: Test in development with sample data
3. **Phase 3**: Pilot with small group of users
4. **Phase 4**: Full rollout to all users
5. **Phase 5**: Monitor and optimize


