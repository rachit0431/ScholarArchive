import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, Printer, FileText, Calendar, BookOpen, Layers, Check, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Note } from '../types';
import { api, fetchPdfBlob, formatBytes } from '../services/api';
import { PdfCanvasViewer } from './PdfCanvasViewer';

interface NoteViewerModalProps {
  note: Note | null;
  onClose: () => void;
  onDownloadRecorded?: (id: string, type?: 'paper' | 'note') => void;
}

export const NoteViewerModal: React.FC<NoteViewerModalProps> = ({ note, onClose, onDownloadRecorded }) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [actualSizeFormatted, setActualSizeFormatted] = useState<string>(note?.fileSizeFormatted || 'Loading...');
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  const viewUrl = note ? api.getNoteViewUrl(note.id) : '';

  useEffect(() => {
    if (!note) return;
    let isCancelled = false;
    let createdUrl: string | null = null;

    async function loadPdfDocument() {
      setIsLoadingPdf(true);
      setPdfError(null);

      try {
        const fetchUrl = api.getNoteViewUrl(note!.id);
        const blob = await fetchPdfBlob(fetchUrl);

        console.log('[FRONTEND NOTE VIEWER] Blob size:', blob.size, 'Blob type:', blob.type);

        if (blob.size === 0) {
          throw new Error('Received 0 bytes from Notes repository storage.');
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
          console.error('Failed to load note PDF preview in modal:', err);
          setPdfError(err.message || 'Could not load study note document.');
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
  }, [note?.id, reloadKey]);

  if (!note) return null;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await api.downloadNoteBlob(
        note.id,
        note.originalFilename || `${note.subjectCode}-Notes.pdf`
      );
      if (onDownloadRecorded) {
        onDownloadRecorded(note.id, 'note');
      } else {
        api.recordDownload(note.id, 'note').catch(() => {});
      }
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err: any) {
      console.error('Download error in note viewer:', err);
      alert(err.message || 'Failed to download study notes.');
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
              <span className="font-semibold text-[#0F5132]">{note.subjectCode}</span>
              <span>·</span>
              <span>{note.btechYear}</span>
              <span>·</span>
              <span>{note.semester}</span>
              <span>·</span>
              <span className="text-[#0F5132] font-semibold">Study Notes</span>
            </div>
            <h3 className="text-lg sm:text-xl font-serif-academic font-bold text-[#1C2826] truncate">
              {note.title}
            </h3>
          </div>

          {/* Action Affordances */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="p-2 text-[#5C6F68] hover:text-[#1C2826] bg-[#FFFFFF] border border-[#E5DFD5] hover:bg-[#F5F1EB] rounded-md transition-colors cursor-pointer"
              title="Print Notes"
            >
              <Printer className="w-4 h-4" />
            </button>

            <a
              href={blobUrl || viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-[#5C6F68] hover:text-[#1C2826] bg-[#FFFFFF] border border-[#E5DFD5] hover:bg-[#F5F1EB] rounded-md transition-colors cursor-pointer"
              title="Open Raw PDF in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md shadow-xs transition-colors disabled:opacity-70 cursor-pointer"
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
              className="p-2 text-[#5C6F68] hover:text-[#1C2826] hover:bg-[#E5DFD5]/50 rounded-md transition-colors ml-1 cursor-pointer"
              title="Close Viewer"
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
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#2C3437] text-white p-6 text-center">
                <Loader2 className="w-9 h-9 text-[#10B981] animate-spin mb-3" />
                <p className="text-sm font-semibold tracking-wide">Loading Study Note Document...</p>
                <p className="text-xs text-[#9CA3AF] mt-1 font-mono-code">Verifying PDF stream from repository</p>
              </div>
            )}

            {pdfError && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#FAF8F5] text-[#1C2826] p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mb-3">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <h4 className="text-base font-serif-academic font-bold mb-1">Unable to Render PDF</h4>
                <p className="text-xs text-[#5C6F68] max-w-md mb-4 leading-relaxed font-mono-code">{pdfError}</p>
                <button
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
                title={note.title}
                filename={note.originalFilename || `${note.subjectName || 'note'}-${note.title}.pdf`}
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
                Material Specifications
              </span>
              <h4 className="text-base font-serif-academic font-bold text-[#1C2826]">
                {note.subjectName}
              </h4>
              <p className="text-xs text-[#5C6F68] mt-1 font-mono-code">
                Accession No: {note.id.toUpperCase()}
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-[#E5DFD5] text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#5C6F68] flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#0F5132]" /> Subject Code
                </span>
                <span className="font-semibold text-[#1C2826] font-mono-code">{note.subjectCode}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5C6F68] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#0F5132]" /> Academic Level
                </span>
                <span className="font-semibold text-[#1C2826]">{note.btechYear}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5C6F68] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#0F5132]" /> Semester
                </span>
                <span className="font-semibold text-[#1C2826]">{note.semester}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5C6F68] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#0F5132]" /> Document Size
                </span>
                <span className="font-semibold font-mono-code text-[#1C2826]">{actualSizeFormatted}</span>
              </div>
            </div>

            {note.description && (
              <div className="pt-3 border-t border-[#E5DFD5]">
                <span className="text-[10px] uppercase tracking-wider text-[#5C6F68] font-semibold block mb-1">
                  Topic Description & Contents
                </span>
                <p className="text-xs text-[#5C6F68] leading-relaxed bg-[#FAF8F5] p-3 rounded-md border border-[#E5DFD5]">
                  {note.description}
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-[#E5DFD5] text-[11px] text-[#5C6F68] space-y-1.5">
              <div className="flex justify-between">
                <span>File Name:</span>
                <span className="font-mono-code truncate max-w-[150px]" title={note.originalFilename}>
                  {note.originalFilename}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Downloads:</span>
                <span className="font-semibold text-[#0F5132] font-mono-code">{note.downloadsCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Author / Board:</span>
                <span>{note.uploadedBy || 'Academic Dean'}</span>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs disabled:opacity-70 cursor-pointer"
              >
                {isDownloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Downloading PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Save Notes to Device</span>
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
