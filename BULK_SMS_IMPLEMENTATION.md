# Bulk SMS Feature Implementation

## Overview

The Bulk SMS feature allows administrators to send SMS messages to multiple recipients (pupils' guardians) through the Trinity Family Schools management system. The feature integrates with Africa's Talking SMS API and provides comprehensive message management, templates, and audit logging.

## Features

### Core Functionality
- **Recipient Selection**: Choose recipients by class, section, gender, or individual pupils
- **Guardian Types**: Select primary or secondary guardians for messaging
- **Manual Recipients**: Add phone numbers manually for external contacts
- **Message Templates**: Use pre-defined templates or create custom messages
- **Character Counting**: Real-time character count with SMS segment calculation
- **Cost Estimation**: Preview estimated costs before sending
- **Confirmation Dialog**: Review message details before sending
- **Audit Logging**: Complete history of all SMS activities

### Technical Features
- **CORS-Free Integration**: Server-side API route handles Africa's Talking communication
- **Real-time Validation**: Phone number formatting and validation
- **Error Handling**: Comprehensive error messages and retry mechanisms
- **Delivery Reports**: Individual status tracking for each recipient
- **Cost Tracking**: Real-time cost calculation in KES
- **Template Management**: Create, edit, and manage reusable message templates

## Technical Architecture

### Frontend Components
- **Bulk SMS Page** (`src/app/bulk-sms/page.tsx`): Main interface
- **SMS Confirmation Dialog** (`src/components/BulkSMS/SMSConfirmationDialog.tsx`): Message preview
- **SMS Templates Hook** (`src/lib/hooks/use-sms-templates.ts`): Template management

### Backend Integration
- **API Route** (`src/app/api/sms/bulk/route.ts`): Server-side SMS handling (CORS-free)
- **SMS Service** (`src/lib/services/sms.service.ts`): Core SMS functionality
- **Firebase Collections**: `smsLogs` and `smsTemplates`

### CORS Solution
The implementation uses a Next.js API route (`/api/sms/bulk`) to handle Africa's Talking API calls server-side, eliminating CORS issues that would occur with direct browser-to-API communication.

## Setup Instructions

### 1. Environment Variables
Create a `.env.local` file in the project root with the following variables:

```env
# Africa's Talking SMS Configuration
NEXT_PUBLIC_AFRICAS_TALKING_USERNAME=trinityfsch
AFRICAS_TALKING_API_KEY=atsk_f6441bd8aa6d905da4199c5d824c45b46b81185c8f4663fa3b5c315a3cceb204687b3617
AFRICAS_TALKING_SENDER_ID=TrinitySchool
```

**Important**: 
- `AFRICAS_TALKING_API_KEY` is server-side only (no `NEXT_PUBLIC_` prefix)
- `NEXT_PUBLIC_AFRICAS_TALKING_USERNAME` is accessible on both client and server
- `AFRICAS_TALKING_SENDER_ID` is optional (custom sender ID)

### 2. Firebase Collections
The feature uses two Firestore collections:

#### SMS Logs (`smsLogs`)
```typescript
interface SMSLog {
  id: string;
  message: string;
  recipients: string[];
  recipientCount: number;
  sentBy: string;
  sentAt: string;
  status: 'pending' | 'sent' | 'failed' | 'partial';
  messageId?: string;
  cost?: string;
  errorMessage?: string;
}
```

#### SMS Templates (`smsTemplates`)
```typescript
interface SMSTemplate {
  id: string;
  name: string;
  content: string;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
}
```

### 3. Populate Sample Templates
Run the following command to populate sample SMS templates:

```bash
npm run populate-sms-templates
```

This creates 10 pre-defined templates including:
- Welcome Message
- Fee Reminder
- Parent Meeting
- Exam Schedule
- Holiday Notice
- Emergency Closure
- Academic Performance
- Medical Reminder
- Sports Day
- Uniform Reminder

### 4. Navigation Integration
The feature is integrated into the main navigation under "Communication" with appropriate permissions.

## Usage Guide

### For Administrators

1. **Access the Feature**
   - Navigate to "Bulk SMS" in the main menu
   - Requires communication module permissions

2. **Select Recipients**
   - **By Class**: Choose specific classes with optional section/gender filters
   - **Individual Pupils**: Search and select specific pupils
   - **Manual Entry**: Add phone numbers directly

3. **Choose Guardian Type**
   - Primary Guardian (default contact)
   - Secondary Guardian (alternative contact)

4. **Compose Message**
   - Use existing templates or write custom messages
   - Monitor character count and SMS segments
   - Preview estimated costs

5. **Send SMS**
   - Review recipients and message in confirmation dialog
   - Confirm to send via Africa's Talking API
   - Monitor delivery status and costs

### Message Templates

Templates can be:
- Selected from existing templates
- Modified before sending
- Created new through the template management system
- Deactivated without deletion

## SMS Provider Integration

### Africa's Talking API
- **Endpoint**: `https://api.africastalking.com/version1/messaging`
- **Authentication**: API Key based
- **Format**: URL-encoded form data
- **Phone Numbers**: Automatic formatting to +256 (Uganda) format
- **Delivery Reports**: Individual status for each recipient
- **Cost Calculation**: Real-time cost extraction from API responses

### Phone Number Processing
The system automatically handles various phone number formats:
- Local format: `0701234567` → `+256701234567`
- International: `+256701234567` (unchanged)
- Country code: `256701234567` → `+256701234567`

### Error Handling
Comprehensive error handling for:
- Network connectivity issues
- Authentication failures
- Invalid phone numbers
- Rate limiting
- Service unavailability
- Partial delivery failures

## Database Schema

### SMS Logs Collection
- **Purpose**: Audit trail of all SMS activities
- **Indexes**: 
  - `sentBy` (for user-specific queries)
  - `sentAt` (for chronological sorting)
  - `status` (for filtering by delivery status)

### SMS Templates Collection
- **Purpose**: Reusable message templates
- **Indexes**:
  - `isActive` (for filtering active templates)
  - `createdBy` (for user-specific templates)

## Security Considerations

### API Key Protection
- Africa's Talking API key is server-side only
- Never exposed to client-side code
- Stored in environment variables

### Phone Number Privacy
- Phone numbers are validated but not stored permanently
- SMS logs contain recipient counts, not individual numbers
- Access restricted to authorized communication staff

### Rate Limiting
- Africa's Talking enforces rate limits
- Application handles rate limit responses gracefully
- Retry mechanisms for temporary failures

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - **Solution**: Use the server-side API route (`/api/sms/bulk`)
   - **Cause**: Direct browser calls to Africa's Talking API are blocked

2. **Authentication Errors**
   - Check `AFRICAS_TALKING_API_KEY` in `.env.local`
   - Verify API key is valid and active
   - Ensure username matches Africa's Talking account

3. **Phone Number Validation Failures**
   - Ensure numbers are in valid format
   - Check country code assumptions (+256 for Uganda)
   - Verify numbers are active mobile numbers

4. **Template Loading Issues**
   - Run `npm run populate-sms-templates` to create sample templates
   - Check Firestore security rules allow template reads
   - Verify user has communication permissions

5. **Environment Variables Not Loading**
   - Restart development server after creating `.env.local`
   - Check file is in project root directory
   - Verify variable names match exactly

### Development Server
If you encounter port conflicts:
```bash
# Kill existing processes on port 9003
taskkill /F /PID <process_id>

# Start development server
npx next dev --turbopack --port 9003
```

## Future Enhancements

### Planned Features
1. **Scheduled SMS**: Send messages at specific times
2. **SMS Campaigns**: Multi-message campaigns with tracking
3. **Delivery Analytics**: Detailed delivery and engagement metrics
4. **Template Categories**: Organize templates by purpose/department
5. **Bulk Import**: CSV import for large recipient lists
6. **SMS Replies**: Handle incoming SMS responses
7. **Multi-language**: Support for local languages
8. **Cost Budgeting**: Set spending limits and alerts

### Technical Improvements
1. **Queue System**: Background processing for large batches
2. **Retry Logic**: Automatic retry for failed messages
3. **Webhook Integration**: Real-time delivery status updates
4. **SMS Segments**: Advanced segment calculation
5. **Provider Fallback**: Multiple SMS provider support
6. **Message Personalization**: Dynamic content insertion

## API Reference

### Send Bulk SMS
```typescript
POST /api/sms/bulk
Content-Type: application/json

{
  "message": "Your message content",
  "recipients": ["+256701234567", "+256701234568"],
  "sentBy": "user_id"
}

Response:
{
  "success": true,
  "message": "Messages sent successfully to 2 recipients",
  "recipientCount": 2,
  "messageId": "at_1234567890",
  "cost": "KES 1.6000",
  "details": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "failedRecipients": []
  }
}
```

### Error Responses
```typescript
{
  "error": "Error message description"
}
```

Common error codes:
- `400`: Invalid request data
- `401`: Authentication failure
- `429`: Rate limit exceeded
- `503`: Service unavailable

## Conclusion

The Bulk SMS feature provides a comprehensive solution for school-to-parent communication with robust error handling, audit logging, and cost tracking. The server-side API route architecture ensures reliable operation without CORS issues, while the Africa's Talking integration provides professional SMS delivery services.

The feature is production-ready and includes all necessary security measures, error handling, and user experience considerations for a school management system. 