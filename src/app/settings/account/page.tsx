"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/contexts/auth-context";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Eye, EyeOff, Save, ArrowLeft, KeyRound, Shield, AlertCircle } from "lucide-react";
import { Lock as LockIcon, SignOut } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useUpdateUser } from "@/lib/hooks/use-users";
import { Loader2 } from "lucide-react";

export default function AccountSettingsPage() {
  const { user, refreshUser, autoLockEnabled, setAutoLockEnabled, autoLockAction, setAutoLockAction, lockAccount, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const updateUserMutation = useUpdateUser();

  // Form states
  const [formData, setFormData] = useState({
    username: user?.username || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // UI states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);

  // Handle navigation in useEffect to avoid state updates during render
  React.useEffect(() => {
    if (!user) {
      // Don't redirect immediately, let the auth context settle
      const timer = setTimeout(() => {
        if (!user) {
          router.push('/login');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, router]);

  // Ensure password fields are always empty and never prefilled
  React.useEffect(() => {
    setFormData(prev => ({
      ...prev,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }));
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Loading account settings...</h2>
          <p className="text-muted-foreground mt-2">Please wait while we load your account information.</p>
        </div>
      </div>
    );
  }

  const handleUpdateUsername = async () => {
    if (!formData.username.trim()) {
      toast({
        variant: "destructive",
        title: "Invalid Username",
        description: "Username cannot be empty."
      });
      return;
    }

    if (formData.username === user.username) {
      toast({
        variant: "destructive",
        title: "No Changes",
        description: "The username is the same as your current username."
      });
      return;
    }

    setIsUpdatingUsername(true);
    try {
      await updateUserMutation.mutateAsync({
        userId: user.id,
        updates: { username: formData.username }
      });

      toast({
        title: "Username Updated",
        description: "Your username has been successfully updated."
      });

      // Refresh user data
      await refreshUser();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update username."
      });
    } finally {
      setIsUpdatingUsername(false);
    }
  };

  const handleUpdatePassword = async () => {
    // Validation
    if (!formData.currentPassword) {
      toast({
        variant: "destructive",
        title: "Current Password Required",
        description: "Please enter your current password."
      });
      return;
    }

    if (!formData.newPassword) {
      toast({
        variant: "destructive",
        title: "New Password Required",
        description: "Please enter a new password."
      });
      return;
    }

    if (formData.newPassword.length < 4) {
      toast({
        variant: "destructive",
        title: "Password Too Short",
        description: "Password must be at least 4 characters long."
      });
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords Don't Match",
        description: "New password and confirmation password don't match."
      });
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      toast({
        variant: "destructive",
        title: "Same Password",
        description: "New password must be different from your current password."
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      // Note: In a real application, you would verify the current password on the server
      // For now, we'll just update the password
      await updateUserMutation.mutateAsync({
        userId: user.id,
        updates: { password: formData.newPassword }
      });

      toast({
        title: "Password Updated",
        description: "Your password has been successfully updated."
      });

      // Clear password fields
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update password."
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const getUserDisplayName = () => {
    if (user.role === 'Staff' && user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username;
  };

  const handleLockOnCloseAndSavePreference = () => {
    setAutoLockAction('lock-on-close');
    setShowLockModal(false);
    toast({
      title: "Auto Lock Preference Set",
      description: "Your account will be locked when you close the browser window."
    });
  };

  const handleLockOnLeaveAndSavePreference = () => {
    setAutoLockAction('lock-on-leave');
    setShowLockModal(false);
    toast({
      title: "Auto Lock Preference Set",
      description: "Your account will be locked when you leave the window or switch tabs."
    });
  };

  const handleSignOutAndSavePreference = async () => {
    setAutoLockAction('signout');
    setShowLockModal(false);
    toast({
      title: "Auto Lock Preference Set",
      description: "You will be signed out when you close the browser window."
    });
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2 rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <PageHeader
            title="Account Settings"
            description="Manage your account credentials and security settings"
          />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Account Information Card */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              Account Information
            </CardTitle>
            <CardDescription>
              View your basic account information
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">Display Name</Label>
                <p className="text-lg font-semibold text-gray-900">{getUserDisplayName()}</p>
              </div>
              
              <div className="p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">Role</Label>
                <p className="text-sm font-medium text-gray-900">{user.role}</p>
              </div>

              {user.email && (
                <div className="p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <Label className="text-xs font-medium text-muted-foreground mb-2 block">Email</Label>
                  <p className="text-sm text-gray-900">{user.email}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Username Settings Card */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 bg-purple-100 rounded-lg">
                <User className="h-5 w-5 text-purple-600" />
              </div>
              Username Settings
            </CardTitle>
            <CardDescription>
              Change your username for logging into the system
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter your username"
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  This is the username you use to log into the system
                </p>
              </div>

              <Button 
                onClick={handleUpdateUsername}
                disabled={isUpdatingUsername || formData.username === user.username}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg rounded-full"
                size="lg"
              >
                {isUpdatingUsername ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Update Username
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Password Settings Card */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow lg:col-span-2">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 bg-green-100 rounded-lg">
                <KeyRound className="h-5 w-5 text-green-600" />
              </div>
              Password Settings
            </CardTitle>
            <CardDescription>
              Change your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Current Password */}
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="current-password" className="text-sm font-medium">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={formData.currentPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="Enter your current password"
                      autoComplete="off"
                      autoFocus={false}
                      className="h-11 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent rounded-full"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="new-password" className="text-sm font-medium">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={formData.newPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Enter your new password"
                      autoComplete="new-password"
                      className="h-11 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent rounded-full"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 4 characters long (letters, numbers, or any combination)
                  </p>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-4 md:col-span-2">
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm your new password"
                      autoComplete="new-password"
                      className="h-11 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent rounded-full"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            <Button 
              onClick={handleUpdatePassword}
              disabled={isUpdatingPassword || !formData.currentPassword || !formData.newPassword || !formData.confirmPassword}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg rounded-full"
              size="lg"
            >
              {isUpdatingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Update Password
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Auto Lock Settings Card */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow lg:col-span-2">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 bg-amber-100 rounded-lg">
                <LockIcon size={20} weight="duotone" className="text-amber-600" />
              </div>
              Auto Lock Settings
            </CardTitle>
            <CardDescription>
              Automatically lock or sign out when you interact with the browser window
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <LockIcon size={20} className="text-blue-600" weight="duotone" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-gray-900">Auto Lock</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Enable automatic locking when closing or leaving the browser
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAutoLockEnabled(!autoLockEnabled)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full ${
                    autoLockEnabled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                  type="button"
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-lg ${
                      autoLockEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {autoLockEnabled && (
                <>
                  <Separator />
                  <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <Label className="text-sm font-semibold text-gray-900 block mb-1">Current Preference</Label>
                        <p className="text-sm text-muted-foreground">
                          {autoLockAction === 'lock-on-close' 
                            ? '🔒 Locks on close' 
                            : autoLockAction === 'lock-on-leave'
                            ? '🔒 Locks on leave'
                            : autoLockAction === 'signout' 
                            ? '🚪 Signs out on close' 
                            : '⚙️ Not set'}
                        </p>
                      </div>
                      <Button
                        onClick={() => setShowLockModal(true)}
                        variant="outline"
                        className="flex items-center gap-2 border-2 hover:bg-white rounded-full"
                      >
                        <Shield className="h-4 w-4" />
                        {autoLockAction ? 'Change Preference' : 'Set Preference'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Security Tips Card */}
        <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-lg lg:col-span-2">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-100 rounded-lg flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-amber-900 mb-3 text-lg">Security Tips</h4>
                <ul className="space-y-2 text-sm text-amber-800">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-1">•</span>
                    <span>Use a strong, unique password</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-1">•</span>
                    <span>Don't share your login credentials with others</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-1">•</span>
                    <span>Log out when using shared computers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 mt-1">•</span>
                    <span>Contact an administrator if you suspect unauthorized access</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lock Preference Modal */}
      <AnimatePresence>
        {showLockModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowLockModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 mb-4">
                  <LockIcon size={28} className="text-blue-600" weight="duotone" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Set Auto Lock Preference
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Choose what happens when you interact with the browser window
                </p>
                {autoLockAction && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full">
                    <span className="text-xs font-medium text-blue-700">
                      Current: {
                        autoLockAction === 'lock-on-close' ? 'Lock on Close' :
                        autoLockAction === 'lock-on-leave' ? 'Lock on Leave' :
                        'Sign Out'
                      }
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleLockOnCloseAndSavePreference}
                  className={`w-full flex items-center justify-center h-12 text-base font-medium transition-all rounded-full ${
                    autoLockAction === 'lock-on-close'
                      ? 'bg-blue-700 text-white ring-2 ring-blue-400 shadow-lg'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  <LockIcon size={18} weight="duotone" className="mr-2" />
                  Lock on Close
                  {autoLockAction === 'lock-on-close' && <span className="ml-2 text-lg">✓</span>}
                </Button>

                <Button
                  onClick={handleLockOnLeaveAndSavePreference}
                  className={`w-full flex items-center justify-center h-12 text-base font-medium transition-all rounded-full ${
                    autoLockAction === 'lock-on-leave'
                      ? 'bg-blue-700 text-white ring-2 ring-blue-400 shadow-lg'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  <LockIcon size={18} weight="duotone" className="mr-2" />
                  Lock on Leave
                  {autoLockAction === 'lock-on-leave' && <span className="ml-2 text-lg">✓</span>}
                </Button>

                <Button
                  onClick={handleSignOutAndSavePreference}
                  variant="destructive"
                  className={`w-full flex items-center justify-center h-12 text-base font-medium transition-all rounded-full ${
                    autoLockAction === 'signout'
                      ? 'bg-red-700 text-white ring-2 ring-red-400 shadow-lg'
                      : 'bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  <SignOut size={18} weight="duotone" className="mr-2" />
                  Sign Out on Close
                  {autoLockAction === 'signout' && <span className="ml-2 text-lg">✓</span>}
                </Button>

                <Button
                  onClick={() => setShowLockModal(false)}
                  variant="ghost"
                  className="w-full h-11 mt-2 rounded-full"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
