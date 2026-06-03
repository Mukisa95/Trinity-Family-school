CONTIN# SurePay Environment Configuration

## Environment Variables Setup

Add these variables to your `.env.local` file (for local development) and to your deployment platform (Vercel, etc.) for production.

### Required Environment Variables

```bash
# SurePay Integration Configuration
# ===================================

# SurePay API Base URL
# - For testing/sandbox: https://sandbox.surepay.com/v1
# - For production: https://api.surepay.com/v1
NEXT_PUBLIC_SUREPAY_API_URL=https://sandbox.surepay.com/v1

# SurePay API Key (KEEP SECRET - Server-side only)
# This will be provided by SurePay
SUREPAY_API_KEY=sk_test_your_api_key_here

# Your School ID in SurePay system
# This will be provided by SurePay
NEXT_PUBLIC_SUREPAY_SCHOOL_ID=school_abc123

# SurePay Webhook Secret (for signature verification)
# This will be provided by SurePay
SUREPAY_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Your webhook URL (where SurePay will send notifications)
# For local testing, use ngrok or similar tool
# For production, use your actual domain
NEXT_PUBLIC_APP_URL=https://your-school-app.vercel.app
```

## Local Development Setup

### Step 1: Create .env.local file

Create a file named `.env.local` in your project root:

```bash
# Copy these variables and replace with actual values
NEXT_PUBLIC_SUREPAY_API_URL=https://sandbox.surepay.com/v1
SUREPAY_API_KEY=your_test_api_key
NEXT_PUBLIC_SUREPAY_SCHOOL_ID=your_school_id
SUREPAY_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 2: Test Webhook Locally with ngrok

Since webhooks require a public URL, use ngrok for local testing:

1. Install ngrok:
   ```bash
   npm install -g ngrok
   # or
   choco install ngrok  # on Windows
   ```

2. Start your Next.js app:
   ```bash
   npm run dev
   ```

3. In another terminal, start ngrok:
   ```bash
   ngrok http 3000
   ```

4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)

5. Configure this URL in SurePay's webhook settings:
   ```
   https://abc123.ngrok.io/api/webhooks/surepay
   ```

## Production Deployment Setup

### Vercel Deployment

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add all the variables:

   | Name | Value | Environment |
   |------|-------|-------------|
   | `NEXT_PUBLIC_SUREPAY_API_URL` | `https://api.surepay.com/v1` | Production |
   | `SUREPAY_API_KEY` | Your production API key | Production (Secret) |
   | `NEXT_PUBLIC_SUREPAY_SCHOOL_ID` | Your school ID | Production |
   | `SUREPAY_WEBHOOK_SECRET` | Your webhook secret | Production (Secret) |
   | `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Production |

4. Redeploy your application

5. Configure webhook URL in SurePay:
   ```
   https://your-app.vercel.app/api/webhooks/surepay
   ```

## Security Best Practices

### 1. API Key Management

- ✅ **DO**: Store API keys in environment variables
- ✅ **DO**: Use different keys for development and production
- ✅ **DO**: Rotate keys periodically
- ❌ **DON'T**: Commit API keys to version control
- ❌ **DON'T**: Expose API keys in client-side code

### 2. Webhook Security

- ✅ **DO**: Always verify webhook signatures
- ✅ **DO**: Use HTTPS for webhook URLs
- ✅ **DO**: Implement rate limiting
- ✅ **DO**: Log all webhook events
- ❌ **DON'T**: Process webhooks without signature verification
- ❌ **DON'T**: Expose webhook URLs publicly without protection

### 3. Error Handling

- ✅ **DO**: Log all integration errors
- ✅ **DO**: Set up monitoring and alerts
- ✅ **DO**: Implement retry mechanisms
- ✅ **DO**: Handle network failures gracefully
- ❌ **DON'T**: Expose internal error details to users

## Testing the Integration

### 1. Test Configuration

```bash
# Run this in your browser console or Node.js
fetch('/api/webhooks/surepay', {
  method: 'GET'
})
.then(r => r.json())
.then(console.log);

// Should return: { status: 'SurePay webhook endpoint is active', timestamp: '...' }
```

### 2. Test Webhook Signature Verification

Create a test file `test-webhook.js`:

```javascript
const crypto = require('crypto');

const webhookSecret = 'your_webhook_secret';
const payload = JSON.stringify({
  eventType: 'payment.completed',
  eventId: 'evt-test-123',
  timestamp: new Date().toISOString(),
  data: {
    paymentId: 'pay-test-001',
    schoolStudentId: 'ADM2024001',
    amount: 50000
  }
});

const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(payload)
  .digest('hex');

console.log('Payload:', payload);
console.log('Signature:', signature);

// Use these values to test your webhook endpoint
fetch('http://localhost:3000/api/webhooks/surepay', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-SurePay-Signature': signature
  },
  body: payload
})
.then(r => r.json())
.then(console.log);
```

Run it:
```bash
node test-webhook.js
```

## Troubleshooting

### Issue: Webhook not receiving events

**Solutions:**
1. Check if webhook URL is correctly configured in SurePay
2. Verify URL is publicly accessible (not localhost)
3. Check Vercel function logs for errors
4. Ensure HTTPS is being used

### Issue: Signature verification failing

**Solutions:**
1. Verify `SUREPAY_WEBHOOK_SECRET` is correct
2. Check that payload is being read as raw text before parsing
3. Ensure the same hashing algorithm is used (SHA256)

### Issue: API calls failing

**Solutions:**
1. Verify `SUREPAY_API_KEY` is correct
2. Check if API URL is correct (sandbox vs production)
3. Verify `NEXT_PUBLIC_SUREPAY_SCHOOL_ID` is correct
4. Check SurePay API status

### Issue: Payments not being recorded

**Solutions:**
1. Check if pupil exists with matching admission number
2. Verify active academic year is configured
3. Check Firebase permissions
4. Review webhook logs in `surePaySyncLogs` collection

## Monitoring and Logging

### View Sync Logs

You can check integration logs in your Firebase Firestore:

1. Collection: `surePaySyncLogs`
   - Contains all registration, payment, and promotion syncs
   - Includes success and failure logs

2. Collection: `surePayPaymentMappings`
   - Maps SurePay payment IDs to local payment records
   - Prevents duplicate payment recording

### Viewing Logs Programmatically

```typescript
import { SurePayIntegrationService } from '@/lib/services/surepay-integration.service';

// Get last 50 sync logs
const logs = await SurePayIntegrationService.getSyncLogs(50);
console.log(logs);
```

## Support Contacts

- **SurePay Support**: Contact SurePay for API issues, credentials, and webhook configuration
- **Your Development Team**: For integration implementation issues
- **Firebase Support**: For database and authentication issues

## Checklist

Before going to production, ensure:

- [ ] All environment variables are configured
- [ ] Webhook URL is configured in SurePay
- [ ] Webhook signature verification is working
- [ ] Test pupil registration sync
- [ ] Test payment webhook reception
- [ ] Test promotion sync
- [ ] Test duplicate payment prevention
- [ ] Set up monitoring and alerts
- [ ] Document the integration for your team
- [ ] Train staff on new features
- [ ] Have rollback plan ready

