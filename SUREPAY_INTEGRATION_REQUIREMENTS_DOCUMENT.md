# SurePay Integration Requirements Document

**School**: Trinity Family Nursery and Primary School  
**Website**: https://trinityfamilyschool.vercel.app  
**Date**: December 2, 2025  
**Document Version**: 1.0

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Integration Overview](#integration-overview)
3. [What We Need from SurePay](#what-we-need-from-surepay)
4. [What SurePay Needs from Us](#what-surepay-needs-from-us)
5. [How the Integration Works](#how-the-integration-works)
6. [Technical Specifications](#technical-specifications)
7. [Testing Plan](#testing-plan)
8. [Timeline](#timeline)
9. [Contact Information](#contact-information)

---

## Executive Summary

Trinity Family Nursery and Primary School wishes to integrate with SurePay to streamline our fee payment process. This document outlines the mutual requirements and technical specifications needed for a successful integration.

**Integration Goals:**
- Automatically register pupils in SurePay when they enroll in our school
- Receive real-time payment notifications when parents make payments
- Automatically sync class promotions to SurePay
- Provide parents with easy-to-use pay codes for making payments

---

## Integration Overview

### Current Situation
- We manually manage pupil registrations and fee payments in our school system
- Parents need a convenient way to pay school fees online
- We need automatic reconciliation of payments

### Desired State After Integration
- When we register a pupil, they are automatically registered in SurePay with a pay code
- Parents use the pay code to make payments via SurePay
- Payments appear in our system instantly
- When pupils are promoted to new classes, SurePay is automatically updated

### Integration Type
**Hybrid RESTful API + Webhook Integration**
- We call SurePay APIs for pupil registration and class updates
- SurePay calls our webhook for payment notifications

---

## What We Need from SurePay

### 1. API Credentials

#### A. API Key (Production)
**What it is**: A secret key that authenticates our requests to SurePay's API

**How it works**: Every time our system needs to register a pupil, sync a promotion, or fetch payment data, we include this key in the request header:
```
Authorization: Bearer sk_live_abc123xyz...
```

**Format**: String (e.g., `sk_live_abc123xyz...`)

**Why we need it**: Without this key, SurePay's servers will reject our requests

**Security**: We will store this securely in our environment variables and never expose it publicly

---

#### B. API Key (Test/Sandbox)
**What it is**: A separate key for testing before going live

**How it works**: Same as production key, but used with sandbox environment

**Format**: String (e.g., `sk_test_xyz123abc...`)

**Why we need it**: To test all integration features without affecting real payments

---

#### C. School ID
**What it is**: Our unique identifier in SurePay's system

**How it works**: Included in every API request to identify our school:
```
X-School-ID: school_trinity_12345
```

**Format**: String (e.g., `school_trinity_12345`)

**Why we need it**: SurePay may serve multiple schools, this ID ensures our data stays separate

---

#### D. Webhook Secret
**What it is**: A secret key used to verify that payment notifications are really from SurePay

**How it works**: 
1. SurePay creates a signature of the payment data using this secret
2. SurePay sends the signature with the payment notification
3. We verify the signature using the same secret
4. If signatures match, we know the notification is authentic

**Format**: String (e.g., `whsec_xyz789abc...`)

**Why we need it**: Prevents malicious users from sending fake payment notifications to our system

**Example**:
```
SurePay calculates: HMAC-SHA256(payment_data, webhook_secret) = "abc123..."
SurePay sends: X-SurePay-Signature: abc123...
We calculate: HMAC-SHA256(payment_data, webhook_secret) = "abc123..."
Match? ✅ We process the payment
```

---

### 2. API Endpoints

We need SurePay to provide the following API endpoints:

#### A. Student Registration API

**Endpoint**: `POST /api/v1/students/register`

**What it does**: Creates a new student in SurePay and generates a pay code

**When we use it**: Immediately after registering a pupil in our school system

**What we send**:
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
    }
  ],
  "registrationDate": "2024-01-15T10:30:00Z"
}
```

**What we need back**:
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

**Key field**: `payCode` - This is what parents will use to make payments

**Error handling**: If student already exists, please return:
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_STUDENT",
    "message": "Student with admission number ADM2024001 already exists"
  }
}
```

---

#### B. Student Promotion API

**Endpoint**: `POST /api/v1/students/promote`

**What it does**: Updates a student's class when they are promoted

**When we use it**: At the end of academic year when promoting pupils to next class

**What we send**:
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

**What we need back**:
```json
{
  "success": true,
  "message": "Student promoted successfully",
  "data": {
    "studentId": "sp-student-789",
    "schoolStudentId": "ADM2024001",
    "previousClass": "Primary 3 A",
    "currentClass": "Primary 4 A",
    "updatedAt": "2024-09-01T00:00:00Z"
  }
}
```

**Why we need it**: So that payment amounts and fee structures can be updated based on the new class

---

#### C. Get Student Pay Code API

**Endpoint**: `GET /api/v1/students/{schoolStudentId}/paycode`

**What it does**: Retrieves the pay code for a specific student

**When we use it**: 
- If we lose the pay code stored in our system
- When parent requests their pay code
- For verification purposes

**What we send**: Student's admission number in URL (e.g., `/api/v1/students/ADM2024001/paycode`)

**What we need back**:
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

#### D. Get Student Payments API

**Endpoint**: `GET /api/v1/payments/student?schoolStudentId={id}&fromDate={date}`

**What it does**: Retrieves all payments made by a specific student

**When we use it**: 
- For manual reconciliation
- If webhook notification was missed
- For generating payment reports

**Query Parameters**:
- `schoolStudentId` (required): Student's admission number
- `fromDate` (optional): Only return payments after this date
- `toDate` (optional): Only return payments before this date

**What we need back**:
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
    ]
  }
}
```

---

#### E. Get All School Payments API

**Endpoint**: `GET /api/v1/payments/school?fromDate={date}&toDate={date}&limit={n}&offset={n}`

**What it does**: Retrieves all payments for our school within a date range

**When we use it**: 
- Periodic sync (every 15-30 minutes) to catch any missed webhooks
- For bulk reconciliation
- For financial reporting

**Query Parameters**:
- `fromDate` (optional): Start date
- `toDate` (optional): End date
- `limit` (optional): Number of records to return (default: 100, max: 500)
- `offset` (optional): Pagination offset

**What we need back**:
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
        "feeItems": [...]
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

---

### 3. Webhook Events

We need SurePay to send us webhook notifications for these events:

#### A. Payment Completed Event

**Event Type**: `payment.completed`

**When to send**: Immediately after a payment is successfully processed

**Where to send**: `https://trinityfamilyschool.vercel.app/api/webhooks/surepay`

**How to send**:
```http
POST https://trinityfamilyschool.vercel.app/api/webhooks/surepay
Content-Type: application/json
X-SurePay-Signature: [HMAC-SHA256 signature]
X-SurePay-Event: payment.completed

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

**Signature calculation**:
```javascript
const crypto = require('crypto');
const payload = JSON.stringify(webhookPayload);
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(payload)
  .digest('hex');
// Send in header: X-SurePay-Signature: {signature}
```

**Expected response from us**:
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "eventId": "evt-123456789"
}
```

**Retry policy needed**: If our server returns 5xx error or times out, please retry:
- After 1 minute
- After 5 minutes
- After 15 minutes
- After 1 hour
- If all retries fail, send us an email alert

---

#### B. Payment Reversed Event

**Event Type**: `payment.reversed`

**When to send**: When a payment is cancelled, refunded, or reversed

**Where to send**: Same webhook URL

**Payload**:
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

**Why we need it**: So we can mark the payment as reversed in our system and adjust student balances

---

### 4. Documentation

We need:

- [ ] Complete API documentation (PDF or online)
- [ ] OpenAPI/Swagger specification (if available)
- [ ] Postman collection for testing
- [ ] Code examples (PHP, Node.js, or Python)
- [ ] Webhook integration guide
- [ ] Error codes reference

---

### 5. Test Environment Access

We need:

- [ ] Sandbox/Test environment URL (e.g., `https://sandbox.surepay.com`)
- [ ] Test API credentials
- [ ] Test pay codes we can use
- [ ] Test payment methods (test credit card numbers, test mobile money numbers)
- [ ] Webhook testing tool (if available)

---

### 6. Support

We need:

- [ ] Technical support contact (email and phone)
- [ ] Response time for technical issues
- [ ] Escalation process for critical issues
- [ ] Scheduled maintenance notifications
- [ ] API status page (to check if SurePay is down)

---

## What SurePay Needs from Us

### 1. Our Webhook URL

**Webhook Endpoint**: `https://trinityfamilyschool.vercel.app/api/webhooks/surepay`

**What it does**: Receives payment notifications from SurePay

**How it works**:
1. Parent makes payment on SurePay
2. SurePay processes payment
3. SurePay sends webhook to our URL with payment details
4. Our system verifies the signature
5. Our system records the payment
6. Our system responds with 200 OK

**Events we want to receive**:
- `payment.completed` - When a payment succeeds
- `payment.reversed` - When a payment is reversed

**Expected payload format**: See webhook specifications above

**Authentication**: We will verify the HMAC-SHA256 signature in the `X-SurePay-Signature` header

**Response format**:
- **Success**: HTTP 200 with `{"success": true}`
- **Error**: HTTP 500 with `{"success": false, "error": "message"}`

**Important**: If you don't receive a 200 response, please retry as specified above

---

### 2. Student ID Format

**Our student ID format**: `ADM` + `YYYY` + sequential number

**Examples**:
- `ADM2024001` - First student admitted in 2024
- `ADM2024150` - 150th student admitted in 2024
- `ADM2023099` - 99th student admitted in 2023

**Characteristics**:
- Always starts with "ADM"
- Includes 4-digit year
- Includes 3-digit sequential number (padded with zeros)
- Maximum length: 11 characters
- Only alphanumeric (no special characters)

**What we'll send**: This ID will be sent as `schoolStudentId` in all API requests

**How to use it**: Store this ID as the primary key linking to our students. Use it in all webhook notifications so we can identify which student made the payment.

---

### 3. Fee Structure Information

We need to map our fee types to SurePay's fee IDs. Here are our fee types:

| Our Fee Name | Suggested Fee ID | Notes |
|--------------|------------------|-------|
| Tuition Fee | `fee-tuition` | Main school fees |
| Lunch Fee | `fee-lunch` | Daily meals |
| Transport Fee | `fee-transport` | School bus |
| Sports Fee | `fee-sports` | Sports activities |
| Library Fee | `fee-library` | Books and resources |
| Uniform Fee | `fee-uniform` | School uniform |
| Examination Fee | `fee-exam` | Exams and assessments |
| Books Fee | `fee-books` | Textbooks |
| Building Fund | `fee-building` | Infrastructure |
| PTA Fee | `fee-pta` | Parent-Teacher Association |
| Computer Fee | `fee-computer` | IT lab usage |
| Science Fee | `fee-science` | Lab materials |
| Boarding Fee | `fee-boarding` | For boarding students |

**Question**: Can we configure these fee types in your system, or do you have a standard list we should use?

---

### 4. Our Technical Specifications

**Platform**: Next.js (React framework)  
**Hosting**: Vercel (https://vercel.com)  
**Database**: Firebase Firestore  
**Server Location**: Automatic (Vercel edge network)  
**SSL Certificate**: Automatic (provided by Vercel)  

**Webhook endpoint specs**:
- Accepts: `application/json`
- Method: `POST`
- Authentication: Signature verification (HMAC-SHA256)
- Response time: < 5 seconds typical
- Idempotent: Yes (can receive same webhook multiple times safely)

---

### 5. Data Privacy Compliance

**Data we share with SurePay**:
- Student names (first, last, other)
- Date of birth
- Gender
- Class information
- Parent/guardian names, phones, emails
- Admission number

**Data we DO NOT share**:
- Student photos
- Medical conditions
- Home addresses
- Academic performance
- Disciplinary records

**Data protection**: We comply with Uganda Data Protection and Privacy Act 2019

**Consent**: We obtain parent consent before sharing data with third parties

**Request**: Please provide your data privacy policy and data processing agreement

---

## How the Integration Works

### Scenario 1: Pupil Registration Flow

```
Step 1: Parent brings child to school for enrollment
    ↓
Step 2: School admin registers pupil in our system
    - Enters name, class, parent details
    - Clicks "Register Pupil" button
    ↓
Step 3: Our system saves pupil to database
    ↓
Step 4: Our system calls SurePay API
    POST /api/v1/students/register
    Sends: pupil data
    ↓
Step 5: SurePay creates student and generates pay code
    Returns: PAY-12345678
    ↓
Step 6: Our system stores pay code with pupil record
    ↓
Step 7: School admin prints pay code on paper
    ↓
Step 8: Parent receives pay code
    ↓
Step 9: Parent can now make payments using this code

Result: Pupil registered in both systems, parent has pay code
```

---

### Scenario 2: Payment Processing Flow

```
Step 1: Parent opens SurePay website/app
    ↓
Step 2: Parent enters pay code: PAY-12345678
    ↓
Step 3: SurePay shows student name and available fees
    ↓
Step 4: Parent selects fees to pay
    - Tuition: UGX 300,000
    - Lunch: UGX 200,000
    Total: UGX 500,000
    ↓
Step 5: Parent chooses payment method (Mobile Money)
    ↓
Step 6: Parent completes payment
    ↓
Step 7: SurePay processes payment successfully
    ↓
Step 8: SurePay sends webhook to our system
    POST https://trinityfamilyschool.vercel.app/api/webhooks/surepay
    Includes: payment details, student ID, amount
    ↓
Step 9: Our system verifies webhook signature
    If valid → continue
    If invalid → reject (prevent fraud)
    ↓
Step 10: Our system finds student by admission number
    ↓
Step 11: Our system checks for duplicate payment
    If already recorded → return success (idempotent)
    If new → continue
    ↓
Step 12: Our system creates payment records
    - One record for tuition (UGX 300,000)
    - One record for lunch (UGX 200,000)
    ↓
Step 13: Our system responds to webhook: 200 OK
    ↓
Step 14: School admin sees payment in dashboard INSTANTLY

Result: Payment recorded, student balance updated, parent has receipt
```

---

### Scenario 3: Promotion Sync Flow

```
Step 1: Academic year ends
    ↓
Step 2: School admin opens promotion page
    ↓
Step 3: Admin selects all Primary 3 students
    ↓
Step 4: Admin selects target class: Primary 4
    ↓
Step 5: Admin clicks "Promote" button
    ↓
Step 6: For each student:
    ↓
    Step 6a: Our system updates student class in database
        From: Primary 3 → To: Primary 4
    ↓
    Step 6b: Our system calls SurePay API
        POST /api/v1/students/promote
        Sends: student ID, old class, new class
    ↓
    Step 6c: SurePay updates student class
    ↓
    Step 6d: SurePay returns success
    ↓
Step 7: Admin sees "50 students promoted successfully"

Result: All students updated in both systems, fee structures adjusted for new class
```

---

## Technical Specifications

### Data Formats

#### Date and Time
- **Format**: ISO 8601 (e.g., `2024-11-10T14:30:00Z`)
- **Timezone**: UTC (all dates in UTC)
- **Example**: `2024-12-02T10:30:00Z`

#### Phone Numbers
- **Format**: E.164 (e.g., `+256700123456`)
- **Country Code**: +256 (Uganda)
- **Example**: `+256700123456`, `+256774081378`

#### Currency
- **Currency**: Uganda Shillings (UGX)
- **Format**: Integer (no decimals)
- **Example**: `500000` means UGX 500,000

#### Student ID
- **Format**: Alphanumeric string
- **Example**: `ADM2024001`
- **Max Length**: 20 characters
- **Pattern**: `ADM` + `YYYY` + `NNN`

#### Pay Code Format
**Question**: What format do you use for pay codes?
- Length?
- Characters allowed?
- Example?

---

### Authentication

**Method**: Bearer Token Authentication

**Request headers**:
```http
Authorization: Bearer {API_KEY}
X-School-ID: {SCHOOL_ID}
Content-Type: application/json
```

**Example**:
```http
POST /api/v1/students/register
Authorization: Bearer sk_live_abc123xyz
X-School-ID: school_trinity_12345
Content-Type: application/json
```

---

### Error Handling

**Standard error response format**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "field": "Additional context if needed"
    }
  }
}
```

**HTTP Status codes we expect**:
- `200 OK` - Success
- `400 Bad Request` - Invalid data sent
- `401 Unauthorized` - Invalid API key
- `404 Not Found` - Student not found
- `409 Conflict` - Duplicate student
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Maintenance

---

### Rate Limits

**Question**: What are your API rate limits?

**Our expected usage**:
- Student registrations: 50-100 per day (peak during admission)
- Promotion syncs: 500-1000 per year (during promotion period)
- Payment fetching: 1 request per 15 minutes (scheduled)
- Pay code lookups: 10-20 per day

---

### Security Requirements

#### 1. HTTPS
- All API endpoints must use HTTPS (TLS 1.2 or higher)
- No HTTP allowed

#### 2. API Key Security
- API keys must be strong (minimum 32 characters)
- Support for API key rotation without downtime
- Different keys for test and production

#### 3. Webhook Security
- Webhook signature using HMAC-SHA256
- Signature must be sent in `X-SurePay-Signature` header
- Webhook secret must be strong

#### 4. Data Encryption
- All data encrypted in transit (HTTPS)
- Student data encrypted at rest

---

## Testing Plan

### Phase 1: Sandbox Testing (Week 1-2)

**Test Cases**:

1. **Student Registration**
   - [ ] Register new student → Verify pay code generated
   - [ ] Register duplicate student → Verify error returned
   - [ ] Register with invalid data → Verify validation errors
   - [ ] Register with missing fields → Verify error messages

2. **Pay Code Retrieval**
   - [ ] Get pay code for existing student
   - [ ] Get pay code for non-existent student → Verify 404 error

3. **Payment Webhook**
   - [ ] Send test payment webhook → Verify payment recorded
   - [ ] Send webhook with invalid signature → Verify rejected
   - [ ] Send duplicate webhook → Verify idempotency (no duplicate payment)
   - [ ] Send webhook with wrong student ID → Verify error logged

4. **Promotion**
   - [ ] Promote student to new class → Verify updated in SurePay
   - [ ] Promote non-existent student → Verify error

5. **Payment Fetching**
   - [ ] Fetch payments for student with payments
   - [ ] Fetch payments for student with no payments
   - [ ] Fetch all school payments → Verify pagination works

### Phase 2: User Acceptance Testing (Week 3)

- [ ] Register 5 real test students
- [ ] Make 10 test payments
- [ ] Promote 5 students
- [ ] Verify all data synced correctly

### Phase 3: Production Rollout (Week 4)

- [ ] Switch to production credentials
- [ ] Monitor first 50 real transactions
- [ ] Verify all webhooks received
- [ ] Check for any errors

---

## Timeline

| Week | Activity | Deliverables |
|------|----------|--------------|
| Week 1 | Kick-off meeting | Agreement on requirements |
| Week 2 | Receive credentials and documentation | API keys, test environment access |
| Week 3 | Integration development | Code complete |
| Week 4 | Sandbox testing | All test cases passed |
| Week 5 | User acceptance testing | Sign-off from school admin |
| Week 6 | Production deployment | Live integration |

---

## Fee ID Mapping Agreement

We need to agree on fee IDs before going live. Please complete this table:

| Our Fee Name | SurePay Fee ID | Amount Configurable? |
|--------------|----------------|----------------------|
| Tuition Fee | _____________ | Yes / No |
| Lunch Fee | _____________ | Yes / No |
| Transport Fee | _____________ | Yes / No |
| Sports Fee | _____________ | Yes / No |
| Library Fee | _____________ | Yes / No |
| Uniform Fee | _____________ | Yes / No |
| Examination Fee | _____________ | Yes / No |
| Books Fee | _____________ | Yes / No |
| Building Fund | _____________ | Yes / No |
| PTA Fee | _____________ | Yes / No |
| Computer Fee | _____________ | Yes / No |
| Science Fee | _____________ | Yes / No |
| Boarding Fee | _____________ | Yes / No |

---

## Questions for SurePay

Before we proceed, we need answers to these questions:

### Technical Questions

1. What is your API base URL for production? For sandbox?
2. What is the expected response time for API requests?
3. Do you have API versioning? How do you handle breaking changes?
4. What is your API uptime SLA?
5. Do you provide API status page?
6. Can we use idempotency keys for API requests?
7. What is your webhook retry policy?
8. Do you support bulk student registration (CSV upload)?

### Fee Management Questions

9. Can we configure custom fee types in your system?
10. How do you handle fee amounts that vary by class?
11. Can parents make partial payments?
12. How are payment receipts generated?
13. Can we customize the payment page with our logo?

### Support Questions

14. What are your support hours?
15. What is your response time for critical issues?
16. Do you provide phone support or email only?
17. How do we report bugs or request features?

### Security & Compliance Questions

18. Are you PCI-DSS compliant (if handling card payments)?
19. Do you comply with Uganda data protection laws?
20. Can we get a data processing agreement?
21. How long do you retain payment data?

---

## Contact Information

### Trinity Family Nursery and Primary School

**School Name**: Trinity Family Nursery and Primary School  
**Website**: https://trinityfamilyschool.vercel.app  
**Email**: trinityfmk@gmail.com  
**Phone**: +256 776 300 109 / +256 774 081 378 / +256 702 957 826  
**Location**: [Your location]

**Technical Contact**:
- **Name**: [Your IT Manager/Developer Name]
- **Email**: [Technical email]
- **Phone**: [Technical phone]

**Financial Contact**:
- **Name**: [Bursar/Accountant Name]
- **Email**: [Finance email]
- **Phone**: [Finance phone]

---

## SurePay Contact Information

Please provide your contact details:

**Company Name**: SurePay  
**Website**: ___________________  
**General Email**: ___________________  
**Support Email**: ___________________  
**Phone**: ___________________

**Technical Contact**:
- **Name**: ___________________
- **Email**: ___________________
- **Phone**: ___________________

**Account Manager**:
- **Name**: ___________________
- **Email**: ___________________
- **Phone**: ___________________

---

## Agreement and Sign-off

### Our Commitments

We, Trinity Family Nursery and Primary School, commit to:

- [ ] Provide accurate student data
- [ ] Maintain webhook endpoint uptime
- [ ] Respond to webhook deliveries within 5 seconds
- [ ] Protect API credentials securely
- [ ] Test thoroughly before production rollout
- [ ] Report integration issues promptly

**Signed**: _____________________  
**Name**: _____________________  
**Title**: _____________________  
**Date**: _____________________

---

### SurePay Commitments

We, SurePay, commit to:

- [ ] Provide all required API endpoints
- [ ] Provide API documentation and test credentials
- [ ] Maintain API uptime of ____%
- [ ] Send webhooks within ___ seconds of payment
- [ ] Retry failed webhooks as specified
- [ ] Provide technical support
- [ ] Give ___ days notice for API changes

**Signed**: _____________________  
**Name**: _____________________  
**Title**: _____________________  
**Date**: _____________________

---

## Appendix A: Sample API Requests

### Sample Student Registration Request

```bash
curl -X POST https://api.surepay.com/v1/students/register \
  -H "Authorization: Bearer sk_live_abc123xyz" \
  -H "X-School-ID: school_trinity_12345" \
  -H "Content-Type: application/json" \
  -d '{
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
      }
    ],
    "registrationDate": "2024-01-15T10:30:00Z"
  }'
