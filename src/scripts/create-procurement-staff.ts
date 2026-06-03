import { UsersService } from '../lib/services/users.service';
import type { SystemUser, ModulePermission } from '../types';

async function createProcurementStaff() {
  try {
    // Create staff user with procurement permissions
    const staffData: Omit<SystemUser, 'id' | 'createdAt'> & { password: string } = {
      username: 'procurement.staff',
      email: 'procurement@trinityfamilyschool.com',
      role: 'Staff',
      isActive: true,
      firstName: 'John',
      lastName: 'Procurement',
      modulePermissions: [
        { module: 'Procurement', permission: 'full_access' }
      ] as ModulePermission[],
      password: 'procure123' // Test password
    };

    const staffId = await UsersService.createUser(staffData);
    console.log('Procurement staff user created successfully!');
    console.log('Username: procurement.staff');
    console.log('Password: procure123');
    console.log('Name: John Procurement');
    console.log('Permissions: Full access to Procurement module');
    console.log('User ID:', staffId);
    console.log('\nYou can now test the digital signature with these credentials in the procurement purchase form.');
    
    // Also create an admin user for backup
    const adminData: Omit<SystemUser, 'id' | 'createdAt'> & { password: string } = {
      username: 'admin.procure',
      email: 'admin.procurement@trinityfamilyschool.com',
      role: 'Admin',
      isActive: true,
      firstName: 'Admin',
      lastName: 'Procurement',
      password: 'admin123' // Test password
    };

    const adminId = await UsersService.createUser(adminData);
    console.log('\nAdmin user also created:');
    console.log('Username: admin.procure');
    console.log('Password: admin123');
    console.log('Name: Admin Procurement');
    console.log('Permissions: Full admin access (including Procurement)');
    console.log('User ID:', adminId);
    
  } catch (error) {
    console.error('Error creating procurement staff:', error);
  }
}

// Run the script
createProcurementStaff(); 