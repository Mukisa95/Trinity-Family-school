# 🧪 Fees Payment Notification Testing Guide

## Overview

This guide provides comprehensive testing procedures for the fees payment notification feature that automatically sends push notifications when fee payments are made.

## Feature Summary

When a fee payment is recorded in the system, the following happens automatically:

1. **Create Payment** → PaymentsService.createPayment()
2. **Trigger Notification** → feesPaymentNotificationService.sendPaymentNotification()
3. **Get Recipients**:
   - Parents of the student (via familyId)
   - Staff/Admin with fees collection permissions
4. **Send Push Notifications** → All devices where recipients are signed in
5. **Include Details**:
   - Fee item name
   - Actual amount
   - Amount paid
   - Balance
   - Time of payment
   - Who received payment

---

## Pre-Testing Setup

### 1. Verify Database State

Check that you have the following data:

#### Pupils Collection
```javascript
{
  id: 'pupil-123',
  firstName: 'John',
  lastName: 'Doe',
  familyId: 'fam-doe-001',  // ← KEY: Family ID for linking parents
  admissionNumber: 'DOE001'
}
```

#### System Users Collection - Parents
```javascript
{
  id: 'parent-123',
  username: 'DOE12',
  role: 'Parent',
  familyId: 'fam-doe-001',  // ← SAME family ID as pupil
  isActive: true,
  firstName: 'Jane',
  lastName: 'Doe'
}
```

#### System Users Collection - Staff
```javascript
{
  id: 'staff-123',
  username: 'bursar01',
  role: 'Staff',
  isActive: true,
  accessLevel: 'access-level-123'  // ← Access level with fees permissions
}
```

#### Access Levels Collection
```javascript
{
  id: 'access-level-123',
  name: 'Bursar Access',
  modules: [
    {
      module: 'fees',
      permission: 'edit'  // ← Has fees permissions (not 'no_access')
    }
  ]
}
```

#### Push Subscriptions Collection
```javascript
{
  id: 'subscription-123',
  userId: 'parent-123',  // ← Parent's user ID
  endpoint: 'https://fcm.googleapis.com/...',
  keys: {
    p256dh: 'encryption-key',
    auth: 'auth-secret'
  },
  isActive: true
}
```

### 2. Create Test Data Script

Run this in Firestore console or via script:

```javascript
// Create test pupil
await addDoc(collection(db, 'pupils'), {
  firstName: 'Test',
  lastName: 'Student',
  familyId: 'fam-test-001',
  admissionNumber: 'TEST001',
  status: 'Active'
});

// Create parent account
await addDoc(collection(db, 'system_users'), {
  username: 'TEST12',
  role: 'Parent',
  familyId: 'fam-test-001',
  isActive: true,
  firstName: 'Test',
  lastName: 'Parent'
});

// Create fee structure
await addDoc(collection(db, 'fee_structures'), {
  name: 'Tuition - Term 1',
  amount: 500000,
  type: 'tuition',
  category: 'academic',
  status: 'active'
});
```

---

## Testing Scenarios

### Test 1: Single Parent Notification

**Objective**: Verify parent receives notification when their child makes a payment

**Setup**:
1. Create pupil with familyId: `fam-test-001`
2. Create parent account with same familyId: `fam-test-001`
3. Parent subscribes to push notifications (sign in and enable push)

**Steps**:
1. Navigate to `/fees/collect/[pupilId]`
2. Record a payment:
   - Fee: Tuition - Term 1 (500,000 UGX)
   - Amount Paid: 200,000 UGX
   - Received by: Current User
3. Click "Record Payment"

**Expected Result**:
- ✅ Payment created successfully
- ✅ Parent receives push notification on all devices
- ✅ Notification shows:
  - Title: "💳 Fee Payment Received"
  - Body: "Test Student paid UGX 200,000 for Tuition - Term 1. Balance: UGX 300,000"
