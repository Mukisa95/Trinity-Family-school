"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export type PDFWorkspaceDocumentStatus = "generating" | "ready" | "error";
export type PDFWorkspaceMode = "expanded" | "minimized";

export interface PDFWorkspaceDocument {
  id: string;
  title: string;
  fileName: string;
  status: PDFWorkspaceDocumentStatus;
  blob: Blob | null;
  progress: number;
  message: string;
  error: string | null;
  createdAt: number;
}

export interface PDFGenerationContext {
  signal: AbortSignal;
  updateProgress: (progress: number, message?: string) => void;
}

export interface PDFJobOptions {
  title?: string;
  fileName?: string;
  initialMessage?: string;
}

export interface PDFJobHandle {
  id: string;
  promise: Promise<Blob>;
}

type PDFGenerator = (context: PDFGenerationContext) => Promise<Blob>;

interface PDFWorkspaceContextValue {
  documents: PDFWorkspaceDocument[];
  activeDocumentId: string | null;
  activeDocument: PDFWorkspaceDocument | null;
  mode: PDFWorkspaceMode;
  runPDFJob: (options: PDFJobOptions, generator: PDFGenerator) => PDFJobHandle;
  addPDFBlob: (blob: Blob, options?: PDFJobOptions) => string;
  selectDocument: (id: string) => void;
  closeDocument: (id: string) => void;
  retryDocument: (id: string) => void;
  minimizeWorkspace: () => void;
  expandWorkspace: (documentId?: string) => void;
  closeAllDocuments: () => void;
}

const PDFWorkspaceContext = createContext<PDFWorkspaceContextValue | null>(null);

const waitForWorkspacePaint = () => new Promise<void>((resolve) => {
  if (typeof window === "undefined") {
    resolve();
    return;
  }

  window.requestAnimationFrame(() => {
    window.setTimeout(resolve, 0);
  });
});

const createDocumentId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const normaliseFileName = (fileName?: string) => {
  const value = fileName?.trim() || "document.pdf";
  return value.toLowerCase().endsWith(".pdf") ? value : `${value}.pdf`;
};

