"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import PasswordUnlockModal from './PasswordUnlockModal';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLocked, unlockAccount, logout } = useAuth();
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  useEffect(() => {
    if (user && isLocked) {
      setShowUnlockModal(true);
    } else {
      setShowUnlockModal(false);
    }
  }, [user, isLocked]);

  const handleUnlock = async (password: string): Promise<boolean> => {
    return await unlockAccount(password);
  };

  const handleCloseModal = () => {
    // Don't allow closing the modal if account is locked
    // User must enter password to unlock
  };

  // If user is not authenticated at all, show nothing (let login page handle it)
  if (!user) {
    return null;
  }

  // If user is authenticated but locked, show unlock modal
  if (isLocked) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
              <svg
                className="h-8 w-8 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Account Locked
            </h2>
            <p className="text-gray-600 mb-4">
              Your account is locked for security. Enter your password to continue.
            </p>
            <button
              onClick={() => setShowUnlockModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Unlock Account
            </button>
          </div>
        </div>
        
        <PasswordUnlockModal
          isOpen={showUnlockModal}
          onClose={handleCloseModal}
          onUnlock={handleUnlock}
          username={user.username}
        />
      </>
    );
  }

  // If user is authenticated and not locked, show the app
  return <>{children}</>;
}