```

### Sample Promotion Request

```bash
curl -X POST https://api.surepay.com/v1/students/promote \
  -H "Authorization: Bearer sk_live_abc123xyz" \
  -H "X-School-ID: school_trinity_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "schoolStudentId": "ADM2024001",
    "fromClassId": "class-p3-a",
    "fromClassName": "Primary 3 A",
    "toClassId": "class-p4-a",
    "toClassName": "Primary 4 A",
    "promotionDate": "2024-09-01T00:00:00Z",
    "academicYearId": "ay-2024-2025"
  }'
```

### Sample Webhook Payload from SurePay

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

---

## Appendix B: Glossary

**API (Application Programming Interface)**: A way for two computer systems to talk to each other

**Webhook**: An automated message sent from one system to another when something happens (like a payment)

**API Key**: A secret password that identifies our school when calling SurePay's APIs

**Pay Code**: A unique code given to each student for making payments (like PAY-12345678)

**HMAC-SHA256**: A cryptographic method to verify that a message really came from who it says it came from

**Signature**: A digital "seal" that proves a message hasn't been tampered with

**Idempotent**: Safe to do multiple times - doing it twice has the same effect as doing it once

**Endpoint**: A specific URL where an API can be called

**Payload**: The data sent in an API request or webhook

**HTTP Status Code**: A number that tells you if a request succeeded (200) or failed (400, 500, etc.)

**JSON**: A format for structuring data (like `{"name": "John", "age": 10}`)

**Production**: The real, live system used by real users

**Sandbox**: A test environment for trying things out safely

---

**END OF DOCUMENT**

---

**Next Steps**: 
1. Review this document internally
2. Schedule meeting with SurePay team
3. Get answers to all questions
4. Agree on timeline
5. Sign agreement
6. Receive credentials
7. Begin integration

**Document prepared by**: Trinity Family School IT Team  
**Date**: December 2, 2024  
**Version**: 1.0

