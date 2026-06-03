# Africa's Talking Top-up Integration

## Overview

This integration adds comprehensive top-up functionality to the Trinity Family Schools bulk SMS system, including manual top-up options and automatic top-up capabilities. Users can now add funds to their SMS account using various payment methods and configure automatic top-ups to ensure uninterrupted service.

## Features Added

### 1. Manual Top-up
- **Multiple Payment Methods**: Mobile Money, Credit/Debit Cards, Bank Transfer
- **Mobile Money Providers**: MTN, Airtel, Orange, Safaricom (M-Pesa)
- **Recommended Amounts**: Smart suggestions based on current balance
- **Real-time Processing**: Instant payment initiation with status feedback
- **Payment URLs**: Automatic redirect for card and bank payments

### 2. Auto Top-up
- **Threshold-based Triggering**: Automatically top-up when balance falls below set threshold
- **Configurable Amounts**: Set custom top-up amounts
- **Daily Limits**: Safety limits to prevent excessive charges
- **Multiple Payment Methods**: Same options as manual top-up
- **Real-time Monitoring**: Automatic balance checking and triggering

### 3. Enhanced Account Management
- **Balance Status Indicators**: Visual indicators for balance levels
- **Auto Top-up Status**: Display current auto top-up configuration
- **Top-up History**: Track daily top-up counts and limits
- **Smart Recommendations**: Suggested amounts based on usage patterns

## Technical Implementation

### API Routes

#### 1. Top-up Processing API (`/api/sms/topup`)
```typescript
POST /api/sms/topup
Body: {
  amount: number;
  currency: string;
  paymentMethod: 'mobile_money' | 'card' | 'bank_transfer';
  phoneNumber?: string; // For mobile money
  provider?: 'MTN' | 'Airtel' | 'Orange' | 'Safaricom';
  metadata?: {
    userId: string;
    description?: string;
  };
}
```

**Features:**
- Validates payment method requirements
- Processes payments through Africa's Talking Payment APIs
- Returns transaction IDs and payment URLs
- Handles mobile money PIN confirmations
- Supports card checkout redirects

#### 2. Auto Top-up Configuration API (`/api/sms/auto-topup`)
```typescript
GET /api/sms/auto-topup?userId={userId}
POST /api/sms/auto-topup
PUT /api/sms/auto-topup
```

**Features:**
- Stores configuration in Firebase Firestore
- Validates payment method settings
- Manages daily limits and counters
- Handles threshold and amount validation

### Services

#### TopUpService (`/lib/services/topup.service.ts`)
**Methods:**
- `processTopUp(request)` - Process manual top-up requests
- `getAutoTopUpConfig(userId)` - Retrieve auto top-up configuration
- `updateAutoTopUpConfig(config)` - Update auto top-up settings
- `checkAutoTopUp(userId, balance)` - Check and trigger auto top-up
- `getPaymentMethods()` - Get available payment options
- `formatCurrency(amount, currency)` - Format currency display
- `validatePhoneNumber(phone, provider)` - Validate mobile money numbers
- `getRecommendedAmounts(balance, currency)` - Get smart amount suggestions

### React Hooks

#### useTopUp (`/lib/hooks/use-topup.ts`)
**Features:**
- React Query integration for caching and state management
- Auto top-up configuration management
- Top-up processing with loading states
- Error handling and retry logic
- Automatic cache invalidation

### UI Components

#### 1. TopUpDialog (`/components/BulkSMS/TopUpDialog.tsx`)
**Features:**
- Tabbed interface for manual and auto top-up
- Payment method selection with provider options
- Form validation and error handling
- Real-time configuration updates
- Status displays and progress indicators

#### 2. Enhanced AccountBalance (`/components/BulkSMS/AccountBalance.tsx`)
**Features:**
- Top-up button integration
- Auto top-up status display
- Balance threshold warnings
- Automatic top-up triggering
- Visual status indicators

## Payment Methods

### Mobile Money
**Supported Providers:**
- **MTN Mobile Money**: Uganda, Ghana, Cameroon, Ivory Coast
- **Airtel Money**: Uganda, Kenya, Tanzania, Rwanda
- **Orange Money**: Senegal, Mali, Burkina Faso, Niger
- **M-Pesa (Safaricom)**: Kenya, Tanzania

**Process:**
1. User selects provider and enters phone number
2. Payment request sent to Africa's Talking
3. User receives PIN prompt on mobile device
4. User enters PIN to complete payment
5. Account balance updated automatically

