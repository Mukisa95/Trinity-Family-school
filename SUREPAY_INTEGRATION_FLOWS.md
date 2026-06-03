# SurePay Integration Flows - Visual Guide

This document provides visual representations of all integration flows between your school management system and SurePay.

---

## Flow 1: Pupil Registration and Pay Code Generation

```
┌─────────────────────────────────────────────────────────────────┐
│                    PUPIL REGISTRATION FLOW                       │
└─────────────────────────────────────────────────────────────────┘

  School Admin                Your System              SurePay
      │                           │                        │
      │  1. Enter pupil data      │                        │
      │ ─────────────────────────>│                        │
      │                           │                        │
      │                           │ 2. Save to Firebase    │
      │                           │ ─────────────┐         │
      │                           │              │         │
      │                           │<─────────────┘         │
      │                           │                        │
      │                           │ 3. POST /students/register
      │                           │ ──────────────────────>│
      │                           │    (Admission No,      │
      │                           │     Name, Class,       │
      │                           │     Guardian Info)     │
      │                           │                        │
      │                           │                        │ 4. Create
      │                           │                        │    Student
      │                           │                        │ ─────┐
      │                           │                        │      │
      │                           │                        │<─────┘
      │                           │                        │
      │                           │                        │ 5. Generate
      │                           │                        │    Pay Code
      │                           │                        │ ─────┐
      │                           │                        │      │
      │                           │                        │<─────┘
      │                           │                        │
      │                           │ 6. Return Pay Code     │
      │                           │<───────────────────────│
      │                           │    (PAY-12345678)      │
      │                           │                        │
      │                           │ 7. Store Pay Code      │
      │                           │    in additionalIds    │
      │                           │ ─────────────┐         │
      │                           │              │         │
      │                           │<─────────────┘         │
      │                           │                        │
      │  8. Show success +        │                        │
      │     Pay Code              │                        │
      │<──────────────────────────│                        │
      │   "PAY-12345678"          │                        │
      │                           │                        │
      │  9. Give Pay Code         │                        │
      │     to Parent             │                        │
      │ ─────────────┐            │                        │
      │              │            │                        │
      │<─────────────┘            │                        │
      │                           │                        │

RESULT: Student registered in both systems with Pay Code generated
```

---

## Flow 2: Payment Processing via Webhook (Real-time)

```
┌─────────────────────────────────────────────────────────────────┐
│                      PAYMENT WEBHOOK FLOW                        │
└─────────────────────────────────────────────────────────────────┘

   Parent          SurePay Platform     Your System       Database
      │                   │                   │               │
      │ 1. Enter Pay Code │                   │               │
      │   PAY-12345678    │                   │               │
      │──────────────────>│                   │               │
      │                   │                   │               │
      │ 2. Select fees    │                   │               │
      │   & Make payment  │                   │               │
      │──────────────────>│                   │               │
      │                   │                   │               │
      │                   │ 3. Process Payment│               │
      │                   │    (Mobile Money/ │               │
      │                   │     Bank Transfer)│               │
      │                   │ ─────────┐        │               │
      │                   │          │        │               │
      │                   │<─────────┘        │               │
      │                   │                   │               │
      │ 4. Payment Success│                   │               │
      │   Confirmation    │                   │               │
      │<──────────────────│                   │               │
      │                   │                   │               │
      │                   │ 5. POST /webhooks/surepay         │
      │                   │    (with signature)               │
      │                   │──────────────────>│               │
      │                   │   {               │               │
      │                   │     paymentId,    │               │
      │                   │     amount,       │               │
      │                   │     studentId,    │               │
      │                   │     feeItems      │               │
      │                   │   }               │               │
      │                   │                   │               │
      │                   │                   │ 6. Verify     │
      │                   │                   │    Signature  │
      │                   │                   │ ─────┐        │
      │                   │                   │      │        │
      │                   │                   │<─────┘        │
      │                   │                   │               │
      │                   │                   │ 7. Find Pupil │
      │                   │                   │    by Adm. No │
      │                   │                   │──────────────>│
      │                   │                   │               │
      │                   │                   │<──────────────│
      │                   │                   │  Pupil Data   │
      │                   │                   │               │
      │                   │                   │ 8. Check for  │
      │                   │                   │    Duplicate  │
      │                   │                   │──────────────>│
      │                   │                   │               │
      │                   │                   │<──────────────│
      │                   │                   │  Not Duplicate│
      │                   │                   │               │
      │                   │                   │ 9. Create     │
      │                   │                   │    Payment    │
      │                   │                   │    Records    │
      │                   │                   │──────────────>│
      │                   │                   │               │
      │                   │                   │<──────────────│
      │                   │                   │  Payment IDs  │
      │                   │                   │               │
      │                   │                   │ 10. Store     │
      │                   │                   │     Mapping   │
      │                   │                   │──────────────>│
      │                   │                   │               │
      │                   │ 11. Return 200 OK │               │
      │                   │<──────────────────│               │
      │                   │                   │               │
      │                   │                   │               │
      │                                                       │
      └───────────────────────────────────────────────────────┘

School Admin sees payment instantly in fees collection dashboard!
```