export function PDFWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [documents, setDocuments] = useState<PDFWorkspaceDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [mode, setMode] = useState<PDFWorkspaceMode>("expanded");
  const generatorsRef = useRef(new Map<string, PDFGenerator>());
  const controllersRef = useRef(new Map<string, AbortController>());

  const patchDocument = useCallback((
    id: string,
    patch: Partial<PDFWorkspaceDocument>,
  ) => {
    setDocuments((current) => current.map((document) => (
      document.id === id ? { ...document, ...patch } : document
    )));
  }, []);

  const executeJob = useCallback(async (id: string, generator: PDFGenerator) => {
    const controller = new AbortController();
    controllersRef.current.get(id)?.abort();
    controllersRef.current.set(id, controller);

    patchDocument(id, {
      status: "generating",
      blob: null,
      progress: 2,
      message: "Preparing PDF workspace…",
      error: null,
    });

    // Allow the loading workspace to paint before a renderer starts heavy work.
    await waitForWorkspacePaint();

    try {
      const blob = await generator({
        signal: controller.signal,
        updateProgress: (progress, message) => {
          if (controller.signal.aborted) return;
          patchDocument(id, {
            progress: Math.max(0, Math.min(99, Math.round(progress))),
            ...(message ? { message } : {}),
          });
        },
      });

      if (controller.signal.aborted) {
        throw new DOMException("PDF generation was cancelled", "AbortError");
      }
      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("The PDF generator returned an empty document.");
      }

      patchDocument(id, {
        status: "ready",
        blob,
        progress: 100,
        message: "PDF ready",
        error: null,
      });
      return blob;
    } catch (error) {
      if (controller.signal.aborted) throw error;
      const message = error instanceof Error ? error.message : "PDF generation failed.";
      patchDocument(id, {
        status: "error",
        blob: null,
        progress: 0,
        message: "Unable to create PDF",
        error: message,
      });
      throw error;
    } finally {
      if (controllersRef.current.get(id) === controller) {
        controllersRef.current.delete(id);
      }
    }
  }, [patchDocument]);

  const runPDFJob = useCallback((options: PDFJobOptions, generator: PDFGenerator): PDFJobHandle => {
    const id = createDocumentId();
    const fileName = normaliseFileName(options.fileName);
    const title = options.title?.trim() || fileName.replace(/\.pdf$/i, "");

    generatorsRef.current.set(id, generator);
    setDocuments((current) => [
      ...current,
      {
        id,
        title,
        fileName,
        status: "generating",
        blob: null,
        progress: 1,
        message: options.initialMessage || "Starting PDF creation…",
        error: null,
        createdAt: Date.now(),
      },
    ]);
    setActiveDocumentId(id);
    setMode("expanded");

    return { id, promise: executeJob(id, generator) };
  }, [executeJob]);

  const addPDFBlob = useCallback((blob: Blob, options: PDFJobOptions = {}) => {
    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error("Cannot open an empty PDF document.");
    }

    const id = createDocumentId();
    const fileName = normaliseFileName(options.fileName);
    const title = options.title?.trim() || fileName.replace(/\.pdf$/i, "");
    setDocuments((current) => [
      ...current,
      {
        id,
        title,
        fileName,
        status: "ready",
        blob,
        progress: 100,
        message: "PDF ready",
        error: null,
        createdAt: Date.now(),
      },
    ]);
    setActiveDocumentId(id);
    setMode("expanded");
    return id;
  }, []);

  const selectDocument = useCallback((id: string) => {
    setActiveDocumentId(id);
  }, []);

  const closeDocument = useCallback((id: string) => {
    controllersRef.current.get(id)?.abort();
    controllersRef.current.delete(id);
    generatorsRef.current.delete(id);
    setDocuments((current) => {
      const index = current.findIndex((document) => document.id === id);
      const next = current.filter((document) => document.id !== id);
      setActiveDocumentId((activeId) => {
        if (activeId !== id) return activeId;
        return next[Math.min(Math.max(index, 0), Math.max(next.length - 1, 0))]?.id ?? null;
      });
      return next;
    });
  }, []);

  const retryDocument = useCallback((id: string) => {
    const generator = generatorsRef.current.get(id);
    if (!generator) return;
    setActiveDocumentId(id);
    setMode("expanded");
    void executeJob(id, generator).catch(() => undefined);
  }, [executeJob]);

  const minimizeWorkspace = useCallback(() => setMode("minimized"), []);
  const expandWorkspace = useCallback((documentId?: string) => {
    if (documentId) setActiveDocumentId(documentId);
    setMode("expanded");
  }, []);

  const closeAllDocuments = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    generatorsRef.current.clear();
    setDocuments([]);
    setActiveDocumentId(null);
  }, []);

  const activeDocument = useMemo(
    () => documents.find((document) => document.id === activeDocumentId) ?? documents.at(-1) ?? null,
    [activeDocumentId, documents],
  );

  const value = useMemo<PDFWorkspaceContextValue>(() => ({
    documents,
    activeDocumentId: activeDocument?.id ?? null,
    activeDocument,
    mode,
    runPDFJob,
    addPDFBlob,
    selectDocument,
    closeDocument,
    retryDocument,
    minimizeWorkspace,
    expandWorkspace,
    closeAllDocuments,
  }), [
    activeDocument,
    closeAllDocuments,
    closeDocument,
    documents,
    expandWorkspace,
    minimizeWorkspace,
    mode,
    retryDocument,
    runPDFJob,
    selectDocument,
    addPDFBlob,
  ]);

  return (
    <PDFWorkspaceContext.Provider value={value}>
      {children}
    </PDFWorkspaceContext.Provider>
  );
}

export function usePDFWorkspace() {
  const context = useContext(PDFWorkspaceContext);
  if (!context) {
    throw new Error("usePDFWorkspace must be used inside PDFWorkspaceProvider.");
  }
  return context;
}

export function useOptionalPDFWorkspace() {
  return useContext(PDFWorkspaceContext);
}
