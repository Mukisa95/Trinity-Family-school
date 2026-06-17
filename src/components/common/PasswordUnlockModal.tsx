"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeSlash, SignOut, UserSwitch } from '@phosphor-icons/react';

interface PasswordUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock: (password: string) => Promise<boolean>;
  onSwitchUser?: (username: string, password: string) => Promise<boolean>;
  onSignOut?: () => void | Promise<void>;
  username?: string;
}

export default function PasswordUnlockModal({ 
  isOpen, 
  onClose, 
  onUnlock, 
  onSwitchUser,
  onSignOut,
  username 
}: PasswordUnlockModalProps) {
  const [password, setPassword] = useState('');
  const [switchUsername, setSwitchUsername] = useState('');
  const [mode, setMode] = useState<'unlock' | 'switch'>('unlock');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'switch' && !switchUsername.trim()) {
      setError('Please enter a username');
      return;
    }

    if (!password.trim()) {
      setError(mode === 'switch' ? 'Please enter the password' : 'Please enter your password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const success = mode === 'switch'
        ? await onSwitchUser?.(switchUsername.trim(), password)
        : await onUnlock(password);

      if (success) {
        setPassword('');
        setSwitchUsername('');
        onClose();
      } else {
        setError(mode === 'switch' ? 'Invalid username or password. Please try again.' : 'Incorrect password. Please try again.');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setSwitchUsername('');
    setMode('unlock');
    setError('');
    onClose();
  };

  const toggleMode = () => {
    setMode((currentMode) => currentMode === 'unlock' ? 'switch' : 'unlock');
    setPassword('');
    setSwitchUsername('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-w-md mx-4 w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <Lock size={24} className="text-blue-600" weight="duotone" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {mode === 'switch' ? 'Switch User' : 'Account Locked'}
          </h3>
          <p className="text-sm text-gray-600">
            {mode === 'switch' ? 'Enter a different username and password' : 'Enter your password to unlock your account'}
            {mode === 'unlock' && username && (
              <span className="block text-xs text-gray-500 mt-1">
                for {username}
              </span>
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'switch' && (
            <div>
              <label htmlFor="switch-username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                id="switch-username"
                value={switchUsername}
                onChange={(e) => setSwitchUsername(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter username"
                autoComplete="username"
                disabled={isLoading}
              />
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeSlash size={20} weight="duotone" />
                ) : (
                  <Eye size={20} weight="duotone" />
                )}
              </button>
            </div>
            {error && (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isLoading || !password.trim() || (mode === 'switch' && !switchUsername.trim())}
              className="flex-1 min-w-0 flex items-center justify-center px-3 py-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm font-medium"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  {mode === 'switch' ? 'Switching...' : 'Unlocking...'}
                </>
              ) : (
                <>
                  {mode === 'switch' ? (
                    <UserSwitch size={16} className="mr-1.5 flex-shrink-0" weight="duotone" />
                  ) : (
                    <Lock size={16} className="mr-1.5 flex-shrink-0" weight="duotone" />
                  )}
                  <span className="truncate">{mode === 'switch' ? 'Switch User' : 'Unlock'}</span>
                </>
              )}
            </button>

            {onSwitchUser && (
              <button
                type="button"
                onClick={toggleMode}
                className="flex-1 min-w-0 flex items-center justify-center px-3 py-2.5 bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm font-medium"
                disabled={isLoading}
              >
                {mode === 'switch' ? (
                  <Lock size={16} className="mr-1.5 flex-shrink-0" weight="duotone" />
                ) : (
                  <UserSwitch size={16} className="mr-1.5 flex-shrink-0" weight="duotone" />
                )}
                <span className="truncate">{mode === 'switch' ? 'Unlock' : 'Switch User'}</span>
              </button>
            )}

            {onSignOut && (
              <button
                type="button"
                onClick={async () => {
                  setPassword('');
                  setError('');
                  setIsLoading(true);
                  try {
                    await onSignOut();
                  } finally {
                    setIsLoading(false);
                  }
                }}
                className="flex-1 min-w-0 flex items-center justify-center px-3 py-2.5 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm font-medium"
                disabled={isLoading}
              >
                <SignOut size={16} className="mr-1.5 flex-shrink-0" weight="duotone" />
                <span className="truncate">Sign Out</span>
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