### Credit/Debit Cards
**Supported Cards:**
- Visa, Mastercard, and other major cards
- Secure checkout through Africa's Talking

**Process:**
1. User selects card payment method
2. Redirected to secure checkout page
3. Enters card details and completes payment
4. Returns to application with payment status

### Bank Transfer
**Features:**
- Direct bank transfer integration
- Online banking support
- Secure payment processing

**Process:**
1. User selects bank transfer option
2. Redirected to banking interface
3. Completes transfer through bank
4. Payment confirmation processed

## Auto Top-up Configuration

### Settings
- **Threshold**: Minimum balance before triggering (default: KES 100)
- **Amount**: Amount to add when triggered (default: KES 500)
- **Payment Method**: Same options as manual top-up
- **Daily Limit**: Maximum auto top-ups per day (default: 3)
- **Status**: Enable/disable auto top-up

### Triggering Logic
1. Balance checked after each SMS send operation
2. If balance < threshold and auto top-up enabled:
   - Check daily limit not exceeded
   - Validate payment method configuration
   - Process automatic top-up
   - Update counters and timestamps
   - Refresh account balance

### Safety Features
- **Daily Limits**: Prevent excessive charges
- **Validation**: Ensure payment methods are properly configured
- **Error Handling**: Graceful failure with user notifications
- **Logging**: Comprehensive audit trail

## Currency Support

### Supported Currencies
- **KES (Kenyan Shilling)**: Primary currency
- **UGX (Ugandan Shilling)**: Secondary support
- **USD**: International support

### Recommended Amounts by Currency
**KES (Kenyan Shilling):**
- Low balance (< 100): 500, 1000, 2000, 5000
- Moderate balance (100-499): 1000, 2000, 5000, 10000
- Good balance (≥ 500): 2000, 5000, 10000, 20000

**UGX (Ugandan Shilling):**
- Low balance (< 1000): 5000, 10000, 20000, 50000
- Moderate balance (1000-4999): 10000, 20000, 50000, 100000
- Good balance (≥ 5000): 20000, 50000, 100000, 200000

## Usage Instructions

### Manual Top-up
1. Navigate to Bulk SMS page
2. Click "Top Up" button in Account Balance card
3. Select "Manual Top-up" tab
4. Enter desired amount or select recommended amount
5. Choose payment method:
   - **Mobile Money**: Select provider and enter phone number
   - **Card**: Will redirect to secure checkout
   - **Bank Transfer**: Will redirect to banking interface
6. Click "Top-up" button
7. Follow payment instructions
8. Account balance updates automatically

### Auto Top-up Setup
1. Click "Top Up" button in Account Balance card
2. Select "Auto Top-up" tab
3. Toggle "Enable Auto Top-up" switch
4. Configure settings:
   - **Threshold**: When to trigger top-up
   - **Amount**: How much to add
   - **Payment Method**: How to pay
   - **Daily Limit**: Safety limit
5. Click "Update Auto Top-up"
6. Auto top-up will trigger automatically when balance is low

### Monitoring Auto Top-up
- **Status Display**: Shows if auto top-up is active
- **Current Settings**: Displays threshold and amount
- **Daily Counter**: Shows today's auto top-up count
- **Balance Warnings**: Alerts when approaching threshold

## Error Handling

### Common Errors
1. **Insufficient Funds**: Payment method has insufficient balance
2. **Invalid Phone Number**: Mobile money number format incorrect
3. **Payment Declined**: Card or bank payment rejected
4. **Network Issues**: Connectivity problems
5. **Daily Limit Exceeded**: Too many auto top-ups in one day

### Error Recovery
- **Retry Mechanisms**: Automatic retry for network issues
- **User Notifications**: Clear error messages with solutions
- **Fallback Options**: Alternative payment methods suggested
- **Support Information**: Contact details for payment issues

## Security Considerations

### Payment Security
- **No Card Storage**: Card details not stored in application
- **Secure Redirects**: All payments through Africa's Talking secure endpoints
- **API Key Protection**: Server-side API key storage only
- **Transaction Logging**: Comprehensive audit trail

### Auto Top-up Security
- **Daily Limits**: Prevent excessive charges
- **User Control**: Easy enable/disable functionality
- **Validation**: Strict payment method validation
- **Monitoring**: Real-time balance and transaction monitoring

