import { UsersService } from '../lib/services/users.service';
import type { SystemUser } from '../types';

async function createAdminUser() {
  try {
    const adminData: Omit<SystemUser, 'id' | 'createdAt'> & { password: string } = {
      username: 'admin',
      email: 'admin@trinityfamilyschool.com',
      role: 'Admin',
      isActive: true,
      password: 'admin123' // Change this in production
    };

    const adminId = await UsersService.createUser(adminData);
    console.log('Admin user created successfully with ID:', adminId);
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('Please change the password after first login!');
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

// Run the script
createAdminUser(); 