# Access Levels Implementation

## Overview

The Access Levels system has been implemented to simplify user account creation by allowing administrators to create predefined permission sets that can be quickly assigned to new users. This eliminates the need to manually configure module permissions for each new teacher account.

## Features

### 1. Access Level Management
- **Create Custom Access Levels**: Define custom access levels with specific module permissions
- **Predefined Access Levels**: System comes with 4 predefined access levels:
  - **Teacher**: Standard teacher access with pupil management and attendance recording
  - **Accountant**: Financial management access for fee collection and banking
  - **Administrator**: Administrative access with user management and system settings
  - **Procurement Officer**: Procurement and inventory management access
- **Edit and Delete**: Modify existing access levels or remove unused ones
- **Default Level**: Set a default access level for new users

### 2. User Creation Enhancement
- **Access Level Selection**: When creating staff accounts, administrators can now select from available access levels
- **Automatic Permission Assignment**: Selecting an access level automatically assigns all associated permissions
- **Manual Override**: Still supports manual permission configuration for custom requirements
- **Visual Feedback**: Clear indication when permissions are auto-assigned from access levels

### 3. Permission System Integration
- **Granular Permissions**: Access levels use the existing granular permission system
- **Legacy Compatibility**: Maintains compatibility with existing legacy permission system
- **Module Coverage**: Supports all 17 system modules with page and action-level permissions

## File Structure

```
src/
├── types/
│   └── access-levels.ts                 # Type definitions for access levels
├── lib/
│   ├── services/
│   │   └── access-levels.service.ts     # Firebase service for access levels
│   └── hooks/
│       └── use-access-levels.ts         # React hooks for access level operations
├── components/
│   └── access-levels/
│       └── access-levels-manager.tsx    # Main UI component for managing access levels
├── app/
│   └── access-levels/
│       └── page.tsx                     # Access levels page
└── scripts/
    └── initialize-access-levels.ts      # Script to initialize predefined levels
```

## Usage

### 1. Initialize Predefined Access Levels

Run the initialization script to create the predefined access levels:

```bash
npm run initialize-access-levels
```

### 2. Access the Management Interface

Navigate to **Settings > Access Levels** in the admin interface to:
- View all access levels
- Create new access levels
- Edit existing access levels
- Delete unused access levels
- Set default access levels

### 3. Create Staff Accounts with Access Levels

When creating new staff accounts:

1. Go to **Settings > Users**
2. Click **Create Staff Account**
3. Fill in basic information (staff member, username, password)
4. **Select an Access Level** from the dropdown (optional)
5. If an access level is selected, permissions are automatically assigned
6. If no access level is selected, you can manually configure permissions
7. Click **Create Staff Account**

## Technical Implementation

### Data Model

```typescript
interface AccessLevel {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
  modulePermissions: ModulePermissions[];
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}
```

### Firebase Collection

Access levels are stored in the `accessLevels` Firestore collection with the following structure:

```javascript
{
  name: "Teacher",
  description: "Standard teacher access with pupil management and attendance recording",
  isDefault: false,
  isActive: true,
  modulePermissions: [
    {
      moduleId: "pupils",
      pages: [
        {
          pageId: "list",
          canAccess: true,
          actions: [
            { actionId: "view_list", allowed: true },
            { actionId: "search_filter", allowed: true }
          ]
        }
      ]
    }
  ],
  createdAt: "2024-01-01T00:00:00.000Z",
  createdBy: "user-id"
}
```

### Permission Integration

The access level system integrates with the existing permission system:

1. **Granular Permissions**: Access levels store permissions in the granular format
2. **Legacy Conversion**: Automatically converts to legacy format for backward compatibility
3. **User Assignment**: When creating users, permissions are extracted from access levels
4. **Permission Checking**: Existing permission guards work unchanged with access level permissions

## Benefits

### For Administrators
- **Faster User Creation**: No need to manually configure permissions for each new user
- **Consistent Permissions**: Ensures consistent permission sets across similar roles
- **Easy Management**: Centralized management of permission templates
- **Flexibility**: Can still create custom permissions when needed

### For Teachers
- **Quick Setup**: New teacher accounts are ready to use immediately
- **Appropriate Access**: Only gets access to modules relevant to their role
- **Consistent Experience**: Similar roles have similar access patterns

### For System Maintenance
- **Reduced Errors**: Less chance of misconfiguring permissions
- **Audit Trail**: Clear tracking of who created/modified access levels
- **Scalability**: Easy to add new access levels as roles evolve

## Security Considerations

- **Permission Guards**: All existing permission guards continue to work
- **Access Control**: Only users with `manage_permissions` action can create/edit access levels
- **Audit Trail**: All changes are tracked with user IDs and timestamps
- **Validation**: Access level data is validated before saving

## Future Enhancements

Potential improvements for future versions:

1. **Role-Based Access Levels**: Link access levels to specific staff roles
2. **Permission Inheritance**: Allow access levels to inherit from other levels
3. **Temporary Permissions**: Support for time-limited access levels
4. **Bulk Assignment**: Assign access levels to multiple existing users
5. **Permission Analytics**: Track which permissions are most/least used
6. **Import/Export**: Backup and restore access level configurations

## Migration Notes

- **Existing Users**: Existing users with manually configured permissions are unaffected
- **Backward Compatibility**: The system maintains full backward compatibility
- **Gradual Adoption**: Administrators can gradually adopt access levels without disrupting existing workflows
- **Data Migration**: No data migration required - access levels are additive to the existing system
