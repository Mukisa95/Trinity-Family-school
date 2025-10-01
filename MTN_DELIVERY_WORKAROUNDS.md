# MTN SMS Delivery Workarounds

## Problem Overview

**Issue**: SMS messages sent to MTN Uganda numbers through Africa's Talking are being charged but not delivered to recipients, while Airtel numbers receive messages successfully.

**Root Cause**: This is a known routing/delivery issue between Africa's Talking and MTN Uganda's network infrastructure. The problem is on the service provider side, not with our application.

**Impact**: 
- Money is deducted from account for MTN messages
- MTN recipients don't receive the messages
- Airtel and other networks work fine

## Implemented Solutions

### 1. Network-Specific Routing

**What it does**: Automatically detects recipient networks and sends messages using different routing strategies for each network.

**How it works**:
- Detects MTN numbers by prefixes: 77, 78, 76, 39
- Detects Airtel numbers by prefixes: 75, 70, 74, 20
- Groups recipients by network
- Sends separate API calls for each network with optimized settings

**MTN-Specific Optimizations**:
- Uses custom sender ID "TRINITY" for MTN numbers
- Falls back to default routing if custom sender fails
- Tries alternative sender IDs on retry

### 2. Automatic Retry Mechanism

**What it does**: Automatically suggests and enables retry attempts for failed MTN messages using different routing strategies.

**Retry Strategies**:
1. **Different Sender ID**: Uses "TRINITY" custom sender ID
2. **Default Routing**: Removes sender ID, uses Africa's Talking default
3. **Alternative Route**: Uses "SMS" as sender ID

**How to use**:
- After sending, if MTN failures are detected, a retry dialog appears
- Choose from 3 different retry strategies
- Each strategy tries different routing parameters
- Can retry up to 3 times with different approaches

### 3. Real-Time Delivery Tracking

**What it does**: Monitors delivery status and provides detailed network-specific analytics.

**Features**:
- Network-wise delivery statistics
- MTN failure rate tracking
- Detailed failure analysis
- Real-time delivery status checking

### 4. Enhanced Results Display

**What it does**: Shows comprehensive results with network breakdown and retry options.

**Features**:
- Tabbed interface showing Summary, Networks, and Details
- MTN-specific issue alerts
- One-click retry buttons for failed MTN messages
- Network-wise cost and delivery statistics

## Technical Implementation

### API Enhancements

#### 1. Enhanced Bulk SMS API (`/api/sms/bulk`)
```typescript
// New parameters
interface SMSRequest {
  message: string;
  recipients: string[];
  sentBy: string;
  retryAttempt?: number; // Track retry attempts
  networkSpecific?: boolean; // Enable network routing
}
```

**Key Features**:
- Network detection and grouping
- Separate API calls per network
- MTN-specific sender ID handling
- Retry attempt tracking

#### 2. SMS Retry API (`/api/sms/retry`)
```typescript
POST /api/sms/retry
{
  message: string;
  failedRecipients: Array<{number, status, network}>;
  sentBy: string;
  retryStrategy: 'different_sender' | 'no_sender' | 'alternative_route';
}
```

**Retry Strategies**:
- `different_sender`: Uses "TRINITY" sender ID
- `no_sender`: Uses default Africa's Talking routing
- `alternative_route`: Uses "SMS" sender ID

#### 3. Delivery Status API (`/api/sms/delivery-status`)
```typescript
POST /api/sms/delivery-status
{
  messageId: string;
}
```

**Returns**:
- Detailed delivery reports per recipient
- Network-wise analysis
- MTN failure rate statistics
- Delivery timeline

### UI Components

#### 1. SMSResultDialog
- Comprehensive results display
- Network-specific analytics
- One-click retry options
- Failed recipient details

#### 2. Enhanced Confirmation Dialog
- Network distribution preview
- MTN delivery warnings
- Cost breakdown by network

### Network Detection Logic

```typescript
function detectNetwork(phoneNumber: string): 'MTN' | 'Airtel' | 'Other' {
  const cleanNumber = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
  
  // Uganda MTN prefixes
  if (cleanNumber.match(/^(256)?(77|78|76|39)/)) {
    return 'MTN';
  }
  
  // Uganda Airtel prefixes
  if (cleanNumber.match(/^(256)?(75|70|74|20)/)) {
    return 'Airtel';
  }
  
  return 'Other';
}
```

## Usage Instructions

### 1. Automatic Network Routing (Default)

When sending SMS:
1. System automatically detects networks
2. Groups recipients by network (MTN, Airtel, Other)
3. Sends optimized requests for each network
4. Shows network-specific results

### 2. Manual Retry for MTN Failures

