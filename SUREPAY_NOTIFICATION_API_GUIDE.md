# Trinity Family School — SurePay Payment Notification API Guide

**For**: SurePay Development Team  
**From**: Trinity Family Nursery and Primary School  
**Purpose**: API specification for SurePay to notify our system of payments made by students/parents  
**Date**: March 2026  

---

## Overview

Whenever a student/parent makes a payment through the SurePay platform, SurePay's system must call **our API endpoint** to notify us. This allows us to automatically record the payment in our school management system so that the school's finance office can see it immediately.

---

## Endpoint Details

| Field | Value |
|-------|-------|
| **URL** | `https://trinity-family-schools.vercel.app/api/surepay/notify` |
| **Method** | `POST` |
| **Content-Type** | `application/json` |
| **Authentication** | API Key (Bearer Token) |

> **Health Check** — A `GET` request to the same URL will confirm the endpoint is live.

---

## Authentication

Every request must include our shared API key in the `Authorization` header:

```
Authorization: Bearer 67d23d26fca94bd0bba01cc3aee16e20ad4b909ce1763b771f0c8a77d3b88e47
```

Requests without a valid key will receive a `401 Unauthorized` response.

> ⚠️ **Keep this key secret.** Do not share it publicly or log it.

---

## Request Body (JSON)

Send a JSON body with the following fields:

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `paymentId` | string | SurePay's unique ID for this payment | `"SP-PAY-2024110001"` |
| `payCode` | string | The student's SurePay pay code | `"000000000"` |
| `admissionNumber` | string | Student's school admission/registration number | `"ADM2024001"` |
| `studentName` | string | Student's full name as registered in SurePay | `"Junior Kagwa"` |
| `amount` | number | Total amount paid in UGX (integer, no decimals) | `20000` |
| `paymentDate` | string | ISO 8601 date/time of the payment (UTC) | `"2026-03-11T11:25:00Z"` |
| `paymentMethod` | string | How payment was made | `"MobileMoney"` |
| `transactionReference` | string | SurePay's own transaction reference | `"MM-20260311-98765"` |
| `payerName` | string | Name of the person who made the payment | `"David Kagwa"` |
| `status` | string | Payment status: `"completed"`, `"pending"`, or `"reversed"` | `"completed"` |

### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `payerPhone` | string | Phone number of the payer (E.164 format) | `"+256700123456"` |
| `feeItems` | array | Breakdown of fees paid (see below). If omitted, the full `amount` is recorded as a single "School Fees" entry | See below |

### `feeItems` Array (optional breakdown)

```json
"feeItems": [
  { "feeName": "Tuition Fee",  "amount": 15000 },
  { "feeName": "Lunch Fee",    "amount": 5000  }
]
```

> Note: the sum of `feeItems[].amount` should equal the top-level `amount`.

---

## Example Request

```http
POST /api/surepay/notify HTTP/1.1
Host: trinity-family-schools.vercel.app
Authorization: Bearer 67d23d26fca94bd0bba01cc3aee16e20ad4b909ce1763b771f0c8a77d3b88e47
Content-Type: application/json

{
  "paymentId": "SP-PAY-2026031100001",
  "payCode": "000000000",
  "admissionNumber": "ADM2024056",
  "studentName": "Junior Kagwa",
  "amount": 20000,
  "paymentDate": "2026-03-11T11:25:00Z",
  "paymentMethod": "MobileMoney",
  "transactionReference": "MM-20260311-98765",
  "payerName": "David Kagwa",
  "payerPhone": "+256700123456",
  "status": "completed",
  "feeItems": [
    { "feeName": "School Fees", "amount": 20000 }
  ]
}
```

---

## Success Response (HTTP 200)

```json
{
  "success": true,
  "requestId": "sp-1741688700000-abc123",
  "message": "Payment notification received and recorded successfully",
  "data": {
    "paymentId": "SP-PAY-2026031100001",
    "admissionNumber": "ADM2024056",
    "studentName": "Junior Kagwa",
    "amount": 20000,
    "recordedPayments": 1,
    "academicYear": "2025/2026",
    "term": "Term 1",
    "recordedAt": "2026-03-11T11:25:05Z"
  }
}
```

---

## Error Responses

| HTTP Code | Meaning | When it happens |
|-----------|---------|----------------|
| `200` | Success | Payment recorded (or duplicate safely ignored) |
| `400` | Bad Request | Request body is not valid JSON |
| `401` | Unauthorized | Missing or invalid API key |
| `404` | Not Found | Student not found with the given `admissionNumber` / `payCode` |
| `422` | Validation Error | Required fields are missing or invalid |
| `500` | Server Error | Unexpected error on our side – **please retry** |

### Example Validation Error (422)

```json
{
  "success": false,
  "requestId": "sp-1741688700000-def456",
  "error": "Validation failed",
  "details": [
    "amount must be a positive number",
    "paymentDate is required"
  ]
}
```

---

## Duplicate Handling

Our system automatically detects duplicate payment notifications using `paymentId`. If SurePay calls us twice with the same `paymentId`, the second call will return `200 OK` with a message saying the payment was already recorded — no duplicate entry is created.

---

## Retry Policy

If you receive a `500` response or a network timeout, please retry with exponential backoff:

| Attempt | Wait Before Retry |
|---------|-----------------|
| 1st retry | 1 minute |
| 2nd retry | 5 minutes |
| 3rd retry | 15 minutes |
| 4th retry | 1 hour |

After 4 failed attempts, please alert our technical contact.

---

## Currency & Data Formats

| Field | Format |
|-------|--------|
| **Currency** | Uganda Shillings (UGX) — integers only, e.g. `20000` for UGX 20,000 |
| **Date/Time** | ISO 8601 UTC — e.g. `"2026-03-11T11:25:00Z"` |
| **Phone** | E.164 format — e.g. `"+256700123456"` |
| **admissionNumber** | As assigned by the school — e.g. `"ADM2024001"` |

---

## Testing / Sandbox

Before going live, please test against our endpoint and confirm:

- [ ] A payment notification is received and `success: true` is returned
- [ ] Sending the same `paymentId` twice returns `200` without creating a duplicate
- [ ] A request without the `Authorization` header returns `401`
- [ ] A request with a missing required field returns `422`
- [ ] The payment appears correctly in our school management dashboard

---

## Contact

**School**: Trinity Family Nursery and Primary School  
**Technical Contact**: [Your Name / Email / Phone]  
**Notification API URL**: `https://trinity-family-schools.vercel.app/api/surepay/notify`

---

*Thank you for the integration. Please reach out if you have questions about the payload format or the student admission numbers.*