---

## Flow 3: Manual Payment Sync (Batch)

```
┌─────────────────────────────────────────────────────────────────┐
│                   MANUAL PAYMENT SYNC FLOW                       │
└─────────────────────────────────────────────────────────────────┘

School Admin          Your System              SurePay         Database
     │                     │                       │               │
     │ 1. Click "Sync     │                       │               │
     │    SurePay         │                       │               │
     │    Payments"       │                       │               │
     │───────────────────>│                       │               │
     │                    │                       │               │
     │                    │ 2. Get last sync      │               │
     │                    │    timestamp          │               │
     │                    │──────────────────────────────────────>│
     │                    │                       │               │
     │                    │<──────────────────────────────────────│
     │                    │  "2024-11-10T00:00Z"  │               │
     │                    │                       │               │
     │                    │ 3. GET /payments/school?fromDate=...  │
     │                    │──────────────────────>│               │
     │                    │                       │               │
     │                    │ 4. Fetch payments     │               │
     │                    │    since last sync    │               │
     │                    │                       │ ─────┐        │
     │                    │                       │      │        │
     │                    │                       │<─────┘        │
     │                    │                       │               │
     │                    │ 5. Return payments    │               │
     │                    │    (Array of 50)      │               │
     │                    │<──────────────────────│               │
     │                    │                       │               │
     │                    │ 6. Load all pupils    │               │
     │                    │──────────────────────────────────────>│
     │                    │                       │               │
     │                    │<──────────────────────────────────────│
     │                    │  Pupils Array         │               │
     │                    │                       │               │
     │                    │ 7. For each payment:  │               │
     │                    │    - Find pupil       │               │
     │                    │    - Check duplicate  │               │
     │                    │    - Create record    │               │
     │                    │──────────────────────────────────────>│
     │                    │                       │               │
     │                    │<──────────────────────────────────────│
     │                    │  Success (45/50)      │               │
     │                    │                       │               │
     │                    │ 8. Update last sync   │               │
     │                    │    timestamp          │               │
     │                    │──────────────────────────────────────>│
     │                    │                       │               │
     │ 9. Show result     │                       │               │
     │    "45 payments    │                       │               │
     │     synced, 5      │                       │               │
     │     failed"        │                       │               │
     │<───────────────────│                       │               │
     │                    │                       │               │

RESULT: All recent payments synchronized and recorded
```

---

## Flow 4: Pupil Promotion Sync

```
┌─────────────────────────────────────────────────────────────────┐
│                    PUPIL PROMOTION FLOW                          │
└─────────────────────────────────────────────────────────────────┘

School Admin          Your System              SurePay         Database
     │                     │                       │               │
     │ 1. Select pupils    │                       │               │
     │    in Primary 3     │                       │               │
     │───────────────────>│                       │               │
     │                    │                       │               │
     │ 2. Select target    │                       │               │
     │    class (P4)       │                       │               │
     │───────────────────>│                       │               │
     │                    │                       │               │
     │ 3. Click "Promote"  │                       │               │
     │───────────────────>│                       │               │
     │                    │                       │               │
     │                    │ FOR EACH PUPIL:       │               │
     │                    │                       │               │
     │                    │ 4. Update pupil class │               │
     │                    │    and add history    │               │
     │                    │──────────────────────────────────────>│
     │                    │                       │               │
     │                    │<──────────────────────────────────────│
     │                    │  Updated              │               │
     │                    │                       │               │
     │                    │ 5. POST /students/promote             │
     │                    │──────────────────────>│               │
     │                    │   {                   │               │
     │                    │     studentId: "ADM..",│              │
     │                    │     fromClass: "P3",  │               │
     │                    │     toClass: "P4"     │               │
     │                    │   }                   │               │
     │                    │                       │               │
     │                    │                       │ 6. Update     │
     │                    │                       │    student    │
     │                    │                       │    class      │
     │                    │                       │ ─────┐        │
     │                    │                       │      │        │
     │                    │                       │<─────┘        │
     │                    │                       │               │
     │                    │ 7. Return success     │               │
     │                    │<──────────────────────│               │
     │                    │                       │               │
     │                    │ 8. Log sync result    │               │
     │                    │──────────────────────────────────────>│
     │                    │                       │               │
     │                    │ [Repeat for all       │               │
     │                    │  selected pupils]     │               │
     │                    │                       │               │
     │ 9. Show success    │                       │               │
     │    "50 pupils      │                       │               │
     │     promoted and   │                       │               │
     │     synced"        │                       │               │
     │<───────────────────│                       │               │
     │                    │                       │               │

RESULT: All promoted pupils updated in both systems
```

