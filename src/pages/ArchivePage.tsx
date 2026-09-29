import React, { useState, useMemo } from 'react';
import { Search, Filter, RotateCcw, LayoutGrid, List, ChevronRight, X, Download, Eye, Bookmark, FileText } from 'lucide-react';
import { Paper, Subject } from '../types';
import { PaperCard } from '../components/PaperCard';
import { api } from '../services/api';

interface ArchivePageProps {
  papers: Paper[];
  subjects: Subject[];
  years: string[];
  examTypes: string[];
  initialFilters?: {
    year?: string;
    btechYear?: string;
    semester?: string;
    examType?: string;
    subject?: string;
  };
  onViewPaper: (paper: Paper) => void;
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (id: string) => void;
  onDownloadRecorded: (id: string) => void;
}

export const ArchivePage: React.FC<ArchivePageProps> = ({
  papers,
  subjects,
  years,
  examTypes,
  initialFilters,
  onViewPaper,
  isBookmarked,
  onToggleBookmark,
  onDownloadRecorded,
}) => {
  // Selected filter states
  const [selectedYear, setSelectedYear] = useState<string>(initialFilters?.year || 'All');
  const [selectedBtechYear, setSelectedBtechYear] = useState<string>(initialFilters?.btechYear || 'All');
  const [selectedSemester, setSelectedSemester] = useState<string>(initialFilters?.semester || 'All');
  const [selectedExamType, setSelectedExamType] = useState<string>(initialFilters?.examType || 'All');
  const [selectedSubject, setSelectedSubject] = useState<string>(initialFilters?.subject || 'All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleTableDownload = async (paper: Paper) => {
    setDownloadingId(paper.id);
    try {
      await api.downloadPaperBlob(
        paper.id,
        paper.originalFilename || `${paper.subjectCode}_${paper.examType}.pdf`
      );
      if (onDownloadRecorded) {
        onDownloadRecorded(paper.id);
      }
    } catch (err: any) {
      console.error('Table download error:', err);
      alert(err.message || 'Failed to download question paper.');
    } finally {
      setDownloadingId(null);
    }
  };

  const btechYearsList = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const semestersList = [
    'Semester 1', 'Semester 2', 'Semester 3', 'Semester 4',
    'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8',
  ];

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedYear('All');
    setSelectedBtechYear('All');
    setSelectedSemester('All');
    setSelectedExamType('All');
    setSelectedSubject('All');
    setSearchQuery('');
  };

  // Filtered papers logic
  const filteredPapers = useMemo(() => {
    return papers.filter((paper) => {
      if (selectedYear !== 'All' && paper.academicYear !== selectedYear) return false;
      if (selectedBtechYear !== 'All' && paper.btechYear.toLowerCase() !== selectedBtechYear.toLowerCase()) return false;
      if (selectedSemester !== 'All' && paper.semester.toLowerCase() !== selectedSemester.toLowerCase()) return false;
      if (selectedExamType !== 'All' && paper.examType.toLowerCase() !== selectedExamType.toLowerCase()) return false;
      if (selectedSubject !== 'All') {
        const matchesName = paper.subjectName.toLowerCase() === selectedSubject.toLowerCase();
        const matchesCode = paper.subjectCode.toLowerCase() === selectedSubject.toLowerCase();
        if (!matchesName && !matchesCode) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inName = paper.subjectName.toLowerCase().includes(q);
        const inCode = paper.subjectCode.toLowerCase().includes(q);
        const inDesc = paper.description && paper.description.toLowerCase().includes(q);
        if (!inName && !inCode && !inDesc) return false;
      }
      return true;
    });
  }, [papers, selectedYear, selectedBtechYear, selectedSemester, selectedExamType, selectedSubject, searchQuery]);

  // Available subjects filtered by B.Tech Year / Semester if chosen
  const filteredSubjectOptions = useMemo(() => {
    let pool = subjects;
    if (selectedBtechYear !== 'All') {
      pool = pool.filter(s => s.btechYear === selectedBtechYear);
    }
    if (selectedSemester !== 'All') {
      pool = pool.filter(s => s.semester === selectedSemester);
    }
    return pool;
  }, [subjects, selectedBtechYear, selectedSemester]);

  // Check if any filter is active
  const hasActiveFilters =
    selectedYear !== 'All' ||
    selectedBtechYear !== 'All' ||
    selectedSemester !== 'All' ||
    selectedExamType !== 'All' ||
    selectedSubject !== 'All' ||
    searchQuery.trim().length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Archive Header */}
      <div className="border-b border-[#E5DFD5] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#0F5132] block mb-1">
            Institutional Repository
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif-academic font-bold text-[#1C2826]">
            College Question Paper Archive
          </h1>
          <p className="text-xs sm:text-sm text-[#5C6F68] mt-1 max-w-2xl">
            Browse and filter through past examination question papers across years, degrees, semesters and examination formats.
          </p>
        </div>

        {/* View Mode Toggle & Reset */}
        <div className="flex items-center gap-3 self-start md:self-end">
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#991B1B] bg-[#FEF2F2] border border-[#FCA5A5] hover:bg-[#FEE2E2] rounded-md transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}

          <div className="flex items-center bg-[#FFFFFF] border border-[#E5DFD5] rounded-md p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#E8F5E9] text-[#0F5132] font-semibold'
                  : 'text-[#5C6F68] hover:text-[#1C2826]'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#E8F5E9] text-[#0F5132] font-semibold'
                  : 'text-[#5C6F68] hover:text-[#1C2826]'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Curricular Multi-Tier Drilldown Bar */}
      <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD5]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1C2826]">
            <Filter className="w-4 h-4 text-[#0F5132]" />
            <span>Interactive Archive Filter Hierarchy</span>
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Quick search subjects..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
            />
          </div>
        </div>

        {/* Tier 1: Academic Year Filter */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5C6F68]">
              1. Academic Year
            </span>
            <span className="text-[10px] text-[#5C6F68]">Selected: {selectedYear}</span>
          </div>
          <div className="flex items-center flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedYear('All')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedYear === 'All'
                  ? 'bg-[#0F5132] text-white shadow-xs font-semibold'
                  : 'bg-[#FAF8F5] text-[#5C6F68] hover:bg-[#F5F1EB] border border-[#E5DFD5]'
              }`}
            >
              All Years
            </button>
            {years.map((yr) => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedYear === yr
                    ? 'bg-[#0F5132] text-white shadow-xs font-semibold'
                    : 'bg-[#FAF8F5] text-[#5C6F68] hover:bg-[#F5F1EB] border border-[#E5DFD5]'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        {/* Tier 2: B.Tech Year Filter */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5C6F68]">
              2. B.Tech Progression Year
            </span>
            <span className="text-[10px] text-[#5C6F68]">Selected: {selectedBtechYear}</span>
          </div>
          <div className="flex items-center flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedBtechYear('All')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedBtechYear === 'All'
                  ? 'bg-[#0F5132] text-white shadow-xs font-semibold'
                  : 'bg-[#FAF8F5] text-[#5C6F68] hover:bg-[#F5F1EB] border border-[#E5DFD5]'
              }`}
            >
              All Years
            </button>
            {btechYearsList.map((yr) => (
              <button
                key={yr}
                onClick={() => setSelectedBtechYear(yr)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedBtechYear === yr
                    ? 'bg-[#0F5132] text-white shadow-xs font-semibold'
                    : 'bg-[#FAF8F5] text-[#5C6F68] hover:bg-[#F5F1EB] border border-[#E5DFD5]'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        {/* Tier 3: Semester Filter */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5C6F68]">
              3. Semester (1 - 8)
            </span>
            <span className="text-[10px] text-[#5C6F68]">Selected: {selectedSemester}</span>
          </div>
          <div className="flex items-center flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedSemester('All')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedSemester === 'All'
                  ? 'bg-[#0F5132] text-white shadow-xs font-semibold'
                  : 'bg-[#FAF8F5] text-[#5C6F68] hover:bg-[#F5F1EB] border border-[#E5DFD5]'
              }`}
            >
              All Semesters
            </button>
            {semestersList.map((sem) => (
              <button
                key={sem}
                onClick={() => setSelectedSemester(sem)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedSemester === sem
                    ? 'bg-[#0F5132] text-white shadow-xs font-semibold'
                    : 'bg-[#FAF8F5] text-[#5C6F68] hover:bg-[#F5F1EB] border border-[#E5DFD5]'
                }`}
              >
                {sem}
              </button>
            ))}
          </div>
        </div>

        {/* Tier 4: Examination Type Filter */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5C6F68]">
              4. Examination Type
            </span>
            <span className="text-[10px] text-[#5C6F68]">Selected: {selectedExamType}</span>
          </div>
          <div className="flex items-center flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedExamType('All')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedExamType === 'All'
                  ? 'bg-[#0F5132] text-white shadow-xs font-semibold'
                  : 'bg-[#FAF8F5] text-[#5C6F68] hover:bg-[#F5F1EB] border border-[#E5DFD5]'
              }`}
            >
              All Exam Types
            </button>
            {examTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedExamType(type)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedExamType === type
                    ? 'bg-[#0F5132] text-white shadow-xs font-semibold'
                    : 'bg-[#FAF8F5] text-[#5C6F68] hover:bg-[#F5F1EB] border border-[#E5DFD5]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Tier 5: Subject Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5C6F68]">
              5. Course Module / Subject
            </span>
            <span className="text-[10px] text-[#5C6F68]">Selected: {selectedSubject}</span>
          </div>
          <div className="flex items-center flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedSubject('All')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedSubject === 'All'
                  ? 'bg-[#0F5132] text-white shadow-xs font-semibold'
                  : 'bg-[#FAF8F5] text-[#5C6F68] hover:bg-[#F5F1EB] border border-[#E5DFD5]'
              }`}
            >
              All Subjects
            </button>
            {filteredSubjectOptions.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSelectedSubject(sub.name)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedSubject === sub.name
                    ? 'bg-[#0F5132] text-white shadow-xs font-semibold'
                    : 'bg-[#FAF8F5] text-[#5C6F68] hover:bg-[#F5F1EB] border border-[#E5DFD5]'
                }`}
              >
                {sub.code}: {sub.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Drilldown Sequence Breadcrumb (Explicit requirement from prompt) */}
      {/* Example: 2026 → 3rd Year → Semester 5 → Midterm 1 → Computer Networks */}
      <div className="bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg p-3.5 px-4 flex items-center flex-wrap gap-2 text-xs">
        <span className="text-[#5C6F68] font-semibold">Active Archive Route:</span>
        <div className="flex items-center flex-wrap gap-1.5 text-[#1C2826] font-mono-code">
          <span className={selectedYear !== 'All' ? 'text-[#0F5132] font-semibold' : 'text-[#8F9E98]'}>
            {selectedYear}
          </span>
          <ChevronRight className="w-3 h-3 text-[#CBD5E1]" />
          <span className={selectedBtechYear !== 'All' ? 'text-[#0F5132] font-semibold' : 'text-[#8F9E98]'}>
            {selectedBtechYear}
          </span>
          <ChevronRight className="w-3 h-3 text-[#CBD5E1]" />
          <span className={selectedSemester !== 'All' ? 'text-[#0F5132] font-semibold' : 'text-[#8F9E98]'}>
            {selectedSemester}
          </span>
          <ChevronRight className="w-3 h-3 text-[#CBD5E1]" />
          <span className={selectedExamType !== 'All' ? 'text-[#0F5132] font-semibold' : 'text-[#8F9E98]'}>
            {selectedExamType}
          </span>
          <ChevronRight className="w-3 h-3 text-[#CBD5E1]" />
          <span className={selectedSubject !== 'All' ? 'text-[#0F5132] font-semibold' : 'text-[#8F9E98]'}>
            {selectedSubject}
          </span>
        </div>

        {/* Quick Clear Single Pill if active */}
        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="ml-auto text-[11px] text-[#991B1B] hover:underline"
          >
            Clear Route
          </button>
        )}
      </div>

      {/* Results Meta */}
      <div className="flex items-center justify-between text-xs text-[#5C6F68]">
        <p>
          Displaying <span className="font-semibold text-[#1C2826] font-mono-code">{filteredPapers.length}</span> question {filteredPapers.length === 1 ? 'folio' : 'folios'}
        </p>
        <span className="hidden sm:inline">Controller of Examinations Archival Standard</span>
      </div>

      {/* Results View: Grid or Table */}
      {filteredPapers.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#FAF8F5] border border-[#E5DFD5] text-[#5C6F68] flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-serif-academic font-bold text-[#1C2826]">
            No Question Papers Found in this Query
          </h3>
          <p className="text-xs text-[#5C6F68] max-w-md mx-auto">
            There are currently no digitized papers matching this exact combination of Year, Semester, and Exam Type. Try clearing some filters or browse all years.
          </p>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs"
          >
            Reset All Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPapers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              onView={onViewPaper}
              isBookmarked={isBookmarked(paper.id)}
              onToggleBookmark={onToggleBookmark}
              onDownloadRecorded={onDownloadRecorded}
            />
          ))}
        </div>
      ) : (
        /* Academic Catalog Table View */
        <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] border-b border-[#E5DFD5] text-[#5C6F68] uppercase font-semibold font-mono-code text-[11px]">
                <tr>
                  <th className="py-3 px-4">Subject & Code</th>
                  <th className="py-3 px-3">Year</th>
                  <th className="py-3 px-3">Semester</th>
                  <th className="py-3 px-3">Exam Type</th>
                  <th className="py-3 px-3">B.Tech Year</th>
                  <th className="py-3 px-3">Exam Date</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD5] text-[#1C2826]">
                {filteredPapers.map((paper) => (
                  <tr key={paper.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-sm font-serif-academic text-[#1C2826]">
                        {paper.subjectName}
                      </div>
                      <div className="text-[11px] text-[#0F5132] font-mono-code">
                        {paper.subjectCode} · {paper.fileSizeFormatted}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-mono-code">{paper.academicYear}</td>
                    <td className="py-3.5 px-3">{paper.semester}</td>
                    <td className="py-3.5 px-3 font-medium text-[#0F5132]">{paper.examType}</td>
                    <td className="py-3.5 px-3">{paper.btechYear}</td>
                    <td className="py-3.5 px-3 text-[#5C6F68]">{paper.paperDate || 'Scheduled'}</td>
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onToggleBookmark && (
                          <button
                            onClick={() => onToggleBookmark(paper.id)}
                            className={`p-1.5 rounded border ${
                              isBookmarked(paper.id)
                                ? 'bg-[#E8F5E9] text-[#0F5132] border-[#A7F3D0]'
                                : 'text-[#5C6F68] border-[#E5DFD5] hover:text-[#0F5132]'
                            }`}
                            title="Bookmark"
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked(paper.id) ? 'fill-current' : ''}`} />
                          </button>
                        )}
                        <button
                          onClick={() => onViewPaper(paper)}
                          className="px-2.5 py-1 text-xs font-medium text-[#1C2826] bg-[#FFFFFF] border border-[#E5DFD5] hover:bg-[#F5F1EB] rounded transition-colors"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTableDownload(paper)}
                          disabled={downloadingId === paper.id}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded transition-colors disabled:opacity-60 flex items-center gap-1"
                        >
                          {downloadingId === paper.id ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>...</span>
                            </>
                          ) : (
                            <span>Download</span>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
