# Wiza SMS Integration

## Overview

Wiza SMS is a Ugandan SMS gateway service that provides reliable SMS delivery with competitive pricing for the East African market. This integration allows you to send bulk SMS messages through the Wiza SMS API directly from the Trinity Family Schools management system.

## API Specifications

### Base URL
```
https://wizasms.ug/API/V1
```

### Endpoint
```
POST /send-bulk-sms
```

### Request Headers
```
Content-Type: application/json
```

### Request Body (JSON)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| username | String | Yes | Your WizaSMS registered username |
| password | String | Yes | Your WizaSMS password |
| senderId | String | Yes | The senderID displayed on recipient's phone |
| message | String | Yes | The text message to send |
| recipients | String | Yes | Comma-separated phone numbers (e.g., 2567XXXXXXX,2567YYYYYYY) |

### Request Example
```json
{
  "username": "your_username",
  "password": "your_password",
  "senderId": "TRINITY",
  "message": "Hello from Trinity Family Schools",
  "recipients": "256701234567,256709876543"
}
```

### Response Format

#### Success Response
```json
{
  "statusCode": 201,
  "success": true,
  "messages": "SMS sent successfully",
  "data": {
    "recipients_count": 2,
    "message_length": 1,
    "cost": 70
  }
}
```

#### Error Response
```json
{
  "statusCode": 401,
  "success": false,
  "messages": "Invalid username or password"
}
```

## Configuration

### Provider Setup

1. **Access SMS Settings**
   - Navigate to Bulk SMS page
   - Click the Settings gear button
   - Find "Wiza SMS" in the providers list

2. **Configure Provider**
   - **Username**: Your WizaSMS registered username
   - **Password**: Your WizaSMS account password
   - **Sender ID**: Your approved sender ID (e.g., "TRINITY", "WIZA")
   - **Base URL**: `https://wizasms.ug/API/V1`

3. **Activate Provider**
   - Toggle the provider to "Active"
   - Optionally set as default provider

### Required Fields

- **Username**: Your WizaSMS account username
- **Password**: Your WizaSMS account password
- **Sender ID**: Must be pre-approved by WizaSMS

### Optional Fields

- **Description**: Custom description for the provider
- **Base URL**: API endpoint (defaults to WizaSMS URL)

## Features

### ✅ Supported Features
- **Bulk SMS**: Send messages to multiple recipients
- **Cost Tracking**: Real-time cost calculation
- **Phone Number Formatting**: Automatic formatting to 256XXXXXXXXX format
- **Connection Testing**: Test API connectivity
- **Error Handling**: Comprehensive error messages

### ❌ Not Supported
- **Delivery Reports**: No delivery status tracking
- **Webhooks**: No webhook support for delivery updates
- **Account Balance**: No balance checking endpoint

## Phone Number Formatting

The Wiza SMS integration automatically formats phone numbers to the required format:

### Input Formats Supported
- `0701234567` → `256701234567`
- `+256701234567` → `256701234567`
- `256701234567` → `256701234567` (unchanged)

### Formatting Rules
1. Remove all spaces, dashes, and parentheses
2. If number starts with `0`, replace with `256`
3. If number starts with `+`, remove the `+`
4. If number doesn't start with `256`, add `256` prefix

## Usage Examples

### Basic SMS Sending
```typescript
import { WizaSMSService } from '@/lib/services/wiza-sms.service';

const provider = {
  username: 'your_username',
  apiSecret: 'your_password',
  senderId: 'TRINITY',
  baseUrl: 'https://wizasms.ug/API/V1'
};

const message = "Hello from Trinity Family Schools";
const recipients = ["0701234567", "+256701234567"];

const result = await WizaSMSService.sendSMS(provider, message, recipients);
```

### Connection Testing
```typescript
const testResult = await WizaSMSService.testConnection(provider);
if (testResult.success) {
  console.log('Connection successful:', testResult.message);
} else {
  console.error('Connection failed:', testResult.message);
}
```

### Phone Number Formatting
```typescript
const phoneNumbers = ["0701234567", "+256701234567", "256701234567"];
const formatted = WizaSMSService.formatPhoneNumbers(phoneNumbers);
// Result: "256701234567,256701234567,256701234567"
```

## Error Handling

### Common Error Codes

| Status Code | Error Message | Description |
|-------------|---------------|-------------|
| 401 | Invalid username or password | Authentication failed |
| 400 | missing fields or incomplete data | Required fields missing |
| 400 | Invalid recipients | Phone number format error |
| 400 | Invalid sender ID | Sender ID not approved |

