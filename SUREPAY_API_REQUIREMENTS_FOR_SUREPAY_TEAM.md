# API Requirements for SurePay Team

**Document For**: SurePay Development Team  
**School**: Trinity Family Nursery and Primary School  
**Integration Type**: RESTful API with Webhooks  
**Date**: November 15, 2024

---

## Executive Summary

Our school management system needs to integrate with SurePay to:
1. **Register students** in SurePay when registered in our system
2. **Receive payment notifications** when parents make payments
3. **Sync student promotions** when students move to new classes
4. **Fetch pay codes** for students

This document outlines the exact APIs we need from SurePay to enable this integration.

---

## Authentication

### API Key Authentication

All API requests should use Bearer token authentication:

```
Authorization: Bearer {API_KEY}
X-School-ID: {SCHOOL_ID}
```

**What we need from you:**
- [ ] Production API Key
- [ ] Sandbox/Test API Key
- [ ] School ID

---

## Required APIs

### 1. Student Registration API

**Purpose**: Register a new student in SurePay system

**Endpoint**: `POST /api/v1/students/register`

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
  "classId": "class-p3-a",
  "className": "Primary 3 A",
  "section": "Day",
  "guardians": [
    {
      "name": "Jane Doe",
      "phone": "+256700123456",
      "email": "jane.doe@example.com",
      "relationship": "Mother"
    },
    {
      "name": "John Doe Sr.",
      "phone": "+256700123457",
      "email": "john.doe@example.com",
      "relationship": "Father"
    }
  ],
  "registrationDate": "2024-01-15T10:30:00Z"
}
```

**Expected Response** (Success - 200 OK):
```json
{
  "success": true,
  "message": "Student registered successfully",
  "data": {
    "studentId": "sp-student-789abc",
    "payCode": "PAY-12345678",
    "schoolStudentId": "ADM2024001",
    "registeredAt": "2024-01-15T10:30:00Z"
  }
}
```

**Expected Response** (Error - 400 Bad Request):
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_STUDENT",
    "message": "Student with admission number ADM2024001 already exists"
  }
}
```

**Error Codes We Need to Handle**:
- `DUPLICATE_STUDENT` - Student already registered
- `INVALID_DATA` - Required fields missing or invalid
- `INVALID_SCHOOL` - School ID not found
- `UNAUTHORIZED` - Invalid API key

---

### 2. Student Promotion/Update API

**Purpose**: Update student's class when promoted