- ✅ Clicking notification navigates to `/fees/collect/[pupilId]`
- ✅ In-app notification appears in notifications feed

**Console Logs to Check**:
```
💳 [Fees Notification] Starting payment notification
   Payment ID: abc123
   Pupil: Test Student
   Fee: Tuition - Term 1
   Amount: 200000
👨‍👩‍👧 [Fees Notification] Found 1 parent account(s)
   Parent IDs: parent-123
👥 [Fees Notification] Found X staff with fees permissions
📊 [Fees Notification] Total recipients: Y
✅ [Fees Notification] Payment notification sent successfully!
```

---

### Test 2: Multiple Parents (Siblings)

**Objective**: Verify all parents with same familyId receive notifications

**Setup**:
1. Create Family:
   - Pupil 1: John Doe (familyId: `fam-doe-001`)
   - Pupil 2: Jane Doe (familyId: `fam-doe-001`)
   - Parent 1: Mr. Doe (familyId: `fam-doe-001`)
   - Parent 2: Mrs. Doe (familyId: `fam-doe-001`)
2. Both parents subscribe to push notifications

**Steps**:
1. Record payment for Pupil 1 (John Doe)
2. Check both parents receive notification
3. Record payment for Pupil 2 (Jane Doe)
4. Check both parents receive notification

**Expected Result**:
- ✅ Both parents receive notification for BOTH children
- ✅ Each notification correctly shows which child made payment
- ✅ Notification for John: "John Doe paid..."
- ✅ Notification for Jane: "Jane Doe paid..."

---

### Test 3: Staff with Fees Permissions

**Objective**: Verify staff with fees permissions receive notifications

**Setup**:
1. Create staff users:
   - Admin User (role: 'Admin')
   - Bursar (role: 'Staff', accessLevel with fees permissions)
   - Teacher (role: 'Staff', accessLevel WITHOUT fees permissions)
2. All subscribe to push notifications

**Steps**:
1. Record a payment

**Expected Result**:
- ✅ Admin receives notification (Admins have access to everything)
- ✅ Bursar receives notification (has fees permission)
- ❌ Teacher does NOT receive notification (no fees permission)

**Console Log to Verify**:
```
✅ Admin user: admin01
✅ Staff user: bursar01 (permission: edit)
⏭️  Staff user: teacher01 (no fees access)
```

---

### Test 4: Multi-Device Notification

**Objective**: Verify notification appears on ALL devices where user is signed in

**Setup**:
1. Parent account signed in on:
   - Desktop browser (Chrome)
   - Mobile browser (Safari)
   - Native mobile app (Android)
2. All subscribed to push notifications

**Steps**:
1. Record a payment for parent's child

**Expected Result**:
- ✅ Push notification appears on desktop browser
- ✅ Push notification appears on mobile browser
- ✅ Push notification appears on native Android app
- ✅ All devices show same notification content
- ✅ Clicking any notification navigates to correct page

---

### Test 5: No Parents (Orphan Student)

**Objective**: Verify system handles students without parent accounts gracefully

**Setup**:
1. Create pupil WITHOUT familyId or with familyId that has no parent accounts

**Steps**:
1. Record payment

**Expected Result**:
- ✅ Payment created successfully
- ⚠️ Console logs: "No active parent accounts found for familyId: xyz"
- ✅ Staff still receive notifications
- ✅ No errors thrown

---

### Test 6: Full Payment vs Partial Payment

**Objective**: Verify notification correctly shows payment status

**Test 6a - Partial Payment**:
1. Fee Amount: 500,000 UGX
2. Pay: 200,000 UGX
3. Expected: "Balance: UGX 300,000"

**Test 6b - Full Payment**:
1. Fee Amount: 500,000 UGX
2. Pay: 500,000 UGX (full amount)
3. Expected: "Balance: UGX 0" or "✅ PAID IN FULL"

---

### Test 7: Multiple Payments for Same Fee