### Error Response Format
```json
{
  "statusCode": 400,
  "success": false,
  "messages": "Error description"
}
```

## Integration with SMS Settings

### Provider Configuration
The Wiza SMS provider is automatically included in the SMS settings with the following default configuration:

```typescript
{
  name: 'Wiza SMS',
  description: 'Ugandan SMS gateway with local expertise and competitive pricing',
  apiKey: 'your_wiza_username',
  apiSecret: 'your_wiza_password',
  username: 'your_wiza_username',
  senderId: 'TRINITY',
  baseUrl: 'https://wizasms.ug/API/V1',
  isActive: false,
  isDefault: false,
  features: {
    bulkSMS: true,
    deliveryReports: false,
    costTracking: true,
    webhooks: false,
  }
}
```

### Settings Interface
- **Edit Button**: Modify provider configuration
- **Toggle Switch**: Activate/deactivate provider
- **Shield Button**: Test API connection
- **Set Default**: Make Wiza SMS the default provider

## Security Considerations

### API Credentials
- Store username and password securely
- Use environment variables for production
- Regularly rotate passwords
- Never expose credentials in client-side code

### Sender ID
- Must be pre-approved by WizaSMS
- Follow WizaSMS naming guidelines
- Avoid generic terms that might be rejected

### Rate Limiting
- Respect WizaSMS rate limits
- Implement proper error handling for rate limit errors
- Monitor API usage to avoid exceeding limits

## Troubleshooting

### Connection Issues
1. **Verify Credentials**: Check username and password
2. **Check Sender ID**: Ensure sender ID is approved
3. **Test Connection**: Use the shield button in settings
4. **Check Network**: Ensure internet connectivity

### Message Delivery Issues
1. **Phone Number Format**: Verify numbers are in correct format
2. **Message Length**: Check message character count
3. **Recipient Limits**: Ensure within batch size limits
4. **Account Balance**: Verify sufficient account balance

### Configuration Issues
1. **Required Fields**: Ensure all required fields are filled
2. **Provider Status**: Check if provider is active
3. **Default Provider**: Verify provider is set as default if needed

## Support

### WizaSMS Support
- **Website**: https://wizasms.ug
- **Documentation**: API documentation available on their website
- **Contact**: Reach out to WizaSMS for account and technical support

### Integration Support
- **Documentation**: This file and SMS_SETTINGS_FEATURE.md
- **Code Examples**: See usage examples above
- **Error Handling**: Comprehensive error messages and codes

## Future Enhancements

### Planned Features
1. **Delivery Status Tracking**: If WizaSMS adds delivery reports
2. **Webhook Integration**: For real-time delivery updates
3. **Account Balance API**: If balance checking becomes available
4. **Advanced Analytics**: Usage statistics and reporting

### Integration Improvements
1. **Batch Processing**: Optimize for large recipient lists
2. **Retry Logic**: Automatic retry for failed messages
3. **Cost Optimization**: Smart message segmentation
4. **Performance Monitoring**: Track delivery rates and costs

## Migration from Other Providers

### Switching to Wiza SMS
1. **Configure Provider**: Set up Wiza SMS in settings
2. **Test Connection**: Verify API connectivity
3. **Set as Default**: Make Wiza SMS the default provider
4. **Deactivate Others**: Turn off other providers if needed
5. **Monitor Delivery**: Track message delivery success

### Provider Comparison
| Feature | Wiza SMS | Africa's Talking | Twilio |
|---------|----------|------------------|--------|
| Local Expertise | ✅ | ✅ | ❌ |
| Cost | Competitive | Competitive | Higher |
| Delivery Reports | ❌ | ✅ | ✅ |
| Webhooks | ❌ | ✅ | ✅ |
| Account Balance | ❌ | ✅ | ✅ |
| Phone Format | 256XXXXXXXXX | +256XXXXXXXXX | +256XXXXXXXXX |

## Conclusion

Wiza SMS provides a reliable, cost-effective SMS solution for the Ugandan market. While it lacks some advanced features like delivery reports and webhooks, it offers excellent value for bulk SMS needs with local expertise and competitive pricing.

The integration is designed to be simple to configure and use, with automatic phone number formatting and comprehensive error handling. For schools and organizations in Uganda, Wiza SMS is an excellent choice for SMS communication needs.
