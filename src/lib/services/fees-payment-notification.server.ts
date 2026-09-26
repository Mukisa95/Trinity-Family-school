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
import { getActiveParentAccountId } from '@/lib/users/parent-account-families';

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

export interface PreparedPaymentNotification {
  paymentId: string;
  paymentData: PaymentRecord;
  pupilDetails: Pupil;
  feeDetails: FeeStructure;
  balance: number;
}

class FeesPaymentNotificationServerService {
  // Scope this cache to one worker run; subsequent retries resolve current policy.
  createRecipientResolver(): () => Promise<User[]> {
    let pending: Promise<User[]> | undefined;
    return () => pending ??= this.resolvePaymentRecipients();
  }

  private async resolvePaymentRecipients(): Promise<User[]> {
    const adminDb = getFirestore(getFirebaseAdminApp());
    const settingsSnapshot = await adminDb.collection('notificationAutomationSettings').doc('current').get();
    const automationSettings = normalizeNotificationAutomationSettings(
      settingsSnapshot.exists ? settingsSnapshot.data() : undefined,
    );
    if (!isNotificationAutomationEnabled(automationSettings, 'schoolPay')) return [];

    // Resolve the staff policy once even when a payment was distributed
    // across several fees. Parent receipt delivery is derived separately from
    // the denormalized account marker already present on each pupil.
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
    return staffWithPermissions;

  }

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
    await this.sendPaymentNotifications([{
      paymentId,
      paymentData,
      pupilDetails,
      feeDetails,
      balance,
    }]);
  }

  /**
   * Sends the payment notifications prepared by the payment route. Recipient
   * policy is resolved once for the whole command, rather than once for every
   * fee allocation in a single cashier action.
   */
  async sendPaymentNotifications(notifications: PreparedPaymentNotification[], progress?: {
    deliveredUserIds: string[];
    resolveRecipients?: () => Promise<User[]>;
    beforeRecipient: () => Promise<void>;
    onRecipientDelivered: (userId: string) => Promise<void>;
  }): Promise<boolean> {
    if (notifications.length === 0) return true;

    try {
      const staffRecipients = await (progress?.resolveRecipients || this.createRecipientResolver())();

      let successful = true;
      for (const { paymentId, paymentData, pupilDetails, feeDetails, balance } of notifications) {
        const parentAccountId = getActiveParentAccountId(pupilDetails);
        const recipientsById = new Map(staffRecipients.map(recipient => [recipient.id, recipient]));
        if (parentAccountId) {
          // Push delivery only requires the user ID. The active marker is kept
          // in sync when the family account is created, disabled or deleted,
          // so no system_users lookup is needed on the payment path.
          recipientsById.set(parentAccountId, { id: parentAccountId } as User);
        }
        const recipients = [...recipientsById.values()];
        if (recipients.length === 0) {
          console.log('⚠️ [Fees Notification] No recipients found, skipping notification');
          continue;
        }
        const payload = this.formatPaymentNotification(paymentId, paymentData, pupilDetails, feeDetails, balance);
        const payloadFor = (recipientId: string) => recipientId === parentAccountId
          ? { ...payload, pushUrl: `/parent?pupilId=${encodeURIComponent(pupilDetails.id)}` }
          : payload;
        if (!progress) {
          for (const recipient of recipients) {
            const result = await optimizedNotificationService.sendPushOnlyNotification(
              payloadFor(recipient.id),
              [recipient],
              `fee-${paymentId}`,
            );
            successful = successful && result.failed === 0 && result.errors.length === 0;
          }
          continue;
        }
        for (const recipient of recipients) {
          if (progress.deliveredUserIds.includes(recipient.id)) continue;
          await progress.beforeRecipient();
          const result = await optimizedNotificationService.sendPushOnlyNotification(
            payloadFor(recipient.id),
            [recipient],
            `fee-${paymentId}`,
          );
          if (result.failed > 0 || result.errors.length > 0) {
            successful = false;
          } else {
            await progress.onRecipientDelivered(recipient.id);
          }
        }
      }
      return successful;

    } catch (error) {
      console.error('❌ [Fees Notification] Error sending payment notifications:', error);
      // Don't throw error - notification failure shouldn't fail payment.
      // The payment outbox worker uses this false result to schedule a retry.
      return false;
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
      throw error;
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
