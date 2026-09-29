import React, { useState, useMemo } from 'react';
import {
  Search,
  BookOpen,
  Download,
  Eye,
  Layers,
  Calendar,
  FileText,
  Check,
  ArrowRight,
  Sparkles,
  Filter,
  Bookmark,
  Award,
  Clock,
} from 'lucide-react';
import { Note } from '../types';
import { api } from '../services/api';

interface NotesPageProps {
  notes: Note[];
  onViewNote: (note: Note) => void;
  onNavigateToQuestionPapers?: () => void;
  onDownloadRecorded?: (id: string, type?: 'paper' | 'note') => void;
  isBookmarked?: (id: string) => boolean;
  onToggleBookmark?: (id: string) => void;
}

export const NotesPage: React.FC<NotesPageProps> = ({
  notes,
  onViewNote,
  onNavigateToQuestionPapers,
  onDownloadRecorded,
  isBookmarked,
  onToggleBookmark,
}) => {
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedSemester, setSelectedSemester] = useState('All');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);

  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const semesters = [
    'Semester 1',
    'Semester 2',
    'Semester 3',
    'Semester 4',
    'Semester 5',
    'Semester 6',
    'Semester 7',
    'Semester 8',
  ];

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      if (selectedYear !== 'All' && note.btechYear.toLowerCase() !== selectedYear.toLowerCase()) {
        return false;
      }
      if (selectedSemester !== 'All' && note.semester.toLowerCase() !== selectedSemester.toLowerCase()) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const inTitle = note.title.toLowerCase().includes(q);
        const inSubject = note.subjectName.toLowerCase().includes(q);
        const inCode = note.subjectCode.toLowerCase().includes(q);
        const inDesc = note.description && note.description.toLowerCase().includes(q);
        if (!inTitle && !inSubject && !inCode && !inDesc) {
          return false;
        }
      }
      return true;
    });
  }, [notes, selectedYear, selectedSemester, search]);

  const handleDownload = async (note: Note) => {
    setDownloadingId(note.id);
    try {
      await api.downloadNoteBlob(note.id, note.originalFilename || `${note.subjectCode}-Notes.pdf`);
      if (onDownloadRecorded) {
        onDownloadRecorded(note.id, 'note');
      } else {
        api.recordDownload(note.id, 'note').catch(() => {});
      }
      setDownloadSuccessId(note.id);
      setTimeout(() => {
        setDownloadSuccessId(prev => (prev === note.id ? null : prev));
      }, 3000);
    } catch (err: any) {
      console.error('Note download error:', err);
      alert(err.message || 'Failed to download note document.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-20">
      {/* Editorial Header */}
      <section className="bg-[#FFFFFF] border-b border-[#E5DFD5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#0F5132] mb-2">
                <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                <span>Curated Academic Repository</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#5C6F68]">B.Tech Course Material</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif-academic font-bold text-[#1C2826] tracking-tight">
                Notes Library
              </h1>
              <p className="text-sm sm:text-base text-[#5C6F68] mt-2 max-w-2xl font-normal leading-relaxed">
                Study material for your B.Tech journey. High-quality subject notes, handwritten summaries, and comprehensive revision sheets verified for academic excellence.
              </p>
            </div>

            {onNavigateToQuestionPapers && (
              <button
                onClick={onNavigateToQuestionPapers}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#0F5132] hover:text-[#064E3B] transition-colors self-start md:self-auto bg-[#FAF8F5] border border-[#E5DFD5] px-3.5 py-2 rounded-md hover:bg-[#F5F1EB]"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#0F5132]" />
                <span>Switch to Question Papers</span>
                <ArrowRight className="w-3 h-3 ml-0.5" />
              </button>
            )}
          </div>

          {/* Search Bar & Primary Filter Controls */}
          <div className="mt-8 pt-6 border-t border-[#E5DFD5] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Search input */}
            <div className="relative flex-1 max-w-xl">
              <Search className="w-4 h-4 text-[#5C6F68] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search notes by subject name (e.g. Computer Networks), code (CS501), or title..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#FAF8F5] border border-[#E5DFD5] focus:border-[#0F5132] rounded-lg text-[#1C2826] focus:outline-none transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#5C6F68] hover:text-[#1C2826]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Year Pill Selectors */}
            <div className="flex items-center flex-wrap gap-2 text-xs">
              <span className="font-semibold text-[#1C2826] flex items-center gap-1 mr-1">
                <Filter className="w-3.5 h-3.5 text-[#0F5132]" />
                <span>Year:</span>
              </span>
              <button
                onClick={() => setSelectedYear('All')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  selectedYear === 'All'
                    ? 'bg-[#0F5132] text-white shadow-2xs'
                    : 'bg-[#FAF8F5] text-[#5C6F68] border border-[#E5DFD5] hover:border-[#0F5132]'
                }`}
              >
                All Years
              </button>
              {years.map(yr => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    selectedYear === yr
                      ? 'bg-[#0F5132] text-white shadow-2xs'
                      : 'bg-[#FAF8F5] text-[#5C6F68] border border-[#E5DFD5] hover:border-[#0F5132]'
                  }`}
                >
                  {yr}
                </button>
              ))}

              <div className="h-4 w-[1px] bg-[#E5DFD5] mx-1 hidden sm:block"></div>

              {/* Semester Dropdown */}
              <select
                value={selectedSemester}
                onChange={e => setSelectedSemester(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-[#1C2826] focus:border-[#0F5132] focus:outline-none"
              >
                <option value="All">All Semesters</option>
                {semesters.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex items-center justify-between pb-4 border-b border-[#E5DFD5] mb-6">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0F5132]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#1C2826] font-mono-code">
              Showing <span className="text-[#0F5132] font-bold">{filteredNotes.length}</span> study notes
            </h2>
          </div>

          {(selectedYear !== 'All' || selectedSemester !== 'All' || search) && (
            <button
              onClick={() => {
                setSelectedYear('All');
                setSelectedSemester('All');
                setSearch('');
              }}
              className="text-xs text-[#0F5132] hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>

        {filteredNotes.length === 0 ? (
          <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-12 text-center max-w-lg mx-auto my-12 space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#FAF8F5] border border-[#E5DFD5] flex items-center justify-center text-[#5C6F68] mx-auto">
              <FileText className="w-6 h-6 text-[#0F5132]" />
            </div>
            <h3 className="text-lg font-serif-academic font-bold text-[#1C2826]">No Notes Found</h3>
            <p className="text-xs text-[#5C6F68] leading-relaxed">
              No study materials match your search or filter options. Try adjusting the query, year, or semester.
            </p>
            <button
              onClick={() => {
                setSelectedYear('All');
                setSelectedSemester('All');
                setSearch('');
              }}
              className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors"
            >
              Show All Notes
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNotes.map(note => {
              const isDownloading = downloadingId === note.id;
              const isDownloaded = downloadSuccessId === note.id;
              const bookmarked = isBookmarked ? isBookmarked(note.id) : false;

              return (
                <div
                  key={note.id}
                  className="bg-white border border-[#E5DFD5] rounded-xl p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group border-t-4 border-t-[#0F5132]"
                >
                  <div className="space-y-3">
                    {/* Top Bar: Subject Code + Cohort + Bookmark Feature */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 text-[11px] font-mono-code font-bold text-[#0F5132] bg-[#E8F5E9] border border-[#A7F3D0] rounded">
                        {note.subjectCode}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-[#5C6F68] bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#E5DFD5]">
                          {note.btechYear} · {note.semester}
                        </span>
                        {onToggleBookmark && (
                          <button
                            type="button"
                            onClick={() => onToggleBookmark(note.id)}
                            className={`p-1 rounded hover:bg-[#FAF8F5] transition-colors ${
                              bookmarked ? 'text-[#0F5132]' : 'text-[#A0AEC0] hover:text-[#0F5132]'
                            }`}
                            title={bookmarked ? 'Remove from My Archive' : 'Save to My Archive'}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? 'fill-current' : ''}`} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Category Label + Title + Subject */}
                    <div>
                      <span className="inline-block text-[10px] uppercase font-semibold text-[#0F5132] mb-0.5">
                        Study Notes
                      </span>
                      <h3
                        onClick={() => onViewNote(note)}
                        className="text-base font-serif-academic font-bold text-[#1C2826] line-clamp-2 cursor-pointer hover:text-[#0F5132] transition-colors leading-snug"
                        title={note.title}
                      >
                        {note.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-[#5C6F68] mt-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[#0F5132] shrink-0" />
                        <span className="font-medium text-[#1C2826] truncate">{note.subjectName}</span>
                      </div>
                    </div>

                    {/* Description if present */}
                    {note.description && (
                      <p className="text-xs text-[#5C6F68] line-clamp-2 leading-relaxed bg-[#FAF8F5] p-2.5 rounded-md border border-[#E5DFD5]">
                        {note.description}
                      </p>
                    )}

                    {/* Metadata Chips Grid */}
                    <div className="pt-2 border-t border-[#E5DFD5]/60 space-y-1.5 text-xs text-[#5C6F68]">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#5C6F68]">Cohort:</span>
                        <span className="font-medium text-[#1C2826]">
                          {note.btechYear} · {note.semester}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1 text-[#5C6F68]">
                          <Calendar className="w-3 h-3 text-[#0F5132]" />
                          Date:
                        </span>
                        <span className="font-medium text-[#1C2826]">
                          {note.uploadedAt
                            ? new Date(note.uploadedAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'Curated'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1 text-[#5C6F68]">
                          <FileText className="w-3 h-3 text-[#0F5132]" />
                          Document Size:
                        </span>
                        <span className="font-mono-code font-medium text-[#1C2826]">
                          {note.fileSizeFormatted}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1 text-[#5C6F68]">
                          <Download className="w-3 h-3 text-[#0F5132]" />
                          Downloads:
                        </span>
                        <span className="font-mono-code font-medium text-[#1C2826]">
                          {note.downloadsCount || 0} downloads
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Footer: View PDF, Download, Secondary Viewer Link */}
                  <div className="mt-4 pt-3 border-t border-[#E5DFD5] space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {/* View PDF */}
                      <button
                        type="button"
                        onClick={() => onViewNote(note)}
                        className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#0F5132] bg-[#E8F5E9] hover:bg-[#D1FAE5] border border-[#A7F3D0] rounded-md transition-colors"
                        title="View PDF inside the website"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View PDF</span>
                      </button>

                      {/* Download PDF */}
                      <button
                        type="button"
                        onClick={() => handleDownload(note)}
                        disabled={isDownloading}
                        className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-2xs disabled:opacity-50"
                        title="Download PDF"
                      >
                        {isDownloading ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : isDownloaded ? (
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

                    {/* Secondary Details Row */}
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <button
                        type="button"
                        onClick={() => onViewNote(note)}
                        className="text-[#0F5132] hover:underline font-medium flex items-center gap-1"
                      >
                        <span>Notes Details & Viewer</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
