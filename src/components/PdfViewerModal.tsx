import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, Printer, FileText, Calendar, Clock, Award, Bookmark, Check, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Paper } from '../types';
import { api, fetchPdfBlob, formatBytes } from '../services/api';
import { PdfCanvasViewer } from './PdfCanvasViewer';

interface PdfViewerModalProps {
  paper: Paper | null;
  onClose: () => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (paperId: string) => void;
  onDownloadRecorded?: (paperId: string) => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  paper,
  onClose,
  isBookmarked = false,
  onToggleBookmark,
  onDownloadRecorded,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [actualSizeFormatted, setActualSizeFormatted] = useState<string>(paper?.fileSizeFormatted || 'Loading...');
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  const viewUrl = paper ? api.getViewUrl(paper.id) : '';

  useEffect(() => {
    if (!paper) return;
    let isCancelled = false;
    let createdUrl: string | null = null;

    async function loadPdfDocument() {
      setIsLoadingPdf(true);
      setPdfError(null);

      try {
        const fetchUrl = api.getViewUrl(paper!.id);
        const blob = await fetchPdfBlob(fetchUrl);

        console.log('[FRONTEND PAPER VIEWER] Blob size:', blob.size, 'Blob type:', blob.type);
        if (blob.size === 0) {
          throw new Error('Received 0 bytes from PDF repository storage.');
        }

        // Verify PDF magic bytes header
        const slice = await blob.slice(0, 5).text();
        if (!slice.startsWith('%PDF')) {
          throw new Error('Document binary is not a valid PDF file format.');
        }

        const realFormatted = formatBytes(blob.size);
        if (!isCancelled) {
          setActualSizeFormatted(realFormatted);
          const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
          createdUrl = URL.createObjectURL(pdfBlob);
          setBlobUrl(createdUrl);
          setIsLoadingPdf(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Failed to load PDF preview in modal:', err);
          setPdfError(err.message || 'Could not load PDF document.');
          setIsLoadingPdf(false);
        }
      }
    }

    loadPdfDocument();

    return () => {
      isCancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [paper?.id, reloadKey]);

  if (!paper) return null;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await api.downloadPaperBlob(
        paper.id,
        paper.originalFilename || `${paper.subjectCode}-${paper.examType}.pdf`
      );
      setDownloadSuccess(true);
      if (onDownloadRecorded) {
        onDownloadRecorded(paper.id);
      }
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err: any) {
      console.error('Download error in viewer:', err);
      alert(err.message || 'Failed to download question paper.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open(blobUrl || viewUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-hidden">
      <div className="bg-[#FAF8F5] border border-[#E5DFD5] w-full max-w-6xl h-[94vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Modal Header */}
        <div className="bg-[#FFFFFF] border-b border-[#E5DFD5] px-4 py-3 sm:px-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#5C6F68] font-mono-code mb-1">
              <span className="font-semibold text-[#0F5132]">{paper.subjectCode}</span>
              <span>·</span>
              <span>{paper.academicYear}</span>
              <span>·</span>
              <span>{paper.btechYear}</span>
              <span>·</span>
              <span>{paper.semester}</span>
              <span>·</span>
              <span className="text-[#0F5132] font-semibold">{paper.examType}</span>
            </div>
            <h3 className="text-lg sm:text-xl font-serif-academic font-bold text-[#1C2826] truncate">
              {paper.subjectName}
            </h3>
          </div>

          {/* Action Affordances */}
          <div className="flex items-center gap-2 shrink-0">
            {onToggleBookmark && (
              <button
                onClick={() => onToggleBookmark(paper.id)}
                className={`p-2 rounded-md border text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  isBookmarked
                    ? 'bg-[#E8F5E9] text-[#0F5132] border-[#A7F3D0]'
                    : 'bg-[#FFFFFF] text-[#5C6F68] border-[#E5DFD5] hover:text-[#0F5132]'
                }`}
                title={isBookmarked ? 'Remove from My Archive' : 'Save to My Archive'}
              >
                <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
                <span className="hidden sm:inline">{isBookmarked ? 'Saved to Archive' : 'Save to My Archive'}</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="p-2 text-[#5C6F68] hover:text-[#1C2826] bg-[#FFFFFF] border border-[#E5DFD5] hover:bg-[#F5F1EB] rounded-md transition-colors"
              title="Print Question Paper"
            >
              <Printer className="w-4 h-4" />
            </button>

            <a
              href={blobUrl || viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-[#5C6F68] hover:text-[#1C2826] bg-[#FFFFFF] border border-[#E5DFD5] hover:bg-[#F5F1EB] rounded-md transition-colors"
              title="Open Raw PDF in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md shadow-xs transition-colors disabled:opacity-70"
            >
              {isDownloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Downloaded</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-[#5C6F68] hover:text-[#1C2826] hover:bg-[#E5DFD5]/50 rounded-md transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Main PDF Viewer Frame */}
          <div className="flex-1 bg-[#2C3437] relative flex items-center justify-center overflow-hidden">
            {isLoadingPdf && (
              <div className="flex flex-col items-center justify-center text-center p-8 text-white space-y-3">
                <Loader2 className="w-10 h-10 animate-spin text-[#10B981]" />
                <p className="text-sm font-medium font-serif-academic tracking-wide">
                  Retrieving official examination document...
                </p>
                <p className="text-xs text-white/60 font-mono-code">
                  Validating PDF stream & binary integrity
                </p>
              </div>
            )}

            {!isLoadingPdf && pdfError && (
              <div className="flex flex-col items-center justify-center text-center p-8 text-white max-w-md space-y-4">
                <div className="p-3 bg-red-500/20 rounded-full border border-red-500/30 text-red-400">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-serif-academic font-bold text-white mb-1">
                    Document Stream Error
                  </h4>
                  <p className="text-xs text-white/70 leading-relaxed font-sans">
                    {pdfError}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReloadKey(k => k + 1)}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-sm cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Document Load</span>
                </button>
              </div>
            )}

            {!isLoadingPdf && !pdfError && blobUrl && (
              <PdfCanvasViewer
                url={blobUrl}
                title={`${paper.subjectCode}: ${paper.subjectName}`}
                filename={paper.originalFilename || `${paper.subjectCode}-${paper.examType}.pdf`}
                onDownload={handleDownload}
                onLoadSuccess={({ totalBytes }) => {
                  if (totalBytes) {
                    setActualSizeFormatted(formatBytes(totalBytes));
                  }
                }}
                className="w-full h-full border-0 rounded-none"
              />
            )}
          </div>

          {/* Academic Information Sidebar */}
          <div className="w-full lg:w-80 bg-[#FFFFFF] border-t lg:border-t-0 lg:border-l border-[#E5DFD5] p-5 overflow-y-auto space-y-5 shrink-0">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#5C6F68] font-semibold block mb-1">
                Paper Specifications
              </span>
              <h4 className="text-base font-serif-academic font-bold text-[#1C2826]">
                {paper.subjectName}
              </h4>
              <p className="text-xs text-[#5C6F68] mt-1 font-mono-code">
                Accession No: {paper.id.toUpperCase()}
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-[#E5DFD5] text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#5C6F68] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#0F5132]" /> Examination Date
                </span>
                <span className="font-semibold text-[#1C2826]">{paper.paperDate || 'Official Schedule'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5C6F68] flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#0F5132]" /> Maximum Marks
                </span>
                <span className="font-semibold text-[#1C2826]">{paper.maxMarks || 100} Marks</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5C6F68] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#0F5132]" /> Time Duration
                </span>
                <span className="font-semibold text-[#1C2826]">{paper.durationMinutes || 180} Minutes</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5C6F68] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#0F5132]" /> Document Size
                </span>
                <span className="font-semibold font-mono-code text-[#1C2826]">{actualSizeFormatted}</span>
              </div>
            </div>

            {paper.description && (
              <div className="pt-3 border-t border-[#E5DFD5]">
                <span className="text-[10px] uppercase tracking-wider text-[#5C6F68] font-semibold block mb-1">
                  Examination Notes & Scope
                </span>
                <p className="text-xs text-[#5C6F68] leading-relaxed bg-[#FAF8F5] p-3 rounded-md border border-[#E5DFD5]">
                  {paper.description}
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-[#E5DFD5] text-[11px] text-[#5C6F68] space-y-1.5">
              <div className="flex justify-between">
                <span>File Name:</span>
                <span className="font-mono-code truncate max-w-[150px]" title={paper.originalFilename}>
                  {paper.originalFilename}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Downloads:</span>
                <span className="font-semibold text-[#0F5132] font-mono-code">{paper.downloadsCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Archived By:</span>
                <span>{paper.uploadedBy || 'Academic Controller'}</span>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs disabled:opacity-70"
              >
                {isDownloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Downloading PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Save Question Paper to Device</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
