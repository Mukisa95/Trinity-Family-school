"use client";

import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Expand, Loader2, Minus, WandSparkles } from 'lucide-react';
import { usePhotoStudioWorkspace } from '@/lib/contexts/photo-studio-workspace-context';
import { usePDFWorkspace } from '@/lib/pdf/pdf-workspace-context';

const Studio = lazy(() => import('./custom-photo-studio').then(module => ({ default: module.CustomPhotoStudio })));

export function LazyPhotoStudioWorkspace() {
  const { session, suspended, minimizeStudio, restoreStudio, closeStudio, setStudioTitle } = usePhotoStudioWorkspace();
  const { documents, mode, minimizeWorkspace } = usePDFWorkspace();
  const previewOpen = documents.length > 0 && mode === 'expanded';
  const [mounted, setMounted] = useState(false);
  const [pdfDockHeight, setPdfDockHeight] = useState(0);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!session?.minimized || suspended || mode !== 'minimized' || !documents.length) { setPdfDockHeight(0); return; }
    // Keep both workspaces reachable on narrow screens, including while the
    // print viewer's lazy chunk is still loading.
    const resize = new ResizeObserver(entries => setPdfDockHeight(entries[0]?.target.getBoundingClientRect().height || 0));
    const mutations = new MutationObserver(attach);
    let observed: Element | null = null;
    function attach() {
      const dock = document.querySelector('[aria-label="Minimized PDF workspace"]');
      if (dock === observed) return;
      resize.disconnect(); observed = dock;
      setPdfDockHeight(dock?.getBoundingClientRect().height || 0);
      if (dock) resize.observe(dock);
    }
    attach(); mutations.observe(document.body, { childList: true, subtree: true });
    return () => { resize.disconnect(); mutations.disconnect(); };
  }, [session?.minimized, suspended, mode, documents.length]);
  if (!session || !mounted) return null;
  // Release modal focus and pointer locks while the PDF preview owns the screen.
  const minimized = suspended || session.minimized || previewOpen;
  const restore = () => { if (previewOpen) minimizeWorkspace(); restoreStudio(); };
  return <>
    <Suspense fallback={!minimized ? createPortal(<section role="status" aria-label="Opening Photo Studio" className="fixed inset-0 z-50 grid place-content-center gap-4 bg-background p-6 text-center text-foreground"><Loader2 className="mx-auto h-8 w-8 animate-spin" /><p>Opening Photo Studio…</p><button aria-label="Minimize Photo Studio" className="mx-auto grid h-11 w-11 place-items-center rounded-md border" onClick={minimizeStudio}><Minus className="h-5 w-5" /></button></section>, document.body) : null}>
      <Studio {...session.data} minimized={minimized} onMinimize={minimizeStudio} onClose={closeStudio} onTitleChange={setStudioTitle} />
    </Suspense>
    {!suspended && (session.minimized || previewOpen) && createPortal(<button type="button" aria-label="Restore Photo Studio" onClick={restore} style={{ '--studio-pdf-dock-height': `${pdfDockHeight}px` } as CSSProperties} className="fixed bottom-[calc(var(--studio-pdf-dock-height,0px)+1.5rem+env(safe-area-inset-bottom))] left-3 z-[60] flex min-h-12 max-w-[calc(100vw-24px)] items-center gap-3 rounded-2xl border border-violet-200 bg-white px-4 py-2 text-left text-slate-900 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 md:bottom-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-violet-800 dark:bg-slate-900 dark:text-white">
      <WandSparkles className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" /><span className="min-w-0"><span className="block text-xs font-bold">Photo Studio</span><span className="block max-w-48 truncate text-xs text-slate-500 dark:text-slate-400">{session.title}</span></span><Expand className="h-4 w-4 shrink-0" />
    </button>, document.body)}
  </>;
}
