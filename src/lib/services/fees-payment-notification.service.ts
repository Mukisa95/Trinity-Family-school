/**
 * FEES PAYMENT NOTIFICATION SERVICE
 * 
 * Automatically sends push notifications when fee payments are made to:
 * 1. All users with fees collection permissions (staff/admin)
 * 2. Parent(s) of the student (all accounts with same familyId)
 * 
 * Notification includes:
 * - Fee item name
 * - Actual amount
 * - Amount paid
 * - Balance
 * - Time of payment
 * - Who received payment
 */

import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
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
      console.log(`\n${'='.repeat(80)}`);
      console.log(`💳 [Fees Notification] Starting payment notification`);
      console.log(`   Payment ID: ${paymentId}`);
      console.log(`   Pupil: ${pupilDetails.firstName} ${pupilDetails.lastName}`);
      console.log(`   Fee: ${feeDetails.name}`);
      console.log(`   Amount: ${paymentData.amount}`);
      console.log(`${'='.repeat(80)}\n`);

      // Step 1: Get parent accounts by familyId
      const parents = await this.getParentsByFamilyId(pupilDetails.familyId);
      console.log(`👨‍👩‍👧 [Fees Notification] Found ${parents.length} parent account(s)`);
      if (parents.length > 0) {
        console.log(`   Parent IDs:`, parents.map(p => p.id).join(', '));
      }

      // Step 2: Get staff/admin with fees permissions
      const staffWithPermissions = await this.getUsersWithFeesPermissions();
      console.log(`👥 [Fees Notification] Found ${staffWithPermissions.length} staff with fees permissions`);
      if (staffWithPermissions.length > 0) {
        console.log(`   Staff IDs:`, staffWithPermissions.map(s => s.id).join(', '));
      }

      // Step 3: Combine recipients
      const allRecipients = [
        ...parents.map(p => ({ type: 'user' as const, value: p.id })),
        ...staffWithPermissions.map(s => ({ type: 'user' as const, value: s.id }))
      ];

      if (allRecipients.length === 0) {
        console.log('⚠️ [Fees Notification] No recipients found, skipping notification');
        return;
      }

      console.log(`📊 [Fees Notification] Total recipients: ${allRecipients.length}`);
      console.log(`   - Parents: ${parents.length}`);
      console.log(`   - Staff: ${staffWithPermissions.length}`);

      // Step 4: Format notification content
      const notificationContent = this.formatPaymentNotification(
        paymentId,
        paymentData,
        pupilDetails,
        feeDetails,
        balance
      );

      console.log(`📝 [Fees Notification] Notification content formatted`);
      console.log(`   Title: ${notificationContent.title}`);
      console.log(`   Body: ${notificationContent.pushBody}`);

      // Step 5: Send notification via optimized service (dynamic import for server-only module)
      console.log(`📨 [Fees Notification] Sending notification...`);
      
      // Dynamic import to avoid bundling server-only modules in client
      const { optimizedNotificationService } = await import('./optimized-notification.service');
      
      await optimizedNotificationService.sendNotificationOptimized({
        ...notificationContent,
        recipients: allRecipients,
        createdBy: paymentData.paidBy.id
      });

      console.log(`✅ [Fees Notification] Payment notification sent successfully!\n`);

    } catch (error) {
      console.error('❌ [Fees Notification] Error sending payment notification:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      // Don't throw error - notification failure shouldn't fail payment
    }
  }

  /**
   * Get parent accounts by familyId
   * Parents are linked to students via familyId
   * A parent can have multiple children (shared familyId)
   */
  private async getParentsByFamilyId(familyId: string): Promise<User[]> {
    if (!familyId) {
      console.log('⚠️ [Fees Notification] No familyId provided');
      return [];
    }

    try {
      console.log(`🔍 [Fees Notification] Querying parents with familyId: ${familyId}`);
      
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

      if (parents.length === 0) {
        console.log(`⚠️ [Fees Notification] No active parent accounts found for familyId: ${familyId}`);
      } else {
        console.log(`✅ [Fees Notification] Found ${parents.length} parent(s) for familyId: ${familyId}`);
        parents.forEach(parent => {
          console.log(`   - Parent: ${parent.username || parent.id} (${parent.firstName} ${parent.lastName})`);
        });
      }

      return parents;

    } catch (error) {
      console.error('❌ [Fees Notification] Error getting parents:', error);
      return [];
    }
  }

  /**
   * Get users with fees collection permissions
   * Includes:
   * - All Admin users (have full access)
   * - Staff users with fees module access (view_only, edit, or full_access)
   */
  private async getUsersWithFeesPermissions(): Promise<User[]> {
    try {
      console.log(`🔍 [Fees Notification] Querying users with fees permissions...`);
      
      // Get all admin and staff users
      const usersQuery = query(
        collection(db, 'system_users'),
        where('role', 'in', ['Admin', 'Staff']),
        where('isActive', '==', true)
      );

      const usersSnapshot = await getDocs(usersQuery);
      console.log(`   Found ${usersSnapshot.docs.length} Admin/Staff users`);

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
          console.log(`   ✅ Admin user: ${userData.username || userDoc.id}`);
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
                console.log(`   ✅ Staff user: ${userData.username || userDoc.id} (permission: ${feesModule.permission})`);
              } else {
                console.log(`   ⏭️  Staff user: ${userData.username || userDoc.id} (no fees access)`);
              }
            }
          } catch (error) {
            console.error(`   ❌ Error checking access level for user ${userDoc.id}:`, error);
          }
        } else {
          console.log(`   ⏭️  Staff user: ${userData.username || userDoc.id} (no accessLevel defined)`);
        }
      }

      console.log(`✅ [Fees Notification] ${usersWithPermissions.length} users have fees permissions`);
      return usersWithPermissions;

    } catch (error) {
      console.error('❌ [Fees Notification] Error getting users with fees permissions:', error);
      return [];
    }
  }

  /**
   * Format payment notification content
   * Creates rich notification with all payment details
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
    
    // Format payment time
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

    // Determine if payment is full or partial
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
      pushIcon: '/icons/icon-192x192.png',
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
        // Include raw numbers for calculations if needed
        rawAmounts: {
          actualAmount,
          amountPaid,
          balance
        }
      }
    };
  }
}

export const feesPaymentNotificationService = new FeesPaymentNotificationService();

