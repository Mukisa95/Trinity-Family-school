# Africa's Talking Account Statistics Integration

## Overview

This integration adds real-time account balance monitoring, SMS cost calculation, and balance verification to the Trinity Family Schools bulk SMS feature. Users can now see their account balance, calculate SMS costs before sending, and get warnings about insufficient balance.

## Features Added

### 1. Account Balance Monitoring
- **Real-time balance display** in the bulk SMS interface
- **Automatic refresh** with manual refresh option
- **Balance status indicators** (Good/Moderate/Low/Insufficient)
- **Estimated SMS count** based on current balance
- **Cost per SMS** display

### 2. Automatic Account Balance Refresh
- **Page Load Refresh**: Balance refreshes automatically when the page loads
- **Activity-Based Refresh**: Balance refreshes after user inactivity (2+ minutes) when user becomes active again
- **Periodic Refresh**: Balance refreshes every 3 minutes when page is visible
- **Post-SMS Refresh**: Balance force-refreshes immediately after sending messages
- **Window Focus Refresh**: Balance refreshes when user returns to the tab
- **Network Reconnect Refresh**: Balance refreshes when internet connection is restored
- **Manual Refresh**: Users can still manually refresh if needed
- **Smart Refresh**: Avoids excessive API calls with intelligent timing

### 3. Enhanced Confirmation Dialog
- **Message preview** with character count and SMS segment information
- **Recipient count** display
- **Warning alerts** for long messages and large recipient lists
- **Send button** with total SMS count display

## Technical Implementation

### API Routes

#### 1. Account Balance API (`/api/sms/account`)
```typescript
GET /api/sms/account
```
- Fetches account balance from Africa's Talking User Data API
- Returns balance amount and currency
- Handles authentication and error cases

### Services

#### AfricasTalkingAccountService
Located: `src/lib/services/africas-talking-account.service.ts`

**Methods:**
- `getAccountData()` - Fetch account balance
- `formatCurrency(amount, currency)` - Format currency display

### React Hooks

#### useAfricasTalkingAccount
Located: `src/lib/hooks/use-africas-talking-account.ts`

**Features:**
- React Query integration for caching and automatic refetching
- Account data management with 2-minute cache (reduced from 5 minutes)
- Error handling and loading states
- **Automatic Refresh System:**
  - **Page Visibility API**: Monitors when page becomes visible/hidden
  - **User Activity Detection**: Listens for clicks, keystrokes, scrolls, mouse movements, and touch events
  - **Periodic Intervals**: Sets up 3-minute refresh intervals when page is active
  - **Force Refresh**: Immediate refresh for critical operations (SMS sending)
  - **Activity Triggers**: Refresh on class selection, guardian selection, template selection, etc.
  - **Smart Timing**: Prevents excessive API calls with intelligent debouncing

### UI Components

#### 1. AccountBalance Component
Located: `src/components/BulkSMS/AccountBalance.tsx`

**Features:**
- Current balance display with status indicators
- Estimated SMS count calculation
- Cost per SMS display
- Manual refresh functionality
- Balance status warnings (Low/Moderate/Good)

#### 2. Enhanced SMSConfirmationDialog
Located: `src/components/BulkSMS/SMSConfirmationDialog.tsx`

**Features:**
- Message preview with character count
- SMS segment calculation and display
- Recipient count display
- Warning alerts for long messages
- Send button with total SMS count

## Environment Variables

Add these to your `.env.local` file:

```env
# Africa's Talking Configuration
NEXT_PUBLIC_AFRICAS_TALKING_USERNAME=trinityfsch
AFRICAS_TALKING_API_KEY=atsk_f6441bd8aa6d905da4199c5d824c45b46b81185c8f4663fa3b5c315a3cceb204687b3617

# Note: Do not add AFRICAS_TALKING_SENDER_ID as it causes InvalidSenderId errors
# Africa's Talking will use their default sender ID
```

## Usage

### 1. Viewing Account Balance
- Navigate to the Bulk SMS page
- Account balance is displayed in the right sidebar with "Auto-refresh" badge
- Balance updates automatically in the following scenarios:
  - **On page load**: Immediate refresh when you visit the page
  - **After inactivity**: Refreshes when you become active after 2+ minutes of inactivity
  - **Periodic updates**: Every 3 minutes while the page is visible
  - **After sending SMS**: Immediate force refresh to show updated balance
  - **Window focus**: When you return to the tab from another tab/application
  - **Network reconnect**: When your internet connection is restored
- Manual refresh button is still available for immediate updates
- Balance status is color-coded:
  - **Green**: Good balance (≥ KES 1,000)
  - **Yellow**: Moderate balance (KES 100-999)
  - **Red**: Low balance (< KES 100)

