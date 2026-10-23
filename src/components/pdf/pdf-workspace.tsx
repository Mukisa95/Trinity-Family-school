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
      <div className="flex h-full min-h-0 items-center justify-center bg-slate-100 px-5 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-[0_24px_70px_-24px_rgba(15,23,42,0.32)] sm:p-8 dark:border-slate-700 dark:bg-slate-900">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-surface-50 ring-1 ring-brand-200 dark:bg-brand-surface-950/40 dark:ring-brand-800/60">
            <Loader2 className="h-8 w-8 animate-spin text-brand-ink-600 motion-reduce:animate-none dark:text-brand-ink-400" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold sm:text-xl">Creating {document.title}</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{document.message}</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Generation continues if this window is minimized.</p>
          <Progress value={document.progress} className="mt-6 h-2 bg-slate-100 dark:bg-slate-900" />
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">

            <span className="font-semibold text-brand-ink-700 dark:text-brand-ink-300">{document.progress}%</span>
          </div>
        </div>
      </div>
    );
  }

  if (document.status === "error") {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 px-5 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <div className="w-full max-w-lg rounded-[28px] border border-red-200 bg-white p-7 text-center shadow-xl shadow-slate-300/40 dark:shadow-black/30 dark:border-red-800/60 dark:bg-slate-900">
          <AlertCircle className="mx-auto h-10 w-10 text-red-600 dark:text-red-400" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">PDF creation failed</h2>
          <p className="mt-2 break-words text-sm text-red-700 dark:text-red-300">{document.error}</p>
        </div>
      </div>
    );
  }

  if (!document.blob) {
    return <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">Loading PDF preview...</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1"><PDFDocumentViewer
      blob={document.blob}
      fileName={document.fileName}
      title={document.title}
      fullscreenTargetRef={fullscreenTargetRef}
      onActionsChange={onViewerActionsChange}
    /></div></div>
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
    const creating = documents.filter(document => document.status === 'generating');
    const progress = creating.reduce((total, document) => total + document.progress, 0) / Math.max(creating.length, 1);
    return (
      <>
        {readyNoticeDocument && (
          <aside role="status" aria-live="polite" className="pdf-workspace-solid-surface fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 z-[95] flex w-[min(320px,calc(100vw-24px))] items-center gap-2 rounded-2xl border border-emerald-300 p-2 shadow-lg dark:border-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <button type="button" onClick={() => expandWorkspace(readyNoticeDocument.id)} aria-label="View PDF" className="min-h-11 min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              <span className="block text-xs font-semibold">Your PDF is ready</span><span className="block truncate text-xs text-slate-500 dark:text-slate-300">{readyNoticeDocument.title}</span>
            </button>
            <button type="button" onClick={() => setReadyNoticeId(null)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" aria-label={`Dismiss notification for ${readyNoticeDocument.title}`}><X className="h-4 w-4" /></button>
          </aside>
        )}
        <aside className="pdf-workspace-solid-surface fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] right-3 z-[90] w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200 shadow-lg dark:border-slate-700" aria-label="Minimized PDF workspace">
          <div className="flex items-center gap-1 px-2 py-1">
            <button type="button" onClick={() => expandWorkspace()} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label="Restore PDF workspace">
              {generatingCount ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand-ink-600 motion-reduce:animate-none dark:text-brand-ink-300" /> : <FileText className="h-5 w-5 shrink-0 text-brand-ink-600 dark:text-brand-ink-300" />}
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{activeDocument.title}</span><span className="block truncate text-[11px] text-slate-500 dark:text-slate-300">{generatingCount ? `${generatingCount} creating · ${Math.round(progress)}%` : activeDocument.status === 'error' ? 'Creation failed · Tap to retry' : 'PDF ready · Tap to open'}</span></span>
              <Expand className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            </button>
            {documents.length > 1 && <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" className="h-11 min-w-11 px-2" aria-label="Choose PDF document">{documents.length}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="z-[100] max-h-64 max-w-[calc(100vw-24px)] overflow-y-auto">{documents.map(document => <DropdownMenuItem key={document.id} onSelect={() => expandWorkspace(document.id)} className="min-h-11 max-w-72"><span className="truncate">{document.title}</span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>}
          </div>
          {generatingCount > 0 && <Progress value={progress} className="h-0.5 rounded-none" />}
          <div className="sr-only" aria-live="polite">{generatingCount ? `${generatingCount} PDF documents are being created.` : 'All PDF documents are ready.'}</div>
        </aside>
      </>
    );
  }

  return (
    <section
      ref={workspaceRef}
      className="fixed inset-0 z-[90] flex min-h-0 flex-col overflow-hidden bg-white shadow-[0_30px_100px_-25px_rgba(15,23,42,0.55)] sm:inset-4 sm:rounded-[28px] sm:border sm:border-slate-200 lg:inset-6 dark:bg-slate-900 dark:sm:border-slate-700"
      aria-label="PDF workspace"
    >
      <header className="flex min-h-14 items-center gap-1 border-b border-slate-200 bg-white px-2 text-slate-900 sm:min-h-16 sm:gap-2 sm:px-4 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-surface-50 text-brand-ink-700 ring-1 ring-brand-200 sm:h-11 sm:w-11 dark:bg-brand-surface-950/40 dark:text-brand-ink-300 dark:ring-brand-800/60">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold sm:text-base">PDF workspace</h1>

          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {viewerActions && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" className="h-11 w-11 cursor-pointer rounded-full border border-slate-200 text-slate-600 shadow-sm hover:bg-brand-surface-50 hover:text-brand-ink-700 sm:h-9 sm:w-9 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-surface-950/40 dark:hover:text-brand-ink-300" aria-label="Download PDF or image">
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[100] min-w-56 rounded-2xl border-slate-200 p-1.5 dark:border-slate-700">
                  <DropdownMenuItem onSelect={() => viewerActions.downloadPDF()} className="cursor-pointer rounded-xl px-3 py-2 text-sm">
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => viewerActions.downloadCurrentPageImage()} className="cursor-pointer rounded-xl px-3 py-2 text-sm">
                    Download current page as PNG
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button type="button" size="icon" variant="ghost" onClick={viewerActions.printPDF} className="hidden h-9 w-9 cursor-pointer rounded-full border border-slate-200 text-slate-600 shadow-sm hover:bg-brand-surface-50 hover:text-brand-ink-700 sm:inline-flex dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-surface-950/40 dark:hover:text-brand-ink-300" aria-label="Print PDF">
                <Printer className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={viewerActions.openExternally} className="hidden h-9 w-9 cursor-pointer rounded-full border border-slate-200 text-slate-600 shadow-sm hover:bg-brand-surface-50 hover:text-brand-ink-700 sm:inline-flex dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-surface-950/40 dark:hover:text-brand-ink-300" aria-label="Open PDF in browser">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={viewerActions.toggleFullscreen} className="hidden h-9 w-9 cursor-pointer rounded-full border border-slate-200 text-slate-600 shadow-sm hover:bg-brand-surface-50 hover:text-brand-ink-700 sm:inline-flex dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-surface-950/40 dark:hover:text-brand-ink-300" aria-label={viewerActions.isFullscreen ? "Exit full screen" : "View PDF workspace in full screen"}>
                {viewerActions.isFullscreen ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" className="h-11 w-11 cursor-pointer rounded-full border border-slate-200 text-slate-600 shadow-sm hover:bg-brand-surface-50 hover:text-brand-ink-700 sm:hidden dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-surface-950/40 dark:hover:text-brand-ink-300" aria-label="More PDF actions">
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[100] min-w-52 rounded-2xl border-slate-200 p-1.5 dark:border-slate-700">
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
          <Button type="button" size="icon" variant="ghost" onClick={minimizeWorkspace} className="h-11 w-11 cursor-pointer rounded-full border border-slate-200 text-slate-600 shadow-sm hover:bg-brand-surface-50 hover:text-brand-ink-700 sm:h-9 sm:w-9 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-surface-950/40 dark:hover:text-brand-ink-300" aria-label="Minimize PDF workspace">
            <Minimize2 className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={closeAllDocuments} className="h-11 w-11 cursor-pointer rounded-full border border-slate-200 text-slate-600 shadow-sm hover:bg-red-50 hover:text-red-700 sm:h-9 sm:w-9 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-300" aria-label="Close all PDF documents">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="flex min-h-12 shrink-0 items-stretch gap-1 overflow-x-auto border-b border-slate-200 bg-slate-100 px-1.5 pt-1.5 sm:px-2 dark:border-slate-700 dark:bg-slate-900" role="tablist" aria-label="Open PDF documents">
        {documents.map((document) => (
          <div
            key={document.id}
            className={`group flex min-w-[136px] max-w-[200px] items-center rounded-t-2xl border border-b-0 px-1 transition-colors sm:min-w-[170px] sm:max-w-[250px] ${
              document.id === activeDocumentId
                ? "border-slate-200 bg-white text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                : "border-transparent bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`}
          >
            <button
              id={`pdf-tab-${document.id}`}
              type="button"
              role="tab"
              aria-selected={document.id === activeDocumentId}
              aria-controls="pdf-workspace-panel"
              onClick={() => selectDocument(document.id)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2 py-2.5 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
            >
              {document.status === "generating" ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-500 motion-reduce:animate-none dark:text-amber-400" aria-hidden="true" />
              ) : document.status === "error" ? (
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500 dark:text-red-400" aria-hidden="true" />
              ) : (
                <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
              )}
              <span className="truncate">{document.title}</span>
            </button>
            {document.status === "error" && (
            <button type="button" onClick={() => retryDocument(document.id)} className="flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-full text-slate-500 hover:bg-brand-surface-50 hover:text-brand-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:h-9 sm:w-9 dark:text-slate-400 dark:hover:bg-brand-surface-950/40 dark:hover:text-brand-ink-300" aria-label={`Retry ${document.title}`}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            <button type="button" onClick={() => closeDocument(document.id)} className="flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 sm:h-9 sm:w-9 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-300" aria-label={`Close ${document.title}`}>
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
