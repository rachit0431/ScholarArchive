import React, { useState } from 'react';
import { Download, Eye, Bookmark, FileText, Calendar, Clock, Award, AlertCircle } from 'lucide-react';
import { Paper } from '../types';
import { api } from '../services/api';

interface PaperCardProps {
  paper: Paper;
  onView: (paper: Paper) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (paperId: string) => void;
  onDownloadRecorded?: (paperId: string) => void;
}

export const PaperCard: React.FC<PaperCardProps> = ({
  paper,
  onView,
  isBookmarked = false,
  onToggleBookmark,
  onDownloadRecorded,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownloadClick = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await api.downloadPaperBlob(
        paper.id,
        paper.originalFilename || `${paper.subjectCode}_${paper.examType}.pdf`
      );
      if (onDownloadRecorded) {
        onDownloadRecorded(paper.id);
      }
    } catch (err: any) {
      console.error('Download error:', err);
      const msg = err.message || 'Failed to download question paper. Please try again.';
      setDownloadError(msg);
      alert(msg);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <article className="group bg-[#FFFFFF] border border-[#E5DFD5] hover:border-[#10B981]/50 rounded-lg p-5 sm:p-6 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between relative">
      <div>
        {/* Unboxed Metadata Line with typographic separators */}
        <div className="flex items-center flex-wrap gap-2 text-xs text-[#5C6F68] font-mono-code mb-2.5">
          <span className="font-semibold text-[#0F5132] tracking-wide">{paper.subjectCode}</span>
          <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
          <span>{paper.academicYear}</span>
          <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
          <span>{paper.btechYear}</span>
          <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
          <span>{paper.semester}</span>
        </div>

        {/* Primary Subject Title */}
        <h3
          onClick={() => onView(paper)}
          className="text-lg sm:text-xl font-serif-academic font-bold text-[#1C2826] group-hover:text-[#0F5132] transition-colors cursor-pointer leading-snug"
        >
          {paper.subjectName}
        </h3>

        {/* Exam Type and Sub-descriptors */}
        <div className="mt-2.5 flex items-center gap-2 text-xs text-[#5C6F68]">
          <span className="font-semibold text-[#1C2826]">{paper.examType}</span>
          <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
          <span>Max Marks: {paper.maxMarks || 100}</span>
          <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
          <span>{paper.fileSizeFormatted}</span>
        </div>

        {/* Paper Description or Instructions */}
        {paper.description && (
          <p className="mt-3 text-xs text-[#5C6F68] line-clamp-2 leading-relaxed">
            {paper.description}
          </p>
        )}
      </div>

      {/* Card Footer & Interactive Actions */}
      <div className="mt-5 pt-4 border-t border-[#E5DFD5] flex items-center justify-between gap-3 text-xs">
        <div className="text-[11px] text-[#5C6F68]">
          <span>Date: {paper.paperDate || 'Scheduled'}</span>
          <span className="mx-1.5 text-[#CBD5E1]">·</span>
          <span className="font-mono-code">{paper.downloadsCount} downloads</span>
        </div>

        <div className="flex items-center gap-2">
          {onToggleBookmark && (
            <button
              onClick={() => onToggleBookmark(paper.id)}
              className={`p-1.5 rounded-md border text-xs transition-colors ${
                isBookmarked
                  ? 'bg-[#E8F5E9] text-[#0F5132] border-[#A7F3D0]'
                  : 'bg-[#FFFFFF] text-[#5C6F68] border-[#E5DFD5] hover:text-[#0F5132] hover:bg-[#F5F1EB]'
              }`}
              title={isBookmarked ? 'Remove from My Archive' : 'Save to My Archive'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
          )}

          <button
            onClick={() => onView(paper)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1C2826] bg-[#FFFFFF] border border-[#E5DFD5] hover:bg-[#F5F1EB] rounded-md transition-colors whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5 text-[#0F5132]" />
            <span>View PDF</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadClick}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-2xs whitespace-nowrap disabled:opacity-60"
            title={isDownloading ? 'Downloading PDF...' : `Download ${paper.originalFilename || 'paper'}`}
          >
            {isDownloading ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
          </button>
        </div>
      </div>
    </article>
  );
};
