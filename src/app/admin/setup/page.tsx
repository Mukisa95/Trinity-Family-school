"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { UsersService } from "@/lib/services/users.service";
import { School, Shield, CheckCircle } from "lucide-react";
import type { SystemUser } from "@/types";

export default function AdminSetupPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [formData, setFormData] = useState({
    username: "admin",
    email: "admin@trinityfamilyschool.com",
    password: "admin123"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.email.trim() || !formData.password.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Fields",
        description: "Please fill in all required fields."
      });
      return;
    }

    setIsLoading(true);

    try {
      console.log('Setup: Starting admin creation process');
      console.log('Setup: Form data:', { username: formData.username, email: formData.email });
      
      // Check if admin already exists
      console.log('Setup: Checking if admin already exists');
      const existingAdmin = await UsersService.getUserByUsername(formData.username);
      console.log('Setup: Existing admin found:', !!existingAdmin);
      
      if (existingAdmin) {
        console.log('Setup: Admin already exists, aborting');
        toast({
          variant: "destructive",
          title: "Admin Already Exists",
          description: "An admin user with this username already exists."
        });
        return;
      }

      const adminData: Omit<SystemUser, 'id' | 'createdAt'> & { password: string } = {
        username: formData.username,
        email: formData.email,
        role: 'Admin',
        isActive: true,
        password: formData.password
      };

      console.log('Setup: Creating admin user with data:', { ...adminData, password: '[HIDDEN]' });
      const userId = await UsersService.createUser(adminData);
      console.log('Setup: Admin user created with ID:', userId);
      
      toast({
        title: "Admin User Created",
        description: "Administrator account has been created successfully!"
      });
      
      setIsComplete(true);
    } catch (error: any) {
      console.error('Setup: Error creating admin user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create admin user."
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto h-16 w-16 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-600">Setup Complete!</CardTitle>
            <CardDescription>
              Your administrator account has been created successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">Login Credentials</h3>
              <div className="space-y-1 text-sm text-green-800 dark:text-green-200">
                <p><strong>Username:</strong> {formData.username}</p>
                <p><strong>Password:</strong> {formData.password}</p>
              </div>
            </div>
            
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Please change your password after first login for security.
              </AlertDescription>
            </Alert>

            <Button 
              className="w-full" 
              onClick={() => window.location.href = '/login'}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-4">
            <School className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Trinity Family School
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Initial Administrator Setup
          </p>
        </div>

        {/* Setup Card */}
        <Card className="shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Create Admin Account</CardTitle>
            <CardDescription className="text-center">
              Set up the initial administrator account for your school management system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter admin username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  disabled={isLoading}
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter admin email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  disabled={isLoading}
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter admin password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  disabled={isLoading}
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating Admin...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Create Administrator
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info */}
        <div className="text-center text-xs text-gray-500 dark:text-gray-400">
          <p>This page is only needed for initial setup.</p>
          <p className="mt-1">
            After creating the admin account, you can access the full system.
          </p>
        </div>
      </div>
    </div>
  );
} 