**Endpoint**: `POST /api/v1/students/promote`

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
  "fromClassId": "class-p3-a",
  "fromClassName": "Primary 3 A",
  "toClassId": "class-p4-a",
  "toClassName": "Primary 4 A",
  "promotionDate": "2024-09-01T00:00:00Z",
  "academicYearId": "ay-2024-2025"
}
```

**Expected Response** (Success - 200 OK):
```json
{
  "success": true,
  "message": "Student promoted successfully",
  "data": {
    "studentId": "sp-student-789abc",
    "schoolStudentId": "ADM2024001",
    "previousClass": "Primary 3 A",
    "currentClass": "Primary 4 A",
    "updatedAt": "2024-09-01T00:00:00Z"
  }
}
```

**Expected Response** (Error - 404 Not Found):
```json
{
  "success": false,
  "error": {
    "code": "STUDENT_NOT_FOUND",
    "message": "Student with ID ADM2024001 not found"
  }
}
```

---

### 3. Get Student Pay Code API

**Purpose**: Retrieve pay code for a specific student

**Endpoint**: `GET /api/v1/students/{schoolStudentId}/paycode`

**Request Headers**:
```
Authorization: Bearer {API_KEY}
X-School-ID: {SCHOOL_ID}
```

**URL Parameters**:
- `schoolStudentId` - The student's admission number (e.g., ADM2024001)

**Expected Response** (Success - 200 OK):
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

**Expected Response** (Error - 404 Not Found):
```json
{
  "success": false,
  "error": {
    "code": "STUDENT_NOT_FOUND",
    "message": "Student with ID ADM2024001 not found"
  }
}
```

---

### 4. Get Student Payments API

**Purpose**: Fetch all payments made by a specific student

**Endpoint**: `GET /api/v1/payments/student`

**Request Headers**:
```
Authorization: Bearer {API_KEY}
X-School-ID: {SCHOOL_ID}
```

**Query Parameters**:
- `schoolStudentId` (required) - Student's admission number
- `fromDate` (optional) - ISO 8601 date (e.g., 2024-01-01T00:00:00Z)
- `toDate` (optional) - ISO 8601 date
- `status` (optional) - Filter by status: `completed`, `pending`, `reversed`

**Example Request**:
```
GET /api/v1/payments/student?schoolStudentId=ADM2024001&fromDate=2024-01-01T00:00:00Z
```

**Expected Response** (Success - 200 OK):
```json
{
  "success": true,
  "data": {
    "studentId": "sp-student-789abc",
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
            "feeName": "Tuition Fee",
            "amount": 300000
          },
          {
            "feeId": "fee-lunch",
            "feeName": "Lunch Fee",
            "amount": 200000
          }
        ]
      },
      {
        "paymentId": "sp-pay-002",
        "schoolStudentId": "ADM2024001",
        "payCode": "PAY-12345678",
        "amount": 150000,
        "paymentDate": "2024-10-15T09:20:00Z",
        "paymentMethod": "Bank Transfer",
        "transactionReference": "BT-20241015-67890",
        "payerName": "John Doe Sr.",
        "payerPhone": "+256700123457",
        "status": "completed",
        "feeItems": [
          {
            "feeId": "fee-sports",
            "feeName": "Sports Fee",
            "amount": 150000
          }
        ]
      }
    ],
    "summary": {
      "totalPayments": 2,
      "totalAmount": 650000,
      "completedPayments": 2,
      "pendingPayments": 0
    }
  }
}
```

---

### 5. Get School Payments API (Batch)

**Purpose**: Fetch all payments for the school within a date range (for batch syncing)

**Endpoint**: `GET /api/v1/payments/school`

**Request Headers**:
```
Authorization: Bearer {API_KEY}
X-School-ID: {SCHOOL_ID}
```

**Query Parameters**:
- `fromDate` (optional) - ISO 8601 date
- `toDate` (optional) - ISO 8601 date
- `status` (optional) - Filter by status
- `limit` (optional) - Number of records (default: 100, max: 500)
- `offset` (optional) - Pagination offset (default: 0)

**Example Request**:
```
GET /api/v1/payments/school?fromDate=2024-11-01T00:00:00Z&limit=100&offset=0
```

**Expected Response** (Success - 200 OK):
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
            "feeName": "Tuition Fee",
            "amount": 300000
          },
          {
            "feeId": "fee-lunch",
            "feeName": "Lunch Fee",
            "amount": 200000
          }
        ]
      },
      {
        "paymentId": "sp-pay-003",
        "schoolStudentId": "ADM2024002",
        "payCode": "PAY-87654321",
        "amount": 300000,
        "paymentDate": "2024-11-10T15:45:00Z",
        "paymentMethod": "Cash",
        "transactionReference": "CASH-20241110-54321",
        "payerName": "Mary Smith",
        "payerPhone": "+256700999888",
        "status": "completed",
        "feeItems": [
          {
            "feeId": "fee-tuition",
            "feeName": "Tuition Fee",
            "amount": 300000
          }
        ]
      }
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

**Important**: This API should return payments in chronological order (oldest first or newest first, but consistent).

---

### 6. Webhook: Payment Completed

**Purpose**: Real-time notification when a payment is completed

**Webhook URL**: We will provide you with our webhook endpoint URL  
**Example**: `https://trinity-school.vercel.app/api/webhooks/surepay`

**Method**: `POST`

**Headers You Should Send**:
```
Content-Type: application/json
X-SurePay-Signature: {HMAC_SHA256_SIGNATURE}
X-SurePay-Event: payment.completed
```

**Signature Generation**:
```javascript
// Pseudocode
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');
```

