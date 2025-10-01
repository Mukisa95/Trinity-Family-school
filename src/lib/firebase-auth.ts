import { 
  signInAnonymously, 
  signInWithCustomToken,
  signOut as firebaseSignOut,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

export class FirebaseAuthService {
  private static currentUser: FirebaseUser | null = null;

  /**
   * Get current user from auth service
   * This method doesn't create a new listener, just checks the current auth state
   */
  static updateCurrentUser() {
    this.currentUser = auth.currentUser;
    return this.currentUser;
  }

  /**
   * Sign in anonymously for basic Firebase operations
   * This allows Firebase Storage operations without full authentication
   */
  static async signInAnonymously(): Promise<FirebaseUser | null> {
    try {
      const result = await signInAnonymously(auth);
      this.currentUser = result.user;
      console.log('Signed in anonymously to Firebase');
      return result.user;
    } catch (error) {
      console.error('Error signing in anonymously:', error);
      return null;
    }
  }

  /**
   * Sign out from Firebase
   */
  static async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
      this.currentUser = null;
      console.log('Signed out from Firebase');
    } catch (error) {
      console.error('Error signing out from Firebase:', error);
    }
  }

  /**
   * Get current Firebase user
   */
  static getCurrentUser(): FirebaseUser | null {
    return this.currentUser || auth.currentUser;
  }

  /**
   * Check if user is authenticated with Firebase
   */
  static isAuthenticated(): boolean {
    return !!(this.currentUser || auth.currentUser);
  }

  /**
   * Ensure user is authenticated for Firebase operations
   * If not authenticated, sign in anonymously
   */
  static async ensureAuthenticated(): Promise<FirebaseUser | null> {
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      return currentUser;
    }

    // Sign in anonymously if not authenticated
    return await this.signInAnonymously();
  }
} 