**Objective**: Verify balance calculation is correct across multiple payments

**Steps**:
1. Create fee: 500,000 UGX
2. Record payment 1: 200,000 UGX
   - Check notification: Balance: 300,000 UGX
3. Record payment 2: 150,000 UGX
   - Check notification: Balance: 150,000 UGX
4. Record payment 3: 150,000 UGX
   - Check notification: Balance: 0 UGX (PAID IN FULL)

**Expected Result**:
- ✅ Each notification shows correct cumulative balance
- ✅ Total of all payments = fee amount
- ✅ Final payment shows balance: 0

---

### Test 8: Uniform Fee Payment

**Objective**: Verify notifications work for uniform fees (special integration)

**Setup**:
1. Create uniform tracking record
2. Link to pupil

**Steps**:
1. Record uniform fee payment via uniform integration

**Expected Result**:
- ✅ Notification sent for uniform payment
- ✅ Fee name includes "Uniform" in notification
- ✅ Same notification flow as regular fees

---

### Test 9: SurePay Integration

**Objective**: Verify notifications sent for SurePay payments

**Setup**:
1. Configure SurePay integration
2. Record payment via SurePay API

**Steps**:
1. Process SurePay payment
2. SurePayIntegrationService.recordSurePayPayment()

**Expected Result**:
- ✅ Notification sent to parents and staff
- ✅ Notification includes SurePay details
- ✅ "Received by" shows parent name from SurePay

---

### Test 10: Notification Failure Doesn't Block Payment

**Objective**: Verify payment succeeds even if notification fails

**Setup**:
1. Temporarily break notification service (e.g., invalid credentials)

**Steps**:
1. Record payment
2. Check console for notification error
3. Check payment is still created in database

**Expected Result**:
- ✅ Payment created successfully in Firestore
- ❌ Notification fails (logged in console)
- ✅ User sees success message
- ✅ App continues working normally

**Console Log**:
```
❌ Error sending payment notification (non-blocking): ...
```

---

## Manual Testing Checklist

### Before Testing
- [ ] Verify push notifications are enabled in browser
- [ ] Check service worker is registered (DevTools → Application → Service Workers)
- [ ] Verify VAPID keys are configured
- [ ] Check FCM is configured for mobile app
- [ ] Open browser console to monitor logs

### During Testing
- [ ] Record payment for test pupil
- [ ] Check console logs for notification flow
- [ ] Verify push notification appears on screen
- [ ] Click notification and verify navigation
- [ ] Check in-app notification in notifications page
- [ ] Verify notification content is correct
- [ ] Check notification appears on all devices

### After Testing
- [ ] Check `notifications` collection in Firestore
- [ ] Check `notificationDeliveries` collection
- [ ] Verify delivery stats are updated
- [ ] Check no errors in console
- [ ] Verify payment record is correct

---

## Browser DevTools Testing

### 1. Check Service Worker

**Chrome DevTools**:
1. Open DevTools (F12)
2. Go to Application tab
3. Click Service Workers
4. Verify service worker is "activated and running"

### 2. Check Push Subscription

**Console**:
```javascript
// Check if user is subscribed
const registration = await navigator.serviceWorker.ready;
const subscription = await registration.pushManager.getSubscription();
console.log('Subscription:', subscription);
```

### 3. Simulate Push Notification

**Console**:
```javascript
// Manually trigger a test notification
if ('Notification' in window && Notification.permission === 'granted') {
  new Notification('Test Notification', {
    body: 'Testing push notification system',
    icon: '/icons/icon-192x192.png'
  });
}
```

### 4. Check Firestore in Real-Time

**Console**:
```javascript
// Listen for new notifications
import { collection, onSnapshot } from 'firebase/firestore';

const unsubscribe = onSnapshot(collection(db, 'notifications'), (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') {
      console.log('New notification:', change.doc.data());
    }
  });
});
```

---

## Common Issues and Solutions

