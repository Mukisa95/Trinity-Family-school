"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { useSubmissionState } from '@/lib/hooks/use-submission-state';
import { useToastHelpers } from '@/lib/utils/toast-utils';
import { Save, UserPlus, Mail, Clock } from 'lucide-react';

/**
 * Example component showing how to use the submission state system
 * to prevent duplicate submissions and provide loading feedback
 */
export function SubmissionExample() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });

  // Use the submission state hook for protected submissions
  const { isSubmitting, submitWithState, resetSubmissionState } = useSubmissionState();
  const toastHelpers = useToastHelpers();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simulate API call with submission state protection
    await submitWithState(
      async () => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Simulate random success/failure
        if (Math.random() > 0.3) {
          return { id: Date.now(), ...formData };
        } else {
          throw new Error('Simulated API error');
        }
      },
      {
        successTitle: "User Created",
        successMessage: `${formData.name} has been successfully added to the system.`,
        errorTitle: "Creation Failed",
        errorMessage: "Failed to create user. Please check your data and try again.",
        onSuccess: (result) => {
          console.log('Created user:', result);
          // Reset form on success
          setFormData({ name: '', email: '' });
        },
        onError: (error) => {
          console.error('Submission error:', error);
        }
      }
    );
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Protected Submission Example
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter your name"
              required
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="flex gap-2">
            <LoadingButton
              type="submit"
              loading={isSubmitting}
              loadingText="Creating User..."
              className="flex-1"
            >
              <Save className="mr-2 h-4 w-4" />
              Create User
            </LoadingButton>
            
            <LoadingButton
              type="button"
              variant="outline"
              loading={isSubmitting}
              loadingText="Sending..."
              onClick={() => {
                submitWithState(
                  async () => {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return { sent: true };
                  },
                  {
                    successTitle: "Email Sent",
                    successMessage: "Welcome email has been sent successfully.",
                    errorTitle: "Send Failed",
                    errorMessage: "Failed to send email. Please try again."
                  }
                );
              }}
            >
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </LoadingButton>
          </div>

          {/* Toast timing demo buttons */}
          <div className="grid grid-cols-2 gap-2">
            <LoadingButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toastHelpers.success("Quick Success", "This disappears in 2 seconds")}
              className="text-xs"
            >
              <Clock className="mr-1 h-3 w-3" />
              Success (2s)
            </LoadingButton>
            
            <LoadingButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toastHelpers.error("Error Message", "This stays for 4 seconds to read")}
              className="text-xs"
            >
              <Clock className="mr-1 h-3 w-3" />
              Error (4s)
            </LoadingButton>
          </div>

          {/* Reset button for demo purposes */}
          <LoadingButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetSubmissionState}
            className="w-full text-xs"
          >
            Reset Submission State (Demo)
          </LoadingButton>
        </form>

        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Features Demonstrated:</h4>
          <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
            <li>• Prevents duplicate submissions within 2 seconds</li>
            <li>• Shows loading indicators during submission</li>
            <li>• Disables buttons when submitting</li>
            <li>• Optimized toast durations (2s success, 4s errors)</li>
            <li>• Auto-dismissible notifications</li>
            <li>• Handles multiple concurrent submissions</li>
            <li>• Provides customizable success/error messages</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
} 