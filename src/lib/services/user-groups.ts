import {
  collection,
  doc,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { NotificationGroup, NotificationRecipient, User } from '@/types';

class UserGroupService {
  // Get users by role/group type
  async getUsersByRole(role: 'admin' | 'staff' | 'parent'): Promise<User[]> {
    try {
      if (role === 'staff' || role === 'admin') {
        // 🔥 FIX: Fetch from system_users collection (actual user accounts) not staff collection
        const roleValue = role === 'staff' ? 'Staff' : 'Admin'; // Capitalize for system_users
        const q = query(
          collection(db, 'system_users'),
          where('role', '==', roleValue),
          where('isActive', '==', true)
        );
        const querySnapshot = await getDocs(q);

        console.log(`👥 [getUsersByRole] Found ${querySnapshot.docs.length} ${roleValue} users from system_users`);

        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          role: roleValue,
          isActive: true
        })) as User[];
      } else if (role === 'parent') {
        // 🔥 FIX: Fetch parent accounts from system_users, not from pupils guardians
        const q = query(
          collection(db, 'system_users'),
          where('role', '==', 'Parent'),
          where('isActive', '==', true)
        );
        const querySnapshot = await getDocs(q);

        console.log(`👥 [getUsersByRole] Found ${querySnapshot.docs.length} Parent users from system_users`);
        
        const parentUsers = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          role: 'Parent',
          isActive: true
        })) as User[];
        
        // 🔍 DEBUG: Log parent user IDs for subscription matching
        console.log(`👥 [getUsersByRole] Parent user IDs:`, parentUsers.map(p => p.id).join(', '));
        console.log(`👥 [getUsersByRole] Parent emails:`, parentUsers.map(p => p.email || 'no-email').join(', '));
        
        return parentUsers;
      }

      return [];
    } catch (error) {
      console.error(`Error fetching ${role} users:`, error);
      return [];
    }
  }

  // Get all active users
  async getAllUsers(): Promise<User[]> {
    try {
      // 🔥 FIX: Fetch all active users from system_users collection
      const q = query(
        collection(db, 'system_users'),
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);

      console.log(`👥 [getAllUsers] Found ${querySnapshot.docs.length} active users from system_users`);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
    } catch (error) {
      console.error('Error fetching all users:', error);
      return [];
    }
  }

  // Get all parents from pupils' guardians
  async getAllParents(): Promise<User[]> {
    try {
      const q = query(
        collection(db, 'pupils'),
        where('status', '==', 'Active')
      );
      const querySnapshot = await getDocs(q);

      const parents: User[] = [];
      const seenParents = new Set<string>();

      querySnapshot.docs.forEach(doc => {
        const pupil = doc.data();
        if (pupil.guardians && Array.isArray(pupil.guardians)) {
          pupil.guardians.forEach((guardian: any) => {
            // Use email or phone as unique identifier for parents
            const parentId = guardian.email || guardian.phone || guardian.id;
            if (parentId && !seenParents.has(parentId)) {
              seenParents.add(parentId);
              parents.push({
                id: parentId,
                role: 'parent',
                isActive: true,
                firstName: guardian.firstName,
                lastName: guardian.lastName,
                email: guardian.email,
                phone: guardian.phone,
                contactNumber: guardian.phone,
                ...guardian
              } as User);
            }
          });
        }
      });

      return parents;
    } catch (error) {
      console.error('Error fetching parents:', error);
      return [];
    }
  }

  // Get users by notification recipient configuration
  async getUsersByRecipients(recipients: NotificationRecipient[]): Promise<User[]> {
    console.log(`👥 [getUsersByRecipients] Starting with ${recipients.length} recipient configurations`);
    console.log(`👥 [getUsersByRecipients] Recipients:`, recipients.map(r => ({ id: r.id, type: r.type, name: r.name })));

    const allUsers: User[] = [];
    const userIds = new Set<string>();

    for (const recipient of recipients) {
      let users: User[] = [];
      console.log(`👥 [getUsersByRecipients] Processing recipient type: ${recipient.type}, id: ${recipient.id}`);

      switch (recipient.type) {
        case 'all_users':
          users = await this.getAllUsers();
          console.log(`👥 [getUsersByRecipients] all_users: Found ${users.length} users`);
          break;
        case 'all_admins':
          users = await this.getUsersByRole('admin');
          console.log(`👥 [getUsersByRecipients] all_admins: Found ${users.length} users`);
          break;
        case 'all_staff':
          users = await this.getUsersByRole('staff');
          console.log(`👥 [getUsersByRecipients] all_staff: Found ${users.length} users`);
          break;
        case 'all_parents':
          users = await this.getUsersByRole('parent');
          console.log(`👥 [getUsersByRecipients] all_parents: Found ${users.length} users`);
          break;
        case 'group':
          users = await this.getUsersByGroupId(recipient.id);
          console.log(`👥 [getUsersByRecipients] group ${recipient.id}: Found ${users.length} users`);
          break;
        case 'user':
          console.log(`👥 [getUsersByRecipients] Looking up individual user with ID: ${recipient.id}`);
          const user = await this.getUserById(recipient.id);
          if (user) {
            users = [user];
            console.log(`✅ [getUsersByRecipients] Found user: ${user.firstName} ${user.lastName || user.id}`);
          } else {
            console.warn(`⚠️ [getUsersByRecipients] User NOT FOUND for ID: ${recipient.id}`);
          }
          break;
        default:
          console.warn(`⚠️ [getUsersByRecipients] Unknown recipient type: ${recipient.type}`);
      }

      // Add users to the set to avoid duplicates
      users.forEach(user => {
        if (!userIds.has(user.id)) {
          userIds.add(user.id);
          allUsers.push(user);
        }
      });
    }

    console.log(`✅ [getUsersByRecipients] Total unique users resolved: ${allUsers.length}`);
    console.log(`✅ [getUsersByRecipients] User IDs:`, allUsers.map(u => u.id).join(', '));
    return allUsers;
  }

  // Get user by ID - first tries users collection, then falls back to other methods
  async getUserById(userId: string): Promise<User | null> {
    try {
      // First, try to get user directly from users collection by document ID
      const { getDoc } = await import('firebase/firestore');
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        console.log(`✅ Found user ${userId} in users collection`);
        return {
          id: userDoc.id,
          ...userDoc.data()
        } as User;
      }

      // If not found by document ID, try to find by staffId (for backwards compatibility)
      const staffQuery = query(
        collection(db, 'users'),
        where('staffId', '==', userId)
      );
      const staffSnapshot = await getDocs(staffQuery);

      if (!staffSnapshot.empty) {
        const staffDoc = staffSnapshot.docs[0];
        console.log(`✅ Found user by staffId ${userId} -> ${staffDoc.id}`);
        return {
          id: staffDoc.id,
          ...staffDoc.data()
        } as User;
      }

      console.warn(`⚠️ User ${userId} not found in users collection`);
      return null;
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      return null;
    }
  }

  // Get users by custom group ID
  async getUsersByGroupId(groupId: string): Promise<User[]> {
    try {
      const group = await this.getGroupById(groupId);
      if (!group) {
        return [];
      }

      const users: User[] = [];
      for (const userId of group.userIds) {
        const user = await this.getUserById(userId);
        if (user) {
          users.push(user);
        }
      }

      return users;
    } catch (error) {
      console.error('Error fetching users by group ID:', error);
      return [];
    }
  }

  // Get notification group by ID
  async getGroupById(groupId: string): Promise<NotificationGroup | null> {
    try {
      const q = query(
        collection(db, 'notificationGroups'),
        where('__name__', '==', groupId)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      } as NotificationGroup;
    } catch (error) {
      console.error('Error fetching group by ID:', error);
      return null;
    }
  }

  // Get all notification groups
  async getAllGroups(): Promise<NotificationGroup[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'notificationGroups'));

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NotificationGroup[];
    } catch (error) {
      console.error('Error fetching all groups:', error);
      return [];
    }
  }

  // Create a new notification group
  async createGroup(groupData: Omit<NotificationGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationGroup> {
    try {
      const docRef = await addDoc(collection(db, 'notificationGroups'), {
        ...groupData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return {
        id: docRef.id,
        ...groupData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    }
  }

  // Update notification group
  async updateGroup(groupId: string, updates: Partial<Omit<NotificationGroup, 'id' | 'createdAt'>>): Promise<void> {
    try {
      await updateDoc(doc(db, 'notificationGroups', groupId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating group:', error);
      throw error;
    }
  }

  // Delete notification group
  async deleteGroup(groupId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'notificationGroups', groupId));
    } catch (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  }

  // Get user count by recipient type
  async getUserCountByRecipients(recipients: NotificationRecipient[]): Promise<number> {
    const users = await this.getUsersByRecipients(recipients);
    return users.length;
  }

  // Get predefined recipient options
  getPredefinedRecipients(): NotificationRecipient[] {
    return [
      { id: 'all_users', type: 'all_users', name: 'All Users' },
      { id: 'all_admins', type: 'all_admins', name: 'All Administrators' },
      { id: 'all_staff', type: 'all_staff', name: 'All Staff Members' },
      { id: 'all_parents', type: 'all_parents', name: 'All Parents' }
    ];
  }

  // Validate recipients
  async validateRecipients(recipients: NotificationRecipient[]): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const recipient of recipients) {
      switch (recipient.type) {
        case 'user':
          const user = await this.getUserById(recipient.id);
          if (!user) {
            errors.push(`User with ID ${recipient.id} not found`);
          }
          break;
        case 'group':
          const group = await this.getGroupById(recipient.id);
          if (!group) {
            errors.push(`Group with ID ${recipient.id} not found`);
          }
          break;
        // Predefined types don't need validation
        case 'all_users':
        case 'all_admins':
        case 'all_staff':
        case 'all_parents':
          break;
        default:
          errors.push(`Invalid recipient type: ${recipient.type}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const userGroupService = new UserGroupService(); 