**Webhook Payload**:
```json
{
  "eventType": "payment.completed",
  "eventId": "evt-123456789",
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
        "feeName": "Tuition Fee",
        "amount": 300000
      },
      {
        "feeId": "fee-lunch",
        "feeName": "Lunch Fee",
        "amount": 200000
      }
    ]
  }
}
```

**Expected Response from Us**:
```json
{
  "success": true,
  "message": "Webhook processed",
  "eventId": "evt-123456789"
}
```

**Retry Logic**:
- If our endpoint returns 5xx or times out, please retry with exponential backoff
- Suggested: 1 minute, 5 minutes, 15 minutes, 1 hour
- After 4 failed attempts, send us an alert email

---

### 7. Webhook: Payment Reversed

**Purpose**: Notification when a payment is reversed/cancelled

**Method**: `POST`

**Headers**: Same as payment.completed webhook

**Webhook Payload**:
```json
{
  "eventType": "payment.reversed",
  "eventId": "evt-987654321",
  "timestamp": "2024-11-11T10:00:00Z",
  "data": {
    "paymentId": "sp-pay-001",
    "schoolStudentId": "ADM2024001",
    "originalAmount": 500000,
    "reversalReason": "Parent request",
    "reversedBy": "Admin User",
    "reversedAt": "2024-11-11T10:00:00Z"
  }
}
```

---

## Fee ID Mapping

For the `feeItems` in payment data, we need to agree on fee IDs. Here are our fee types:

| Our Fee Name | Suggested Fee ID | Amount Type |
|--------------|------------------|-------------|
| Tuition Fee | `fee-tuition` | Fixed/Variable |
| Lunch Fee | `fee-lunch` | Fixed |
| Transport Fee | `fee-transport` | Fixed |
| Sports Fee | `fee-sports` | Fixed |
| Library Fee | `fee-library` | Fixed |
| Uniform Fee | `fee-uniform` | Variable |
| Examination Fee | `fee-exam` | Fixed |
| Books Fee | `fee-books` | Variable |
| Building Fund | `fee-building` | Fixed |
| PTA Fee | `fee-pta` | Fixed |
| Computer Fee | `fee-computer` | Fixed |
| Science Fee | `fee-science` | Fixed |
| Boarding Fee | `fee-boarding` | Fixed |
| Other | `fee-other` | Variable |

**Question for SurePay**: Can we configure custom fee IDs in your system, or should we use your standard fee IDs?

---

## Data Formats

### Date and Time
- **Format**: ISO 8601 (e.g., `2024-11-10T14:30:00Z`)
- **Timezone**: UTC (all dates should be in UTC)

### Phone Numbers
- **Format**: E.164 format (e.g., `+256700123456`)
- **Country**: Uganda (+256)

### Currency
- **Currency**: Uganda Shillings (UGX)
- **Format**: Integer (no decimals, e.g., `500000` for UGX 500,000)

### Student ID (schoolStudentId)
- **Format**: Alphanumeric string
- **Example**: `ADM2024001`, `ADM2023150`
- **Max Length**: 20 characters

### Pay Code
- **Format**: Your format (please specify)
- **Example**: `PAY-12345678`
- **Requirements**: Should be unique per student and easy for parents to remember

---

## Rate Limits

**What are your API rate limits?**

We expect to make:
- Student registrations: ~50-100 per day (peak during admission season)
- Promotion syncs: ~500-1000 per year (during promotion period)
- Payment fetching: 1 request per 15 minutes (scheduled sync)
- Pay code lookups: ~10-20 per day (on-demand)

Please let us know if these are acceptable or if we need to adjust.

---

## Environment URLs

**What we need from you:**

### Sandbox/Test Environment
- [ ] API Base URL: `https://sandbox.surepay.com/v1` (example)
- [ ] Test API Key
- [ ] Test School ID
- [ ] Test Webhook Secret

### Production Environment
- [ ] API Base URL: `https://api.surepay.com/v1` (example)
- [ ] Production API Key
- [ ] Production School ID
- [ ] Production Webhook Secret

---

## Testing Requirements

**Before going live, we need to test:**

