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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Maximize2,
  PanelLeft,
  Printer,
  RotateCw,
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
}

interface SearchHit {
  pageNumber: number;
  occurrence: number;
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
  "inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full",
  "border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors duration-150",
  "hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-40",
);

function countOccurrences(source: string, query: string) {
  let count = 0;
  let offset = 0;
  while (offset < source.length) {
    const matchIndex = source.indexOf(query, offset);
    if (matchIndex < 0) break;
    count += 1;
    offset = matchIndex + Math.max(query.length, 1);
  }
  return count;
}

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
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation: number;
  className?: string;
  onPageSize?: (size: PageSize) => void;
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

export function PDFDocumentViewer({ blob, fileName, title }: PDFDocumentViewerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(100);
  const [fitMode, setFitMode] = useState<FitMode>("custom");
  const [rotation, setRotation] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pageSizes, setPageSizes] = useState<Record<number, PageSize>>({
    1: { width: 595, height: 842 },
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [activeSearchHit, setActiveSearchHit] = useState(-1);
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
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setPdf(null);
    setPageNumber(1);
    setPageInput("1");
    pageNumberRef.current = 1;
    setZoom(100);
    setFitMode("custom");
    setRotation(0);
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
        const viewport = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
        nextSizes[candidatePage] = { width: viewport.width, height: viewport.height };
      }
      if (!cancelled) setPageSizes(nextSizes);
    })();

    return () => {
      cancelled = true;
    };
  }, [pdf, rotation]);

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
  }, [fitMode, pdf, rotation, viewportRef, viewportSize.height, viewportSize.width, zoom]);

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
        const text = textContent.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .toLocaleLowerCase();
        const occurrences = countOccurrences(text, normalizedQuery);
        for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
          nextHits.push({ pageNumber: candidatePage, occurrence });
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

  const moveSearchHit = useCallback((direction: 1 | -1) => {
    if (!searchHits.length) return;
    const nextIndex = (activeSearchHit + direction + searchHits.length) % searchHits.length;
    setActiveSearchHit(nextIndex);
    navigateToPage(searchHits[nextIndex].pageNumber);
  }, [activeSearchHit, navigateToPage, searchHits]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLocaleLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
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

  const downloadPDF = () => {
    if (!objectUrl) return;
    const link = window.document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const printPDF = () => {
    const frameWindow = printFrameRef.current?.contentWindow;
    if (frameWindow) {
      frameWindow.focus();
      frameWindow.print();
    }
  };

  const openExternally = () => {
    if (objectUrl) window.open(objectUrl, "_blank", "noopener,noreferrer");
  };

  const enterFullscreen = () => {
    if (viewerRootRef.current?.requestFullscreen) void viewerRootRef.current.requestFullscreen();
  };

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
        <div className="flex min-h-[64px] items-center gap-2 overflow-x-auto px-3 py-2 sm:px-4">
          <button type="button" onClick={() => setSidebarOpen((open) => !open)} className={cn(roundControlClass, sidebarOpen && "border-blue-300 bg-blue-50 text-blue-700")} aria-label={sidebarOpen ? "Hide page thumbnails" : "Show page thumbnails"} aria-pressed={sidebarOpen} title={sidebarOpen ? "Hide thumbnails" : "Show thumbnails"}>
            <PanelLeft className="h-5 w-5" />
          </button>

          <div className="mx-1 h-8 w-px shrink-0 bg-slate-200" />

          <button type="button" onClick={() => navigateToPage(pageNumber - 1)} disabled={pageNumber <= 1} className={roundControlClass} aria-label="Previous page" title="Previous page">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 shadow-inner">
            <label htmlFor="pdf-page-number" className="sr-only">Current page</label>
            <input
              id="pdf-page-number"
              inputMode="numeric"
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value.replace(/\D/g, ""))}
              onBlur={commitPageInput}
              onKeyDown={(event) => { if (event.key === "Enter") commitPageInput(); }}
              className="h-8 w-11 rounded-full border border-slate-200 bg-white text-center text-sm font-bold text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <span className="whitespace-nowrap pr-1 text-xs font-medium text-slate-500">of {totalPages}</span>
          </div>
          <button type="button" onClick={() => navigateToPage(pageNumber + 1)} disabled={pageNumber >= totalPages} className={roundControlClass} aria-label="Next page" title="Next page">
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="mx-1 h-8 w-px shrink-0 bg-slate-200" />

          <button type="button" onClick={() => changeZoom(-1)} disabled={displayedZoom <= MIN_ZOOM} className={roundControlClass} aria-label="Zoom out" title="Zoom out (Ctrl −)">
            <ZoomOut className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => { setZoom(100); setFitMode("custom"); }} className="h-11 min-w-[72px] shrink-0 cursor-pointer rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" aria-label={`Zoom ${displayedZoom} percent`} title="Reset zoom to 100%">
            {displayedZoom}%
          </button>
          <button type="button" onClick={() => changeZoom(1)} disabled={displayedZoom >= MAX_ZOOM} className={roundControlClass} aria-label="Zoom in" title="Zoom in (Ctrl +)">
            <ZoomIn className="h-5 w-5" />
          </button>

          <button type="button" onClick={() => setFitMode("width")} className={cn(roundControlClass, fitMode === "width" && "border-blue-300 bg-blue-50 text-blue-700")} aria-label="Fit page width" aria-pressed={fitMode === "width"} title="Fit width">
            <StretchHorizontal className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => setFitMode("page")} className={cn(roundControlClass, fitMode === "page" && "border-blue-300 bg-blue-50 text-blue-700")} aria-label="Fit whole page" aria-pressed={fitMode === "page"} title="Fit page (Ctrl 0)">
            <Scan className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => setRotation((value) => (value + 90) % 360)} className={roundControlClass} aria-label="Rotate page clockwise" title="Rotate clockwise">
            <RotateCw className="h-5 w-5" />
          </button>

          <div className="mx-1 h-8 w-px shrink-0 bg-slate-200" />

          <div className="relative flex h-11 min-w-[230px] shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 pl-4 pr-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
            <Search className="h-4 w-4 shrink-0 text-slate-500" />
            <label htmlFor="pdf-search" className="sr-only">Search this PDF</label>
            <input ref={searchInputRef} id="pdf-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search this PDF" className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-slate-400" />
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 motion-reduce:animate-none" aria-label="Searching PDF" />
            ) : searchQuery ? (
              <button type="button" onClick={() => setSearchQuery("")} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="Clear PDF search"><X className="h-4 w-4" /></button>
            ) : null}
          </div>
          {searchQuery.trim().length >= 2 && (
            <div className="flex h-11 shrink-0 items-center rounded-full border border-slate-200 bg-white px-1 shadow-sm" aria-live="polite">
              <span className="min-w-[72px] px-2 text-center text-xs font-semibold text-slate-600">
                {searching ? "Searching" : searchHits.length ? `${activeSearchHit + 1} of ${searchHits.length}` : "No matches"}
              </span>
              <button type="button" onClick={() => moveSearchHit(-1)} disabled={!searchHits.length} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-600 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35" aria-label="Previous search result"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => moveSearchHit(1)} disabled={!searchHits.length} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-600 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35" aria-label="Next search result"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button type="button" onClick={downloadPDF} className={roundControlClass} aria-label={`Download ${title}`} title="Download PDF"><Download className="h-5 w-5" /></button>
            <button type="button" onClick={printPDF} className={roundControlClass} aria-label={`Print ${title}`} title="Print PDF"><Printer className="h-5 w-5" /></button>
            <button type="button" onClick={openExternally} className={roundControlClass} aria-label={`Open ${title} in browser`} title="Open in browser"><ExternalLink className="h-5 w-5" /></button>
            <button type="button" onClick={enterFullscreen} className={roundControlClass} aria-label="Enter full screen" title="Full screen"><Maximize2 className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="flex min-h-9 items-center gap-2 border-t border-slate-100 px-4 text-xs text-slate-500">
          <span className="max-w-[45vw] truncate font-semibold text-slate-700">{fileName}</span>
          <span aria-hidden="true">•</span>
          <span>Page {pageNumber} of {totalPages}</span>
          <span aria-hidden="true">•</span>
          <span>{fitMode === "page" ? "Fit page" : fitMode === "width" ? "Fit width" : `${displayedZoom}% zoom`}</span>
          <span className="ml-auto hidden items-center gap-1 sm:flex"><ChevronDown className="h-3.5 w-3.5" /> Ctrl+F search · Ctrl+0 fit page</span>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <aside className="absolute inset-y-0 left-0 z-20 w-[184px] overflow-y-auto border-r border-slate-200 bg-slate-50/95 py-3 shadow-xl backdrop-blur-sm md:static md:shadow-none" aria-label="Page thumbnails">
            <div className="mb-2 flex items-center justify-between px-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Pages</h3>
              <button type="button" onClick={() => setSidebarOpen(false)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 md:hidden" aria-label="Close page thumbnails"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((candidatePage) => (
                <PDFThumbnail key={candidatePage} pdf={pdf} pageNumber={candidatePage} selected={candidatePage === pageNumber} onSelect={() => navigateToPage(candidatePage)} />
              ))}
            </div>
          </aside>
        )}

        <main ref={viewportRef} className="min-h-0 min-w-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_top,#ffffff_0%,#eef2f7_62%,#e2e8f0_100%)] p-6" aria-label={`Viewing ${title}, page ${pageNumber} of ${totalPages}`}>
          <div className="flex min-h-full w-max min-w-full flex-col items-center gap-6" aria-label="Continuous PDF pages">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((candidatePage) => (
              <ContinuousPDFPage
                key={candidatePage}
                pdf={pdf}
                pageNumber={candidatePage}
                scale={getScaleForPage(pageSizes[candidatePage] ?? pageSizes[1] ?? activePageSize)}
                rotation={rotation}
                pageSize={pageSizes[candidatePage] ?? pageSizes[1] ?? activePageSize}
                fitMode={fitMode}
                viewportElement={viewportRef.current}
                viewportHeight={viewportSize.height}
                registerPageElement={registerPageElement}
                onPageSize={updatePageSize}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
