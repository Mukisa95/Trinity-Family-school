"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, Lock } from 'lucide-react';

interface AdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string, notes?: string) => Promise<void>;
  title: string;
  description: string;
  selectedCount?: number;
  isLoading?: boolean;
}

export function AdminPasswordModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  selectedCount = 0,
  isLoading = false,
}: AdminPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Admin password is required');
      return;
    }

    try {
      setError('');
      await onConfirm(password, notes || undefined);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleClose = () => {
    setPassword('');
    setNotes('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 rounded-full">
              <Shield className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {selectedCount > 0 && (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                You are about to affect {selectedCount} student result{selectedCount !== 1 ? 's' : ''}.
                This action requires admin authentication.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="admin-password">Admin Password</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="release-notes">Release Notes (Optional)</Label>
            <Textarea
              id="release-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this release..."
              disabled={isLoading}
              rows={3}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !password.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 