---

## Flow 5: Error Handling and Retry

```
┌─────────────────────────────────────────────────────────────────┐
│                   ERROR HANDLING FLOW                            │
└─────────────────────────────────────────────────────────────────┘

Your System          SurePay           Database          Admin
     │                  │                  │                │
     │ 1. API Request   │                  │                │
     │─────────────────>│                  │                │
     │                  │                  │                │
     │                  │ Network Error    │                │
     │                  │ OR 5xx Error     │                │
     │                  │ OR Timeout       │                │
     │                  │ ─────┐           │                │
     │                  │      │           │                │
     │                  │<─────┘           │                │
     │                  │                  │                │
     │ 2. Catch Error   │                  │                │
     │ ─────┐           │                  │                │
     │      │           │                  │                │
     │<─────┘           │                  │                │
     │                  │                  │                │
     │ 3. Log error     │                  │                │
     │─────────────────────────────────────>│                │
     │                  │  (surePaySyncLogs)│               │
     │                  │                  │                │
     │ 4. Wait 1 second │                  │                │
     │ ─────┐           │                  │                │
     │      │           │                  │                │
     │<─────┘           │                  │                │
     │                  │                  │                │
     │ 5. Retry Request │                  │                │
     │─────────────────>│                  │                │
     │                  │                  │                │
     │                  │ Success!         │                │
     │<─────────────────│                  │                │
     │                  │                  │                │
     │ 6. Log success   │                  │                │
     │─────────────────────────────────────>│                │
     │                  │                  │                │
     │ 7. Continue      │                  │                │
     │    normally      │                  │                │
     │                  │                  │                │
     │                                                       │
     │  IF ALL RETRIES FAIL:                                │
     │                                                       │
     │ 8. Log final error                                   │
     │─────────────────────────────────────>│                │
     │                  │                  │                │
     │ 9. Show error to user                                │
     │─────────────────────────────────────────────────────>│
     │   "SurePay sync failed.                              │
     │    Data saved locally.                               │
     │    Will retry later."                                │
     │                  │                  │                │

RESULT: Graceful error handling with automatic retries
```

---

## Flow 6: Duplicate Payment Prevention

```
┌─────────────────────────────────────────────────────────────────┐
│                DUPLICATE PREVENTION FLOW                         │
└─────────────────────────────────────────────────────────────────┘

Webhook/Sync         Your System          Database
     │                    │                   │
     │ 1. Payment data    │                   │
     │    received        │                   │
     │───────────────────>│                   │
     │   paymentId:       │                   │
     │   "sp-pay-123"     │                   │
     │                    │                   │
     │                    │ 2. Check if       │
     │                    │    payment exists │
     │                    │──────────────────>│
     │                    │  WHERE            │
     │                    │  surePayPaymentId │
     │                    │  = "sp-pay-123"   │
     │                    │                   │
     │                    │<──────────────────│
     │                    │  Found: {         │
     │                    │    localIds: [...] │
     │                    │  }                │
     │                    │                   │
     │                    │ 3. Payment already│
     │                    │    recorded       │
     │                    │ ─────┐            │
     │                    │      │            │
     │                    │<─────┘            │
     │                    │                   │
     │                    │ 4. Skip processing│
     │                    │ ─────┐            │
     │                    │      │            │
     │                    │<─────┘            │
     │                    │                   │
     │ 5. Return success  │                   │
     │    (idempotent)    │                   │
     │<───────────────────│                   │
     │   "Already         │                   │
     │    processed"      │                   │
     │                    │                   │

RESULT: No duplicate payments created even if webhook is sent multiple times
```

---

## Flow 7: Pay Code Lookup

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAY CODE LOOKUP FLOW                          │
└─────────────────────────────────────────────────────────────────┘

