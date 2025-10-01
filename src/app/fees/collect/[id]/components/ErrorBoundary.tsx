'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Warning, ArrowCounterClockwise, House } from '@phosphor-icons/react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Fees Collection Error:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Log error to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // Example: logErrorToService(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Warning className="w-6 h-6 text-red-600" />
              </div>
              <CardTitle className="text-xl text-gray-900">
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600 text-center">
                We encountered an unexpected error while loading the fees collection page. 
                This has been logged and our team will investigate.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="bg-gray-50 p-3 rounded-lg text-xs">
                  <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                    Error Details (Development)
                  </summary>
                  <pre className="whitespace-pre-wrap text-red-600">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
              
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={this.handleRetry}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <ArrowCounterClockwise className="w-4 h-4" />
                  Try Again
                </Button>
                
                <Button 
                  variant="outline" 
                  asChild
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Link href="/fees/collection">
                    <House className="w-4 h-4" />
                    Back to Fees
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to handle errors
export const useErrorHandler = () => {
  const handleError = (error: Error, errorInfo?: string) => {
    console.error('Fees Collection Error:', error, errorInfo);
    
    // In a real app, you might want to:
    // - Send error to monitoring service
    // - Show user-friendly error message
    // - Trigger error boundary
    
    if (process.env.NODE_ENV === 'production') {
      // Example: logErrorToService(error, errorInfo);
    }
  };

  return { handleError };
}; 