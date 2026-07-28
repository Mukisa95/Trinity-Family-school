"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowCounterClockwise,
  Eye,
  EyeSlash,
  Lock,
  SignOut,
  UserSwitch,
} from '@phosphor-icons/react';

interface SessionResumeModalProps {
  isOpen: boolean;
  onResume: () => Promise<boolean>;
  onSwitchUser?: (username: string, password: string) => Promise<boolean>;
  onSignOut?: () => void | Promise<void>;
  username?: string;
}

export default function SessionResumeModal({
  isOpen,
  onResume,
  onSwitchUser,
  onSignOut,
  username,
}: SessionResumeModalProps) {
  const [password, setPassword] = useState('');
  const [switchUsername, setSwitchUsername] = useState('');
  const [mode, setMode] = useState<'resume' | 'switch'>('resume');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const resumeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && mode === 'resume') {
      resumeButtonRef.current?.focus();
    }
  }, [isOpen, mode]);

  const resetFields = () => {
    setPassword('');
    setSwitchUsername('');
    setShowPassword(false);
    setError('');
  };

  const handleResume = async () => {
    setIsLoading(true);
    setError('');
    try {
      const success = await onResume();
      if (!success) {
        setError('This signed session is no longer available. Please switch user or sign in again.');
      }
    } catch {
      setError('The session could not be resumed. Please try again or switch user.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!switchUsername.trim() || !password) {
      setError('Enter both the username and password.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const success = await onSwitchUser?.(switchUsername.trim(), password);
      if (!success) {
        setError('Invalid username or password. Please try again.');
      } else {
        resetFields();
      }
    } catch (switchError) {
      setError(
        switchError instanceof Error
          ? switchError.message
          : 'The sign-in service is temporarily unavailable. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(currentMode => currentMode === 'resume' ? 'switch' : 'resume');
    resetFields();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm"
    >
      <motion.section
        initial={{ scale: 0.96, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-resume-title"
        aria-describedby="session-resume-description"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl motion-reduce:transition-none"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            {mode === 'switch' ? (
              <UserSwitch size={24} className="text-blue-700" weight="duotone" />
            ) : (
              <Lock size={24} className="text-blue-700" weight="duotone" />
            )}
          </div>
          <h2 id="session-resume-title" className="text-lg font-semibold text-slate-950">
            {mode === 'switch' ? 'Switch user' : 'Session privacy lock'}
          </h2>
          <p id="session-resume-description" className="mt-2 text-sm leading-6 text-slate-600">
            {mode === 'switch'
              ? 'Sign in with a different account. This replaces the current signed session.'
              : 'Your signed session and mounted dashboard are still available. Resume without entering your password again.'}
          </p>
          {mode === 'resume' && username && (
            <p className="mt-2 text-xs font-medium text-slate-500">
              Signed in as {username}
            </p>
          )}
        </div>

        {mode === 'resume' ? (
          <div className="space-y-3">
            <button
              ref={resumeButtonRef}
              type="button"
              onClick={handleResume}
              disabled={isLoading}
              className="flex w-full items-center justify-center rounded-full bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <ArrowCounterClockwise size={18} className="mr-2" weight="bold" />
              )}
              {isLoading ? 'Resuming…' : 'Resume session'}
            </button>

            <p className="text-center text-xs leading-5 text-slate-500">
              Access changes made by an administrator are checked through Firebase Authentication in the background, without a Firestore user read.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSwitchUser} className="space-y-4">
            <div>
              <label htmlFor="switch-username" className="mb-2 block text-sm font-medium text-slate-700">
                Username
              </label>
              <input
                type="text"
                id="switch-username"
                value={switchUsername}
                onChange={event => setSwitchUsername(event.target.value)}
                className="w-full rounded-full border border-slate-300 px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Enter username"
                autoComplete="username"
                autoFocus
                disabled={isLoading}
                aria-invalid={Boolean(error)}
              />
            </div>

            <div>
              <label htmlFor="switch-password" className="mb-2 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="switch-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className="w-full rounded-full border border-slate-300 px-4 py-2.5 pr-11 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Enter password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'session-resume-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(current => !current)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  disabled={isLoading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !password || !switchUsername.trim()}
              className="flex w-full items-center justify-center rounded-full bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserSwitch size={18} className="mr-2" weight="duotone" />
              {isLoading ? 'Signing in…' : 'Sign in as another user'}
            </button>
          </form>
        )}

        {error && (
          <p
            id="session-resume-error"
            role="alert"
            aria-live="assertive"
            className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-200 pt-4">
          {onSwitchUser && (
            <button
              type="button"
              onClick={toggleMode}
              disabled={isLoading}
              className="flex items-center justify-center rounded-full bg-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50 sm:text-sm"
            >
              {mode === 'switch' ? (
                <ArrowCounterClockwise size={17} className="mr-1.5" />
              ) : (
                <UserSwitch size={17} className="mr-1.5" />
              )}
              {mode === 'switch' ? 'Back to session' : 'Switch user'}
            </button>
          )}

          {onSignOut && (
            <button
              type="button"
              onClick={async () => {
                setIsLoading(true);
                setError('');
                try {
                  await onSignOut();
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              className="flex items-center justify-center rounded-full bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50 sm:text-sm"
            >
              <SignOut size={17} className="mr-1.5" />
              Sign out
            </button>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}