1. ✅ Student registration (success and error cases)
2. ✅ Duplicate student registration (should return error)
3. ✅ Student promotion
4. ✅ Pay code retrieval
5. ✅ Payment webhook reception (with valid signature)
6. ✅ Payment webhook with invalid signature (should reject)
7. ✅ Payment reversal webhook
8. ✅ Batch payment fetching (pagination)
9. ✅ API authentication (invalid API key should return 401)

**Test Data Needed:**
- [ ] Sample student data for testing
- [ ] Sample payment transactions for testing
- [ ] Test pay codes
- [ ] Webhook test events

---

## Security Requirements

### 1. HTTPS
- All API endpoints must use HTTPS
- TLS 1.2 or higher

### 2. Authentication
- API keys must be securely generated
- Ability to rotate API keys without downtime
- Separate keys for test and production

### 3. Webhook Security
- HMAC-SHA256 signature verification
- Webhook secret shared securely
- Support for webhook URL verification (optional)

### 4. Data Privacy
- Student data should be encrypted at rest
- Secure handling of guardian phone numbers and emails
- Compliance with data protection regulations

---

## Support and Documentation

**What we need from you:**

1. [ ] Complete API documentation (OpenAPI/Swagger preferred)
2. [ ] Postman collection for testing
3. [ ] Sandbox environment access
4. [ ] Technical support contact (email/phone)
5. [ ] Webhook testing tool (if available)
6. [ ] SLA for API uptime and response times
7. [ ] Planned maintenance notification system

---

## Timeline

**Proposed Implementation Timeline:**

| Phase | Duration | Tasks |
|-------|----------|-------|
| Phase 1 | Week 1 | Receive credentials, set up test environment |
| Phase 2 | Week 2 | Implement student registration sync |
| Phase 3 | Week 3 | Implement payment webhook and fetching |
| Phase 4 | Week 4 | Implement promotion sync |
| Phase 5 | Week 5 | Testing and bug fixes |
| Phase 6 | Week 6 | Production deployment |

---

## Questions for SurePay Team

1. What is your expected response time for API requests?
2. Do you have API versioning? How do you handle breaking changes?
3. Can we configure custom fee types in your system?
4. Do you support bulk student registration (uploading multiple students at once)?
5. How are payment disputes/reversals handled?
6. Do you provide webhooks for other events (student updates, etc.)?
7. Is there a test credit card/mobile money number for testing payments?
8. What happens if a student is promoted but the API call fails? Can we retry?
9. Do you support idempotency for API calls (to prevent duplicate registrations)?
10. What monitoring/logging do you provide for API usage?

---

## Contact Information

**School**: Trinity Family Nursery and Primary School  
**Technical Contact**: [Your Name]  
**Email**: [Your Email]  
**Phone**: [Your Phone]  
**Webhook URL**: [Will provide after deployment]

---

## Acceptance Criteria

For us to complete the integration, we need:

- [x] All 7 APIs implemented and documented
- [x] Sandbox environment provided with test credentials
- [x] Successfully tested all scenarios listed in "Testing Requirements"
- [x] Webhook signature verification working
- [x] Production credentials provided
- [x] SLA and support contact established
- [x] Data privacy agreement signed (if required)

---

## Appendix: Sample Scenarios

### Scenario 1: New Student Registration

1. Parent comes to school and registers student
2. School admin enters student data in our system
3. Our system calls `POST /api/v1/students/register`
4. SurePay returns pay code
5. School admin gives pay code to parent
6. Parent uses pay code to make payments

### Scenario 2: Payment Made

1. Parent goes to SurePay website/app
2. Parent enters pay code
3. Parent makes payment via mobile money
4. SurePay processes payment
5. SurePay sends webhook to our system
6. Our system records payment in database
7. Payment appears in school admin's dashboard instantly

### Scenario 3: Student Promotion

1. School year ends
2. School admin promotes all Primary 3 students to Primary 4
3. Our system calls `POST /api/v1/students/promote` for each student
4. SurePay updates student class
5. Parent can now make payments for Primary 4 fees

---

**Thank you for your collaboration!** We look forward to a successful integration.

For questions or clarifications, please contact us at the email/phone above.

