# Granular Permissions System Guide

## Overview
The Trinity School Management System now features a deep-level permission control system that allows administrators to control access at both page and action levels for each module.

## Key Components

### 1. Permission Types

```typescript
interface ActionPermission {
  actionId: string;
  allowed: boolean;
}

interface PagePermission {
  pageId: string;
  canAccess: boolean;
  actions: ActionPermission[];
}

interface ModulePermissions {
  moduleId: string;
  pages: PagePermission[];
}
```

### 2. Available Modules and Pages

The system has 17 modules with multiple pages and actions:

- **pupils**: list, create, edit, detail, promote
- **fees**: list, collection, collect
- **exams**: list, results
- **staff**: list
- **classes**: list, detail
- **attendance**: record
- **subjects**: list
- **academic_years**: list
- **banking**: list, loans
- **users**: list
- **notifications**: list
- **bulk_sms**: send
- **procurement**: items, purchases, budget
- **uniforms**: list, tracking
- **requirements**: list, tracking
- **settings**: school, photos
- **reports**: dashboard, reports

## Using ActionGuard

The `ActionGuard` component protects UI elements based on user permissions:

```jsx
import { ActionGuard } from "@/components/auth/action-guard";

// Protect a button
<ActionGuard module="pupils" page="detail" action="fee_collection">
  <Button onClick={handleFeeCollection}>
    Collect Fees
  </Button>
</ActionGuard>

// With fallback content
<ActionGuard 
  module="pupils" 
  page="detail" 
  action="delete_pupil"
  fallback={<span>No permission to delete</span>}
>
  <Button variant="destructive" onClick={handleDelete}>
    Delete Pupil
  </Button>
</ActionGuard>
```

## Using usePermissions Hook

For programmatic permission checking:

```jsx
import { usePermissions } from "@/lib/hooks/use-permissions";

function MyComponent() {
  const permissions = usePermissions();
  
  // Check single permission
  if (permissions.canPerformAction('pupils', 'detail', 'edit_details')) {
    // Show edit button
  }
  
  // Check multiple permissions
  const canManage = permissions.canPerformAnyAction(
    'pupils', 
    'detail', 
    ['edit_details', 'change_status', 'delete_pupil']
  );
  
  // Check if user has all permissions
  const hasFullControl = permissions.canPerformAllActions(
    'fees', 
    'collect', 
    ['record_payment', 'revert_payment']
  );
}
```

## Example Actions by Module

### Pupils Module
- **List Page**: view_list, search_filter, export_data, bulk_actions
- **Create Page**: access_page, create_pupil, add_guardian, upload_photo
- **Detail Page**: 18 different actions including fee_collection, manage_assignments, change_status
- **Promote Page**: select_pupils, promote_pupils, demote_pupils, transfer_pupils

### Fees Module
- **List Page**: view_list, create_structure, edit_structure, manage_adjustments
- **Collection Page**: search_pupils, view_balance, collect_fees
- **Collect Page**: record_payment, print_receipt, revert_payment

## User Management

### Creating Staff Users with Permissions

1. Navigate to Users Management
2. Click "Create User Account"
3. Select staff member
4. Use the Granular Permissions Editor to:
   - Enable/disable entire page access
   - Control individual actions within pages
   - Use bulk enable/disable for convenience

### Editing Permissions

1. Click edit on any staff user
2. The permissions editor shows:
   - Module accordion structure
   - Page-level access toggles
   - Individual action permissions
   - Visual indicators for permission status

## Backward Compatibility

The system maintains backward compatibility with the legacy permission system:
- `view_only`: Basic read access
- `edit`: Read and write access
- `full_access`: All permissions including delete

Legacy permissions are automatically mapped to appropriate granular permissions.

## Best Practices

1. **Principle of Least Privilege**: Only grant permissions necessary for the user's role
2. **Page Access First**: Users need page access before action permissions work
3. **Use Groups**: Common permission sets can be saved as templates
4. **Regular Audits**: Review user permissions periodically

## Implementation Examples

### Protecting a Form

```jsx
<ActionGuard module="pupils" page="edit" action="save_changes">
  <Button type="submit">Save Changes</Button>
</ActionGuard>
```

### Conditional Rendering

```jsx
const permissions = usePermissions();

return (
  <div>
    {permissions.canAccessPage('fees', 'collection') && (
      <Link href="/fees/collection">Fee Collection</Link>
    )}
  </div>
);
```

### Protecting Routes

```jsx
import { ProtectedRoute } from "@/components/auth/protected-route";

<ProtectedRoute module="users" page="list">
  <UsersPage />
</ProtectedRoute>
```

## Security Notes

1. All permission checks are also enforced server-side
2. UI-only protection is not sufficient - always validate on the backend
3. Admin users bypass all permission checks
4. Parent users use a separate authentication system

## Troubleshooting

1. **User can't see a button**: Check if they have both page access and the specific action permission
2. **Permission not working**: Ensure the module, page, and action IDs match exactly
3. **Legacy permissions**: These are automatically converted but may need manual adjustment

## Future Enhancements

- Permission templates for common roles
- Time-based permissions
- Department-level permissions
- Custom permission groups 