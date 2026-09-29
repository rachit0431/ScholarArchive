import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  RotateCcw,
  LayoutGrid,
  List,
  Eye,
  Download,
  Trash2,
  Calendar,
  Clock,
  Award,
  BookOpen,
  FileText,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Printer,
  Bookmark,
  Check,
  AlertCircle,
  ArrowLeft,
  Share2,
} from 'lucide-react';
import { Paper, Subject } from '../types';
import { api } from '../services/api';
import { PdfCanvasViewer } from '../components/PdfCanvasViewer';

interface LibraryPageProps {
  papers: Paper[];
  subjects: Subject[];
  years: string[];
  examTypes: string[];
  isAdmin?: boolean;
  onOpenAddPaper?: () => void;
  onViewPdfModal?: (paper: Paper) => void;
  onPaperDeleted: (paperId: string) => void;
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (id: string) => void;
  onDownloadRecorded: (id: string) => void;
  selectedPaperForDetails?: Paper | null;
  onSelectPaperForDetails?: (paper: Paper | null) => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({
  papers,
  subjects,
  years,
  examTypes,
  isAdmin = false,
  onOpenAddPaper,
  onViewPdfModal,
  onPaperDeleted,
  isBookmarked,
  onToggleBookmark,
  onDownloadRecorded,
  selectedPaperForDetails: selectedPaperProp,
  onSelectPaperForDetails,
}) => {
  // View mode: 'grid' (modern cards) or 'table'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Dedicated Paper Details view state
  const [internalSelectedPaper, setInternalSelectedPaper] = useState<Paper | null>(selectedPaperProp || null);

  const activePaper = selectedPaperProp !== undefined ? selectedPaperProp : internalSelectedPaper;

  const handleOpenPaper = (paper: Paper | null) => {
    setInternalSelectedPaper(paper);
    if (onSelectPaperForDetails) {
      onSelectPaperForDetails(paper);
    } else if (paper) {
      if (window.location.pathname !== `/papers/${paper.id}`) {
        window.history.pushState(null, '', `/papers/${paper.id}`);
      }
    } else {
      if (window.location.pathname.startsWith('/papers/') || window.location.pathname.startsWith('/paper/')) {
        window.history.pushState(null, '', '/');
      }
    }
  };

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('All');
  const [selectedBtechYear, setSelectedBtechYear] = useState('All');
  const [selectedSemester, setSelectedSemester] = useState('All');
  const [selectedExamType, setSelectedExamType] = useState('All');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  // Delete modal state
  const [paperToDelete, setPaperToDelete] = useState<Paper | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Download feedback state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);

  const btechYearsList = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const semestersList = [
    'Semester 1', 'Semester 2', 'Semester 3', 'Semester 4',
    'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8',
  ];

