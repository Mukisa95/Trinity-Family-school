# Payment Notification Fix - Server-Side API Route

## Problem
Payment notifications were not being triggered because `PaymentsService.createPayment` was being called directly from client-side components. The notification service contains a check:

```typescript
if (typeof window !== 'undefined') {
  console.log('⚠️ [Payment Notification] Skipping - running in browser');
  return;
}
```

This caused all payment notifications to be skipped when payments were made through the fees collection UI.

## Root Cause
- Payment creation was happening on the **client side** (browser)
- Notification service requires **server-side** execution to access Node.js modules (`firebase-admin`, `web-push`)
- The `typeof window !== 'undefined'` check correctly prevented the service from trying to load server-only modules in the browser

## Solution
Created a server-side API route `/api/payments/create` that:
1. Receives payment data via POST request
2. Creates payment record using `PaymentsService.createPayment` on the server
3. Automatically triggers the notification service with access to all server-side modules
4. Returns the payment ID to the client

## Files Changed

### 1. New API Route
- **`src/app/api/payments/create/route.ts`** (NEW)
  - Server-side POST endpoint for payment creation
  - Ensures notifications run in Node.js environment

### 2. Updated Client-Side Payment Calls
All client-side files that call `PaymentsService.createPayment` were updated to use the new API route:

- **`src/app/fees/collect/[id]/PupilFeesCollectionClient.tsx`**
  - Regular fee payments now use API route
  
- **`src/lib/services/uniform-fees-integration.service.ts`**
  - Uniform fee payments use API route when called from client
  
- **`src/app/fees/collect/[id]/utils/carryForwardPayments.ts`**
  - Carry forward payments use API route when called from client
  
- **`src/app/fees/collect/[id]/hooks/usePaymentProcessing.ts`**
  - Payment processing hook uses API route
  
- **`src/lib/hooks/use-payments.ts`**
  - `useCreatePayment` hook uses API route
  
- **`src/app/fees/family/[...slug]/page.tsx`**
  - Family payment page uses API route
  
- **`src/app/fees/collect/[id]/utils/paymentReversal.ts`**
  - Payment reversals use API route when called from client
  
- **`src/lib/services/surepay-integration.service.ts`**
  - SurePay integration uses API route when called from client

## Implementation Pattern

### Client-Side Code (Before)
```typescript
const paymentId = await PaymentsService.createPayment(paymentData);
```

### Client-Side Code (After)
```typescript
const response = await fetch('/api/payments/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(paymentData),
});

if (!response.ok) {
  const errorData = await response.json();
  throw new Error(errorData.error || 'Failed to create payment');
}

const result = await response.json();
const paymentId = result.paymentId;
```

### Services Used from Both Client and Server (After)
```typescript
let paymentId: string;
if (typeof window !== 'undefined') {
  // Client-side: use API route for notifications
  const response = await fetch('/api/payments/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(paymentRecord),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create payment');
  }

  const result = await response.json();
  paymentId = result.paymentId;
} else {
  // Server-side: call service directly
  paymentId = await PaymentsService.createPayment(paymentRecord as any);
}
```

## Expected Behavior After Fix

When a payment is made through the fees collection UI:

1. ✅ Payment record is created on the **server**
2. ✅ `PaymentsService.sendPaymentNotification` runs in **Node.js environment**
3. ✅ Fetches pupil, fee structure, and calculates balance
4. ✅ Identifies recipients:
   - **Parents**: All users with same `familyId` as the pupil
   - **Staff**: All users with permission to fees collection component
5. ✅ Calls `feesPaymentNotificationServerService.sendPaymentNotification`
6. ✅ Uses `optimizedNotificationService` to send push notifications to:
   - Native FCM tokens (mobile devices)
   - Web push subscriptions (browsers)
7. ✅ Console logs show the full notification flow

## Console Logs to Expect

### Server-Side Logs (Vercel Functions)
```
================================================================================
💳 [Payment API] Creating payment via server-side route
   Pupil ID: TbiDDPHCa8PBtjL6m9FD
   Fee ID: PlRiklfuXHjxAKWJhJMO
   Amount: 50000
================================================================================

================================================================================
🔔 [Payment Notification] Initiating notification for payment abc123xyz
================================================================================

📖 [Payment Notification] Fetching pupil details for ID: TbiDDPHCa8PBtjL6m9FD
   ✅ Pupil: JOVAN MUKISA (familyId: family123)

📖 [Payment Notification] Fetching fee structure for ID: PlRiklfuXHjxAKWJhJMO
   ✅ Fee: UPPER PRIMARY (Amount: 300000)

🧮 [Payment Notification] Calculating balance...
   Total Paid: 50000
   Balance: 250000

📤 [Payment Notification] Sending notification via server-only notification service...

✅ [Payment Notification] Notification process completed

✅ [Payment API] Payment created successfully: abc123xyz
```

### Client-Side Logs (Browser Console)
```
✅ Payment of UGX 50,000 recorded successfully!
```

## Testing Checklist

- [ ] Make a fee payment and verify server logs show notification processing
- [ ] Check that push notifications are received by:
  - [ ] Parent accounts (all devices signed in with same familyId)
  - [ ] Staff accounts with fees collection permission (all devices)
- [ ] Verify notification includes:
  - [ ] Fee item name
  - [ ] Actual amount (original fee amount)
  - [ ] Amount paid (current payment)
  - [ ] Balance remaining
  - [ ] Time of payment
  - [ ] Who received the payment (staff name)
- [ ] Test uniform fee payments
- [ ] Test carry forward payments
- [ ] Test family payment page
- [ ] Test payment reversals
- [ ] Test SurePay integration (if applicable)

## Deployment Notes

After deployment:
1. Monitor Vercel function logs for payment notifications
2. Verify no "Skipping - running in browser" messages appear
3. Check Firebase Firestore for `notifications` and `notificationDeliveries` collections
4. Test with real devices to confirm push notifications are delivered

## Related Files

- Implementation: `FEES_PAYMENT_NOTIFICATION_IMPLEMENTATION_SUMMARY.md`
- Testing Guide: `FEES_PAYMENT_NOTIFICATION_TESTING_GUIDE.md`
- Flow Analysis: `PUSH_NOTIFICATION_FLOW_ANALYSIS.md`

