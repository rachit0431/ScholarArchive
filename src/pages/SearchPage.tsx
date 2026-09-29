import React, { useState, useMemo } from 'react';
import { Search, X, Filter, BookOpen, Clock, FileText } from 'lucide-react';
import { Paper } from '../types';
import { PaperCard } from '../components/PaperCard';

interface SearchPageProps {
  papers: Paper[];
  initialQuery?: string;
  onViewPaper: (paper: Paper) => void;
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (id: string) => void;
  onDownloadRecorded: (id: string) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  papers,
  initialQuery = '',
  onViewPaper,
  isBookmarked,
  onToggleBookmark,
  onDownloadRecorded,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [selectedExamType, setSelectedExamType] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');

  const popularQueries = [
    'Computer Networks',
    'Database Management Systems',
    'CS501',
    'Data Structures',
    'Midterm 1',
    'University Exam',
    'Operating Systems',
    'Cyber Security',
  ];

  const searchResults = useMemo(() => {
    if (!query.trim() && selectedExamType === 'All' && selectedYear === 'All') {
      return papers;
    }

    const q = query.toLowerCase().trim();

    return papers.filter((paper) => {
      const matchExam = selectedExamType === 'All' || paper.examType.toLowerCase() === selectedExamType.toLowerCase();
      const matchYear = selectedYear === 'All' || paper.academicYear === selectedYear;

      if (!matchExam || !matchYear) return false;

      if (!q) return true;

      const inName = paper.subjectName.toLowerCase().includes(q);
      const inCode = paper.subjectCode.toLowerCase().includes(q);
      const inYear = paper.academicYear.toLowerCase().includes(q);
      const inSem = paper.semester.toLowerCase().includes(q);
      const inExam = paper.examType.toLowerCase().includes(q);
      const inBtech = paper.btechYear.toLowerCase().includes(q);
      const inDesc = paper.description && paper.description.toLowerCase().includes(q);

      return inName || inCode || inYear || inSem || inExam || inBtech || inDesc;
    });
  }, [papers, query, selectedExamType, selectedYear]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Search Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#0F5132]">
          Catalog Index Search
        </span>
        <h1 className="text-3xl sm:text-4xl font-serif-academic font-bold text-[#1C2826]">
          Search Examination Archives
        </h1>
        <p className="text-xs sm:text-sm text-[#5C6F68]">
          Instant live search across subject titles, course codes, semester designations, and question paper metadata.
        </p>
      </div>

      {/* Main Search Input */}
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-center bg-[#FFFFFF] border-2 border-[#E5DFD5] focus-within:border-[#0F5132] rounded-xl p-2 shadow-xs transition-colors">
          <Search className="w-5 h-5 text-[#0F5132] ml-3" />
          <input
            type="text"
            placeholder="Type subject name (e.g. Computer Networks), code (CS501), or topic..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full px-4 py-2.5 text-sm bg-transparent focus:outline-none text-[#1C2826] placeholder-[#8F9E98]"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1.5 text-[#5C6F68] hover:text-[#1C2826] mr-2"
              title="Clear Search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick query chips */}
        <div className="flex items-center flex-wrap gap-2 text-xs text-[#5C6F68] mt-3 justify-center">
          <span className="font-semibold text-[#1C2826]">Recommended Queries:</span>
          {popularQueries.map((term) => (
            <button
              key={term}
              onClick={() => setQuery(term)}
              className="hover:text-[#0F5132] hover:underline"
            >
              {term}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-3.5 px-5 text-xs text-[#5C6F68]">
        <div className="flex items-center flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#1C2826]">Exam Type:</span>
            <select
              value={selectedExamType}
              onChange={e => setSelectedExamType(e.target.value)}
              className="bg-[#FAF8F5] border border-[#E5DFD5] rounded px-2.5 py-1 text-xs text-[#1C2826]"
            >
              <option value="All">All Exam Types</option>
              <option value="UT 1">UT 1</option>
              <option value="UT 2">UT 2</option>
              <option value="Midterm 1">Midterm 1</option>
              <option value="Midterm 2">Midterm 2</option>
              <option value="University Exam">University Exam</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#1C2826]">Year:</span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="bg-[#FAF8F5] border border-[#E5DFD5] rounded px-2.5 py-1 text-xs text-[#1C2826]"
            >
              <option value="All">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
            </select>
          </div>
        </div>

        <div>
          <span>
            Matched <strong className="text-[#1C2826] font-mono-code">{searchResults.length}</strong> question {searchResults.length === 1 ? 'folio' : 'folios'}
          </span>
        </div>
      </div>

      {/* Search Results Grid */}
      {searchResults.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-12 text-center space-y-3">
          <FileText className="w-8 h-8 text-[#5C6F68] mx-auto opacity-40" />
          <h3 className="text-lg font-serif-academic font-bold text-[#1C2826]">
            No examination papers match "{query}"
          </h3>
          <p className="text-xs text-[#5C6F68] max-w-sm mx-auto">
            Check the spelling or try searching by generic keywords like "Midterm", "Networks", or "2026".
          </p>
          <button
            onClick={() => {
              setQuery('');
              setSelectedExamType('All');
              setSelectedYear('All');
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {searchResults.map((paper) => (
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
      )}
    </div>
  );
};
