/**
 * SERVER-ONLY FEES PAYMENT NOTIFICATION SERVICE
 * 
 * This module should ONLY be imported on the server-side.
 * It contains server-only dependencies and will fail if bundled for the client.
 */

// Mark this module as server-only
if (typeof window !== 'undefined') {
  throw new Error('This module can only be imported on the server side');
}

import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { optimizedNotificationService } from './optimized-notification.service';
import type { PaymentRecord, User, Pupil, FeeStructure, SystemUser } from '@/types';
import { GranularPermissionService } from './granular-permissions.service';
import 'server-only';

import {
  isNotificationAutomationEnabled,
  normalizeNotificationAutomationSettings,
  resolveAutomatedNotificationRecipientIds,
} from '@/lib/notifications/automation-settings';

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

class FeesPaymentNotificationServerService {
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
      // This service is invoked only from the server payment route. Its
      // delivery dependency can safely use Firebase Admin and Node-only APIs.
      const adminDb = getFirestore(getFirebaseAdminApp());
      const settingsSnapshot = await adminDb.collection('notificationAutomationSettings').doc('current').get();
      const automationSettings = normalizeNotificationAutomationSettings(
        settingsSnapshot.exists ? settingsSnapshot.data() : undefined,
      );
      if (!isNotificationAutomationEnabled(automationSettings, 'schoolPay')) return;

      console.log(`\n${'='.repeat(80)}`);
      console.log(`💳 [Fees Notification] Starting payment notification`);
      console.log(`   Payment ID: ${paymentId}`);
      console.log(`   Pupil: ${pupilDetails.firstName} ${pupilDetails.lastName}`);
      console.log(`   Fee: ${feeDetails.name}`);
      console.log(`   Amount: ${paymentData.amount}`);
      console.log(`${'='.repeat(80)}\n`);

      // Step 1: Get parent accounts by familyId
      // Parent receipt pushes are intentionally excluded from this policy.
      const parents: User[] = [];
      console.log(`👨‍👩‍👧 [Fees Notification] Found ${parents.length} parent account(s)`);

      // Step 2: Get staff/admin with fees permissions
      const eligibleStaff = await this.getUsersWithFeesPermissions();
      const selectedStaffIds = new Set(resolveAutomatedNotificationRecipientIds(
        automationSettings,
        'schoolPay',
        eligibleStaff.map(user => user.id),
      ));
      const staffWithPermissions = eligibleStaff.filter(user =>
        selectedStaffIds.has(user.id)
        && GranularPermissionService.canAccessPage(user as unknown as SystemUser, 'fees', 'collection')
        && GranularPermissionService.canAccessPage(user as unknown as SystemUser, 'fees', 'collect'),
      );
      console.log(`👥 [Fees Notification] Found ${staffWithPermissions.length} staff with fees permissions`);

      // Step 3: Combine recipients
      const recipients = staffWithPermissions;

      if (recipients.length === 0) {
        console.log('⚠️ [Fees Notification] No recipients found, skipping notification');
        return;
      }

      console.log(`📊 [Fees Notification] Total recipients: ${recipients.length}`);

      // Step 4: Format notification content
      const notificationContent = this.formatPaymentNotification(
        paymentId,
        paymentData,
        pupilDetails,
        feeDetails,
        balance
      );

      // Step 5: Send notification
      console.log(`📨 [Fees Notification] Sending notification...`);
      
      await optimizedNotificationService.sendPushOnlyNotification(
        notificationContent,
        recipients,
      );

      console.log(`✅ [Fees Notification] Payment notification sent successfully!\n`);

    } catch (error) {
      console.error('❌ [Fees Notification] Error sending payment notification:', error);
      // Don't throw error - notification failure shouldn't fail payment
    }
  }

  /**
   * Get users with fees collection permissions
   */
  private async getUsersWithFeesPermissions(): Promise<User[]> {
    try {
      const adminDb = getFirestore(getFirebaseAdminApp());
      const usersSnapshot = await adminDb
        .collection('system_users')
        .where('role', 'in', ['Admin', 'Staff'])
        .where('isActive', '==', true)
        .get();
      const usersWithPermissions: User[] = [];
      const accessLevelIds = Array.from(new Set(
        usersSnapshot.docs
          .map(userDoc => userDoc.data().accessLevel)
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      ));
      const accessLevelSnapshots = await Promise.all(
        accessLevelIds.map(accessLevelId => adminDb.collection('accessLevels').doc(accessLevelId).get()),
      );
      const accessLevelsById = new Map(
        accessLevelSnapshots
          .filter(snapshot => snapshot.exists)
          .map(snapshot => [snapshot.id, snapshot.data()]),
      );

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        
        if (userData.role === 'Admin') {
          usersWithPermissions.push({
            id: userDoc.id,
            ...userData
          } as User);
          continue;
        }

        if (userData.accessLevel) {
          const accessLevelData = accessLevelsById.get(userData.accessLevel);
          const feesModule = accessLevelData?.modules?.find((m: any) => m.module === 'fees');
          if (feesModule && feesModule.permission !== 'no_access') {
            usersWithPermissions.push({
              id: userDoc.id,
              ...userData
            } as User);
          }
        }
      }

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

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-UG', {
        style: 'currency',
        currency: 'UGX',
        minimumFractionDigits: 0
      }).format(amount);
    };

    const isFullPayment = balance <= 0;
    const paymentStatus = isFullPayment ? '✅ PAID IN FULL' : '⏳ PARTIAL PAYMENT';

    return {
      title: '💳 Fee Payment Received',
      description: `${pupilName} paid ${formatCurrency(amountPaid)} for ${feeItemName}`,
      type: 'fees_payment',
      priority: 'high',
      enablePush: true,
      pushTitle: '💳 Fee Payment Received',
      pushBody: `${pupilName} paid ${formatCurrency(amountPaid)} for ${feeItemName}. Balance: ${formatCurrency(balance)}`,
      pushUrl: `/fees/collect/${paymentData.pupilId}`,
      pushIcon: '/trinity-logo-192.png',
      richContent: {
        paymentDetails: {
          paymentId,
          pupilName,
          pupilId: pupil.id,
          feeItem: feeItemName,
          actualAmount: formatCurrency(actualAmount),
          amountPaid: formatCurrency(amountPaid),
          balance: formatCurrency(balance),
          paymentTime,
          receivedBy,
          paymentStatus,
          academicYear: paymentData.academicYearId,
          term: paymentData.termId
        },
        rawAmounts: {
          actualAmount,
          amountPaid,
          balance
        }
      }
    };
  }
}

export const feesPaymentNotificationServerService = new FeesPaymentNotificationServerService();
