# Africa's Talking API Fix

## Problem
The application was showing errors when trying to fetch Africa's Talking account data:
- `Error fetching account data: Error: Unknown error`
- `Error fetching auto top-up config: Error: Unknown error`
- `HTTP/1.1 405 Method Not Allowed` for `/api/sms/account`

## Root Cause
The issue was caused by the API routes being disabled for static export, but the services were still trying to use local API endpoints in development mode. The services were configured to use:
- Local API endpoints (`/api/sms/account`, `/api/sms/topup`, etc.) in development
- Firebase Functions endpoints in production

However, the local API routes were disabled with this code:
```typescript
// This file is disabled for static export - functionality moved to Firebase Functions
export default function handler() {
  return new Response('API route disabled for static export', { status: 404 });
}
```

## Solution
Updated all Africa's Talking related services to always use Firebase Functions endpoints instead of trying to use local API routes.

### Files Modified:

1. **`src/lib/services/africas-talking-account.service.ts`**
   - Changed from conditional endpoint selection to always use Firebase Functions
   - Endpoint: `https://smsaccount-u7lfv2gaca-uc.a.run.app`

2. **`src/lib/services/topup.service.ts`**
   - Updated all three methods to use Firebase Functions
   - Endpoints: 
     - `https://us-central1-trinity-family-schools.cloudfunctions.net/smsTopup`
     - `https://us-central1-trinity-family-schools.cloudfunctions.net/smsAutoTopup`

3. **`src/lib/services/sms.service.ts`**
   - Updated SMS sending to use Firebase Functions
   - Endpoint: `https://smsbulk-u7lfv2gaca-uc.a.run.app`

### Changes Made:
```typescript
// Before (causing errors)
const apiEndpoint = process.env.NODE_ENV === 'production' 
  ? 'https://smsaccount-u7lfv2gaca-uc.a.run.app'
  : '/api/sms/account';

// After (fixed)
const apiEndpoint = 'https://smsaccount-u7lfv2gaca-uc.a.run.app';
```

## Result
- ✅ Africa's Talking account data now loads properly
- ✅ Auto top-up configuration works
- ✅ SMS sending functionality works
- ✅ No more 405 Method Not Allowed errors
- ✅ Consistent behavior across development and production

## Firebase Functions Used
The application now relies on these Firebase Functions:
- `smsAccount` - Account balance and information
- `smsTopup` - Manual top-up processing
- `smsAutoTopup` - Auto top-up configuration and execution
- `smsBulk` - Bulk SMS sending

All functions are deployed and working correctly in the Firebase project.
