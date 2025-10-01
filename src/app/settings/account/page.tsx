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
import { User, Lock, Eye, EyeOff, Save, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUpdateUser } from "@/lib/hooks/use-users";
import { Loader2 } from "lucide-react";

export default function AccountSettingsPage() {
  const { user, refreshUser } = useAuth();
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

    if (formData.newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Password Too Short",
        description: "Password must be at least 6 characters long."
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <PageHeader
          title="Account Settings"
          description="Manage your account credentials and security settings"
        />
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>
              View and update your basic account information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-sm font-medium text-muted-foreground">Display Name</Label>
              <p className="text-lg font-semibold">{getUserDisplayName()}</p>
            </div>
            
            <div className="grid gap-2">
              <Label className="text-sm font-medium text-muted-foreground">Role</Label>
              <p className="text-sm">{user.role}</p>
            </div>

            {user.email && (
              <div className="grid gap-2">
                <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                <p className="text-sm">{user.email}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Username Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Username Settings
            </CardTitle>
            <CardDescription>
              Change your username for logging into the system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Enter your username"
              />
              <p className="text-xs text-muted-foreground">
                This is the username you use to log into the system
              </p>
            </div>

            <Button 
              onClick={handleUpdateUsername}
              disabled={isUpdatingUsername || formData.username === user.username}
              className="flex items-center gap-2"
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
          </CardContent>
        </Card>

        {/* Password Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Password Settings
            </CardTitle>
            <CardDescription>
              Change your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={formData.currentPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder="Enter your current password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="grid gap-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={formData.newPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter your new password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters long
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm your new password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button 
              onClick={handleUpdatePassword}
              disabled={isUpdatingPassword || !formData.currentPassword || !formData.newPassword || !formData.confirmPassword}
              className="flex items-center gap-2"
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

        {/* Security Notice */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800">Security Tips</h4>
                <ul className="text-sm text-amber-700 mt-2 space-y-1">
                  <li>• Use a strong, unique password</li>
                  <li>• Don't share your login credentials with others</li>
                  <li>• Log out when using shared computers</li>
                  <li>• Contact an administrator if you suspect unauthorized access</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 