### Issue 1: Notifications Not Appearing

**Symptoms**:
- Payment created successfully
- Console shows notification sent
- No push notification appears

**Solutions**:
1. Check browser notification permissions:
   ```javascript
   console.log('Permission:', Notification.permission);
   ```
   - If "denied", user must manually enable in browser settings
   
2. Check push subscription exists:
   ```javascript
   const subscription = await registration.pushManager.getSubscription();
   console.log(subscription); // Should not be null
   ```

3. Check service worker is running:
   - DevTools → Application → Service Workers
   - Should show "activated and running"

4. Check VAPID keys match:
   - Public key in frontend matches private key in backend

### Issue 2: Parents Not Receiving Notifications

**Symptoms**:
- Staff receive notifications
- Parents don't receive notifications

**Solutions**:
1. Verify familyId matches:
   ```javascript
   // Check pupil's familyId
   const pupil = await getDoc(doc(db, 'pupils', pupilId));
   console.log('Pupil familyId:', pupil.data().familyId);
   
   // Check parent's familyId
   const parent = await getDoc(doc(db, 'system_users', parentId));
   console.log('Parent familyId:', parent.data().familyId);
   ```

2. Check parent account is active:
   ```javascript
   console.log('Parent isActive:', parent.data().isActive);
   ```

3. Check parent has push subscription:
   ```javascript
   const subscription = await getDocs(query(
     collection(db, 'pushSubscriptions'),
     where('userId', '==', parentId),
     where('isActive', '==', true)
   ));
   console.log('Parent subscriptions:', subscription.size);
   ```

### Issue 3: Staff Not Receiving Notifications

**Symptoms**:
- Parents receive notifications
- Specific staff member doesn't

**Solutions**:
1. Check staff has fees permissions:
   ```javascript
   const accessLevel = await getDoc(doc(db, 'accessLevels', staff.accessLevel));
   const feesModule = accessLevel.data().modules.find(m => m.module === 'fees');
   console.log('Fees permission:', feesModule.permission);
   ```
   - Should NOT be 'no_access'

2. Check staff is active:
   ```javascript
   console.log('Staff isActive:', staff.data().isActive);
   ```

3. Admin users should always receive (bypass permission check):
   ```javascript
   console.log('Staff role:', staff.data().role); // Should be 'Admin' or 'Staff'
   ```

### Issue 4: Incorrect Balance in Notification

**Symptoms**:
- Balance doesn't match expected amount
- Balance calculation seems wrong

**Solutions**:
1. Check all payments for the fee:
   ```javascript
   const payments = await getDocs(query(
     collection(db, 'payments'),
     where('pupilId', '==', pupilId),
     where('feeStructureId', '==', feeId),
     where('academicYearId', '==', yearId),
     where('termId', '==', termId)
   ));
   
   const total = payments.docs.reduce((sum, doc) => {
     if (doc.data().reverted) return sum;
     return sum + doc.data().amount;
   }, 0);
   
   console.log('Total paid:', total);
   console.log('Fee amount:', feeStructure.amount);
   console.log('Balance:', feeStructure.amount - total);
   ```

2. Check for reverted payments:
   ```javascript
   payments.docs.forEach(doc => {
     console.log('Payment:', doc.id, 'Amount:', doc.data().amount, 'Reverted:', doc.data().reverted);
   });
   ```

### Issue 5: Notification Content Missing Details

**Symptoms**:
- Notification shows but missing fee name, amount, etc.

**Solutions**:
1. Check fee structure exists:
   ```javascript
   const feeStructure = await getDoc(doc(db, 'fee_structures', feeStructureId));
   console.log('Fee structure:', feeStructure.exists(), feeStructure.data());
   ```

2. Check pupil exists:
   ```javascript
   const pupil = await getDoc(doc(db, 'pupils', pupilId));
   console.log('Pupil:', pupil.exists(), pupil.data());
   ```

