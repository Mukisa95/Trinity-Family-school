"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  PanelLeft,
  Scan,
  Search,
  StretchHorizontal,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { cn } from "@/lib/utils";

type FitMode = "custom" | "width" | "page";

interface PDFDocumentViewerProps {
  blob: Blob;
  fileName: string;
  title: string;
  fullscreenTargetRef?: React.RefObject<HTMLElement | null>;
  onActionsChange?: (actions: PDFDocumentViewerActions | null) => void;
}

interface SearchHit {
  id: number;
  pageNumber: number;
  bounds: { left: number; top: number; width: number; height: number };
}

export interface PDFDocumentViewerActions {
  downloadPDF: () => void;
  downloadCurrentPageImage: () => void;
  printPDF: () => void;
  openExternally: () => void;
  toggleFullscreen: () => void;
  isFullscreen: boolean;
}

interface PageSize {
  width: number;
  height: number;
}

const MIN_ZOOM = 25;
const MAX_ZOOM = 300;
const ZOOM_STEP = 10;
const MIN_FIT_SCALE = 0.05;
const VIEWPORT_PADDING = 24;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const roundControlClass = cn(
  "inline-flex h-11 w-11 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full sm:h-9 sm:w-9",
  "border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors duration-150",
  "hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-40",
);

function useElementSize<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => setSize({
      width: element.clientWidth,
      height: element.clientHeight,
    });
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [active]);

  return { ref, size };
}

function PDFPageCanvas({
  pdf,
  pageNumber,
  scale,
  rotation,
  className,
  onPageSize,
  searchHits = [],
  activeSearchHitId = -1,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation: number;
  className?: string;
  onPageSize?: (size: PageSize) => void;
  searchHits?: SearchHit[];
  activeSearchHitId?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    const renderPage = async () => {
      setRendering(true);
      setRenderError(null);
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const effectiveRotation = (page.rotate + rotation) % 360;
        const baseViewport = page.getViewport({ scale: 1, rotation: effectiveRotation });
        onPageSize?.({ width: baseViewport.width, height: baseViewport.height });

        const viewport = page.getViewport({ scale, rotation: effectiveRotation });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Unable to prepare the PDF canvas.");

        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
        canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
          background: "#ffffff",
        });
        await renderTask.promise;
        if (!cancelled) setRendering(false);
      } catch (error) {
        if (cancelled || (error instanceof Error && error.name === "RenderingCancelledException")) return;
        setRenderError(error instanceof Error ? error.message : "Unable to render this page.");
        setRendering(false);
      }
    };

    void renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [onPageSize, pageNumber, pdf, rotation, scale]);

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <canvas ref={canvasRef} className="block bg-white shadow-[0_18px_55px_-22px_rgba(15,23,42,0.45)]" />
      {searchHits.length > 0 && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {searchHits.map((hit) => (
            <span
              key={hit.id}
              className={cn(
                "absolute rounded-sm bg-amber-300/55 ring-1 ring-amber-500/40",
                hit.id === activeSearchHitId && "bg-amber-400/75 ring-2 ring-amber-600",
              )}
              style={{
                left: hit.bounds.left * scale,
                top: hit.bounds.top * scale,
                width: Math.max(3, hit.bounds.width * scale),
                height: Math.max(3, hit.bounds.height * scale),
              }}
            />
          ))}
        </div>
      )}
      {rendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/75 text-blue-700 backdrop-blur-[1px]">
          <Loader2 className="h-7 w-7 animate-spin motion-reduce:animate-none" aria-label="Rendering PDF page" />
        </div>
      )}
      {renderError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white p-6 text-center text-sm text-red-700" role="alert">
          {renderError}
        </div>
      )}
    </div>
  );
}

