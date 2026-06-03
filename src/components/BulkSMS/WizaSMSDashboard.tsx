"use client";

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ExternalLink,
  CreditCard,
  RefreshCw,
  Monitor,
  LogIn,
} from 'lucide-react';

interface WizaSMSDashboardProps {
  open: boolean;
  onClose: () => void;
}

export const WizaSMSDashboard: React.FC<WizaSMSDashboardProps> = ({ open, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // When opening, reset loading state
  React.useEffect(() => {
    if (open) {
      setIsLoading(true);
    }
  }, [open]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    if (iframeRef.current) {
      // Reload by resetting src
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  /**
   * Opens a small popup window that auto-submits the login form to wizasms.ug.
   * The browser sets the session cookie on the wizasms.ug domain.
   * After a short delay the iframe reloads so it picks up the authenticated session.
   */
  const handleAutoSignIn = () => {
    // Open our wiza-login route in a small popup — it auto-submits credentials
    const popup = window.open(
      '/api/sms/wiza-login',
      'wiza_login',
      'width=500,height=350,left=200,top=200,noopener'
    );

    // Close the popup automatically after it has had time to submit the form
    setTimeout(() => {
      try { popup?.close(); } catch { /* ignore */ }
    }, 4000);

    // Reload the iframe after a short delay so it picks up the fresh session cookie
    setTimeout(() => {
      setSignedIn(true);
      setIsLoading(true);
      if (iframeRef.current) {
        iframeRef.current.src = 'https://wizasms.ug/dashboard';
      }
    }, 3500);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-none">
        <div className="absolute inset-x-0 bottom-0 top-14 z-20 flex flex-col bg-background">
          {/* Header */}
          <DialogHeader className="px-4 py-3 border-b bg-muted/30 flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" />
                Wiza SMS Dashboard
                <Badge variant="outline" className="text-xs font-normal">wizasms.ug</Badge>
              </DialogTitle>

              <div className="flex items-center gap-1.5 pr-8">
                {/* Auto Sign In — sets the session cookie on wizasms.ug then refreshes iframe */}
                <Button
                  onClick={handleAutoSignIn}
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs gap-1.5"
                  title="Automatically log in with your saved credentials"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  {signedIn ? 'Re-login' : 'Sign In'}
                </Button>

                <Button
                  onClick={handleRefresh}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={isLoading}
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>

                <Button
                  onClick={() => window.open('https://wizasms.ug/dashboard', '_blank', 'noopener,noreferrer')}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Contextual hint */}
            <p className="text-xs text-muted-foreground mt-0.5">
              {signedIn
                ? '✅ Sign-in complete — the dashboard should now show your account.'
                : 'If the dashboard asks you to log in, click "Sign In" above to authenticate automatically.'}
            </p>
          </DialogHeader>

          {/* Iframe */}
          <div className="relative flex-1 overflow-hidden bg-white">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80">
                <RefreshCw className="h-7 w-7 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading Wiza SMS…</p>
              </div>
            )}

            <iframe
              ref={iframeRef}
              src="https://wizasms.ug/dashboard"
              title="Wiza SMS Dashboard"
              className="absolute inset-0 w-full h-full border-0"
              onLoad={handleIframeLoad}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground flex-shrink-0">
            <span>🔐 Secure connection · Your credentials are stored privately</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onClose()}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