School Admin          Your System          SurePay         Database
     │                     │                   │               │
     │ 1. View pupil       │                   │               │
     │    details page     │                   │               │
     │───────────────────>│                   │               │
     │                    │                   │               │
     │                    │ 2. Load pupil     │               │
     │                    │──────────────────────────────────>│
     │                    │                   │               │
     │                    │<──────────────────────────────────│
     │                    │  Pupil Data       │               │
     │                    │  (with Pay Code   │               │
     │                    │   in additionalIds)│              │
     │                    │                   │               │
     │                    │ 3. Check if Pay   │               │
     │                    │    Code exists    │               │
     │                    │ ─────┐            │               │
     │                    │      │            │               │
     │                    │<─────┘            │               │
     │                    │  Found: PAY-12345678             │
     │                    │                   │               │
     │ 4. Display Pay Code│                   │               │
     │<───────────────────│                   │               │
     │   PAY-12345678     │                   │               │
     │                    │                   │               │
     │                                                        │
     │  IF PAY CODE NOT FOUND:                               │
     │                                                        │
     │                    │ 5. GET /students/{id}/paycode    │
     │                    │──────────────────>│               │
     │                    │                   │               │
     │                    │<──────────────────│               │
     │                    │  PAY-12345678     │               │
     │                    │                   │               │
     │                    │ 6. Store Pay Code │               │
     │                    │──────────────────────────────────>│
     │                    │                   │               │
     │ 7. Display Pay Code│                   │               │
     │<───────────────────│                   │               │
     │   PAY-12345678     │                   │               │
     │                    │                   │               │

RESULT: Pay Code always available for parent
```

---

## Integration Status Dashboard

```
┌────────────────────────────────────────────────────────────┐
│               SUREPAY SYNC DASHBOARD                        │
│                                                            │
│  Last Sync: 2024-11-15 10:30 AM                           │
│  Status: ✅ Active                                         │
│                                                            │
│  ┌──────────────────┐  ┌──────────────────┐              │
│  │   Total Syncs    │  │  Success Rate    │              │
│  │                  │  │                  │              │
│  │      1,247       │  │     98.5%        │              │
│  └──────────────────┘  └──────────────────┘              │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │             Sync Activity by Type                     │ │
│  │                                                       │ │
│  │  Registrations:   ████████░░  450  (445 success)    │ │
│  │  Payments:        ██████████  780  (770 success)    │ │
│  │  Promotions:      ███░░░░░░░   17  ( 17 success)    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │             Recent Sync Logs                          │ │
│  │  ✅ Payment sync      ADM2024001  10:30 AM  Success  │ │
│  │  ✅ Registration      ADM2024150  10:25 AM  Success  │ │
│  │  ❌ Payment sync      ADM2024002  10:20 AM  Failed   │ │
│  │  ✅ Promotion         ADM2023099  10:15 AM  Success  │ │
│  │  ✅ Payment sync      ADM2024045  10:10 AM  Success  │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  [Sync Payments Now]  [View All Logs]  [Settings]         │
└────────────────────────────────────────────────────────────┘
```

---

## Data Flow Summary

### Pupil Data Flow
```
School System         →  SurePay System
──────────────────────────────────────────
admissionNumber       →  schoolStudentId
firstName, lastName   →  firstName, lastName
classId, className    →  classId, className
guardians[]           →  guardians[]
photo, medicalInfo    →  (NOT sent)
```

### Payment Data Flow
```
SurePay System        →  School System
──────────────────────────────────────────
paymentId             →  surePayPaymentId
schoolStudentId       →  pupilId (mapped)
amount                →  amount
feeItems[]            →  multiple PaymentRecords
transactionReference  →  notes
payerName             →  paidBy.name
```

### Security Flow
```
SurePay Webhook Request:
1. Payload: JSON string
2. Signature: HMAC-SHA256(payload, webhookSecret)
3. Header: X-SurePay-Signature: {signature}

Your System Verification:
1. Read raw payload
2. Calculate: HMAC-SHA256(payload, yourWebhookSecret)
3. Compare signatures
4. If match → process
5. If not match → reject (401)
```

---

## Best Practices Illustrated

### ✅ DO: Verify Signatures
```
Webhook → Verify Signature → Process → Respond
         ✓ Valid           ✓ Success   200 OK
         ✗ Invalid         Reject      401
```

### ✅ DO: Handle Idempotency
```
Same Payment → Check Database → Already Exists? → Return Success
                                      Yes ──────────────┘
                                      No → Create → Return Success
```

### ✅ DO: Log Everything
```
Every API Call → Log → Database
                 ├─ Success logs
                 └─ Error logs
```

### ❌ DON'T: Ignore Errors
```
API Error → Show Generic Error → User Confused ❌

API Error → Log Detailed Error → Show User-Friendly Message ✅
```
