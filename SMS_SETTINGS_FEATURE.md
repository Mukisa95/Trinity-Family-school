# SMS Service Provider Settings Feature

## Overview

The SMS Settings feature allows administrators to manage multiple SMS service providers and their API configurations directly from the Bulk SMS page. This feature provides a centralized way to view, configure, and switch between different SMS providers.

## Features

### 🔧 Settings Gear Button
- Located in the top-right corner of the Bulk SMS page
- Provides quick access to SMS provider management
- Clean, intuitive interface with gear icon

### 📋 Provider Management
- **View All Providers**: See all configured SMS service providers
- **Provider Status**: Active/Inactive toggle for each provider
- **Default Provider**: Set which provider should be used by default
- **Feature Indicators**: Visual badges showing supported features

### ⚙️ API Configuration
- **API Key Management**: Secure storage and editing of API keys
- **Show/Hide API Keys**: Toggle visibility for security
- **Provider Details**: Edit provider name, description, and base URL
- **Connection Testing**: Test API connectivity for each provider

### 📊 Overview Dashboard
- **Provider Statistics**: Total, active, and default provider counts
- **API Configuration Status**: Track configured API keys and features
- **Quick Status Overview**: See current system state at a glance

## Available Providers

### 1. Africa's Talking (Default)
- **Description**: Leading African SMS gateway with excellent delivery rates
- **Features**: Bulk SMS, Delivery Reports, Cost Tracking, Webhooks
- **Status**: Active by default
- **API**: REST API with username and API key authentication

### 2. Twilio
- **Description**: Global SMS platform with advanced features
- **Features**: Bulk SMS, Delivery Reports, Cost Tracking, Webhooks
- **Status**: Inactive by default
- **API**: REST API with Account SID and Auth Token

### 3. Vonage (Nexmo)
- **Description**: Enterprise-grade SMS platform with analytics
- **Features**: Bulk SMS, Delivery Reports, Cost Tracking, Webhooks
- **Status**: Inactive by default
- **API**: REST API with API Key and API Secret

### 4. Wiza SMS
- **Description**: Ugandan SMS gateway with local expertise and competitive pricing
- **Features**: Bulk SMS, Cost Tracking
- **Status**: Inactive by default
- **API**: REST API with Username, Password, and Sender ID
- **Endpoint**: `https://wizasms.ug/API/V1/send-bulk-sms`

## How to Use

### Accessing Settings
1. Navigate to the **Bulk SMS** page
2. Click the **Settings** gear button in the top-right corner
3. The SMS Settings modal will open

### Managing Providers

#### Viewing Providers
- The **Service Providers** tab shows all configured providers
- Active providers are highlighted with green badges
- Default provider is marked with a "Default" badge

#### Editing Provider Configuration
1. Click the **Edit** button next to any provider
2. Modify the provider details:
   - Provider name and description
   - API key (with show/hide toggle)
   - API secret (if applicable)
   - Username (if applicable)
   - Base URL
   - Active status
3. Click **Save Changes** to update

#### Testing Provider Connection
1. Click the **Shield** button next to an active provider
2. The system will test the API connection
3. Results are shown via toast notifications

#### Setting Default Provider
1. Click **Set Default** next to any active provider
2. The provider will become the new default
3. Only one provider can be default at a time

#### Activating/Deactivating Providers
1. Use the toggle switch next to each provider
2. Only active providers can be used for sending SMS
3. Only active providers can be set as default

### Overview Dashboard
- Switch to the **Overview** tab to see system statistics
- View provider counts and configuration status
- Monitor API setup completion

## Technical Implementation

### Data Storage
- Provider configurations are stored in localStorage (demo mode)
- In production, data is stored in Firestore collection `smsProviders`
- API keys are encrypted and securely handled

### Service Integration
- The `SMSProvidersService` class manages all provider operations
- Supports CRUD operations for providers
- Includes connection testing and validation

### Security Features
- API keys are masked by default
- Show/hide toggle for sensitive data
- Secure storage and transmission

## Initialization

### Setting Up Default Providers
Run the initialization script to set up default providers:

```bash
npm run initialize-sms-providers
```

This will:
- Create default provider configurations
- Set Africa's Talking as the active default provider
- Configure sample API keys and endpoints

### Database Schema
```typescript
interface SMSProvider {
  id: string;
  name: string;
  description: string;
     apiKey: string;
   apiSecret?: string;
   username?: string;
   senderId?: string;
   baseUrl: string;
  isActive: boolean;
  isDefault: boolean;
  features: {
    bulkSMS: boolean;
    deliveryReports: boolean;
    costTracking: boolean;
    webhooks: boolean;
  };
  createdAt: string;
  updatedAt: string;
}
```

## Future Enhancements

### Planned Features
1. **Provider Analytics**: Usage statistics and performance metrics
2. **Cost Comparison**: Compare pricing across providers
3. **Auto-Failover**: Automatic switching between providers
4. **Webhook Configuration**: Set up delivery status webhooks
5. **Provider Templates**: Pre-configured templates for popular providers

### Integration Improvements
1. **Real API Testing**: Actual API calls to test connections
2. **Rate Limiting**: Monitor and manage API rate limits
3. **Delivery Reports**: Real-time delivery status tracking
4. **Cost Tracking**: Monitor SMS costs per provider

## Troubleshooting

### Common Issues

#### Provider Not Connecting
- Verify API key and credentials
- Check base URL format
- Ensure provider is active
- Test connection using the shield button

#### Settings Not Saving
- Check browser console for errors
- Verify localStorage permissions
- Ensure all required fields are filled

#### Default Provider Issues
- Only one provider can be default
- Provider must be active to be set as default
- Check provider status before setting as default

### Support
For technical support or feature requests, please contact the development team or create an issue in the project repository.

## Security Notes

- API keys are sensitive information - handle with care
- Use show/hide toggle to prevent accidental exposure
- Regularly rotate API keys for security
- Monitor provider usage for unusual activity
- Keep provider configurations up to date
