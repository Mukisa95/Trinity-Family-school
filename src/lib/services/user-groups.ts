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
        // Staff and admins are in the 'staff' collection
        const q = query(
          collection(db, 'staff'),
          where('status', '==', 'active')
        );
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          role: role, // Set the role explicitly
          isActive: true,
          ...doc.data()
        })) as User[];
      } else if (role === 'parent') {
        // Parents are guardians embedded in pupils documents
        return await this.getAllParents();
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
      // Combine staff and parents
      const staff = await this.getUsersByRole('staff');
      const parents = await this.getAllParents();
      
      return [...staff, ...parents];
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
    const allUsers: User[] = [];
    const userIds = new Set<string>();

    for (const recipient of recipients) {
      let users: User[] = [];

      switch (recipient.type) {
        case 'all_users':
          users = await this.getAllUsers();
          break;
        case 'all_admins':
          users = await this.getUsersByRole('admin');
          break;
        case 'all_staff':
          users = await this.getUsersByRole('staff');
          break;
        case 'all_parents':
          users = await this.getUsersByRole('parent');
          break;
        case 'group':
          users = await this.getUsersByGroupId(recipient.id);
          break;
        case 'user':
          const user = await this.getUserById(recipient.id);
          if (user) users = [user];
          break;
      }

      // Add users to the set to avoid duplicates
      users.forEach(user => {
        if (!userIds.has(user.id)) {
          userIds.add(user.id);
          allUsers.push(user);
        }
      });
    }

    return allUsers;
  }

  // Get user by ID
  async getUserById(userId: string): Promise<User | null> {
    try {
      const q = query(
        collection(db, 'users'),
        where('__name__', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      } as User;
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