When MTN messages fail:
1. Results dialog shows "MTN Delivery Issues Detected" alert
2. Click on retry options in the "Summary" tab
3. Choose retry strategy:
   - **Custom Sender ID**: Best for branded messages
   - **Default Routing**: Most reliable fallback
   - **Alternative Route**: Last resort option
4. Monitor retry results

### 3. Delivery Status Monitoring

To check delivery status:
1. Note the Message ID from results
2. Use delivery status API to check real delivery
3. Monitor network-specific delivery rates
4. Track MTN vs Airtel performance

## Best Practices

### 1. Message Composition
- Keep messages under 160 characters when possible
- Avoid special characters that might cause routing issues
- Use clear, simple language

### 2. Recipient Management
- Verify phone number formats
- Separate MTN and Airtel contacts if needed
- Consider sending to Airtel first to test message content

### 3. Retry Strategy
- Start with "Custom Sender ID" for MTN retries
- If that fails, try "Default Routing"
- Use "Alternative Route" as last resort
- Don't retry more than 3 times to avoid excessive charges

### 4. Monitoring
- Always check results dialog after sending
- Monitor MTN failure rates over time
- Keep track of which retry strategies work best
- Report persistent issues to Africa's Talking support

## Troubleshooting

### Common Issues

#### 1. All MTN Messages Failing
**Symptoms**: 100% MTN failure rate
**Solutions**:
- Try "Default Routing" retry strategy
- Check if MTN network is experiencing issues
- Contact Africa's Talking support

#### 2. Partial MTN Failures
**Symptoms**: Some MTN messages deliver, others don't
**Solutions**:
- Use "Custom Sender ID" retry for failed numbers
- Check if specific MTN prefixes are more problematic
- Monitor delivery patterns

#### 3. High Retry Costs
**Symptoms**: Excessive charges from retries
**Solutions**:
- Limit retries to 2 attempts maximum
- Use delivery status API to verify before retrying
- Consider alternative SMS providers for MTN

### Error Messages

#### "MTN Delivery Issues Detected"
- **Meaning**: System detected failed MTN deliveries
- **Action**: Use retry options or contact support

#### "No MTN numbers to retry"
- **Meaning**: No failed MTN recipients found
- **Action**: Check if failures were on other networks

#### "Daily retry limit exceeded"
- **Meaning**: Too many retry attempts today
- **Action**: Wait until tomorrow or contact support

## Alternative Solutions

### 1. Dual Provider Setup
- Use Africa's Talking for Airtel numbers
- Use alternative provider (e.g., Twilio, Nexmo) for MTN numbers
- Implement provider switching logic

### 2. Manual MTN Handling
- Separate MTN recipients into different campaigns
- Use different SMS service specifically for MTN
- Manual verification of MTN deliveries

### 3. Hybrid Approach
- Send to all networks via Africa's Talking first
- Automatically retry MTN failures via alternative provider
- Maintain cost tracking across providers

## Monitoring and Analytics

### Key Metrics to Track

1. **Network Delivery Rates**
   - MTN success rate
   - Airtel success rate
   - Overall success rate

2. **Retry Effectiveness**
   - Success rate by retry strategy
   - Cost per successful MTN delivery
   - Time to successful delivery

3. **Cost Analysis**
   - Cost per network
   - Retry costs vs. success rate
   - ROI of different strategies

### Reporting

Generate weekly reports showing:
- Network-wise delivery statistics
- MTN retry success rates
- Cost analysis and trends
- Recommendations for optimization

## Future Enhancements

### 1. Machine Learning Optimization
- Learn which retry strategies work best for specific MTN prefixes
- Predict optimal sending times for MTN numbers
- Automatic strategy selection based on historical data

### 2. Provider Integration
- Integrate multiple SMS providers
- Automatic failover to alternative providers
- Cost optimization across providers

### 3. Advanced Monitoring
- Real-time delivery webhooks
- Automated retry scheduling
- Predictive failure detection

## Support and Escalation

### When to Contact Africa's Talking Support

1. **Persistent MTN Issues**: If MTN failure rate exceeds 80% for multiple days
2. **Billing Disputes**: If charged for messages that consistently fail
3. **API Issues**: If retry mechanisms stop working
4. **Account Issues**: If sender ID registration is needed

### Support Information
- **Africa's Talking Support**: support@africastalking.com
- **Documentation**: https://developers.africastalking.com/
- **Status Page**: https://status.africastalking.com/

### Escalation Process
1. Document the issue with message IDs and timestamps
2. Include network analysis and retry attempt details
3. Provide recipient phone numbers (with permission)
4. Request specific investigation into MTN routing

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Status**: Active Implementation 