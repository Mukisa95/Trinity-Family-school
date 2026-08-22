"use client";

import { useState, useCallback } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import {
  PDFGenerationContext,
  PDFJobOptions,
  useOptionalPDFWorkspace,
} from '@/lib/pdf/pdf-workspace-context';

interface UsePDFViewerReturn {
  isOpen: boolean;
  pdfBlob: Blob | null;
  isLoading: boolean;
  openPDF: (pdfDocument: ReactElement, fileName?: string, title?: string) => Promise<void>;
  openPDFFromBlob: (blob: Blob, fileName?: string, title?: string) => void;
  runPDFJob: (
    options: PDFJobOptions,
    generator: (context: PDFGenerationContext) => Promise<Blob>,
  ) => Promise<Blob>;
  closePDF: () => void;
  fileName: string;
  title: string;
}

export function usePDFViewer(): UsePDFViewerReturn {
  const workspace = useOptionalPDFWorkspace();
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
    if (workspace) {
      const job = workspace.runPDFJob(
        {
          fileName,
          title,
          initialMessage: 'Preparing document layout…',
        },
        async ({ signal, updateProgress }) => {
          updateProgress(8, 'Loading PDF renderer…');
          if (signal.aborted) throw new DOMException('PDF generation was cancelled', 'AbortError');
          const asPdf = pdf(pdfDocument);
          updateProgress(24, 'Rendering pages…');
          const blob = await asPdf.toBlob();
          updateProgress(96, 'Finalizing document…');
          return blob;
        },
      );
      await job.promise;
      return;
    }

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
  }, [workspace]);

  const openPDFFromBlob = useCallback((
    blob: Blob,
    fileName: string = 'document.pdf',
    title: string = 'PDF Viewer'
  ) => {
    if (workspace) {
      workspace.addPDFBlob(blob, { fileName, title });
      return;
    }

    if (!blob || blob.size === 0) {
      console.error('Invalid PDF blob');
      return;
    }
    
    setFileName(fileName);
    setTitle(title);
    setPdfBlob(blob);
    setIsOpen(true);
    setIsLoading(false);
  }, [workspace]);

  const runPDFJob = useCallback(async (
    options: PDFJobOptions,
    generator: (context: PDFGenerationContext) => Promise<Blob>,
  ) => {
    if (workspace) {
      return workspace.runPDFJob(options, generator).promise;
    }

    setIsLoading(true);
    setFileName(options.fileName || 'document.pdf');
    setTitle(options.title || 'PDF Viewer');
    setPdfBlob(null);
    setIsOpen(true);
    try {
      const controller = new AbortController();
      const blob = await generator({
        signal: controller.signal,
        updateProgress: () => undefined,
      });
      if (!blob || blob.size === 0) throw new Error('PDF blob is empty or invalid');
      setPdfBlob(blob);
      return blob;
    } finally {
      setIsLoading(false);
    }
  }, [workspace]);

  const closePDF = useCallback(() => {
    if (workspace) {
      workspace.minimizeWorkspace();
      return;
    }
    setIsOpen(false);
    // Cleanup blob URL after a short delay to allow viewer to close
    setTimeout(() => {
      if (pdfBlob) {
        setPdfBlob(null);
      }
    }, 300);
  }, [pdfBlob, workspace]);

  const workspaceDocument = workspace?.activeDocument ?? null;

  return {
    isOpen: workspace ? workspace.documents.length > 0 && workspace.mode === 'expanded' : isOpen,
    pdfBlob: workspaceDocument?.blob ?? pdfBlob,
    isLoading: workspaceDocument?.status === 'generating' || isLoading,
    openPDF,
    openPDFFromBlob,
    runPDFJob,
    closePDF,
    fileName: workspaceDocument?.fileName ?? fileName,
    title: workspaceDocument?.title ?? title,
  };
}