function ContinuousPDFPage({
  pdf,
  pageNumber,
  scale,
  rotation,
  pageSize,
  fitMode,
  viewportElement,
  viewportHeight,
  registerPageElement,
  onPageSize,
  searchHits,
  activeSearchHitId,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation: number;
  pageSize: PageSize;
  fitMode: FitMode;
  viewportElement: HTMLDivElement | null;
  viewportHeight: number;
  registerPageElement: (pageNumber: number, element: HTMLElement | null) => void;
  onPageSize: (pageNumber: number, size: PageSize) => void;
  searchHits: SearchHit[];
  activeSearchHitId: number;
}) {
  const hostRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);

  const setHostRef = useCallback((element: HTMLElement | null) => {
    hostRef.current = element;
    registerPageElement(pageNumber, element);
  }, [pageNumber, registerPageElement]);

  const handlePageSize = useCallback((size: PageSize) => {
    onPageSize(pageNumber, size);
  }, [onPageSize, pageNumber]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !viewportElement) return;

    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
    }, {
      root: viewportElement,
      rootMargin: "1200px 0px",
      threshold: 0,
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [viewportElement]);

  const renderedWidth = Math.max(1, Math.round(pageSize.width * scale));
  const renderedHeight = Math.max(1, Math.round(pageSize.height * scale));
  const pageSlotHeight = fitMode === "page"
    ? Math.max(renderedHeight, viewportHeight - VIEWPORT_PADDING * 2)
    : renderedHeight;

  return (
    <section
      ref={setHostRef}
      data-pdf-page={pageNumber}
      aria-label={`Page ${pageNumber}`}
      className="flex shrink-0 items-center justify-center scroll-mt-6"
      style={{ minHeight: Math.max(1, pageSlotHeight), width: renderedWidth }}
    >
      <div
        className="relative flex items-center justify-center bg-white shadow-[0_18px_55px_-22px_rgba(15,23,42,0.45)]"
        style={{ width: renderedWidth, height: renderedHeight }}
      >
        {visible ? (
          <PDFPageCanvas
            pdf={pdf}
            pageNumber={pageNumber}
            scale={scale}
            rotation={rotation}
            className="h-full w-full"
            onPageSize={handlePageSize}
            searchHits={searchHits}
            activeSearchHitId={activeSearchHitId}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400" aria-label={`Page ${pageNumber} waiting to render`}>
            <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" />
          </div>
        )}
      </div>
    </section>
  );
}

function PDFThumbnail({
  pdf,
  pageNumber,
  selected,
  onSelect,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const hostRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 3);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || visible) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "160px" });
    observer.observe(host);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (selected) hostRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const natural = page.getViewport({ scale: 1 });
        const scale = 116 / natural.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { alpha: false });
        if (!canvas || !context) return;
        const outputScale = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
          background: "#ffffff",
        });
        await renderTask.promise;
      } catch (error) {
        if (!cancelled) console.warn(`Unable to render PDF thumbnail ${pageNumber}`, error);
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pageNumber, pdf, visible]);

  return (
    <button
      ref={hostRef}
      type="button"
      onClick={onSelect}
      aria-label={`Go to page ${pageNumber}`}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "mx-auto flex w-[148px] cursor-pointer flex-col items-center rounded-2xl border p-3 text-slate-600 transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        selected
          ? "border-blue-400 bg-blue-50 text-blue-800 shadow-sm"
          : "border-transparent bg-transparent hover:border-slate-200 hover:bg-white",
      )}
    >
      <span className="flex min-h-[148px] w-[120px] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {visible ? <canvas ref={canvasRef} className="block max-w-full" /> : <Loader2 className="h-5 w-5 animate-spin text-slate-400 motion-reduce:animate-none" />}
      </span>
      <span className="mt-2 text-xs font-semibold">Page {pageNumber}</span>
    </button>
  );
}