## Testing

### Manual Testing
1. **Test Manual Top-up**:
   - Try each payment method
   - Test with different amounts
   - Verify balance updates
   - Check error handling

2. **Test Auto Top-up**:
   - Configure auto top-up
   - Send SMS to trigger low balance
   - Verify automatic top-up
   - Check daily limits

3. **Test Error Scenarios**:
   - Invalid phone numbers
   - Insufficient payment method balance
   - Network connectivity issues
   - Daily limit exceeded

### API Testing
```javascript
// Test manual top-up
const topUpResponse = await fetch('/api/sms/topup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 1000,
    currency: 'KES',
    paymentMethod: 'mobile_money',
    phoneNumber: '+254700000000',
    provider: 'Safaricom',
    metadata: { userId: 'test-user', description: 'Test top-up' }
  })
});

// Test auto top-up configuration
const configResponse = await fetch('/api/sms/auto-topup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'test-user',
    enabled: true,
    threshold: 100,
    amount: 500,
    currency: 'KES',
    paymentMethod: 'mobile_money',
    phoneNumber: '+254700000000',
    provider: 'Safaricom'
  })
});
```

## Monitoring and Analytics

### Key Metrics
- **Top-up Success Rate**: Percentage of successful payments
- **Auto Top-up Trigger Rate**: How often auto top-up activates
- **Payment Method Usage**: Distribution of payment methods
- **Average Top-up Amount**: Typical top-up amounts
- **Daily Top-up Volume**: Number of top-ups per day

### Logging
- **Transaction Logs**: All payment attempts and results
- **Auto Top-up Logs**: Threshold checks and triggers
- **Error Logs**: Failed payments and reasons
- **User Activity**: Top-up configuration changes

## Troubleshooting

### Common Issues

#### 1. "Payment failed" Error
**Causes:**
- Insufficient funds in payment method
- Invalid payment details
- Network connectivity issues
- Payment provider downtime

**Solutions:**
- Check payment method balance
- Verify phone number format
- Try alternative payment method
- Retry after network issues resolve

#### 2. "Auto top-up not triggering"
**Causes:**
- Auto top-up disabled
- Daily limit reached
- Payment method configuration invalid
- Balance above threshold

**Solutions:**
- Check auto top-up settings
- Verify daily limit not exceeded
- Validate payment method details
- Confirm threshold settings

#### 3. "Invalid phone number" Error
**Causes:**
- Incorrect phone number format
- Wrong country code
- Unsupported provider

**Solutions:**
- Use international format (+country code)
- Verify provider supports the number
- Check number belongs to selected provider

### Support Contacts
- **Africa's Talking Support**: For payment processing issues
- **Technical Support**: For application-related problems
- **Account Support**: For balance and billing questions

## Future Enhancements

### Planned Features
1. **Payment History**: Detailed transaction history
2. **Spending Analytics**: Usage patterns and insights
3. **Budget Alerts**: Spending limit notifications
4. **Bulk Top-up**: Top-up for multiple accounts
5. **Subscription Plans**: Recurring payment options
6. **Loyalty Rewards**: Discounts for frequent top-ups

### API Improvements
1. **Webhook Integration**: Real-time payment notifications
2. **Advanced Analytics**: Detailed usage statistics
3. **Multi-currency**: Enhanced currency support
4. **Payment Scheduling**: Scheduled top-ups
5. **Group Payments**: Shared account top-ups

## Environment Configuration

### Required Environment Variables
```env
# Africa's Talking Configuration
NEXT_PUBLIC_AFRICAS_TALKING_USERNAME=trinityfsch
AFRICAS_TALKING_API_KEY=atsk_f6441bd8aa6d905da4199c5d824c45b46b81185c8f4663fa3b5c315a3cceb204687b3617

# Firebase Configuration (for auto top-up storage)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

### Firestore Collections
- **autoTopUpConfigs**: Auto top-up configurations by user ID
- **topUpTransactions**: Transaction history (optional)
- **paymentMethods**: Saved payment methods (optional)

## Changelog

### Version 1.0.0 (Current)
- Initial top-up integration
- Manual top-up with multiple payment methods
- Auto top-up configuration and triggering
- Enhanced account balance display
- Comprehensive error handling
- Security and validation features

---

**Last Updated**: December 2024
**Integration Version**: 1.0.0
**Africa's Talking Payment API Version**: v1 