import React, { useState } from 'react';
import { Eye, EyeOff, User, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { UsersService } from '@/lib/services/users.service';
import type { SystemUser } from '@/types';

interface DigitalSignatureProps {
  onSignatureComplete: (user: SystemUser) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function DigitalSignature({ onSignatureComplete, onCancel, disabled }: DigitalSignatureProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authenticatedUser, setAuthenticatedUser] = useState<SystemUser | null>(null);

  const handleAuthenticate = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const user = await UsersService.authenticateUser(username.trim(), password);
      
      if (!user) {
        setError('Invalid username or password');
        return;
      }

      if (user.role !== 'Staff' && user.role !== 'Admin') {
        setError('Only staff members can record purchases');
        return;
      }

      if (!user.isActive) {
        setError('Your account is inactive. Please contact the administrator');
        return;
      }

      // Check if user has procurement module permission
      const hasPermission = user.role === 'Admin' || 
        (user.modulePermissions && user.modulePermissions.some(
          mp => mp.module === 'Procurement' && ['edit', 'full_access'].includes(mp.permission)
        ));

      if (!hasPermission) {
        setError('You do not have permission to record purchases');
        return;
      }

      setAuthenticatedUser(user);
      onSignatureComplete(user);
    } catch (error) {
      console.error('Authentication error:', error);
      setError('Authentication failed. Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleAuthenticate();
    }
  };

  if (authenticatedUser) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <Shield className="w-6 h-6 text-green-600" />
          <div className="flex-1">
            <div className="font-medium text-green-800">Digital Signature Verified</div>
            <div className="text-sm text-green-600">
              {authenticatedUser.firstName} {authenticatedUser.lastName} ({authenticatedUser.username})
            </div>
          </div>
          <Badge className="bg-green-100 text-green-800 border-green-300">
            Authenticated
          </Badge>
        </div>
        
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Purchase will be recorded under the authenticated staff member's credentials.
            This action creates an audit trail for accountability.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto">
          <User className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold">Digital Signature Required</h3>
        <p className="text-sm text-gray-600">
          Enter your credentials to authenticate this purchase record
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="signature-username">Username *</Label>
          <Input
            id="signature-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter your username"
            disabled={disabled || isLoading}
            autoComplete="username"
            className="text-center"
          />
        </div>

        <div>
          <Label htmlFor="signature-password">Password *</Label>
          <div className="relative">
            <Input
              id="signature-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your password"
              disabled={disabled || isLoading}
              autoComplete="current-password"
              className="text-center pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => setShowPassword(!showPassword)}
              disabled={disabled || isLoading}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={disabled || isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAuthenticate}
            disabled={disabled || isLoading || !username.trim() || !password.trim()}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Authenticate
              </>
            )}
          </Button>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Security Notice:</strong> Your authentication will be logged for audit purposes. 
          Only authorized staff members with procurement permissions can record purchases.
        </AlertDescription>
      </Alert>
    </div>
  );
} 