3. Check payment data is complete:
   ```javascript
   console.log('Payment data:', {
     paidBy: paymentData.paidBy,
     amount: paymentData.amount,
     paymentDate: paymentData.paymentDate
   });
   ```

---

## Performance Testing

### Test Load with Multiple Recipients

**Objective**: Verify system can handle many recipients efficiently

**Setup**:
1. Create 100 staff accounts with fees permissions
2. Create 50 parent accounts
3. All subscribed to push notifications

**Steps**:
1. Record a payment
2. Monitor console logs for timing
3. Check all recipients receive notification

**Expected Result**:
- ✅ Notification sent within 10 seconds
- ✅ No timeout errors
- ✅ Batch processing logs show progress
- ✅ All recipients receive notification

**Console Logs to Check**:
```
⚡ Processing 150 users in 3 batches of 50
📈 Progress: 50/150 users processed
📈 Progress: 100/150 users processed
📈 Progress: 150/150 users processed
✅ [WEB PUSH] Results: 140 successful, 10 failed
```

---

## Production Deployment Checklist

Before deploying to production:

- [ ] Test all scenarios in staging environment
- [ ] Verify VAPID keys are production keys (not dev)
- [ ] Check FCM project is production project
- [ ] Test with real user accounts
- [ ] Monitor console logs for errors
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure rate limiting to prevent spam
- [ ] Test notification frequency limits
- [ ] Verify privacy - parents only see their children
- [ ] Check security - permissions properly enforced
- [ ] Create rollback plan if issues arise
- [ ] Document known issues and workarounds
- [ ] Train staff on new notification feature
- [ ] Create user guide for parents

---

## Monitoring and Logging

### What to Monitor

1. **Notification Delivery Rate**:
   ```sql
   SELECT 
     COUNT(*) as total,
     SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
     (SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) / COUNT(*)) * 100 as delivery_rate
   FROM notificationDeliveries
   WHERE method = 'push'
   AND createdAt > NOW() - INTERVAL 24 HOURS;
   ```

2. **Average Notification Latency**:
   - Time from payment creation to notification sent
   - Should be < 5 seconds

3. **Failed Notifications**:
   - Track error rates
   - Common failure reasons
   - Users with failed notifications

4. **Push Subscription Health**:
   - Number of active subscriptions
   - Expired subscriptions
   - Subscription renewal rate

### Key Metrics

- **Delivery Rate**: Target > 95%
- **Latency**: Target < 5 seconds
- **Error Rate**: Target < 2%
- **User Engagement**: % of users who enable push

---

## Success Criteria

✅ Feature is successful if:

1. **Functionality**:
   - All parents of student receive notification
   - All staff with fees permissions receive notification
   - Notification includes all required payment details
   - Balance calculation is accurate
   - Clicking notification navigates to correct page

2. **Performance**:
   - Notifications sent within 5 seconds of payment
   - Payment creation not blocked by notification
   - System handles 100+ recipients efficiently

3. **Reliability**:
   - 95%+ delivery rate
   - Payment succeeds even if notification fails
   - No crashes or errors in normal usage

4. **User Experience**:
   - Notifications are clear and informative
   - Parents can easily view payment details
   - Staff can quickly access fee collection page
   - No notification spam or duplicates

5. **Security**:
   - Parents only see their own children's payments
   - Staff permissions properly enforced
   - No sensitive data leaked in notifications
   - Push subscriptions properly secured

---

## Next Steps

After successful testing:

1. **Deploy to Production**: Follow deployment checklist
2. **Monitor Closely**: Watch logs and metrics for first 48 hours
3. **Gather Feedback**: Ask users about notification experience
4. **Iterate**: Make improvements based on feedback
5. **Document**: Update user guides and training materials
6. **Expand**: Consider adding email/SMS notifications in future

---

**Version**: 1.0  
**Last Updated**: December 21, 2025  
**Author**: AI Implementation Team

