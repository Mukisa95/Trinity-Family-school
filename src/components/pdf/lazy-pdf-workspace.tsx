'use client';

import dynamic from 'next/dynamic';
import { Expand, Minus } from 'lucide-react';
import { ViewportPortal } from '@/components/common/viewport-portal';
import { usePDFWorkspace } from '@/lib/pdf/pdf-workspace-context';

function WorkspaceLoading() {
  const { activeDocument, mode, minimizeWorkspace, expandWorkspace, closeDocument } = usePDFWorkspace();
  if (!activeDocument) return null;
  return <ViewportPortal zIndex={90} className={mode === 'minimized' ? 'pdf-workspace-minimized-layer' : ''} lockScroll={mode === 'expanded'} followZoom={mode !== 'expanded'}><div aria-label={mode === 'minimized' ? 'Minimized PDF workspace' : undefined} className={mode === 'minimized'
    ? 'fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] right-3 z-[90] w-[min(380px,calc(100%-24px))] rounded-xl border bg-card p-4 text-card-foreground shadow-lg'
    : 'fixed inset-0 z-[90] flex items-center justify-center bg-background p-6 text-foreground'}>
    <div className="w-full max-w-md space-y-4">
      <div role="status" aria-live="polite"><p className="font-semibold">{activeDocument.title}</p><p className="text-sm text-muted-foreground">{activeDocument.message || 'Opening document workspace…'}</p></div>
      <progress max={100} value={activeDocument.progress} className="h-2 w-full accent-primary" aria-label="Document progress" />
      <div className="flex gap-4 text-sm">
        <button type="button" aria-label={mode === 'minimized' ? 'Restore PDF workspace' : 'Minimize PDF workspace'} className="grid h-11 w-11 place-items-center text-link" onClick={() => mode === 'minimized' ? expandWorkspace(activeDocument.id) : minimizeWorkspace()}>{mode === 'minimized' ? <Expand className="h-4 w-4" /> : <Minus className="h-4 w-4" />}</button>
        <button type="button" className="min-h-11 text-link" onClick={() => closeDocument(activeDocument.id)}>Close</button>
      </div>
    </div>
  </div></ViewportPortal>;
}

const Workspace = dynamic(() => import('./pdf-workspace').then(module => module.PDFWorkspace), { ssr: false, loading: WorkspaceLoading });

/** Keep document generation/state available; download the viewer only on first use. */
export function LazyPDFWorkspace() {
  const { documents } = usePDFWorkspace();
  return documents.length ? <Workspace /> : null;
}
