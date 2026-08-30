"use client";

import React, { useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useNavigation } from '@/lib/contexts/navigation-context';
import {
  User,
  Mail,
  Lock,
  LogOut,
  ChevronLeft,
  Eye,
  EyeOff,
  Shield,
  Bell,
  Info,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';

export default function ParentSettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { goBack } = useNavigation();

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !firebaseUser.email) {
      setMessage({ type: 'error', text: 'Unable to verify current session. Please log in again.' });
      return;
    }

    setIsUpdating(true);
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPassword);
      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setMessage({ type: 'error', text: 'Current password is incorrect.' });
      } else if (code === 'auth/weak-password') {
        setMessage({ type: 'error', text: 'New password is too weak. Use at least 6 characters.' });
      } else {
        setMessage({ type: 'error', text: 'Failed to update password. Please try again.' });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const displayName = user
    ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() || user.username || 'Parent'
    : 'Parent';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-blue-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => goBack('/parent')}
            className="w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-blue-600" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">Settings</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-xl font-bold text-white">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-base truncate">{displayName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <p className="text-sm text-gray-500 truncate">{user?.email || '—'}</p>
              </div>
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">
                <Shield className="w-3 h-3" />
                Parent Account
              </span>
            </div>
          </div>
        </div>

        {/* Alert message */}
        {message && (
          <div className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.type === 'success'
              ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            {message.text}
          </div>
        )}

        {/* Account Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</p>
          </div>

          {/* Change Password */}
          <button
            onClick={() => { setShowPasswordForm(prev => !prev); setMessage(null); }}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <Lock className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Change Password</p>
              <p className="text-xs text-gray-400">Update your account password</p>
            </div>
            <ChevronLeft className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showPasswordForm ? '-rotate-90' : 'rotate-180'}`} />
          </button>

          {/* Password Form */}
          {showPasswordForm && (
            <form onSubmit={handlePasswordChange} className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
              {/* Current password */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                    className="w-full px-3 py-2.5 pr-9 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                  />
                  <button type="button" onClick={() => setShowCurrent(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {/* New password */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    placeholder="Min. 6 characters"
                    className="w-full px-3 py-2.5 pr-9 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                  />
                  <button type="button" onClick={() => setShowNew(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {/* Confirm password */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2.5 pr-9 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                  />
                  <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isUpdating}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isUpdating ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        {/* About */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">About</p>
          </div>
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Info className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Trinity Family Schools</p>
              <p className="text-xs text-gray-400">Parent Portal · Powered by TFS System</p>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-4 bg-white rounded-2xl shadow-sm border border-red-100 hover:bg-red-50 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <LogOut className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-red-600">Logout</p>
            <p className="text-xs text-red-400">Sign out of your account</p>
          </div>
        </button>

      </div>
    </div>
  );
}