  // Filtered papers
  const filteredPapers = useMemo(() => {
    return papers.filter((paper) => {
      if (selectedAcademicYear !== 'All' && paper.academicYear !== selectedAcademicYear) return false;
      if (selectedBtechYear !== 'All' && paper.btechYear.toLowerCase() !== selectedBtechYear.toLowerCase()) return false;
      if (selectedSemester !== 'All' && paper.semester.toLowerCase() !== selectedSemester.toLowerCase()) return false;
      if (selectedExamType !== 'All' && paper.examType.toLowerCase() !== selectedExamType.toLowerCase()) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inName = paper.subjectName?.toLowerCase().includes(q);
        const inCode = paper.subjectCode?.toLowerCase().includes(q);
        const inDesc = paper.description?.toLowerCase().includes(q);
        if (!inName && !inCode && !inDesc) return false;
      }

      return true;
    });
  }, [papers, selectedAcademicYear, selectedBtechYear, selectedSemester, selectedExamType, searchQuery]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedAcademicYear, selectedBtechYear, selectedSemester, selectedExamType, itemsPerPage]);

  // Keep internalSelectedPaper in sync with updated papers list
  React.useEffect(() => {
    if (internalSelectedPaper) {
      const updated = papers.find(p => p.id === internalSelectedPaper.id);
      if (updated) {
        setInternalSelectedPaper(updated);
      }
    }
  }, [papers]);

  const totalPages = Math.max(1, Math.ceil(filteredPapers.length / itemsPerPage));
  const paginatedPapers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPapers.slice(start, start + itemsPerPage);
  }, [filteredPapers, currentPage, itemsPerPage]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedAcademicYear !== 'All' ||
    selectedBtechYear !== 'All' ||
    selectedSemester !== 'All' ||
    selectedExamType !== 'All';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedAcademicYear('All');
    setSelectedBtechYear('All');
    setSelectedSemester('All');
    setSelectedExamType('All');
    setCurrentPage(1);
  };

  const handleDownloadPaper = async (paper: Paper, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setDownloadingId(paper.id);
      await api.downloadPaperBlob(paper.id, paper.originalFilename || `${paper.subjectCode}-${paper.examType}.pdf`);
      setDownloadSuccessId(paper.id);
      onDownloadRecorded(paper.id);
      setTimeout(() => setDownloadSuccessId(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to download PDF document.');
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmDeletePaper = async () => {
    if (!paperToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await api.deletePaper(paperToDelete.id);
      onPaperDeleted(paperToDelete.id);
      if (activePaper?.id === paperToDelete.id) {
        handleOpenPaper(null);
      }
      setPaperToDelete(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete question paper. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Format examination date
  const formatExamDate = (dateStr?: string) => {
    if (!dateStr) return 'Not Specified';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // =========================================================================
  // SUB-VIEW: DEDICATED PAPER DETAILS PAGE (WITH EMBEDDED PDF VIEWER)
  // =========================================================================
  if (activePaper) {
    const paper = activePaper;
    const viewUrl = api.getQuestionPaperPdfUrl(paper.id);
    const bookmarked = isBookmarked(paper.id);

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Breadcrumb & Back Action */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5DFD5]">
          <button
            onClick={() => handleOpenPaper(null)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#0F5132] bg-[#E8F5E9] hover:bg-[#D1FAE5] border border-[#A7F3D0] rounded-md transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Question Papers Library</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleBookmark(paper.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md transition-colors ${
                bookmarked
                  ? 'bg-[#E8F5E9] text-[#0F5132] border-[#A7F3D0]'
                  : 'bg-white text-[#5C6F68] border-[#E5DFD5] hover:text-[#0F5132]'
              }`}
              title={bookmarked ? 'Remove from My Archive' : 'Save to My Archive'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? 'fill-current' : ''}`} />
              <span>{bookmarked ? 'Saved to Archive' : 'Save to My Archive'}</span>
            </button>

            <button
              onClick={() => window.open(viewUrl, '_blank')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1C2826] bg-white border border-[#E5DFD5] hover:bg-[#F5F1EB] rounded-md transition-colors"
              title="Print Question Paper"
            >
              <Printer className="w-3.5 h-3.5 text-[#5C6F68]" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={(e) => handleDownloadPaper(paper, e)}
              disabled={downloadingId === paper.id}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md shadow-xs transition-colors disabled:opacity-50"
            >
              {downloadSuccessId === paper.id ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Downloaded</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            {isAdmin && (
              <button
                onClick={() => setPaperToDelete(paper)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#991B1B] bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FCA5A5] rounded-md transition-colors"
                title="Admin: Delete from Repository"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
          </div>
        </div>

        {/* Paper Metadata Executive Header */}
        <div className="bg-white border border-[#E5DFD5] rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-mono-code font-bold text-[#0F5132] bg-[#E8F5E9] border border-[#A7F3D0] rounded-md">
              {paper.subjectCode}
            </span>
            <span className="px-2.5 py-1 text-xs font-semibold text-[#1C2826] bg-[#FAF8F5] border border-[#E5DFD5] rounded-md">
              {paper.examType}
            </span>
            <span className="px-2.5 py-1 text-xs font-medium text-[#5C6F68] bg-[#FAF8F5] border border-[#E5DFD5] rounded-md">
              Academic Year: {paper.academicYear}
            </span>
            <span className="px-2.5 py-1 text-xs font-medium text-[#5C6F68] bg-[#FAF8F5] border border-[#E5DFD5] rounded-md">
              {paper.btechYear} · {paper.semester}
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-serif-academic font-bold text-[#1C2826]">
              {paper.subjectName}
            </h1>
            {paper.description && (
              <p className="text-xs sm:text-sm text-[#5C6F68] mt-2 max-w-3xl leading-relaxed">
                {paper.description}
              </p>
            )}
          </div>

          {/* Grid of Key Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#E5DFD5]/70">
            <div className="bg-[#FAF8F5] p-3 rounded-lg border border-[#E5DFD5]/60">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#5C6F68] flex items-center gap-1.5 mb-1">
                <Calendar className="w-3 h-3 text-[#0F5132]" />
                Examination Date
              </span>
              <p className="text-xs font-semibold text-[#1C2826]">
                {formatExamDate(paper.paperDate)}
              </p>
            </div>

            <div className="bg-[#FAF8F5] p-3 rounded-lg border border-[#E5DFD5]/60">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#5C6F68] flex items-center gap-1.5 mb-1">
                <Award className="w-3 h-3 text-[#0F5132]" />
                Maximum Marks
              </span>
              <p className="text-xs font-semibold text-[#1C2826]">
                {paper.maxMarks || 100} Marks
              </p>
            </div>

            <div className="bg-[#FAF8F5] p-3 rounded-lg border border-[#E5DFD5]/60">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#5C6F68] flex items-center gap-1.5 mb-1">
                <Clock className="w-3 h-3 text-[#0F5132]" />
                Duration
              </span>
              <p className="text-xs font-semibold text-[#1C2826]">
                {paper.durationMinutes || 180} Minutes ({Math.round((paper.durationMinutes || 180) / 60)} Hours)
              </p>
            </div>

            <div className="bg-[#FAF8F5] p-3 rounded-lg border border-[#E5DFD5]/60">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#5C6F68] flex items-center gap-1.5 mb-1">
                <FileText className="w-3 h-3 text-[#0F5132]" />
                Permanent File
              </span>
              <p className="text-xs font-mono-code font-semibold text-[#1C2826] truncate" title={paper.originalFilename}>
                {paper.fileSizeFormatted || 'PDF Document'}
              </p>
            </div>
          </div>
        </div>

        {/* Embedded Full-Width PDF Viewer */}
        <div className="bg-white border border-[#E5DFD5] rounded-xl shadow-md overflow-hidden flex flex-col">
          <div className="bg-[#FAF8F5] border-b border-[#E5DFD5] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#0F5132]" />
              <span className="text-xs font-semibold text-[#1C2826]">
                Embedded Interactive PDF Reader
              </span>
              <span className="text-[11px] text-[#5C6F68]">
                · High-fidelity browser viewer
              </span>
            </div>
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[#0F5132] hover:underline flex items-center gap-1"
            >
              <span>Fullscreen Reader</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="w-full h-[78vh] min-h-[600px] bg-[#3B4245] relative">
            <PdfCanvasViewer
              url={viewUrl}
              title={`${paper.subjectCode}: ${paper.subjectName}`}
              filename={paper.originalFilename || `${paper.subjectCode}-${paper.examType}.pdf`}
              onDownload={() => handleDownloadPaper(paper)}
              className="w-full h-full border-0 rounded-none"
            />
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {paperToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white border border-[#E5DFD5] rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center gap-3 text-[#991B1B]">
                <div className="w-10 h-10 rounded-full bg-[#FEF2F2] flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-serif-academic font-bold text-[#1C2826]">
                    Delete Question Paper?
                  </h3>
                  <p className="text-xs text-[#5C6F68]">
                    This action will permanently remove this PDF and its archival record from the database.
                  </p>
                </div>
              </div>

              <div className="bg-[#FAF8F5] p-3 rounded-md border border-[#E5DFD5] text-xs">
                <span className="font-semibold text-[#1C2826] block">
                  {paperToDelete.subjectCode}: {paperToDelete.subjectName}
                </span>
                <span className="text-[#5C6F68] font-mono-code">
                  {paperToDelete.examType} · {paperToDelete.academicYear} · {paperToDelete.btechYear}
                </span>
              </div>

              {deleteError && (
                <p className="text-xs text-[#991B1B] bg-[#FEF2F2] p-2 rounded border border-[#FCA5A5]">
                  {deleteError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setPaperToDelete(null)}
                  disabled={isDeleting}
                  className="px-3.5 py-1.5 text-xs font-medium text-[#5C6F68] hover:text-[#1C2826] border border-[#E5DFD5] rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeletePaper}
                  disabled={isDeleting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] rounded-md transition-colors flex items-center gap-1.5"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // MAIN VIEW: QUESTION PAPERS LIBRARY (CARDS & TABLE)
  // =========================================================================
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-[#E5DFD5] rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold tracking-widest uppercase bg-[#E8F5E9] text-[#0F5132] border border-[#A7F3D0] rounded-full">
                Permanent Institutional Repository
              </span>
              <span className="text-xs text-[#5C6F68]">
                {papers.length} Question Papers Archived
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif-academic font-bold text-[#1C2826]">
              Question Papers Library
            </h1>
            <p className="text-xs sm:text-sm text-[#5C6F68] max-w-2xl">
              Centralized library of examination question papers. Browse by academic year, B.Tech year, semester, or examination format, preview PDFs in-browser, download, or manage records.
            </p>
          </div>

          {/* Action Header: Add Paper & View Mode Toggle */}
          <div className="flex items-center gap-3 self-start md:self-center shrink-0">
            {onOpenAddPaper && (
              <button
                onClick={onOpenAddPaper}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add New Question Paper</span>
              </button>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#FAF8F5] border border-[#E5DFD5] rounded-md p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded text-xs transition-colors flex items-center gap-1 ${
                  viewMode === 'grid'
                    ? 'bg-white text-[#0F5132] font-semibold shadow-2xs border border-[#E5DFD5]/60'
                    : 'text-[#5C6F68] hover:text-[#1C2826]'
                }`}
                title="Cards Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded text-xs transition-colors flex items-center gap-1 ${
                  viewMode === 'table'
                    ? 'bg-white text-[#0F5132] font-semibold shadow-2xs border border-[#E5DFD5]/60'
                    : 'text-[#5C6F68] hover:text-[#1C2826]'
                }`}
                title="Structured Table View"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-6 pt-6 border-t border-[#E5DFD5] space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by subject name or subject code (e.g. CS501)..."
                className="w-full pl-9 pr-8 py-2 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-xs text-[#1C2826] placeholder-[#5C6F68] focus:outline-none focus:border-[#0F5132] focus:bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#5C6F68] hover:text-[#1C2826]"
                >
                  ×
                </button>
              )}
            </div>

            {/* Academic Year Filter */}
            <div className="md:col-span-2">
              <select
                value={selectedAcademicYear}
                onChange={(e) => setSelectedAcademicYear(e.target.value)}
                className="w-full px-2.5 py-2 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-xs text-[#1C2826] focus:outline-none focus:border-[#0F5132] focus:bg-white"
              >
                <option value="All">All Academic Years</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    Year: {y}
                  </option>
                ))}
              </select>
            </div>

            {/* B.Tech Year Filter */}
            <div className="md:col-span-2">
              <select
                value={selectedBtechYear}
                onChange={(e) => setSelectedBtechYear(e.target.value)}
                className="w-full px-2.5 py-2 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-xs text-[#1C2826] focus:outline-none focus:border-[#0F5132] focus:bg-white"
              >
                <option value="All">All B.Tech Years</option>
                {btechYearsList.map((by) => (
                  <option key={by} value={by}>
                    {by}
                  </option>
                ))}
              </select>
            </div>

            {/* Semester Filter */}
            <div className="md:col-span-2">
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="w-full px-2.5 py-2 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-xs text-[#1C2826] focus:outline-none focus:border-[#0F5132] focus:bg-white"
              >
                <option value="All">All Semesters</option>
                {semestersList.map((sem) => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>

            {/* Exam Type Filter */}
            <div className="md:col-span-1">
              <select
                value={selectedExamType}
                onChange={(e) => setSelectedExamType(e.target.value)}
                className="w-full px-2 py-2 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-xs text-[#1C2826] focus:outline-none focus:border-[#0F5132] focus:bg-white"
              >
                <option value="All">All Exams</option>
                {examTypes.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filter Pill & Count */}
          <div className="flex flex-wrap items-center justify-between text-xs text-[#5C6F68] pt-1">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="text-[#1C2826]">{filteredPapers.length}</strong> of{' '}
                <strong className="text-[#1C2826]">{papers.length}</strong> papers in library
              </span>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 text-[#991B1B] hover:underline font-medium ml-2"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset All Filters</span>
                </button>
              )}
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span>Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="bg-transparent border border-[#E5DFD5] rounded px-1.5 py-0.5 text-xs text-[#1C2826] focus:outline-none"
              >
                <option value={8}>8 per page</option>
                <option value={12}>12 per page</option>
                <option value={24}>24 per page</option>
                <option value={48}>48 per page</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredPapers.length === 0 ? (
        <div className="bg-white border border-[#E5DFD5] rounded-xl p-12 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-[#5C6F68] mx-auto opacity-40" />
          <h3 className="text-lg font-serif-academic font-bold text-[#1C2826]">
            No Question Papers Found
          </h3>
          <p className="text-xs text-[#5C6F68] max-w-md mx-auto">
            {hasActiveFilters
              ? 'No question papers match the current search query and filters. Try clearing some filters.'
              : 'There are currently no question papers uploaded to the library repository.'}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 text-xs font-semibold text-[#0F5132] bg-[#E8F5E9] hover:bg-[#D1FAE5] rounded-md transition-colors"
            >
              Clear All Filters
            </button>
          ) : onOpenAddPaper ? (
            <button
              onClick={onOpenAddPaper}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors"
            >
              Upload First Question Paper
            </button>
          ) : null}
        </div>
      ) : viewMode === 'grid' ? (
        /* =========================================================================
           CARDS VIEW
           ========================================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {paginatedPapers.map((paper) => {
            const bookmarked = isBookmarked(paper.id);
            return (
              <div
                key={paper.id}
                className="bg-white border border-[#E5DFD5] rounded-xl p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group border-t-4 border-t-[#0F5132]"
              >
                <div className="space-y-3">
                  {/* Top Bar: Subject Code + Exam Type + Academic Year */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 text-[11px] font-mono-code font-bold text-[#0F5132] bg-[#E8F5E9] border border-[#A7F3D0] rounded">
                      {paper.subjectCode}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-[#5C6F68] bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#E5DFD5]">
                        {paper.academicYear}
                      </span>
                      <button
                        onClick={() => onToggleBookmark(paper.id)}
                        className={`p-1 rounded hover:bg-[#FAF8F5] transition-colors ${
                          bookmarked ? 'text-[#0F5132]' : 'text-[#A0AEC0]'
                        }`}
                        title={bookmarked ? 'Remove from My Archive' : 'Save to My Archive'}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Subject Name (Clickable to open dedicated details page) */}
                  <div>
                    <span className="inline-block text-[10px] uppercase font-semibold text-[#0F5132] mb-0.5">
                      {paper.examType}
                    </span>
                    <h3
                      onClick={() => handleOpenPaper(paper)}
                      className="text-base font-serif-academic font-bold text-[#1C2826] line-clamp-2 cursor-pointer hover:text-[#0F5132] transition-colors"
                      title={paper.subjectName}
                    >
                      {paper.subjectName}
                    </h3>
                  </div>

                  {/* Metadata Chips Grid */}
                  <div className="pt-2 border-t border-[#E5DFD5]/60 space-y-1.5 text-xs text-[#5C6F68]">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#5C6F68]">Cohort:</span>
                      <span className="font-medium text-[#1C2826]">
                        {paper.btechYear} · {paper.semester}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 text-[#5C6F68]">
                        <Calendar className="w-3 h-3 text-[#0F5132]" />
                        Date:
                      </span>
                      <span className="font-medium text-[#1C2826]">
                        {formatExamDate(paper.paperDate)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 text-[#5C6F68]">
                        <Award className="w-3 h-3 text-[#0F5132]" />
                        Max Marks:
                      </span>
                      <span className="font-medium text-[#1C2826]">
                        {paper.maxMarks || 100} Marks
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 text-[#5C6F68]">
                        <Clock className="w-3 h-3 text-[#0F5132]" />
                        Duration:
                      </span>
                      <span className="font-medium text-[#1C2826]">
                        {paper.durationMinutes || 180} Mins
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer: View PDF, Download, Delete */}
                <div className="mt-4 pt-3 border-t border-[#E5DFD5] space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* View PDF: Opens embedded viewer inside website */}
                    <button
                      onClick={() => handleOpenPaper(paper)}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#0F5132] bg-[#E8F5E9] hover:bg-[#D1FAE5] border border-[#A7F3D0] rounded-md transition-colors"
                      title="View PDF inside the website"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View PDF</span>
                    </button>

                    {/* Download PDF */}
                    <button
                      onClick={(e) => handleDownloadPaper(paper, e)}
                      disabled={downloadingId === paper.id}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-2xs disabled:opacity-50"
                      title="Download PDF"
                    >
                      {downloadSuccessId === paper.id ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Saved</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Secondary Details & Delete Row */}
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <button
                      onClick={() => handleOpenPaper(paper)}
                      className="text-[#0F5132] hover:underline font-medium flex items-center gap-1"
                    >
                      <span>Paper Details & Viewer</span>
                      <span>→</span>
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => setPaperToDelete(paper)}
                        className="text-[#991B1B] hover:text-[#7F1D1D] p-1 rounded hover:bg-[#FEF2F2] transition-colors"
                        title="Admin: Delete question paper"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* =========================================================================
           STRUCTURED TABLE VIEW
           ========================================================================= */
        <div className="bg-white border border-[#E5DFD5] rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E5DFD5] text-[#5C6F68] font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Subject & Code</th>
                  <th className="py-3.5 px-4">Exam Type</th>
                  <th className="py-3.5 px-4">Academic Year</th>
                  <th className="py-3.5 px-4">B.Tech Year & Sem</th>
                  <th className="py-3.5 px-4">Exam Date</th>
                  <th className="py-3.5 px-4">Marks & Time</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD5]">
                {paginatedPapers.map((paper) => (
                  <tr
                    key={paper.id}
                    className="hover:bg-[#FAF8F5]/80 transition-colors group cursor-pointer"
                    onClick={() => handleOpenPaper(paper)}
                  >
                    {/* Subject & Code */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-mono-code font-bold text-[#0F5132] bg-[#E8F5E9] border border-[#A7F3D0] rounded">
                          {paper.subjectCode}
                        </span>
                        <div>
                          <span className="font-serif-academic font-bold text-[#1C2826] block group-hover:text-[#0F5132] transition-colors">
                            {paper.subjectName}
                          </span>
                          <span className="text-[10px] text-[#5C6F68]">
                            {paper.fileSizeFormatted}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Exam Type */}
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-[#1C2826] bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#E5DFD5]">
                        {paper.examType}
                      </span>
                    </td>

                    {/* Academic Year */}
                    <td className="py-3.5 px-4 font-mono-code font-medium text-[#1C2826]">
                      {paper.academicYear}
                    </td>

                    {/* B.Tech Year & Semester */}
                    <td className="py-3.5 px-4 text-[#1C2826]">
                      <div>{paper.btechYear}</div>
                      <div className="text-[10px] text-[#5C6F68]">{paper.semester}</div>
                    </td>

                    {/* Examination Date */}
                    <td className="py-3.5 px-4 text-[#5C6F68]">
                      {formatExamDate(paper.paperDate)}
                    </td>

                    {/* Marks & Time */}
                    <td className="py-3.5 px-4 text-[#1C2826]">
                      <div>{paper.maxMarks || 100} Marks</div>
                      <div className="text-[10px] text-[#5C6F68]">
                        {paper.durationMinutes || 180} Mins
                      </div>
                    </td>

                    {/* Actions: View PDF, Download, Delete */}
                    <td className="py-3.5 px-4 text-right">
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleOpenPaper(paper)}
                          className="px-2.5 py-1 text-xs font-semibold text-[#0F5132] bg-[#E8F5E9] hover:bg-[#D1FAE5] border border-[#A7F3D0] rounded transition-colors flex items-center gap-1"
                          title="View PDF inside the website"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">View PDF</span>
                        </button>

                        <button
                          onClick={(e) => handleDownloadPaper(paper, e)}
                          disabled={downloadingId === paper.id}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded transition-colors flex items-center gap-1 shadow-2xs disabled:opacity-50"
                          title="Download PDF"
                        >
                          {downloadSuccessId === paper.id ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span className="hidden sm:inline">Download</span>
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => setPaperToDelete(paper)}
                            className="p-1.5 text-[#991B1B] hover:bg-[#FEF2F2] rounded transition-colors"
                            title="Admin: Delete from Library"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#E5DFD5] text-xs text-[#5C6F68]">
          <span>
            Page <strong className="text-[#1C2826]">{currentPage}</strong> of{' '}
            <strong className="text-[#1C2826]">{totalPages}</strong>
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setCurrentPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 180, behavior: 'smooth' });
              }}
              disabled={currentPage === 1}
              className="p-1.5 border border-[#E5DFD5] rounded bg-white hover:bg-[#FAF8F5] text-[#1C2826] disabled:opacity-40 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => {
              if (
                pg === 1 ||
                pg === totalPages ||
                (pg >= currentPage - 1 && pg <= currentPage + 1)
              ) {
                return (
                  <button
                    key={pg}
                    onClick={() => {
                      setCurrentPage(pg);
                      window.scrollTo({ top: 180, behavior: 'smooth' });
                    }}
                    className={`min-w-8 h-8 px-2 rounded text-xs font-semibold transition-colors ${
                      currentPage === pg
                        ? 'bg-[#0F5132] text-white'
                        : 'bg-white border border-[#E5DFD5] text-[#1C2826] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    {pg}
                  </button>
                );
              } else if (pg === currentPage - 2 || pg === currentPage + 2) {
                return (
                  <span key={pg} className="px-1 text-[#5C6F68]">
                    …
                  </span>
                );
              }
              return null;
            })}

            <button
              onClick={() => {
                setCurrentPage((p) => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 180, behavior: 'smooth' });
              }}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-[#E5DFD5] rounded bg-white hover:bg-[#FAF8F5] text-[#1C2826] disabled:opacity-40 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {paperToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E5DFD5] rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center gap-3 text-[#991B1B]">
              <div className="w-10 h-10 rounded-full bg-[#FEF2F2] flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-serif-academic font-bold text-[#1C2826]">
                  Delete Question Paper?
                </h3>
                <p className="text-xs text-[#5C6F68]">
                  This action will permanently remove this PDF and its archival record from the database.
                </p>
              </div>
            </div>

            <div className="bg-[#FAF8F5] p-3 rounded-md border border-[#E5DFD5] text-xs">
              <span className="font-semibold text-[#1C2826] block">
                {paperToDelete.subjectCode}: {paperToDelete.subjectName}
              </span>
              <span className="text-[#5C6F68] font-mono-code">
                {paperToDelete.examType} · {paperToDelete.academicYear} · {paperToDelete.btechYear}
              </span>
            </div>

            {deleteError && (
              <p className="text-xs text-[#991B1B] bg-[#FEF2F2] p-2 rounded border border-[#FCA5A5]">
                {deleteError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPaperToDelete(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs font-medium text-[#5C6F68] hover:text-[#1C2826] border border-[#E5DFD5] rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePaper}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] rounded-md transition-colors flex items-center gap-1.5"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
