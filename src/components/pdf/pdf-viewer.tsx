"use client";

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Printer, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { usePrint } from '@/lib/contexts/print-context';

interface PDFViewerProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBlob: Blob | null;
  fileName?: string;
  title?: string;
  showDownload?: boolean;
  showPrint?: boolean;
}

export function PDFViewer({
  isOpen,
  onClose,
  pdfBlob,
  fileName = 'document.pdf',
  title = 'PDF Viewer',
  showDownload = true,
  showPrint = true,
}: PDFViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [useObjectTag, setUseObjectTag] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const objectRef = useRef<HTMLObjectElement>(null);
  const { registerPrintHandler } = usePrint();

  useEffect(() => {
    setMounted(true);
    // Detect mobile device
    const checkMobile = () => {
      const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                            window.innerWidth < 768;
      setIsMobile(isMobileDevice);
      // On mobile, prefer object tag over iframe
      if (isMobileDevice) {
        setUseObjectTag(true);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (pdfBlob && isOpen) {
      setIsLoading(true);
      setError(null);
      
      try {
        // Verify blob is valid
        if (!(pdfBlob instanceof Blob)) {
          throw new Error('Invalid PDF blob');
        }
        
        if (pdfBlob.size === 0) {
          throw new Error('PDF blob is empty');
        }
        
        console.log('Creating blob URL for PDF:', { size: pdfBlob.size, type: pdfBlob.type });
        
        // Create blob URL
        const url = URL.createObjectURL(pdfBlob);
        setPdfUrl(url);
        console.log('Blob URL created:', url);
        
        // Set loading to false after a short delay to allow PDF to start loading
        const timer = setTimeout(() => {
          setIsLoading(false);
        }, 500);

        // Cleanup function
        return () => {
          clearTimeout(timer);
          if (url) {
            URL.revokeObjectURL(url);
            console.log('Blob URL revoked');
          }
          setPdfUrl(null);
          setIsLoading(false);
          setError(null);
        };
      } catch (err) {
        console.error('Error setting up PDF viewer:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
        setIsLoading(false);
      }
    } else {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      setPdfUrl(null);
      setIsLoading(false);
      setError(null);
    }
  }, [pdfBlob, isOpen, isMobile]);

  const handleDownload = () => {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handlePrint = () => {
    if (!pdfUrl) return;

    // Print the PDF document that is already loaded inside the preview. This
    // keeps the app preview open while the browser/device print dialog is shown.
    const previewWindow = iframeRef.current?.contentWindow
      ?? objectRef.current?.contentWindow;

    if (previewWindow) {
      previewWindow.focus();
      previewWindow.print();
    }
  };

  // Register print handler when PDF viewer is open (high priority for PDF viewer)
  useEffect(() => {
    if (isOpen && pdfUrl) {
      const unregister = registerPrintHandler(handlePrint, 100);
      return unregister;
    }
  }, [isOpen, pdfUrl, registerPrintHandler]);

  const handleOpenInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  return (
    <>
      {/* Custom glossy blur overlay using portal */}
      {mounted && isOpen && createPortal(
        <div 
          className="fixed inset-0 z-[49] transition-all duration-500 ease-out"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.25) 50%, rgba(236, 72, 153, 0.25) 100%)',
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
            pointerEvents: 'auto',
          }}
          onClick={onClose}
        />,
        document.body
      )}
      
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent 
        side={isMobile ? "bottom" : "right"}
        className="w-full sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] p-0 flex flex-col !overflow-hidden !max-w-none border-0 shadow-2xl [&+div>div]:!bg-gradient-to-br [&+div>div]:!from-blue-500/20 [&+div>div]:!via-purple-500/20 [&+div>div]:!to-pink-500/20 [&+div>div]:!backdrop-blur-xl [&+div>div]:!backdrop-saturate-150"
        style={{ 
          padding: 0, 
          maxWidth: 'none',
          width: isMobile ? '100vw' : undefined,
          height: isMobile ? '100vh' : undefined,
          maxHeight: isMobile ? '100vh' : undefined,
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.6) inset, 0 0 100px rgba(99, 102, 241, 0.1)',
        }}
      >
        <SheetHeader 
          className="px-6 py-5 flex-shrink-0 z-10 relative"
          style={{ 
            flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.9) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <SheetTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {title}
                </SheetTitle>
                {fileName && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                    {fileName}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isMobile && pdfUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenInNewTab}
                  disabled={!pdfUrl || isLoading}
                  className="gap-2 border-gray-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md"
                  title="Open in new tab"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Open</span>
                </Button>
              )}
              {showPrint && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  disabled={!pdfUrl || isLoading}
                  className="gap-2 border-gray-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md"
                  title="Open your device print settings"
                >
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">Print</span>
                </Button>
              )}
              {showDownload && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  disabled={!pdfBlob || isLoading}
                  className="gap-2 border-gray-200 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 hover:border-green-300 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-9 w-9 p-0 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all duration-200"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>
        
        <div 
          className="flex-1 overflow-hidden relative" 
          style={{ 
            flex: '1 1 auto',
            minHeight: 0,
            height: isMobile ? 'calc(100vh - 140px)' : 'calc(100vh - 120px)',
            maxHeight: isMobile ? 'calc(100vh - 140px)' : 'calc(100vh - 120px)',
            position: 'relative',
            background: 'linear-gradient(135deg, rgba(249, 250, 251, 0.8) 0%, rgba(243, 244, 246, 0.8) 100%)',
          }}
        >
          {isLoading && (
            <div 
              className="absolute inset-0 flex items-center justify-center z-10"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.9) 100%)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white/80 shadow-xl border border-gray-200/50">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-xl opacity-30 animate-pulse" />
                  <Loader2 className="h-10 w-10 animate-spin text-blue-600 relative z-10" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Loading PDF</p>
                  <p className="text-xs text-gray-500 mt-1">Please wait...</p>
                </div>
              </div>
            </div>
          )}
          
          {error && (
            <div 
              className="absolute inset-0 flex items-center justify-center z-10"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.9) 100%)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white/90 shadow-xl border border-red-200/50 max-w-md">
                <div className="p-3 rounded-full bg-red-100">
                  <X className="h-6 w-6 text-red-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-red-600 mb-4">{error}</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {pdfUrl && (
                      <Button 
                        onClick={handleOpenInNewTab} 
                        variant="default" 
                        size="sm"
                        className="gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Open in New Tab
                      </Button>
                    )}
                    {showDownload && (
                      <Button 
                        onClick={handleDownload} 
                        variant="outline" 
                        size="sm"
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    )}
                    <Button 
                      onClick={onClose} 
                      variant="outline" 
                      size="sm"
                      className="border-red-200 hover:bg-red-50 hover:border-red-300"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {pdfUrl && !error && (
            <div 
              className="w-full h-full absolute inset-0 rounded-lg overflow-hidden"
              style={{
                boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.05)',
                minHeight: '400px',
              }}
            >
              {/* On mobile, try object tag first, otherwise use iframe */}
              {useObjectTag ? (
                <>
                  {/* Primary for mobile: Use object tag */}
                  <object
                    ref={objectRef}
                    data={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                    type="application/pdf"
                    className="w-full h-full rounded-lg"
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      minHeight: '400px',
                      display: 'block',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      border: 'none',
                      borderRadius: '8px',
                    }}
                    onLoad={() => {
                      console.log('PDF object loaded');
                      setIsLoading(false);
                    }}
                    onError={(e) => {
                      console.error('PDF object error:', e);
                      // Try iframe as fallback
                      if (iframeRef.current) {
                        iframeRef.current.style.display = 'block';
                        if (objectRef.current) {
                          objectRef.current.style.display = 'none';
                        }
                        setUseObjectTag(false);
                      } else {
                        setError('PDF cannot be displayed. Please download it to view.');
                        setIsLoading(false);
                      }
                    }}
                  />
                  {/* Fallback iframe for mobile */}
                  <iframe
                    ref={iframeRef}
                    src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                    className="w-full h-full border-0 rounded-lg"
                    title={title}
                    allow="fullscreen"
                    loading="eager"
                    onLoad={() => {
                      console.log('PDF iframe loaded (mobile fallback)');
                      setIsLoading(false);
                    }}
                    onError={(e) => {
                      console.error('PDF iframe error:', e);
                      setError('PDF cannot be displayed. Please download it to view.');
                      setIsLoading(false);
                    }}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      minHeight: '400px',
                      display: 'none',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      border: 'none',
                      borderRadius: '8px',
                    }}
                  />
                </>
              ) : (
                <>
                  {/* Primary for desktop: Use iframe */}
                  <iframe
                    ref={iframeRef}
                    src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                    className="w-full h-full border-0 rounded-lg"
                    title={title}
                    allow="fullscreen"
                    loading="eager"
                    onLoad={() => {
                      console.log('PDF iframe loaded');
                      setIsLoading(false);
                    }}
                    onError={(e) => {
                      console.error('PDF iframe error:', e);
                      // Try object tag as fallback
                      if (objectRef.current) {
                        objectRef.current.style.display = 'block';
                        if (iframeRef.current) {
                          iframeRef.current.style.display = 'none';
                        }
                        setUseObjectTag(true);
                      } else {
                        setError('Failed to load PDF. Please try downloading it instead.');
                        setIsLoading(false);
                      }
                    }}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      minHeight: '400px',
                      display: 'block',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      border: 'none',
                      borderRadius: '8px',
                    }}
                  />
                  {/* Fallback object tag for desktop */}
                  <object
                    ref={objectRef}
                    data={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                    type="application/pdf"
                    className="w-full h-full rounded-lg"
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      minHeight: '400px',
                      display: 'none',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      border: 'none',
                      borderRadius: '8px',
                    }}
                    onLoad={() => {
                      console.log('PDF object loaded (desktop fallback)');
                      setIsLoading(false);
                    }}
                    onError={(e) => {
                      console.error('PDF object error:', e);
                      setError('PDF cannot be displayed. Please download it to view.');
                      setIsLoading(false);
                    }}
                  />
                </>
              )}
            </div>
          )}
          
          {!pdfUrl && !isLoading && !error && (
            <div 
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(248, 250, 252, 0.5) 100%)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-white/80 shadow-lg border border-gray-200/50">
                <FileText className="h-12 w-12 text-gray-400" />
                <p className="text-sm text-gray-500 font-medium">No PDF to display</p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}