### 2. Message Composition and Sending
- Enter your message in the text area
- Select recipients using class selection, individual selection, or manual phone numbers
- View message statistics including:
  - Character count with 160-character limit indicator
  - SMS segment count for long messages
  - Total recipient count
- Send button shows total SMS count that will be sent
- Confirmation dialog provides final review before sending

### 3. Sending Messages
- Confirmation dialog shows message preview and recipient count
- After sending, account balance is automatically refreshed
- Results dialog shows detailed sending results including any blocked MTN numbers

## Error Handling

### Network Errors
- Graceful handling of network connectivity issues
- Retry mechanisms for failed requests
- User-friendly error messages

### API Errors
- Authentication error handling for invalid credentials
- Rate limiting and quota exceeded handling
- Invalid response format handling

### Balance Errors
- Clear warnings for insufficient balance
- Exact shortfall calculations
- Prevention of sending when balance is insufficient

## Pricing Information

**Current Africa's Talking Pricing:**
- **Cost per SMS segment**: KES 25.0000
- **Characters per segment**: 160 characters
- **Long messages**: Automatically split into multiple segments

**Example Calculations:**
- 50-character message to 10 recipients = 10 SMS = KES 250.0000
- 200-character message to 10 recipients = 20 SMS = KES 500.0000
- 500-character message to 10 recipients = 40 SMS = KES 1,000.0000

## Testing

### Manual Testing
1. Start the development server: `npm run dev`
2. Navigate to `/bulk-sms`
3. Check account balance display
4. Enter a message and select recipients
5. Verify cost calculation updates in real-time
6. Test sending with sufficient/insufficient balance

### API Testing
Use the provided test script:
```javascript
// In browser console when dev server is running
testAfricasTalking();
```

### Test Scenarios
1. **Normal Operation**: Sufficient balance, successful cost calculation
2. **Insufficient Balance**: Balance lower than required cost
3. **Network Issues**: Offline or slow connection
4. **Invalid Credentials**: Wrong API key or username
5. **Long Messages**: Messages exceeding 160 characters

## Monitoring and Maintenance

### Account Balance Monitoring
- Set up alerts for low balance (< KES 100)
- Monitor SMS usage patterns
- Track cost per campaign

### API Rate Limits
- Africa's Talking has rate limits on API calls
- Implement exponential backoff for failed requests
- Cache account data to reduce API calls

### Cost Accuracy
- Verify pricing with Africa's Talking regularly
- Update cost calculations if pricing changes
- Monitor for currency fluctuations

## Troubleshooting

### Common Issues

#### 1. "Failed to load account information"
- Check internet connection
- Verify API credentials in `.env.local`
- Check Africa's Talking service status

#### 2. "Error calculating costs"
- Verify message and recipients are valid
- Check API endpoint accessibility
- Review browser console for detailed errors

#### 3. "Insufficient balance" when balance appears sufficient
- Account balance may have changed since last refresh
- Click refresh button to update balance
- Check for pending transactions

#### 4. Cost calculation seems incorrect
- Verify message length calculation
- Check for special characters that may affect segment count
- Review Africa's Talking pricing documentation

### Debug Mode
Enable detailed logging by adding to browser console:
```javascript
localStorage.setItem('debug', 'africas-talking:*');
```

## Future Enhancements

### Planned Features
1. **SMS History Integration**: Link sent messages with costs
2. **Budget Alerts**: Set spending limits and alerts
3. **Usage Analytics**: Track SMS usage patterns and costs
4. **Auto Top-up**: Automatic balance top-up when low
5. **Multi-currency Support**: Support for different currencies
6. **Bulk Pricing**: Volume discounts for large campaigns

### API Improvements
1. **Webhook Integration**: Real-time balance updates
2. **Delivery Reports**: Track message delivery status
3. **Advanced Analytics**: Detailed usage statistics
4. **Cost Optimization**: Smart routing for cost savings

## Security Considerations

### API Key Protection
- API key is stored server-side only
- Never expose API key in client-side code
- Use environment variables for configuration

### Rate Limiting
- Implement client-side rate limiting
- Cache responses to reduce API calls
- Use exponential backoff for retries

### Data Privacy
- No sensitive data stored in cost calculations
- Temporary recipient arrays for calculations only
- Secure transmission of all API requests

## Support

For issues related to:
- **Africa's Talking API**: Contact Africa's Talking support
- **Integration Issues**: Check this documentation and logs
- **Feature Requests**: Submit through project issue tracker

## Changelog

### Version 1.0.0 (Current)
- Initial Africa's Talking account integration
- Real-time balance monitoring
- SMS cost calculation
- Balance verification
- Enhanced confirmation dialog
- Comprehensive error handling

---

**Last Updated**: December 2024
**Integration Version**: 1.0.0
**Africa's Talking API Version**: v1 