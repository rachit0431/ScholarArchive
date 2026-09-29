import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Download,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Loader2,
  Layers,
  FileText
} from 'lucide-react';
import { authFetch, fetchPdfBlob } from '../services/api';

// Configure PDF.js worker using Vite's static asset URL bundling
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

interface PdfCanvasViewerProps {
  url?: string;
  data?: ArrayBuffer | Uint8Array;
  title?: string;
  filename?: string;
  initialScale?: number;
  className?: string;
  onDownload?: () => void;
  onLoadSuccess?: (info: { numPages: number; totalBytes?: number }) => void;
}

// Single Page Canvas Renderer Component with Retina / HiDPI handling
const PageCanvasItem: React.FC<{
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation: number;
}> = ({ pdfDoc, pageNumber, scale, rotation }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function renderPage() {
      if (!canvasRef.current) return;
      setIsRendering(true);

      // Cancel any ongoing render task on this canvas
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore cancellation error
        }
        renderTaskRef.current = null;
      }

      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (isCancelled || !canvasRef.current) return;

        const viewport = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        setPageSize({ width: Math.floor(viewport.width), height: Math.floor(viewport.height) });

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        const renderContext = {
          canvasContext: ctx,
          transform: transform,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (!isCancelled) {
          setIsRendering(false);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && !isCancelled) {
          console.error(`Error rendering page ${pageNumber}:`, err);
          setIsRendering(false);
        }
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, pageNumber, scale, rotation]);

  return (
    <div
      className="relative flex justify-center my-4 transition-all duration-150"
      style={{
        minHeight: pageSize ? `${pageSize.height}px` : '400px',
        minWidth: pageSize ? `${pageSize.width}px` : '300px',
      }}
    >
      <div className="bg-white shadow-xl rounded-sm border border-[#D1D5DB] overflow-hidden">
        <canvas ref={canvasRef} className="block mx-auto select-none" />
      </div>

      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px] pointer-events-none">
          <div className="flex items-center gap-2 bg-[#1C2826]/80 text-white px-3 py-1.5 rounded-full text-xs shadow-md">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#10B981]" />
            <span>Rendering Page {pageNumber}...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  url,
  data,
  title = 'Document',
  filename = 'document.pdf',
  initialScale = 1.15,
  className = '',
  onDownload,
  onLoadSuccess,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(initialScale);
  const [rotation, setRotation] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'continuous' | 'single'>('continuous');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingPercent, setLoadingPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [rawBlobUrl, setRawBlobUrl] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  // Load PDF Binary Data
  useEffect(() => {
    let isCancelled = false;
    let loadingTask: any = null;
    let localBlobUrl: string | null = null;

    async function loadPdf() {
      setIsLoading(true);
      setError(null);
      setLoadingPercent(10);

      try {
        let pdfBytes: Uint8Array;

        if (data) {
          pdfBytes = data instanceof Uint8Array ? data : new Uint8Array(data);
          const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
          localBlobUrl = URL.createObjectURL(blob);
          if (!isCancelled) setRawBlobUrl(localBlobUrl);
        } else if (url) {
          let blob: Blob;
          if (url.startsWith('blob:') || url.startsWith('data:')) {
            const resp = await fetch(url);
            blob = await resp.blob();
          } else {
            blob = await fetchPdfBlob(url, (loaded, total) => {
              if (total > 0 && !isCancelled) {
                setLoadingPercent(Math.min(90, Math.round((loaded / total) * 90)));
              }
            });
          }

          const arrayBuffer = await blob.arrayBuffer();
          if (arrayBuffer.byteLength === 0) {
            throw new Error('Received 0 bytes from PDF repository storage.');
          }

          pdfBytes = new Uint8Array(arrayBuffer);
          localBlobUrl = URL.createObjectURL(blob);
          if (!isCancelled) setRawBlobUrl(localBlobUrl);
        } else {
          throw new Error('No PDF source URL or binary data provided.');
        }

        if (isCancelled) return;
        setLoadingPercent(60);

        // Verify PDF Header
        const header = String.fromCharCode(...pdfBytes.slice(0, 5));
        if (!header.startsWith('%PDF')) {
          throw new Error('File does not have a valid %PDF header binary signature.');
        }

        // Initialize PDF.js Document
        loadingTask = pdfjsLib.getDocument({
          data: pdfBytes,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@' + pdfjsLib.version + '/cmaps/',
          cMapPacked: true,
        });

        loadingTask.onProgress = (progress: { loaded: number; total: number }) => {
          if (progress.total > 0) {
            const pct = Math.round((progress.loaded / progress.total) * 100);
            if (!isCancelled) setLoadingPercent(pct);
          }
        };

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);
        setIsLoading(false);
        setLoadingPercent(100);

        if (onLoadSuccess) {
          onLoadSuccess({ numPages: doc.numPages, totalBytes: pdfBytes.byteLength });
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Failed to load PDF document:', err);
          setError(err.message || 'Failed to parse and render PDF document.');
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
      if (loadingTask) {
        try {
          loadingTask.destroy();
        } catch {
          // ignore
        }
      }
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [url, data, reloadKey]);

  // Zoom handlers
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const handleFitWidth = useCallback(() => {
    if (!containerRef.current || !pdfDoc) return;
    pdfDoc.getPage(1).then((page) => {
      const viewport = page.getViewport({ scale: 1.0, rotation });
      const containerWidth = containerRef.current?.clientWidth || 800;
      // Leave 48px padding
      const targetWidth = Math.max(containerWidth - 64, 320);
      const newScale = targetWidth / viewport.width;
      setScale(Math.max(0.6, Math.min(newScale, 2.5)));
    });
  }, [pdfDoc, rotation]);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Download Trigger
  const handleDownloadClick = () => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (rawBlobUrl) {
      const a = document.createElement('a');
      a.href = rawBlobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-[#2A3033] rounded-lg overflow-hidden border border-[#3E464A] shadow-inner select-none ${className}`}
      style={{ height: '100%', minHeight: '500px' }}
    >
      {/* Interactive Top Toolbar */}
      <div className="bg-[#1F2426] border-b border-[#3E464A] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-white shrink-0 z-10 shadow-sm">
        {/* Left: Document Info & Page Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF] font-mono-code">
            <FileText className="w-4 h-4 text-[#10B981]" />
            <span className="font-semibold text-white truncate max-w-[160px] sm:max-w-[240px]" title={title}>
              {title}
            </span>
          </div>

          {numPages > 0 && (
            <div className="flex items-center gap-1 bg-[#2C3337] px-2 py-1 rounded border border-[#434D52] text-xs">
              {viewMode === 'single' ? (
                <>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage <= 1}
                    className="p-0.5 hover:text-[#10B981] disabled:opacity-40 transition-colors"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono-code px-1 text-white">
                    {currentPage} / {numPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, numPages))}
                    disabled={currentPage >= numPages}
                    className="p-0.5 hover:text-[#10B981] disabled:opacity-40 transition-colors"
                    title="Next Page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <span className="font-mono-code px-1 text-[#9CA3AF]">
                  {numPages} {numPages === 1 ? 'Page' : 'Pages'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Center: Zoom & View Mode Controls */}
        <div className="flex items-center gap-1 bg-[#2C3337] px-2 py-0.5 rounded border border-[#434D52]">
          <button
            onClick={handleZoomOut}
            className="p-1 text-[#9CA3AF] hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono-code text-white min-w-[42px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1 text-[#9CA3AF] hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-3.5 bg-[#434D52] mx-1" />

          <button
            onClick={handleFitWidth}
            className="px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#9CA3AF] hover:text-white hover:bg-[#384146] rounded transition-colors"
            title="Fit to Width"
          >
            Fit
          </button>

          <button
            onClick={handleRotate}
            className="p-1 text-[#9CA3AF] hover:text-white transition-colors"
            title="Rotate 90° Clockwise"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-3.5 bg-[#434D52] mx-1" />

          <button
            onClick={() => setViewMode((m) => (m === 'continuous' ? 'single' : 'continuous'))}
            className={`p-1 transition-colors rounded ${
              viewMode === 'continuous' ? 'text-[#10B981] bg-[#1C2826]' : 'text-[#9CA3AF] hover:text-white'
            }`}
            title={viewMode === 'continuous' ? 'Switch to Single Page Mode' : 'Switch to Continuous Scroll Mode'}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Actions (Fullscreen, Download, Open Raw) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleToggleFullscreen}
            className="p-1.5 text-[#9CA3AF] hover:text-white hover:bg-[#2C3337] rounded transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {rawBlobUrl && (
            <a
              href={rawBlobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-[#9CA3AF] hover:text-white hover:bg-[#2C3337] rounded transition-colors"
              title="Open Raw PDF in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          <button
            onClick={handleDownloadClick}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#10B981] rounded transition-colors shadow-2xs cursor-pointer"
            title="Download PDF Document"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Scrollable Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-[#32383B] relative flex flex-col items-center p-4 scroll-smooth"
        tabIndex={0}
      >
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#2A3033] text-white z-20 space-y-3">
            <Loader2 className="w-10 h-10 animate-spin text-[#10B981]" />
            <p className="text-sm font-serif-academic tracking-wide">
              Rendering authentic PDF pages...
            </p>
            <div className="w-48 bg-[#1F2426] h-1.5 rounded-full overflow-hidden border border-[#434D52]">
              <div
                className="bg-[#10B981] h-full transition-all duration-200"
                style={{ width: `${Math.max(loadingPercent, 15)}%` }}
              />
            </div>
            <p className="text-xs text-[#9CA3AF] font-mono-code">
              Parsing binary structure ({loadingPercent}%)
            </p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#2A3033] text-white z-20 p-6 max-w-md mx-auto text-center space-y-4">
            <div className="p-3 bg-red-500/20 rounded-full border border-red-500/30 text-red-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base font-serif-academic font-bold text-white mb-1">
                Unable to Render Document
              </h4>
              <p className="text-xs text-red-300 font-sans leading-relaxed">
                {error}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setReloadKey((k) => k + 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#10B981] rounded transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Load</span>
              </button>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#9CA3AF] hover:text-white border border-[#434D52] hover:bg-[#2C3337] rounded transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Directly</span>
                </a>
              )}
            </div>
          </div>
        )}

        {!isLoading && !error && pdfDoc && (
          <div className="w-full flex flex-col items-center">
            {viewMode === 'continuous' ? (
              // All pages rendered continuously
              Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <PageCanvasItem
                  key={`page-${pageNum}-${scale}-${rotation}`}
                  pdfDoc={pdfDoc}
                  pageNumber={pageNum}
                  scale={scale}
                  rotation={rotation}
                />
              ))
            ) : (
              // Single page mode
              <PageCanvasItem
                key={`page-${currentPage}-${scale}-${rotation}`}
                pdfDoc={pdfDoc}
                pageNumber={currentPage}
                scale={scale}
                rotation={rotation}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
