"use client";

import { useState, useCallback } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

interface UsePDFViewerReturn {
  isOpen: boolean;
  pdfBlob: Blob | null;
  isLoading: boolean;
  openPDF: (pdfDocument: ReactElement, fileName?: string, title?: string) => Promise<void>;
  openPDFFromBlob: (blob: Blob, fileName?: string, title?: string) => void;
  closePDF: () => void;
  fileName: string;
  title: string;
}

export function usePDFViewer(): UsePDFViewerReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState('document.pdf');
  const [title, setTitle] = useState('PDF Viewer');

  const openPDF = useCallback(async (
    pdfDocument: ReactElement,
    fileName: string = 'document.pdf',
    title: string = 'PDF Viewer'
  ) => {
    try {
      setIsLoading(true);
      setFileName(fileName);
      setTitle(title);
      setPdfBlob(null); // Clear previous blob
      
      // Generate PDF blob
      const asPdf = pdf(pdfDocument);
      const blob = await asPdf.toBlob();
      
      // Verify blob was created
      if (!blob || blob.size === 0) {
        throw new Error('PDF blob is empty or invalid');
      }
      
      console.log('PDF blob generated:', { size: blob.size, type: blob.type });
      
      setPdfBlob(blob);
      setIsOpen(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setIsLoading(false);
      throw error;
    }
  }, []);

  const openPDFFromBlob = useCallback((
    blob: Blob,
    fileName: string = 'document.pdf',
    title: string = 'PDF Viewer'
  ) => {
    if (!blob || blob.size === 0) {
      console.error('Invalid PDF blob');
      return;
    }
    
    setFileName(fileName);
    setTitle(title);
    setPdfBlob(blob);
    setIsOpen(true);
    setIsLoading(false);
  }, []);

  const closePDF = useCallback(() => {
    setIsOpen(false);
    // Cleanup blob URL after a short delay to allow viewer to close
    setTimeout(() => {
      if (pdfBlob) {
        setPdfBlob(null);
      }
    }, 300);
  }, [pdfBlob]);

  return {
    isOpen,
    pdfBlob,
    isLoading,
    openPDF,
    openPDFFromBlob,
    closePDF,
    fileName,
    title,
  };
}