export function PDFDocumentViewer({
  blob,
  fileName,
  title,
  fullscreenTargetRef,
  onActionsChange,
}: PDFDocumentViewerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(100);
  const [fitMode, setFitMode] = useState<FitMode>("custom");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pageSizes, setPageSizes] = useState<Record<number, PageSize>>({
    1: { width: 595, height: 842 },
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [activeSearchHit, setActiveSearchHit] = useState(-1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const printFrameRef = useRef<HTMLIFrameElement>(null);
  const viewerRootRef = useRef<HTMLDivElement>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const searchRunRef = useRef(0);
  const pageNumberRef = useRef(1);
  const pageElementsRef = useRef(new Map<number, HTMLElement>());
  const { ref: viewportRef, size: viewportSize } = useElementSize<HTMLDivElement>(Boolean(pdf));
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const nextObjectUrl = URL.createObjectURL(blob);
    setObjectUrl(nextObjectUrl);
    return () => URL.revokeObjectURL(nextObjectUrl);
  }, [blob]);

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setSidebarOpen(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setPdf(null);
    setPageNumber(1);
    setPageInput("1");
    pageNumberRef.current = 1;
    setZoom(100);
    setFitMode("custom");
    setPageSizes({ 1: { width: 595, height: 842 } });
    pageElementsRef.current.clear();

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url,
          ).toString();
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (cancelled) return;
        const loadingTask = pdfjs.getDocument({ data: bytes });
        loadingTaskRef.current = loadingTask;
        const documentProxy = await loadingTask.promise;
        if (cancelled) {
          await loadingTask.destroy();
          return;
        }
        const firstPage = await documentProxy.getPage(1);
        const firstViewport = firstPage.getViewport({ scale: 1 });
        setPageSizes({
          1: { width: firstViewport.width, height: firstViewport.height },
        });
        setPdf(documentProxy);
        setLoading(false);
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load this PDF.");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      const task = loadingTaskRef.current;
      loadingTaskRef.current = null;
      if (task) void task.destroy();
    };
  }, [blob]);

  const totalPages = pdf?.numPages ?? 0;

  const updateCurrentPage = useCallback((nextPage: number) => {
    if (!totalPages) return;
    const safePage = clamp(Math.round(nextPage), 1, totalPages);
    if (pageNumberRef.current === safePage) return;
    pageNumberRef.current = safePage;
    setPageNumber(safePage);
    setPageInput(String(safePage));
  }, [totalPages]);

  const registerPageElement = useCallback((candidatePage: number, element: HTMLElement | null) => {
    if (element) pageElementsRef.current.set(candidatePage, element);
    else pageElementsRef.current.delete(candidatePage);
  }, []);

  const updatePageSize = useCallback((candidatePage: number, size: PageSize) => {
    setPageSizes((current) => {
      const existing = current[candidatePage];
      if (existing && Math.abs(existing.width - size.width) < 0.5 && Math.abs(existing.height - size.height) < 0.5) {
        return current;
      }
      return { ...current, [candidatePage]: size };
    });
  }, []);

  const navigateToPage = useCallback((nextPage: number) => {
    if (!totalPages) return;
    const safePage = clamp(Math.round(nextPage), 1, totalPages);
    pageNumberRef.current = safePage;
    setPageNumber(safePage);
    setPageInput(String(safePage));

    window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      const pageElement = pageElementsRef.current.get(safePage);
      if (!viewport || !pageElement) return;
      viewport.scrollTo({
        top: Math.max(0, pageElement.offsetTop - VIEWPORT_PADDING),
        behavior: "auto",
      });
    });
  }, [totalPages, viewportRef]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;

    void (async () => {
      const nextSizes: Record<number, PageSize> = {};
      for (let candidatePage = 1; candidatePage <= pdf.numPages; candidatePage += 1) {
        const page = await pdf.getPage(candidatePage);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1, rotation: page.rotate });
        nextSizes[candidatePage] = { width: viewport.width, height: viewport.height };
      }
      if (!cancelled) setPageSizes(nextSizes);
    })();

    return () => {
      cancelled = true;
    };
  }, [pdf]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !pdf) return;
    let animationFrame = 0;

    const synchronizePageFromScroll = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const viewportRect = viewport.getBoundingClientRect();
        let visiblePage = pageNumberRef.current;
        let bestVisiblePixels = -1;
        let bestDistance = Number.POSITIVE_INFINITY;

        pageElementsRef.current.forEach((element, candidatePage) => {
          const pageRect = element.getBoundingClientRect();
          const visiblePixels = Math.max(
            0,
            Math.min(pageRect.bottom, viewportRect.bottom) - Math.max(pageRect.top, viewportRect.top),
          );
          const distance = Math.abs(
            (pageRect.top + pageRect.bottom) / 2 - (viewportRect.top + viewportRect.height * 0.4),
          );
          if (visiblePixels > bestVisiblePixels || (visiblePixels === bestVisiblePixels && distance < bestDistance)) {
            visiblePage = candidatePage;
            bestVisiblePixels = visiblePixels;
            bestDistance = distance;
          }
        });

        updateCurrentPage(visiblePage);
      });
    };

    viewport.addEventListener("scroll", synchronizePageFromScroll, { passive: true });
    synchronizePageFromScroll();
    return () => {
      viewport.removeEventListener("scroll", synchronizePageFromScroll);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [pdf, updateCurrentPage, viewportRef, viewportSize.height, viewportSize.width]);

  const activePageSize = pageSizes[pageNumber] ?? pageSizes[1] ?? { width: 595, height: 842 };
  const getScaleForPage = useCallback((size: PageSize) => {
    if (fitMode === "custom") return clamp(zoom, MIN_ZOOM, MAX_ZOOM) / 100;
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return 1;
    const availableWidth = Math.max(viewportSize.width - VIEWPORT_PADDING * 2, 1);
    const availableHeight = Math.max(viewportSize.height - VIEWPORT_PADDING * 2, 1);
    if (fitMode === "width") return clamp(availableWidth / size.width, MIN_FIT_SCALE, 3);
    return clamp(
      Math.min(availableWidth / size.width, availableHeight / size.height),
      MIN_FIT_SCALE,
      3,
    );
  }, [fitMode, viewportSize.height, viewportSize.width, zoom]);

  const computedScale = useMemo(
    () => getScaleForPage(activePageSize),
    [activePageSize, getScaleForPage],
  );

  const displayedZoom = Math.round(computedScale * 100);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !pdf) return;
    const animationFrame = window.requestAnimationFrame(() => {
      const pageElement = pageElementsRef.current.get(pageNumberRef.current);
      if (!pageElement) return;
      viewport.scrollTop = Math.max(0, pageElement.offsetTop - VIEWPORT_PADDING);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [fitMode, pdf, viewportRef, viewportSize.height, viewportSize.width, zoom]);

  const changeZoom = useCallback((direction: 1 | -1) => {
    setZoom(clamp(displayedZoom + direction * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM));
    setFitMode("custom");
  }, [displayedZoom]);

  const runSearch = useCallback(async (query: string) => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const runId = ++searchRunRef.current;
    if (!pdf || normalizedQuery.length < 2) {
      setSearchHits([]);
      setActiveSearchHit(-1);
      setSearching(false);
      return;
    }

    setSearching(true);
    const nextHits: SearchHit[] = [];
    try {
      for (let candidatePage = 1; candidatePage <= pdf.numPages; candidatePage += 1) {
        const page: PDFPageProxy = await pdf.getPage(candidatePage);
        const textContent = await page.getTextContent();
        if (runId !== searchRunRef.current) return;
        const viewport = page.getViewport({ scale: 1, rotation: page.rotate });
        for (const item of textContent.items) {
          if (!("str" in item) || !item.str) continue;
          const source = item.str.toLocaleLowerCase();
          let offset = 0;
          while (offset < source.length) {
            const matchStart = source.indexOf(normalizedQuery, offset);
            if (matchStart < 0) break;
            const matchEnd = matchStart + normalizedQuery.length;
            const [scaleX, , , scaleY, x, y] = item.transform;
            const itemWidth = Math.max(item.width || Math.abs(scaleX), 1);
            const itemHeight = Math.max(item.height || Math.abs(scaleY), 1);
            const startX = x + itemWidth * (matchStart / source.length);
            const endX = x + itemWidth * (matchEnd / source.length);
            const [leftA, topA] = viewport.convertToViewportPoint(startX, y);
            const [leftB, topB] = viewport.convertToViewportPoint(endX, y + itemHeight);
            nextHits.push({
              id: nextHits.length,
              pageNumber: candidatePage,
              bounds: {
                left: Math.min(leftA, leftB),
                top: Math.min(topA, topB),
                width: Math.abs(leftB - leftA),
                height: Math.abs(topB - topA),
              },
            });
            offset = matchEnd;
          }
        }
      }

      if (runId !== searchRunRef.current) return;
      setSearchHits(nextHits);
      const firstHit = nextHits[0];
      setActiveSearchHit(firstHit ? 0 : -1);
      if (firstHit) navigateToPage(firstHit.pageNumber);
    } finally {
      if (runId === searchRunRef.current) setSearching(false);
    }
  }, [navigateToPage, pdf]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void runSearch(searchQuery), 280);
    return () => window.clearTimeout(timeoutId);
  }, [runSearch, searchQuery]);

  const navigateToSearchHit = useCallback((hit: SearchHit) => {
    navigateToPage(hit.pageNumber);
    window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      const pageElement = pageElementsRef.current.get(hit.pageNumber);
      const size = pageSizes[hit.pageNumber] ?? pageSizes[1] ?? activePageSize;
      if (!viewport || !pageElement) return;
      const scale = getScaleForPage(size);
      viewport.scrollTo({
        top: Math.max(0, pageElement.offsetTop + hit.bounds.top * scale - viewport.clientHeight * 0.28),
        behavior: "auto",
      });
    });
  }, [activePageSize, getScaleForPage, navigateToPage, pageSizes, viewportRef]);

  const moveSearchHit = useCallback((direction: 1 | -1) => {
    if (!searchHits.length) return;
    const nextIndex = (activeSearchHit + direction + searchHits.length) % searchHits.length;
    setActiveSearchHit(nextIndex);
    navigateToSearchHit(searchHits[nextIndex]);
  }, [activeSearchHit, navigateToSearchHit, searchHits]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLocaleLowerCase() === "f") {
        event.preventDefault();
        setSearchOpen(true);
        window.requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
        return;
      }
      if (modifier && ["+", "="].includes(event.key)) {
        event.preventDefault();
        changeZoom(1);
        return;
      }
      if (modifier && event.key === "-") {
        event.preventDefault();
        changeZoom(-1);
        return;
      }
      if (modifier && event.key === "0") {
        event.preventDefault();
        setFitMode("page");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeZoom]);

  const downloadPDF = useCallback(() => {
    if (!objectUrl) return;
    const link = window.document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
  }, [fileName, objectUrl]);

  const downloadCurrentPageImage = useCallback(async () => {
    if (!pdf) return;
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2, rotation: page.rotate });
    const canvas = window.document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    await page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" }).promise;
    canvas.toBlob((imageBlob) => {
      if (!imageBlob) return;
      const imageUrl = URL.createObjectURL(imageBlob);
      const link = window.document.createElement("a");
      link.href = imageUrl;
      link.download = `${fileName.replace(/\.pdf$/i, "")}-page-${pageNumber}.png`;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(imageUrl), 0);
    }, "image/png");
  }, [fileName, pageNumber, pdf]);

  const printPDF = useCallback(() => {
    const frameWindow = printFrameRef.current?.contentWindow;
    if (frameWindow) {
      frameWindow.focus();
      frameWindow.print();
    }
  }, []);

  const openExternally = useCallback(() => {
    if (objectUrl) window.open(objectUrl, "_blank", "noopener,noreferrer");
  }, [objectUrl]);

  const toggleFullscreen = useCallback(() => {
    const target = fullscreenTargetRef?.current ?? viewerRootRef.current;
    if (!target) return;
    if (window.document.fullscreenElement === target) {
      void window.document.exitFullscreen?.();
    } else {
      void target.requestFullscreen?.();
    }
  }, [fullscreenTargetRef]);

  useEffect(() => {
    const target = fullscreenTargetRef?.current ?? viewerRootRef.current;
    const updateFullscreenState = () => setIsFullscreen(window.document.fullscreenElement === target);
    window.document.addEventListener("fullscreenchange", updateFullscreenState);
    updateFullscreenState();
    return () => window.document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, [fullscreenTargetRef]);

  useEffect(() => {
    onActionsChange?.({
      downloadPDF,
      downloadCurrentPageImage: () => void downloadCurrentPageImage(),
      printPDF,
      openExternally,
      toggleFullscreen,
      isFullscreen,
    });
    return () => onActionsChange?.(null);
  }, [downloadCurrentPageImage, downloadPDF, isFullscreen, onActionsChange, openExternally, printPDF, toggleFullscreen]);

  const commitPageInput = () => {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isFinite(parsed)) navigateToPage(parsed);
    else setPageInput(String(pageNumber));
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 text-slate-700">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-7 text-center shadow-xl shadow-slate-300/40">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600 motion-reduce:animate-none" />
          <p className="mt-4 text-sm font-semibold">Opening the PDF viewer…</p>
        </div>
      </div>
    );
  }

  if (loadError || !pdf) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 p-6">
        <div className="max-w-lg rounded-3xl border border-red-200 bg-white p-7 text-center shadow-xl shadow-slate-300/40" role="alert">
          <p className="text-base font-bold text-slate-950">The advanced viewer could not open this PDF</p>
          <p className="mt-2 text-sm text-red-700">{loadError || "The document could not be read."}</p>
          <button type="button" onClick={openExternally} className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            <ExternalLink className="h-4 w-4" /> Open in browser
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={viewerRootRef} className="flex h-full min-h-0 flex-col bg-slate-100 text-slate-900">
      {objectUrl && <iframe ref={printFrameRef} src={objectUrl} title={`${title} print source`} className="pointer-events-none fixed h-0 w-0 border-0 opacity-0" aria-hidden="true" />}

      <div className="flex shrink-0 flex-col border-b border-slate-200 bg-white shadow-sm">
        <div className="flex min-h-14 items-center gap-1.5 overflow-x-auto px-2 py-1.5 sm:min-h-12 sm:px-3">
          <button type="button" onClick={() => setSidebarOpen((open) => !open)} className={cn(roundControlClass, sidebarOpen && "border-blue-300 bg-blue-50 text-blue-700")} aria-label={sidebarOpen ? "Hide page thumbnails" : "Show page thumbnails"} aria-pressed={sidebarOpen} title={sidebarOpen ? "Hide thumbnails" : "Show thumbnails"}>
            <PanelLeft className="h-4 w-4" />
          </button>

          <div className="mx-0.5 h-6 w-px shrink-0 bg-slate-200" />

          <button type="button" onClick={() => navigateToPage(pageNumber - 1)} disabled={pageNumber <= 1} className={roundControlClass} aria-label="Previous page" title="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 shadow-inner sm:h-9">
            <label htmlFor="pdf-page-number" className="sr-only">Current page</label>
            <input
              id="pdf-page-number"
              inputMode="numeric"
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value.replace(/\D/g, ""))}
              onBlur={commitPageInput}
              onKeyDown={(event) => { if (event.key === "Enter") commitPageInput(); }}
              className="h-9 w-9 rounded-full border border-slate-200 bg-white text-center text-xs font-bold text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:h-7"
            />
            <span className="whitespace-nowrap pr-1 text-[11px] font-medium text-slate-500">/ {totalPages}</span>
          </div>
          <button type="button" onClick={() => navigateToPage(pageNumber + 1)} disabled={pageNumber >= totalPages} className={roundControlClass} aria-label="Next page" title="Next page">
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="mx-0.5 h-6 w-px shrink-0 bg-slate-200" />
          <button
            type="button"
            onClick={() => {
              setSearchOpen((open) => !open);
              window.requestAnimationFrame(() => searchInputRef.current?.focus());
            }}
            className={cn(roundControlClass, searchOpen && "border-blue-300 bg-blue-50 text-blue-700")}
            aria-label={searchOpen ? "Hide PDF search" : "Search this PDF"}
            aria-pressed={searchOpen}
            title="Search this PDF (Ctrl F)"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
        {searchOpen && (
          <div className="flex min-h-14 items-center gap-2 border-t border-slate-100 bg-slate-50 px-2 py-1.5 sm:min-h-11 sm:px-3">
            <div className="relative flex h-11 min-w-0 flex-1 items-center rounded-full border border-slate-200 bg-white pl-3 pr-1.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 sm:h-9">
              <Search className="h-4 w-4 shrink-0 text-slate-500" />
              <label htmlFor="pdf-search" className="sr-only">Search this PDF</label>
              <input ref={searchInputRef} id="pdf-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search this PDF" className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-slate-400" />
              {searching ? <Loader2 className="h-4 w-4 animate-spin text-blue-600 motion-reduce:animate-none" aria-label="Searching PDF" /> : searchQuery ? <button type="button" onClick={() => setSearchQuery("")} className="flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:h-7 sm:w-7" aria-label="Clear PDF search"><X className="h-4 w-4" /></button> : null}
            </div>
            <span className="shrink-0 text-xs font-semibold text-slate-600" aria-live="polite">{searching ? "…" : searchQuery.trim().length < 2 ? "Type 2+ letters" : searchHits.length ? `${activeSearchHit + 1}/${searchHits.length}` : "No matches"}</span>
            <button type="button" onClick={() => moveSearchHit(-1)} disabled={!searchHits.length} className={roundControlClass} aria-label="Previous search result"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => moveSearchHit(1)} disabled={!searchHits.length} className={roundControlClass} aria-label="Next search result"><ChevronRight className="h-4 w-4" /></button>
            <button type="button" onClick={() => setSearchOpen(false)} className={roundControlClass} aria-label="Close PDF search"><X className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <aside className="absolute inset-y-0 left-0 z-20 w-[min(82vw,260px)] overflow-y-auto border-r border-slate-200 bg-slate-50/95 py-3 shadow-xl backdrop-blur-sm md:static md:w-[184px] md:shadow-none" aria-label="Page thumbnails">
            <div className="mb-2 flex items-center justify-between px-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Pages</h3>
              <button type="button" onClick={() => setSidebarOpen(false)} className="flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 sm:h-9 sm:w-9 md:hidden" aria-label="Close page thumbnails"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((candidatePage) => (
                <PDFThumbnail key={candidatePage} pdf={pdf} pageNumber={candidatePage} selected={candidatePage === pageNumber} onSelect={() => navigateToPage(candidatePage)} />
              ))}
            </div>
          </aside>
        )}

        <main ref={viewportRef} className="min-h-0 min-w-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_top,#ffffff_0%,#eef2f7_62%,#e2e8f0_100%)] p-3 sm:p-6" aria-label={`Viewing ${title}, page ${pageNumber} of ${totalPages}`}>
          <div className="flex min-h-full w-max min-w-full flex-col items-center gap-3 sm:gap-6" aria-label="Continuous PDF pages">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((candidatePage) => (
              <ContinuousPDFPage
                key={candidatePage}
                pdf={pdf}
                pageNumber={candidatePage}
                scale={getScaleForPage(pageSizes[candidatePage] ?? pageSizes[1] ?? activePageSize)}
                rotation={0}
                pageSize={pageSizes[candidatePage] ?? pageSizes[1] ?? activePageSize}
                fitMode={fitMode}
                viewportElement={viewportRef.current}
                viewportHeight={viewportSize.height}
                registerPageElement={registerPageElement}
                onPageSize={updatePageSize}
                searchHits={searchHits.filter((hit) => hit.pageNumber === candidatePage)}
                activeSearchHitId={searchHits[activeSearchHit]?.id ?? -1}
              />
            ))}
          </div>
        </main>

        <div className="absolute bottom-[calc(0.75rem+env(safe-area-inset-bottom))] right-3 z-30 flex max-w-[calc(100vw-24px)] flex-col items-end gap-2 sm:bottom-4 sm:right-4">
          {zoomMenuOpen && (
            <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-400/25">
              <button type="button" onClick={() => changeZoom(-1)} disabled={displayedZoom <= MIN_ZOOM} className={roundControlClass} aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></button>
              <button type="button" onClick={() => { setZoom(100); setFitMode("custom"); }} className="h-11 min-w-14 cursor-pointer touch-manipulation rounded-full border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:h-9" aria-label="Reset zoom to 100 percent">{displayedZoom}%</button>
              <button type="button" onClick={() => changeZoom(1)} disabled={displayedZoom >= MAX_ZOOM} className={roundControlClass} aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></button>
              <span className="mx-0.5 h-6 w-px bg-slate-200" />
              <button type="button" onClick={() => setFitMode("width")} className={cn(roundControlClass, fitMode === "width" && "border-blue-300 bg-blue-50 text-blue-700")} aria-label="Fit page width" aria-pressed={fitMode === "width"} title="Fit width"><StretchHorizontal className="h-4 w-4" /></button>
              <button type="button" onClick={() => setFitMode("page")} className={cn(roundControlClass, fitMode === "page" && "border-blue-300 bg-blue-50 text-blue-700")} aria-label="Fit whole page" aria-pressed={fitMode === "page"} title="Fit page"><Scan className="h-4 w-4" /></button>
            </div>
          )}
          <button type="button" onClick={() => setZoomMenuOpen((open) => !open)} className="inline-flex h-11 cursor-pointer touch-manipulation items-center gap-2 rounded-full border border-blue-200 bg-white px-4 text-sm font-bold text-blue-700 shadow-lg shadow-slate-400/30 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" aria-label={zoomMenuOpen ? "Hide zoom controls" : "Show zoom controls"} aria-expanded={zoomMenuOpen}>
            <ZoomIn className="h-4 w-4" /> {displayedZoom}%
          </button>
        </div>
      </div>
    </div>
  );
}
