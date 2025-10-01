# MTN Number Handling by SMS Provider

## Overview

The bulk SMS system now dynamically handles MTN numbers (25677, 25678, 25674) based on the active SMS service provider. This ensures optimal delivery rates and cost management.

## Provider-Specific Behavior

### Africa's Talking (Default)
- **MTN Numbers**: ❌ **BLOCKED**
- **Reason**: Africa's Talking has known delivery issues with MTN Uganda numbers
- **Behavior**: MTN numbers are automatically filtered out before sending
- **User Notification**: Shows warning about blocked MTN numbers
- **Cost Impact**: No charges for blocked MTN numbers

### Wiza SMS
- **MTN Numbers**: ✅ **ALLOWED**
- **Reason**: Wiza SMS has reliable delivery to MTN Uganda numbers
- **Behavior**: MTN numbers are included in the message send
- **User Notification**: Shows success message including MTN count
- **Cost Impact**: Normal charges apply for all numbers

## How It Works

### 1. Provider Detection
The system automatically detects the active SMS provider from the SMS settings:
- Checks localStorage for saved provider configuration
- Identifies the provider marked as "Active" and "Default"
- Falls back to Africa's Talking if no provider is configured

### 2. Dynamic MTN Filtering
```javascript
// Only block MTN numbers if using Africa's Talking
if (activeProvider === 'africas_talking' || activeProvider === 'Africa\'s Talking') {
  // Filter out MTN numbers (25677, 25678, 25674)
  mtnNumbers = recipients.filter(phone => {
    // MTN detection logic
    return localNumber.match(/^(77|78|76|39)/);
  });
  allowedNumbers = recipients.filter(phone => !mtnNumbers.includes(phone));
} else {
  // Allow all numbers for other providers (like Wiza SMS)
  allowedNumbers = recipients;
}
```

### 3. User Interface Updates
- **Blocked MTN Alert**: Shows when MTN numbers are blocked (Africa's Talking)
- **MTN Success Alert**: Shows when MTN numbers are successfully sent (Wiza SMS)
- **Provider-Specific Messages**: Different success/error messages based on provider

## Configuration

### Setting Up Wiza SMS for MTN Delivery

1. **Access SMS Settings**
   - Go to Bulk SMS page
   - Click the Settings gear button
   - Navigate to "Service Providers" tab

2. **Configure Wiza SMS**
   - Find "Wiza SMS" in the providers list
   - Click "Edit" to configure:
     - **Username**: Your WizaSMS account username
     - **Password**: Your WizaSMS account password
     - **Sender ID**: Your approved sender ID (e.g., "TRINITY")
     - **Base URL**: `https://wizasms.ug/API/V1`

3. **Activate Wiza SMS**
   - Toggle the provider to "Active"
   - Click "Set Default" to make it the default provider
   - Test the connection using the shield button

### Environment Variables (Optional)
For production deployment, set these environment variables in Firebase Functions:

```env
WIZA_SMS_USERNAME=your_wiza_username
WIZA_SMS_PASSWORD=your_wiza_password
WIZA_SMS_SENDER_ID=TRINITY
```

## User Experience

### When Using Africa's Talking (Default)
```
✅ SMS Sent Successfully
📱 Messages sent to 15 recipients
⚠️ 5 MTN numbers were blocked to prevent charges for undelivered messages
   (Africa's Talking has delivery issues with MTN)
```

### When Using Wiza SMS
```
✅ SMS Sent Successfully (Including MTN)
📱 Messages sent to 20 recipients, including 5 MTN numbers via Wiza SMS
```

## Technical Implementation

### Firebase Functions Changes
- Modified `functions/index.js` to accept `activeProvider` parameter
- Added provider-specific SMS sending logic
- Implemented conditional MTN number filtering

### Frontend Changes
- Updated `SMSService` to detect active provider
- Modified bulk SMS page to show provider-specific messages
- Enhanced SMS result dialog with MTN success alerts

### API Endpoints
- **Africa's Talking**: `https://api.africastalking.com/version1/messaging`
- **Wiza SMS**: `https://wizasms.ug/API/V1/send-bulk-sms`

## Benefits

### For Users
- **Automatic Optimization**: System chooses best delivery method
- **Cost Savings**: No charges for undeliverable MTN messages
- **Better Delivery Rates**: MTN numbers delivered via Wiza SMS
- **Clear Feedback**: Understandable messages about what happened

### For Administrators
- **Flexible Provider Management**: Easy switching between providers
- **Network-Specific Optimization**: Different strategies for different networks
- **Cost Control**: Prevent unnecessary charges for failed deliveries
- **Delivery Monitoring**: Track success rates by provider and network

## Troubleshooting

### MTN Numbers Still Blocked
1. **Check Active Provider**: Verify Wiza SMS is set as default
2. **Provider Status**: Ensure Wiza SMS is marked as "Active"
3. **Configuration**: Verify Wiza SMS credentials are correct
4. **Connection Test**: Use the shield button to test Wiza SMS connection

### Wiza SMS Not Working
1. **Credentials**: Check username and password
2. **Sender ID**: Ensure sender ID is approved by WizaSMS
3. **Account Balance**: Verify sufficient account balance
4. **Network**: Check internet connectivity

### Provider Switching Issues
1. **Clear Cache**: Clear browser localStorage
2. **Reset Providers**: Use "Reset to Default Providers" button
3. **Refresh Page**: Reload the bulk SMS page
4. **Check Permissions**: Ensure user has SMS settings access

## Future Enhancements

### Planned Features
1. **Automatic Provider Selection**: Choose provider based on recipient networks
2. **Provider Failover**: Automatic switching if primary provider fails
3. **Network Analytics**: Track delivery rates by network and provider
4. **Cost Comparison**: Compare costs between providers
5. **Batch Optimization**: Send different networks via different providers

### Integration Improvements
1. **Real-time Provider Status**: Monitor provider health
2. **Delivery Reports**: Track actual delivery status
3. **Rate Limiting**: Respect provider rate limits
4. **Retry Logic**: Automatic retry with different providers
