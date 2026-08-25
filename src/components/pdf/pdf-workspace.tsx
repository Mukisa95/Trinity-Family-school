"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Expand,
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Printer,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  PDFDocumentViewer,
  type PDFDocumentViewerActions,
} from "@/components/pdf/pdf-document-viewer";
import {
  PDFWorkspaceDocument,
  usePDFWorkspace,
} from "@/lib/pdf/pdf-workspace-context";

function PDFDocumentSurface({
  document,
  fullscreenTargetRef,
  onViewerActionsChange,
}: {
  document: PDFWorkspaceDocument;
  fullscreenTargetRef: React.RefObject<HTMLElement | null>;
  onViewerActionsChange: (actions: PDFDocumentViewerActions | null) => void;
}) {
  if (document.status === "generating") {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-slate-100 px-5 text-slate-900">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-[0_24px_70px_-24px_rgba(15,23,42,0.32)] sm:p-8">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 ring-1 ring-blue-200">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 motion-reduce:animate-none" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold sm:text-xl">Creating {document.title}</h2>
          <p className="mt-2 text-sm text-slate-600">{document.message}</p>
          <Progress value={document.progress} className="mt-6 h-2 bg-slate-100" />
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Generation continues if this window is minimized</span>
            <span className="font-semibold text-blue-700">{document.progress}%</span>
          </div>
        </div>
      </div>
    );
  }

  if (document.status === "error") {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 px-5 text-slate-900">
        <div className="w-full max-w-lg rounded-[28px] border border-red-200 bg-white p-7 text-center shadow-xl shadow-slate-300/40">
          <AlertCircle className="mx-auto h-10 w-10 text-red-600" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">PDF creation failed</h2>
          <p className="mt-2 break-words text-sm text-red-700">{document.error}</p>
        </div>
      </div>
    );
  }

  if (!document.blob) {
    return <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-600">Loading PDF preview…</div>;
  }

  return (
    <PDFDocumentViewer
      blob={document.blob}
      fileName={document.fileName}
      title={document.title}
      fullscreenTargetRef={fullscreenTargetRef}
      onActionsChange={onViewerActionsChange}
    />
  );
}

