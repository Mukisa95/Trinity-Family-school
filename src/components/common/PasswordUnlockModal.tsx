"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeSlash } from '@phosphor-icons/react';

interface PasswordUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock: (password: string) => Promise<boolean>;
  username?: string;
}

export default function PasswordUnlockModal({ 
  isOpen, 
  onClose, 
  onUnlock, 
  username 
}: PasswordUnlockModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const success = await onUnlock(password);
      if (success) {
        setPassword('');
        onClose();
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
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
        className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 max-w-sm mx-4 w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <Lock size={24} className="text-blue-600" weight="duotone" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Account Locked
          </h3>
          <p className="text-sm text-gray-600">
            Enter your password to unlock your account
            {username && (
              <span className="block text-xs text-gray-500 mt-1">
                for {username}
              </span>
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

          <div className="space-y-3">
            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Unlocking...
                </>
              ) : (
                <>
                  <Lock size={16} className="mr-2" weight="duotone" />
                  Unlock Account
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="w-full px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
