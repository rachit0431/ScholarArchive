import React from 'react';
import { Search, BookOpen, Download, ArrowRight, ShieldCheck, FileCheck, Layers, Sparkles } from 'lucide-react';
import { Paper, SystemStats } from '../types';
import { PaperCard } from '../components/PaperCard';
import { ASSETS } from '../assets/images';

interface HomePageProps {
  stats: SystemStats | null;
  recentPapers: Paper[];
  onNavigateToArchive: (filters?: { year?: string; btechYear?: string; semester?: string; examType?: string; subject?: string }) => void;
  onNavigateToSearch: (query?: string) => void;
  onNavigateToNotes?: () => void;
  onViewPaper: (paper: Paper) => void;
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (id: string) => void;
  onDownloadRecorded: (id: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  stats,
  recentPapers,
  onNavigateToArchive,
  onNavigateToSearch,
  onNavigateToNotes,
  onViewPaper,
  isBookmarked,
  onToggleBookmark,
  onDownloadRecorded,
}) => {
  const [quickSearch, setQuickSearch] = React.useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      onNavigateToSearch(quickSearch.trim());
    } else {
      onNavigateToArchive();
    }
  };

  const examTypes = ['UT 1', 'UT 2', 'Midterm 1', 'Midterm 2', 'University Exam'];
  const btechYears = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const academicYears = ['2026', '2025', '2024'];

  return (
    <div className="space-y-16">
      {/* Editorial Archival Hero */}
      <section className="relative overflow-hidden bg-[#FFFFFF] border-b border-[#E5DFD5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Narrative Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#0F5132]">
                <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                <span>Official Institutional Digital Archives</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#5C6F68]">B.Tech Examination Wing</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif-academic font-bold text-[#1C2826] leading-[1.08] tracking-tight text-balance">
                The Curated Archive of College Examination Papers.
              </h1>

              <p className="text-base sm:text-lg text-[#5C6F68] leading-relaxed max-w-2xl font-normal">
                Explore comprehensive past question papers across Unit Tests, Midterms, and University End-Semester examinations. Verified by the Controller of Examinations for rigorous academic preparation.
              </p>

              {/* Omnibox Archival Search Bar */}
              <form onSubmit={handleSearchSubmit} className="pt-2 max-w-2xl">
                <div className="flex items-center bg-[#FAF8F5] border-2 border-[#E5DFD5] focus-within:border-[#0F5132] rounded-lg p-1.5 shadow-xs transition-colors">
                  <div className="pl-3 text-[#5C6F68]">
                    <Search className="w-5 h-5 text-[#0F5132]" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by subject (e.g. Computer Networks, DBMS) or code CS501..."
                    value={quickSearch}
                    onChange={e => setQuickSearch(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-transparent focus:outline-none text-[#1C2826] placeholder-[#8F9E98]"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-2xs whitespace-nowrap"
                  >
                    Find Papers
                  </button>
                </div>

                <div className="flex items-center flex-wrap gap-2 text-xs text-[#5C6F68] mt-3">
                  <span className="font-semibold text-[#1C2826]">Popular Inquiries:</span>
                  <button
                    type="button"
                    onClick={() => onNavigateToArchive({ subject: 'Computer Networks', year: '2026', examType: 'Midterm 1' })}
                    className="hover:text-[#0F5132] hover:underline"
                  >
                    Computer Networks (2026 Midterm 1)
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => onNavigateToArchive({ subject: 'Database Management Systems' })}
                    className="hover:text-[#0F5132] hover:underline"
                  >
                    DBMS
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => onNavigateToArchive({ btechYear: '3rd Year', semester: 'Semester 5' })}
                    className="hover:text-[#0F5132] hover:underline"
                  >
                    3rd Year Sem 5
                  </button>
                </div>
              </form>
            </div>

            {/* Right Architectural Image Framing */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-xl overflow-hidden border border-[#E5DFD5] shadow-lg bg-[#FAF8F5]">
                <img
                  src={ASSETS.libraryArchive}
                  alt="Collegiate Library Reading Hall"
                  className="w-full h-80 sm:h-96 object-cover object-center"
                  referrerPolicy="no-referrer"
                />
                <div className="p-4 bg-[#FFFFFF] border-t border-[#E5DFD5]">
                  <div className="flex items-center justify-between text-xs text-[#5C6F68]">
                    <span className="font-serif-academic text-sm font-bold text-[#1C2826]">
                      Departmental Reading Folio
                    </span>
                    <span className="font-mono-code text-[11px] text-[#0F5132] font-semibold">
                      ARCHIVE REG. 2026
                    </span>
                  </div>
                  <p className="text-xs text-[#5C6F68] mt-1 leading-snug">
                    Over 500+ digitized B.Tech examination folios archived with official syllabi references and marking rubrics.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Primary Category Hubs: Exam Type & B.Tech Year */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#0F5132] block mb-1">
              Curricular Drilldown
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif-academic font-bold text-[#1C2826]">
              Browse Papers by Examination Scheme
            </h2>
          </div>
          <button
            onClick={() => onNavigateToArchive()}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0F5132] hover:text-[#064E3B] transition-colors self-start md:self-end"
          >
            <span>Open Comprehensive Archive</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Exam Type Jump Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 mb-10">
          {examTypes.map((type) => {
            const count = stats?.examTypeCounts[type] ?? 0;
            return (
              <button
                key={type}
                onClick={() => onNavigateToArchive({ examType: type })}
                className="text-left bg-[#FFFFFF] border border-[#E5DFD5] hover:border-[#0F5132] rounded-lg p-4 sm:p-5 transition-all hover:shadow-xs group"
              >
                <span className="text-[10px] font-mono-code text-[#5C6F68] uppercase block mb-1">
                  Examination Module
                </span>
                <h3 className="text-base sm:text-lg font-serif-academic font-bold text-[#1C2826] group-hover:text-[#0F5132] transition-colors">
                  {type}
                </h3>
                <div className="mt-3 flex items-center justify-between text-xs text-[#5C6F68] font-mono-code">
                  <span>{count} Papers</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#0F5132] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            );
          })}
        </div>

        {/* B.Tech Year Segments */}
        <div className="bg-[#FAF8F5] border border-[#E5DFD5] rounded-xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg sm:text-xl font-serif-academic font-bold text-[#1C2826]">
                Undergraduate Progression Directory
              </h3>
              <p className="text-xs text-[#5C6F68] mt-0.5">
                Select your academic tenure to view semester-wise curricula and examination folios.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {academicYears.map((yr) => (
                <button
                  key={yr}
                  onClick={() => onNavigateToArchive({ year: yr })}
                  className="px-3 py-1.5 text-xs font-mono-code font-medium bg-[#FFFFFF] border border-[#E5DFD5] hover:border-[#0F5132] text-[#1C2826] rounded-md transition-colors shadow-2xs"
                >
                  Year {yr}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {btechYears.map((year, idx) => {
              const semA = `Semester ${idx * 2 + 1}`;
              const semB = `Semester ${idx * 2 + 2}`;
              return (
                <div
                  key={year}
                  className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-5 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] font-mono-code uppercase text-[#0F5132] font-semibold">
                      Class Level {idx + 1}
                    </span>
                    <h4 className="text-base font-serif-academic font-bold text-[#1C2826] mt-0.5">
                      {year}
                    </h4>
                    <p className="text-xs text-[#5C6F68] mt-1">
                      Foundational & core discipline modules.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[#E5DFD5] flex items-center justify-between text-xs">
                    <button
                      onClick={() => onNavigateToArchive({ btechYear: year, semester: semA })}
                      className="text-[#0F5132] hover:underline font-semibold"
                    >
                      {semA}
                    </button>
                    <span className="text-[#CBD5E1]">·</span>
                    <button
                      onClick={() => onNavigateToArchive({ btechYear: year, semester: semB })}
                      className="text-[#0F5132] hover:underline font-semibold"
                    >
                      {semB}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* "Want Notes?" Feature Banner / Card */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-[#F0FDF4] to-[#FAF8F5] border-2 border-[#A7F3D0] rounded-xl p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-5 transition-all hover:border-[#0F5132]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#0F5132] text-white flex items-center justify-center shrink-0 shadow-xs">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-[#0F5132] bg-[#E8F5E9] px-2 py-0.5 rounded border border-[#A7F3D0]">
                  Study Materials
                </span>
                <span className="text-xs text-[#5C6F68] font-medium hidden md:inline">
                  1st, 2nd, 3rd & 4th Year
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-serif-academic font-bold text-[#1C2826] mt-1">
                Want Notes?
              </h3>
              <p className="text-xs sm:text-sm text-[#5C6F68] mt-0.5">
                Find notes for your B.Tech subjects
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToNotes}
            className="flex items-center justify-center gap-2 px-6 py-3 text-xs sm:text-sm font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-lg shadow-sm transition-all hover:gap-2.5 self-start sm:self-auto whitespace-nowrap cursor-pointer"
          >
            <span>Explore Notes</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Featured Question Papers Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#0F5132] block mb-1">
              Newly Catalogued
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif-academic font-bold text-[#1C2826]">
              Recently Added Examination Folios
            </h2>
          </div>
          <button
            onClick={() => onNavigateToArchive()}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0F5132] hover:text-[#064E3B] transition-colors"
          >
            <span>View Full Archive ({stats?.totalPapers || recentPapers.length} Papers)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {recentPapers.map((paper) => (
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
      </section>

      {/* Academic Excellence & Library Guarantee */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-8 sm:p-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-md bg-[#E8F5E9] border border-[#A7F3D0] flex items-center justify-center text-[#0F5132]">
                <FileCheck className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-serif-academic font-bold text-[#1C2826]">
                100% Genuine Question Folios
              </h4>
              <p className="text-xs text-[#5C6F68] leading-relaxed">
                Directly harvested from official examination rooms, sealed archives, and verified by departmental academic convenors.
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-md bg-[#E8F5E9] border border-[#A7F3D0] flex items-center justify-center text-[#0F5132]">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-serif-academic font-bold text-[#1C2826]">
                Multi-Tier Curricular Taxonomies
              </h4>
              <p className="text-xs text-[#5C6F68] leading-relaxed">
                Browse effortlessly by Academic Year, B.Tech Year, Semester, and Examination Type (UT 1, Midterm 1, University).
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-md bg-[#E8F5E9] border border-[#A7F3D0] flex items-center justify-center text-[#0F5132]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-serif-academic font-bold text-[#1C2826]">
                Autonomous Faculty Governance
              </h4>
              <p className="text-xs text-[#5C6F68] leading-relaxed">
                Protected administrative upload pipeline with real PDF file storage and instantaneous student access.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