export function PDFWorkspace() {
  const {
    documents,
    activeDocument,
    activeDocumentId,
    mode,
    selectDocument,
    closeDocument,
    retryDocument,
    minimizeWorkspace,
    expandWorkspace,
    closeAllDocuments,
  } = usePDFWorkspace();
  const workspaceRef = useRef<HTMLElement | null>(null);
  const previousStatusesRef = useRef(new Map<string, PDFWorkspaceDocument["status"]>());
  const [readyNoticeId, setReadyNoticeId] = useState<string | null>(null);
  const [viewerActions, setViewerActions] = useState<PDFDocumentViewerActions | null>(null);

  const generatingCount = useMemo(
    () => documents.filter((document) => document.status === "generating").length,
    [documents],
  );

  const readyNoticeDocument = useMemo(
    () => documents.find((document) => document.id === readyNoticeId) ?? null,
    [documents, readyNoticeId],
  );

  useEffect(() => {
    const previousStatuses = previousStatusesRef.current;
    const newlyCompleted = documents.filter((document) => (
      document.status === "ready" && previousStatuses.get(document.id) === "generating"
    ));

    previousStatusesRef.current = new Map(
      documents.map((document) => [document.id, document.status]),
    );

    if (mode === "minimized" && newlyCompleted.length > 0) {
      setReadyNoticeId(newlyCompleted.at(-1)?.id ?? null);
    }
  }, [documents, mode]);

  useEffect(() => {
    if (!readyNoticeId) return;
    const timeoutId = window.setTimeout(() => setReadyNoticeId(null), 10000);
    return () => window.clearTimeout(timeoutId);
  }, [readyNoticeId]);

  useEffect(() => {
    if (mode === "expanded") setReadyNoticeId(null);
  }, [mode]);

  useEffect(() => {
    setViewerActions(null);
  }, [activeDocumentId]);

  if (documents.length === 0 || !activeDocument) return null;

  if (mode === "minimized") {
    return (
      <>
        {readyNoticeDocument && (
          <aside
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="fixed bottom-[11.75rem] right-3 z-[91] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-[24px] border border-emerald-200 bg-white shadow-[0_24px_70px_-20px_rgba(5,150,105,0.45)] motion-safe:animate-in motion-safe:slide-in-from-bottom-3 motion-safe:fade-in"
          >
            <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-500" />
            <div className="flex items-start gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-950">Your PDF is ready</p>
                <p className="mt-1 truncate text-xs text-slate-600">{readyNoticeDocument.title}</p>
                <button
                  type="button"
                  onClick={() => expandWorkspace(readyNoticeDocument.id)}
                  className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  View PDF
                </button>
              </div>
              <button
                type="button"
                onClick={() => setReadyNoticeId(null)}
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label={`Dismiss notification for ${readyNoticeDocument.title}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </aside>
        )}

        <aside
          className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] right-3 z-[90] w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-[24px] border border-slate-200 bg-white/95 shadow-[0_22px_70px_-20px_rgba(15,23,42,0.42)] backdrop-blur-xl"
          aria-label="Minimized PDF workspace"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
            <button
              type="button"
              onClick={() => expandWorkspace()}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <FileText className="h-4 w-4" aria-hidden="true" />
                {generatingCount > 0 && (
                  <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-400" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">PDF workspace</span>
                <span className="block truncate text-xs text-slate-500">
                  {generatingCount > 0 ? `${generatingCount} creating in background` : `${documents.length} document${documents.length === 1 ? "" : "s"} ready`}
                </span>
              </span>
            </button>
            <Button type="button" size="icon" variant="ghost" onClick={() => expandWorkspace()} aria-label="Restore PDF workspace" className="h-9 w-9">
              <Expand className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="flex max-h-28 gap-2 overflow-x-auto p-2" role="tablist" aria-label="Open PDF documents">
            {documents.map((document) => (
              <button
                key={document.id}
                type="button"
                role="tab"
                aria-selected={document.id === activeDocumentId}
                onClick={() => expandWorkspace(document.id)}
                className={`min-w-[150px] rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  document.id === activeDocumentId
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  {document.status === "generating" ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-500 motion-reduce:animate-none" />
                  ) : document.status === "error" ? (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  )}
                  <span className="truncate text-xs font-medium text-slate-800">{document.title}</span>
                </span>
                {document.status === "generating" && <Progress value={document.progress} className="mt-2 h-1" />}
              </button>
            ))}
          </div>
          <div className="sr-only" aria-live="polite">
            {generatingCount > 0 ? `${generatingCount} PDF documents are being created.` : "All PDF documents are ready."}
          </div>
        </aside>
      </>
    );
  }

  return (
    <section
      ref={workspaceRef}
      className="fixed inset-0 z-[90] flex min-h-0 flex-col overflow-hidden bg-white shadow-[0_30px_100px_-25px_rgba(15,23,42,0.55)] sm:inset-4 sm:rounded-[28px] sm:border sm:border-slate-200 lg:inset-6"
      aria-label="PDF workspace"
    >
      <header className="flex min-h-14 items-center gap-1 border-b border-slate-200 bg-white px-2 text-slate-900 sm:min-h-16 sm:gap-2 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200 sm:h-11 sm:w-11">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold sm:text-base">PDF workspace</h1>
            <p className="hidden text-xs text-slate-500 sm:block">Create, compare and keep several documents open</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {viewerActions && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" className="h-11 w-11 cursor-pointer rounded-full border border-slate-200 text-slate-600 shadow-sm hover:bg-blue-50 hover:text-blue-700 sm:h-9 sm:w-9" aria-label="Download PDF or image">
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56 rounded-2xl border-slate-200 p-1.5">
                  <DropdownMenuItem onSelect={() => viewerActions.downloadPDF()} className="cursor-pointer rounded-xl px-3 py-2 text-sm">
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => viewerActions.downloadCurrentPageImage()} className="cursor-pointer rounded-xl px-3 py-2 text-sm">
                    Download current page as PNG
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button type="button" size="icon" variant="ghost" onClick={viewerActions.printPDF} className="hidden h-9 w-9 cursor-pointer rounded-full border border-slate-200 text-slate-600 shadow-sm hover:bg-blue-50 hover:text-blue-700 sm:inline-flex" aria-label="Print PDF">
                <Printer className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={viewerActions.openExternally} className="hidden h-9 w-9 cursor-pointer rounded-full border border-slate-200 text-slate-600 shadow-sm hover:bg-blue-50 hover:text-blue-700 sm:inline-flex" aria-label="Open PDF in browser">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={viewerActions.toggleFullscreen} className="hidden h-9 w-9 cursor-pointer rounded-full border border-slate-200 text-slate-600 shadow-sm hover:bg-blue-50 hover:text-blue-700 sm:inline-flex" aria-label={viewerActions.isFullscreen ? "Exit full screen" : "View PDF workspace in full screen"}>
                {viewerActions.isFullscreen ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" className="h-11 w-11 cursor-pointer rounded-full border border-slate-200 text-slate-600 shadow-sm hover:bg-blue-50 hover:text-blue-700 sm:hidden" aria-label="More PDF actions">
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52 rounded-2xl border-slate-200 p-1.5">
                  <DropdownMenuItem onSelect={() => viewerActions.printPDF()} className="cursor-pointer rounded-xl px-3 py-2.5 text-sm">
                    <Printer className="mr-2 h-4 w-4" aria-hidden="true" /> Print PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => viewerActions.openExternally()} className="cursor-pointer rounded-xl px-3 py-2.5 text-sm">
                    <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" /> Open in browser
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => viewerActions.toggleFullscreen()} className="cursor-pointer rounded-xl px-3 py-2.5 text-sm">
                    {viewerActions.isFullscreen ? <Minimize2 className="mr-2 h-4 w-4" aria-hidden="true" /> : <Maximize2 className="mr-2 h-4 w-4" aria-hidden="true" />} {viewerActions.isFullscreen ? "Exit full screen" : "Full screen"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          <Button type="button" size="icon" variant="ghost" onClick={minimizeWorkspace} className="h-11 w-11 cursor-pointer rounded-full border border-slate-200 text-slate-600 shadow-sm hover:bg-blue-50 hover:text-blue-700 sm:h-9 sm:w-9" aria-label="Minimize PDF workspace">
            <Minimize2 className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={closeAllDocuments} className="h-11 w-11 cursor-pointer rounded-full border border-slate-200 text-slate-600 shadow-sm hover:bg-red-50 hover:text-red-700 sm:h-9 sm:w-9" aria-label="Close all PDF documents">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="flex min-h-12 shrink-0 items-stretch gap-1 overflow-x-auto border-b border-slate-200 bg-slate-100 px-1.5 pt-1.5 sm:px-2" role="tablist" aria-label="Open PDF documents">
        {documents.map((document) => (
          <div
            key={document.id}
            className={`group flex min-w-[136px] max-w-[200px] items-center rounded-t-2xl border border-b-0 px-1 transition-colors sm:min-w-[170px] sm:max-w-[250px] ${
              document.id === activeDocumentId
                ? "border-slate-200 bg-white text-slate-950"
                : "border-transparent bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
            }`}
          >
            <button
              id={`pdf-tab-${document.id}`}
              type="button"
              role="tab"
              aria-selected={document.id === activeDocumentId}
              aria-controls="pdf-workspace-panel"
              onClick={() => selectDocument(document.id)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2 py-2.5 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
            >
              {document.status === "generating" ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-500 motion-reduce:animate-none" aria-hidden="true" />
              ) : document.status === "error" ? (
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden="true" />
              ) : (
                <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
              )}
              <span className="truncate">{document.title}</span>
            </button>
            {document.status === "error" && (
            <button type="button" onClick={() => retryDocument(document.id)} className="flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-full text-slate-500 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:h-9 sm:w-9" aria-label={`Retry ${document.title}`}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            <button type="button" onClick={() => closeDocument(document.id)} className="flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 sm:h-9 sm:w-9" aria-label={`Close ${document.title}`}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <div id="pdf-workspace-panel" role="tabpanel" className="min-h-0 flex-1">
        <PDFDocumentSurface
          key={activeDocument.id}
          document={activeDocument}
          fullscreenTargetRef={workspaceRef}
          onViewerActionsChange={setViewerActions}
        />
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {activeDocument.status === "generating"
          ? `${activeDocument.title}: ${activeDocument.message}, ${activeDocument.progress} percent.`
          : activeDocument.status === "ready"
            ? `${activeDocument.title} is ready.`
            : `${activeDocument.title} failed to generate.`}
      </div>
    </section>
  );
}
