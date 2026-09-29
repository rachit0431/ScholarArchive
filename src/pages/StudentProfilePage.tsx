import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  Bookmark,
  Download,
  Calendar,
  GraduationCap,
  Clock,
  FileText,
  BookOpen,
  Eye,
  Trash2,
  AlertCircle,
  Archive,
  Check,
  Search,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import {
  StudentUser,
  Paper,
  Note,
  ArchiveResponse,
  ResolvedArchivePaper,
  ResolvedArchiveNote,
  ResolvedDownloadEntry,
} from '../types';
import { api } from '../services/api';

interface StudentProfilePageProps {
  student: StudentUser;
  allPapers: Paper[];
  allNotes?: Note[];
  onViewPaper: (paper: Paper) => void;
  onViewNote?: (note: Note) => void;
  onToggleBookmark: (paperId: string) => void;
  onRemoveFromArchive?: (paperId: string) => void;
  onRemoveNoteFromArchive?: (noteId: string) => void;
  onDownloadRecorded: (id: string, type?: 'paper' | 'note') => void;
  onNavigateToArchive: (filters?: { year?: string; btechYear?: string; semester?: string }) => void;
  onNavigateToNotes?: () => void;
}

export const StudentProfilePage: React.FC<StudentProfilePageProps> = ({
  student,
  allPapers,
  allNotes = [],
  onViewPaper,
  onViewNote,
  onToggleBookmark,
  onRemoveFromArchive,
  onRemoveNoteFromArchive,
  onDownloadRecorded,
  onNavigateToArchive,
  onNavigateToNotes,
}) => {
  const [activeTab, setActiveTab] = useState<'saved' | 'notes' | 'downloads'>('saved');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [backendArchive, setBackendArchive] = useState<ArchiveResponse | null>(null);

  // Fetch resolved archive from backend on mount and when student saved papers/notes change
  useEffect(() => {
    let isMounted = true;
    api
      .getStudentArchive()
      .then(data => {
        if (isMounted && data) {
          setBackendArchive(data);
        }
      })
      .catch(err => {
        console.error('Failed to load resolved archive from backend:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [student.savedPapers, student.savedNotes, student.bookmarks, student.recentDownloads]);

  // Merge student savedPapers and bookmarks with unique paperId
  const savedPaperEntries = useMemo(() => {
    const map = new Map<string, { paperId: string; savedAt: string }>();

    // 1. Check backend resolved archive if available
    if (backendArchive?.savedPapers) {
      backendArchive.savedPapers.forEach(sp => {
        map.set(sp.paperId, {
          paperId: sp.paperId,
          savedAt: sp.savedAt,
        });
      });
    }

    // 2. Add student.savedPapers from session
    if (Array.isArray(student.savedPapers)) {
      student.savedPapers.forEach(sp => {
        if (!map.has(sp.paperId)) {
          map.set(sp.paperId, sp);
        }
      });
    }

    // 3. Fallback sync with student.bookmarks
    if (Array.isArray(student.bookmarks)) {
      student.bookmarks.forEach(bId => {
        if (!map.has(bId)) {
          map.set(bId, {
            paperId: bId,
            savedAt: student.createdAt || new Date().toISOString(),
          });
        }
      });
    }

    return Array.from(map.values());
  }, [backendArchive, student.savedPapers, student.bookmarks, student.createdAt]);

  // Resolve saved papers with paper metadata
  const resolvedSavedPapers = useMemo(() => {
    return savedPaperEntries.map(entry => {
      const backendResolved = backendArchive?.savedPapers?.find(sp => sp.paperId === entry.paperId);
      const matched = allPapers.find(p => p.id === entry.paperId) || backendResolved?.paper;
      const isAvailable = !!matched;

      return {
        paperId: entry.paperId,
        savedAt: entry.savedAt,
        isAvailable,
        paper: matched || null,
        pdfUrl: backendResolved?.pdfUrl || (matched ? `/api/papers/view/${matched.id}` : null),
        downloadUrl: backendResolved?.downloadUrl || (matched ? `/api/papers/download/${matched.id}` : null),
      };
    });
  }, [savedPaperEntries, allPapers, backendArchive]);

  // Merge student savedNotes from backend and local student object
  const savedNoteEntries = useMemo(() => {
    const map = new Map<string, { noteId: string; savedAt: string }>();

    if (backendArchive?.savedNotes) {
      backendArchive.savedNotes.forEach(sn => {
        map.set(sn.noteId, {
          noteId: sn.noteId,
          savedAt: sn.savedAt,
        });
      });
    }

    if (Array.isArray(student.savedNotes)) {
      student.savedNotes.forEach(sn => {
        if (!map.has(sn.noteId)) {
          map.set(sn.noteId, sn);
        }
      });
    }

    return Array.from(map.values());
  }, [backendArchive, student.savedNotes]);

  // Resolve saved notes with note metadata
  const resolvedSavedNotes = useMemo(() => {
    return savedNoteEntries.map(entry => {
      const backendResolved = backendArchive?.savedNotes?.find(sn => sn.noteId === entry.noteId);
      const matched = allNotes.find(n => n.id === entry.noteId) || backendResolved?.note;
      const isAvailable = !!matched;

      return {
        noteId: entry.noteId,
        savedAt: entry.savedAt,
        isAvailable,
        note: matched || null,
        pdfUrl: backendResolved?.pdfUrl || (matched ? `/api/notes/view/${matched.id}` : null),
        downloadUrl: backendResolved?.downloadUrl || (matched ? `/api/notes/download/${matched.id}` : null),
      };
    });
  }, [savedNoteEntries, allNotes, backendArchive]);

  // Filter saved papers by search query
  const filteredSavedPapers = useMemo(() => {
    if (!searchQuery.trim()) return resolvedSavedPapers;
    const q = searchQuery.toLowerCase().trim();

    return resolvedSavedPapers.filter(item => {
      if (!item.paper) return item.paperId.toLowerCase().includes(q);
      const inName = item.paper.subjectName?.toLowerCase().includes(q);
      const inCode = item.paper.subjectCode?.toLowerCase().includes(q);
      const inExam = item.paper.examType?.toLowerCase().includes(q);
      const inYear = item.paper.academicYear?.toLowerCase().includes(q);
      const inFilename =
        item.paper.originalFilename?.toLowerCase().includes(q) || item.paper.filename?.toLowerCase().includes(q);
      return inName || inCode || inExam || inYear || inFilename;
    });
  }, [resolvedSavedPapers, searchQuery]);

  // Filter saved notes by search query
  const filteredSavedNotes = useMemo(() => {
    if (!searchQuery.trim()) return resolvedSavedNotes;
    const q = searchQuery.toLowerCase().trim();

    return resolvedSavedNotes.filter(item => {
      if (!item.note) return item.noteId.toLowerCase().includes(q);
      const inTitle = item.note.title?.toLowerCase().includes(q);
      const inName = item.note.subjectName?.toLowerCase().includes(q);
      const inCode = item.note.subjectCode?.toLowerCase().includes(q);
      const inYear = item.note.btechYear?.toLowerCase().includes(q);
      const inSem = item.note.semester?.toLowerCase().includes(q);
      const inFilename =
        item.note.originalFilename?.toLowerCase().includes(q) || item.note.filename?.toLowerCase().includes(q);
      return inTitle || inName || inCode || inYear || inSem || inFilename;
    });
  }, [resolvedSavedNotes, searchQuery]);

  // Resolve recent downloads with paper/note metadata
  const resolvedRecentDownloads = useMemo(() => {
    const list = student.recentDownloads || [];
    return list.map(dl => {
      const isNote =
        dl.itemType === 'note' ||
        Boolean(dl.noteId) ||
        (typeof dl.paperId === 'string' && dl.paperId.startsWith('note-'));

      if (isNote) {
        const noteId = dl.noteId || dl.paperId;
        const backendResolved = backendArchive?.recentDownloads?.find(
          d => d.noteId === noteId || d.paperId === noteId
        );
        const note = allNotes.find(n => n.id === noteId) || backendResolved?.note;
        return {
          paperId: noteId,
          noteId,
          downloadedAt: dl.downloadedAt,
          itemType: 'note' as const,
          isAvailable: !!note,
          paper: null,
          note: note || null,
        };
      }

      const backendResolved = backendArchive?.recentDownloads?.find(d => d.paperId === dl.paperId);
      const paper = allPapers.find(p => p.id === dl.paperId) || backendResolved?.paper;
      return {
        paperId: dl.paperId,
        noteId: undefined,
        downloadedAt: dl.downloadedAt,
        itemType: 'paper' as const,
        isAvailable: !!paper,
        paper: paper || null,
        note: null,
      };
    });
  }, [student.recentDownloads, allPapers, allNotes, backendArchive]);

  // Filter recent downloads
  const filteredRecentDownloads = useMemo(() => {
    if (!searchQuery.trim()) return resolvedRecentDownloads;
    const q = searchQuery.toLowerCase().trim();

    return resolvedRecentDownloads.filter(item => {
      if (item.itemType === 'note') {
        if (!item.note) return (item.noteId || item.paperId).toLowerCase().includes(q);
        const inTitle = item.note.title?.toLowerCase().includes(q);
        const inName = item.note.subjectName?.toLowerCase().includes(q);
        const inCode = item.note.subjectCode?.toLowerCase().includes(q);
        return inTitle || inName || inCode;
      }
      if (!item.paper) return item.paperId.toLowerCase().includes(q);
      const inName = item.paper.subjectName?.toLowerCase().includes(q);
      const inCode = item.paper.subjectCode?.toLowerCase().includes(q);
      const inExam = item.paper.examType?.toLowerCase().includes(q);
      return inName || inCode || inExam;
    });
  }, [resolvedRecentDownloads, searchQuery]);

  // Recommended semester papers
  const semesterPapers = useMemo(() => {
    return allPapers.filter(p => p.semester.toLowerCase() === student.semester.toLowerCase());
  }, [allPapers, student.semester]);

  // Handle Download Paper
  const handleDownloadPaper = async (paper: Paper) => {
    setDownloadingId(paper.id);
    try {
      await api.downloadPaperBlob(paper.id, paper.originalFilename || `${paper.subjectCode}_${paper.examType}.pdf`);
      if (onDownloadRecorded) {
        onDownloadRecorded(paper.id, 'paper');
      }
    } catch (err: any) {
      console.error('Download error:', err);
      alert(err.message || 'Failed to download question paper.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle Download Note
  const handleDownloadNote = async (note: Note) => {
    setDownloadingId(note.id);
    try {
      await api.downloadNoteBlob(note.id, note.originalFilename || `${note.subjectCode}-Notes.pdf`);
      if (onDownloadRecorded) {
        onDownloadRecorded(note.id, 'note');
      } else {
        api.recordDownload(note.id, 'note').catch(() => {});
      }
    } catch (err: any) {
      console.error('Note download error:', err);
      alert(err.message || 'Failed to download study note document.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle Remove Paper from My Archive
  const handleRemovePaper = async (paperId: string) => {
    if (onRemoveFromArchive) {
      onRemoveFromArchive(paperId);
    } else {
      onToggleBookmark(paperId);
    }
  };

  // Handle Remove Note from My Archive
  const handleRemoveNote = async (noteId: string) => {
    if (onRemoveNoteFromArchive) {
      onRemoveNoteFromArchive(noteId);
    } else {
      try {
        await api.removeNoteFromArchive(noteId);
        setBackendArchive(prev => {
          if (!prev) return null;
          return {
            ...prev,
            savedNotes: prev.savedNotes?.filter(n => n.noteId !== noteId),
          };
        });
      } catch (err: any) {
        console.error('Failed to remove note:', err);
      }
    }
  };

  const handleViewNote = (note: Note) => {
    if (onViewNote) {
      onViewNote(note);
    }
  };

  // Format examination date
  const formatExamDate = (dateStr?: string) => {
    if (!dateStr) return 'Scheduled';
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

  // Format saved timestamp
  const formatSavedDate = (dateStr?: string) => {
    if (!dateStr) return 'Recently';
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

  const totalArchiveItems = resolvedSavedPapers.length + resolvedSavedNotes.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Student Dossier Header Card */}
      <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#E8F5E9] border-2 border-[#A7F3D0] flex items-center justify-center text-[#0F5132] font-serif-academic text-2xl font-bold">
              {student.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-serif-academic font-bold text-[#1C2826]">{student.name}</h1>
                <span className="text-[10px] uppercase font-mono-code font-semibold px-2 py-0.5 bg-[#E8F5E9] text-[#0F5132] rounded">
                  Enrolled Student
                </span>
              </div>
              <p className="text-xs text-[#5C6F68] mt-0.5 font-mono-code">{student.email}</p>
              <div className="flex items-center gap-3 text-xs text-[#5C6F68] mt-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-[#0F5132]" /> {student.year}
                </span>
                <span>·</span>
                <span>{student.semester}</span>
                <span>·</span>
                <span className="text-[#0F5132] font-medium font-mono-code">
                  {totalArchiveItems} Saved in My Archive ({resolvedSavedPapers.length} Papers ·{' '}
                  {resolvedSavedNotes.length} Notes)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-stretch sm:self-auto flex-wrap">
            {onNavigateToNotes && (
              <button
                onClick={onNavigateToNotes}
                className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold text-[#0F5132] bg-[#E8F5E9] hover:bg-[#D1FAE5] border border-[#A7F3D0] rounded-md transition-colors flex items-center justify-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-[#0F5132]" />
                <span>Explore Notes Library</span>
              </button>
            )}
            <button
              onClick={() => onNavigateToArchive({ btechYear: student.year, semester: student.semester })}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-2xs flex items-center justify-center gap-2"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Browse {student.semester} Papers</span>
            </button>
          </div>
        </div>
      </div>

      {/* Page Title & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#E5DFD5]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#0F5132] block mb-1">
            Personal Repository
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif-academic font-bold text-[#1C2826]">My Archive</h2>
          <p className="text-xs sm:text-sm text-[#5C6F68] mt-0.5">
            Your personal persistent collection of question papers, study notes, and downloads with embedded PDF reader.
          </p>
        </div>

        {/* Quick Filter Input */}
        <div className="relative w-full max-w-xs self-start md:self-end">
          <Search className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search within My Archive..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-[#FFFFFF] border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
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
      </div>

      {/* Three distinct sections in My Archive: Saved Papers, Saved Study Notes, Recent Downloads */}
      <div className="border-b border-[#E5DFD5] flex items-center gap-6 text-sm flex-wrap">
        <button
          onClick={() => setActiveTab('saved')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'saved' ? 'text-[#0F5132] border-b-2 border-[#0F5132]' : 'text-[#5C6F68] hover:text-[#1C2826]'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Saved Papers ({resolvedSavedPapers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'notes' ? 'text-[#0F5132] border-b-2 border-[#0F5132]' : 'text-[#5C6F68] hover:text-[#1C2826]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Saved Study Notes ({resolvedSavedNotes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('downloads')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'downloads'
              ? 'text-[#0F5132] border-b-2 border-[#0F5132]'
              : 'text-[#5C6F68] hover:text-[#1C2826]'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Recent Downloads ({resolvedRecentDownloads.length})</span>
        </button>
      </div>

      {/* =========================================================================
          SECTION 1: SAVED QUESTION PAPERS
          ========================================================================= */}
      {activeTab === 'saved' && (
        <section aria-label="Saved Papers Collection">
          {resolvedSavedPapers.length === 0 ? (
            <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-12 text-center space-y-3">
              <Archive className="w-10 h-10 text-[#5C6F68] mx-auto opacity-30" />
              <h3 className="text-lg font-serif-academic font-bold text-[#1C2826]">
                No Saved Papers in My Archive Yet
              </h3>
              <p className="text-xs text-[#5C6F68] max-w-md mx-auto leading-relaxed">
                When you browse past question papers in the library, click &ldquo;Save to My Archive&rdquo; or download
                any paper to keep it permanently saved in your personal archive for instant access.
              </p>
              <button
                onClick={() => onNavigateToArchive()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-2xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Explore Question Papers Library</span>
              </button>
            </div>
          ) : filteredSavedPapers.length === 0 ? (
            <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-8 text-center space-y-3">
              <p className="text-xs text-[#5C6F68]">
                No saved papers match your search &ldquo;{searchQuery}&rdquo;.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F5132] hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear search filter</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSavedPapers.map(entry => {
                const paper = entry.paper;

                if (!entry.isAvailable || !paper) {
                  return (
                    <article
                      key={entry.paperId}
                      className="bg-[#FFFDFB] border border-[#FCA5A5] rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between border-t-4 border-t-[#DC2626]"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#991B1B] bg-[#FEF2F2] border border-[#FCA5A5] rounded">
                            Unavailable
                          </span>
                          <span className="text-[11px] font-mono-code text-[#7F1D1D]">ID: {entry.paperId}</span>
                        </div>

                        <h3 className="text-base font-serif-academic font-bold text-[#991B1B]">
                          Paper no longer available
                        </h3>

                        <p className="mt-2 text-xs text-[#7F1D1D]/80 leading-relaxed">
                          This question paper was removed from the institution repository by an academic administrator.
                        </p>

                        <div className="mt-4 pt-3 border-t border-[#FCA5A5]/40 text-[11px] text-[#5C6F68] flex items-center gap-1.5 font-mono-code">
                          <Clock className="w-3.5 h-3.5 text-[#991B1B]" />
                          <span>Saved: {formatSavedDate(entry.savedAt)}</span>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-[#FCA5A5]/40">
                        <button
                          onClick={() => handleRemovePaper(entry.paperId)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-[#991B1B] bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FCA5A5] rounded-md transition-colors"
                          title="Remove this unavailable paper from My Archive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove from My Archive</span>
                        </button>
                      </div>
                    </article>
                  );
                }

                return (
                  <article
                    key={paper.id}
                    className="bg-[#FFFFFF] border border-[#E5DFD5] hover:border-[#10B981]/50 rounded-xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative border-t-4 border-t-[#0F5132]"
                  >
                    <div>
                      {/* Badges: Subject Code + Academic Year + Exam Type */}
                      <div className="flex items-center flex-wrap gap-2 text-xs font-mono-code mb-2.5">
                        <span className="px-2 py-0.5 font-bold text-[#0F5132] bg-[#E8F5E9] border border-[#A7F3D0] rounded">
                          {paper.subjectCode}
                        </span>
                        <span className="text-[11px] font-semibold text-[#5C6F68] bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#E5DFD5]">
                          {paper.academicYear}
                        </span>
                        <span className="text-[11px] font-semibold text-[#0F5132] bg-[#E8F5E9] px-2 py-0.5 rounded">
                          {paper.examType}
                        </span>
                      </div>

                      {/* Subject Name */}
                      <h3
                        onClick={() => onViewPaper(paper)}
                        className="text-lg sm:text-xl font-serif-academic font-bold text-[#1C2826] hover:text-[#0F5132] transition-colors cursor-pointer leading-snug"
                        title={paper.subjectName}
                      >
                        {paper.subjectName}
                      </h3>

                      {/* Curricular & Exam Details */}
                      <div className="mt-3 pt-2.5 border-t border-[#E5DFD5]/60 space-y-1.5 text-xs text-[#5C6F68]">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#5C6F68]">Curricular Cohort:</span>
                          <span className="font-medium text-[#1C2826]">
                            {paper.btechYear} · {paper.semester}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1 text-[#5C6F68]">
                            <Calendar className="w-3.5 h-3.5 text-[#0F5132]" />
                            Examination Date:
                          </span>
                          <span className="font-medium text-[#1C2826]">{formatExamDate(paper.paperDate)}</span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1 text-[#5C6F68]">
                            <FileText className="w-3.5 h-3.5 text-[#0F5132]" />
                            PDF Document:
                          </span>
                          <span
                            className="font-mono-code font-medium text-[#1C2826] truncate max-w-[170px]"
                            title={paper.originalFilename || paper.filename}
                          >
                            {paper.originalFilename || paper.filename}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1 text-[#5C6F68]">
                            <Clock className="w-3.5 h-3.5 text-[#0F5132]" />
                            Date Added:
                          </span>
                          <span className="font-mono-code font-medium text-[#0F5132]">
                            {formatSavedDate(entry.savedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: View PDF (Embedded Reader) + Download + Remove */}
                    <div className="mt-5 pt-3.5 border-t border-[#E5DFD5] space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => onViewPaper(paper)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0F5132] bg-[#E8F5E9] hover:bg-[#D1FAE5] border border-[#A7F3D0] rounded-md transition-colors"
                          title="View PDF in embedded reader"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View PDF</span>
                        </button>

                        <button
                          onClick={() => handleDownloadPaper(paper)}
                          disabled={downloadingId === paper.id}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-2xs disabled:opacity-60"
                          title="Download question paper PDF"
                        >
                          {downloadingId === paper.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>Download</span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleRemovePaper(paper.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[#991B1B] hover:text-[#7F1D1D] hover:bg-[#FEF2F2] border border-transparent hover:border-[#FCA5A5] rounded-md transition-colors"
                        title="Remove from My Archive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove from My Archive</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* =========================================================================
          SECTION 2: SAVED STUDY NOTES (WITH PDF READER & DOWNLOAD FEATURE)
          ========================================================================= */}
      {activeTab === 'notes' && (
        <section aria-label="Saved Study Notes Collection">
          {resolvedSavedNotes.length === 0 ? (
            <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-12 text-center space-y-3">
              <FileText className="w-10 h-10 text-[#5C6F68] mx-auto opacity-30" />
              <h3 className="text-lg font-serif-academic font-bold text-[#1C2826]">
                No Saved Notes in My Archive Yet
              </h3>
              <p className="text-xs text-[#5C6F68] max-w-md mx-auto leading-relaxed">
                When you download or save any study notes or handwritten material from the Notes Library, it will
                automatically be preserved here in your personal archive with instant PDF Reader access.
              </p>
              {onNavigateToNotes && (
                <button
                  onClick={onNavigateToNotes}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-2xs"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Browse Notes Library</span>
                </button>
              )}
            </div>
          ) : filteredSavedNotes.length === 0 ? (
            <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-8 text-center space-y-3">
              <p className="text-xs text-[#5C6F68]">
                No saved study notes match your search &ldquo;{searchQuery}&rdquo;.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F5132] hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear search filter</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSavedNotes.map(entry => {
                const note = entry.note;

                if (!entry.isAvailable || !note) {
                  return (
                    <article
                      key={entry.noteId}
                      className="bg-[#FFFDFB] border border-[#FCA5A5] rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between border-t-4 border-t-[#DC2626]"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#991B1B] bg-[#FEF2F2] border border-[#FCA5A5] rounded">
                            Unavailable
                          </span>
                          <span className="text-[11px] font-mono-code text-[#7F1D1D]">ID: {entry.noteId}</span>
                        </div>

                        <h3 className="text-base font-serif-academic font-bold text-[#991B1B]">
                          Study note no longer available
                        </h3>

                        <p className="mt-2 text-xs text-[#7F1D1D]/80 leading-relaxed">
                          This study note was removed from the institution repository by an academic administrator.
                        </p>

                        <div className="mt-4 pt-3 border-t border-[#FCA5A5]/40 text-[11px] text-[#5C6F68] flex items-center gap-1.5 font-mono-code">
                          <Clock className="w-3.5 h-3.5 text-[#991B1B]" />
                          <span>Saved: {formatSavedDate(entry.savedAt)}</span>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-[#FCA5A5]/40">
                        <button
                          onClick={() => handleRemoveNote(entry.noteId)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-[#991B1B] bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FCA5A5] rounded-md transition-colors"
                          title="Remove this unavailable note from My Archive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove from My Archive</span>
                        </button>
                      </div>
                    </article>
                  );
                }

                return (
                  <article
                    key={note.id}
                    className="bg-[#FFFFFF] border border-[#E5DFD5] hover:border-[#10B981]/50 rounded-xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative border-t-4 border-t-[#10B981]"
                  >
                    <div>
                      {/* Badges: Subject Code + Cohort + Study Notes Tag */}
                      <div className="flex items-center flex-wrap gap-2 text-xs font-mono-code mb-2.5">
                        <span className="px-2 py-0.5 font-bold text-[#0F5132] bg-[#E8F5E9] border border-[#A7F3D0] rounded">
                          {note.subjectCode}
                        </span>
                        <span className="text-[11px] font-semibold text-[#5C6F68] bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#E5DFD5]">
                          {note.btechYear} · {note.semester}
                        </span>
                        <span className="text-[11px] font-semibold text-[#10B981] bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 rounded flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-[#10B981]" />
                          <span>Study Notes</span>
                        </span>
                      </div>

                      {/* Note Title - Clickable to open PDF Reader */}
                      <h3
                        onClick={() => handleViewNote(note)}
                        className="text-lg sm:text-xl font-serif-academic font-bold text-[#1C2826] hover:text-[#0F5132] transition-colors cursor-pointer leading-snug"
                        title={note.title}
                      >
                        {note.title}
                      </h3>

                      {/* Subject Name */}
                      <p className="text-xs text-[#0F5132] font-medium mt-1">
                        {note.subjectName}
                      </p>

                      {/* Details */}
                      <div className="mt-3 pt-2.5 border-t border-[#E5DFD5]/60 space-y-1.5 text-xs text-[#5C6F68]">
                        {note.description && (
                          <p className="text-xs text-[#5C6F68] line-clamp-2 leading-relaxed">
                            {note.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1 text-[#5C6F68]">
                            <FileText className="w-3.5 h-3.5 text-[#0F5132]" />
                            Document:
                          </span>
                          <span
                            className="font-mono-code font-medium text-[#1C2826] truncate max-w-[170px]"
                            title={note.originalFilename || note.filename}
                          >
                            {note.originalFilename || note.filename}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#5C6F68]">File Size:</span>
                          <span className="font-mono-code font-medium text-[#1C2826]">
                            {note.fileSizeFormatted}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1 text-[#5C6F68]">
                            <Clock className="w-3.5 h-3.5 text-[#0F5132]" />
                            Archived:
                          </span>
                          <span className="font-mono-code font-medium text-[#0F5132]">
                            {formatSavedDate(entry.savedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: View PDF (PDF Reader feature) + Download + Remove */}
                    <div className="mt-5 pt-3.5 border-t border-[#E5DFD5] space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {/* View PDF Reader button */}
                        <button
                          onClick={() => handleViewNote(note)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0F5132] bg-[#E8F5E9] hover:bg-[#D1FAE5] border border-[#A7F3D0] rounded-md transition-colors"
                          title="Open in interactive PDF Reader"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View PDF</span>
                        </button>

                        {/* Download button */}
                        <button
                          onClick={() => handleDownloadNote(note)}
                          disabled={downloadingId === note.id}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-2xs disabled:opacity-60"
                          title="Download note PDF"
                        >
                          {downloadingId === note.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>Download</span>
                        </button>
                      </div>

                      {/* Remove from My Archive */}
                      <button
                        onClick={() => handleRemoveNote(note.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[#991B1B] hover:text-[#7F1D1D] hover:bg-[#FEF2F2] border border-transparent hover:border-[#FCA5A5] rounded-md transition-colors"
                        title="Remove note from My Archive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove from My Archive</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* =========================================================================
          SECTION 3: RECENT DOWNLOADS (WITH BOTH PAPERS & NOTES SUPPORT)
          ========================================================================= */}
      {activeTab === 'downloads' && (
        <section aria-label="Recent Downloads History">
          {resolvedRecentDownloads.length === 0 ? (
            <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-12 text-center space-y-3">
              <Download className="w-10 h-10 text-[#5C6F68] mx-auto opacity-30" />
              <h3 className="text-lg font-serif-academic font-bold text-[#1C2826]">
                No Downloads Recorded Yet
              </h3>
              <p className="text-xs text-[#5C6F68] max-w-sm mx-auto leading-relaxed">
                Any question paper or study note PDF you download from the library will automatically appear here in your
                download log and archive.
              </p>
            </div>
          ) : filteredRecentDownloads.length === 0 ? (
            <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-8 text-center space-y-3">
              <p className="text-xs text-[#5C6F68]">
                No downloads match your search &ldquo;{searchQuery}&rdquo;.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F5132] hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear search filter</span>
              </button>
            </div>
          ) : (
            <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] border-b border-[#E5DFD5] text-[#5C6F68] uppercase font-mono-code font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Document & Subject</th>
                      <th className="py-3 px-3">Type / Category</th>
                      <th className="py-3 px-3">Academic Info</th>
                      <th className="py-3 px-3">Downloaded At</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DFD5]">
                    {filteredRecentDownloads.map((item, idx) => {
                      // Case 1: Downloaded Study Note
                      if (item.itemType === 'note') {
                        const note = item.note;
                        if (!note) {
                          return (
                            <tr key={idx} className="bg-[#FFFDFB]">
                              <td className="py-3 px-4 text-[#991B1B] font-mono-code">
                                Note ID: {item.noteId || item.paperId} (No longer available)
                              </td>
                              <td className="py-3 px-3 text-[#991B1B]">Study Note</td>
                              <td className="py-3 px-3 text-[#991B1B]">—</td>
                              <td className="py-3 px-3 text-[#5C6F68] font-mono-code">
                                {new Date(item.downloadedAt).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-[11px] text-[#991B1B] italic">Deleted from repository</span>
                              </td>
                            </tr>
                          );
                        }

                        const isNoteAlreadySaved = savedNoteEntries.some(s => s.noteId === note.id);

                        return (
                          <tr key={idx} className="hover:bg-[#FAF8F5]/80 transition-colors">
                            <td className="py-3 px-4 font-semibold text-[#1C2826]">
                              <div className="flex flex-col">
                                <span className="text-sm font-serif-academic font-bold text-[#1C2826]">
                                  {note.title}
                                </span>
                                <span className="text-[11px] text-[#0F5132] font-mono-code">
                                  {note.subjectCode} · {note.subjectName}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 font-semibold text-[#10B981] bg-[#ECFDF5] border border-[#A7F3D0] rounded text-[11px] inline-flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                <span>Study Notes</span>
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono-code text-[#5C6F68]">
                              {note.btechYear} · {note.semester}
                            </td>
                            <td className="py-3 px-3 text-[#5C6F68] font-mono-code">
                              {new Date(item.downloadedAt).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* View PDF reader button */}
                                <button
                                  onClick={() => handleViewNote(note)}
                                  className="px-2.5 py-1 text-xs font-semibold text-[#0F5132] bg-[#E8F5E9] hover:bg-[#D1FAE5] rounded transition-colors flex items-center gap-1"
                                  title="Open note in embedded PDF Reader"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View PDF</span>
                                </button>

                                {/* Download Again */}
                                <button
                                  onClick={() => handleDownloadNote(note)}
                                  disabled={downloadingId === note.id}
                                  className="px-2.5 py-1 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded transition-colors flex items-center gap-1 disabled:opacity-60"
                                  title="Download note PDF again"
                                >
                                  {downloadingId === note.id ? (
                                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Download className="w-3.5 h-3.5" />
                                  )}
                                  <span>Download</span>
                                </button>

                                {/* Saved badge */}
                                {isNoteAlreadySaved ? (
                                  <span className="text-[11px] text-[#0F5132] font-semibold bg-[#E8F5E9] px-2 py-1 rounded inline-flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    <span>In Archive</span>
                                  </span>
                                ) : (
                                  <button
                                    onClick={async () => {
                                      try {
                                        await api.saveNoteToArchive(note.id);
                                        const arch = await api.getStudentArchive();
                                        setBackendArchive(arch);
                                      } catch (err) {
                                        console.error(err);
                                      }
                                    }}
                                    className="px-2 py-1 text-xs font-medium text-[#5C6F68] hover:text-[#0F5132] hover:bg-[#FAF8F5] border border-[#E5DFD5] rounded transition-colors flex items-center gap-1"
                                    title="Save to My Archive"
                                  >
                                    <Archive className="w-3 h-3" />
                                    <span className="hidden sm:inline">Save</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      // Case 2: Downloaded Question Paper
                      const paper = item.paper;
                      if (!paper) {
                        return (
                          <tr key={idx} className="bg-[#FFFDFB]">
                            <td className="py-3 px-4 text-[#991B1B] font-mono-code">
                              Paper ID: {item.paperId} (No longer available)
                            </td>
                            <td className="py-3 px-3 text-[#991B1B]">Question Paper</td>
                            <td className="py-3 px-3 text-[#991B1B]">—</td>
                            <td className="py-3 px-3 text-[#5C6F68] font-mono-code">
                              {new Date(item.downloadedAt).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-[11px] text-[#991B1B] italic">Deleted from repository</span>
                            </td>
                          </tr>
                        );
                      }

                      const isAlreadySaved = savedPaperEntries.some(s => s.paperId === paper.id);

                      return (
                        <tr key={idx} className="hover:bg-[#FAF8F5]/80 transition-colors">
                          <td className="py-3 px-4 font-semibold text-[#1C2826]">
                            <div className="flex flex-col">
                              <span>{paper.subjectName}</span>
                              <span className="text-[11px] text-[#0F5132] font-mono-code">
                                {paper.subjectCode} · {paper.btechYear} · {paper.semester}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-[#0F5132] font-medium">{paper.examType}</td>
                          <td className="py-3 px-3 font-mono-code">{paper.academicYear}</td>
                          <td className="py-3 px-3 text-[#5C6F68] font-mono-code">
                            {new Date(item.downloadedAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* View PDF reader button */}
                              <button
                                onClick={() => onViewPaper(paper)}
                                className="px-2.5 py-1 text-xs font-semibold text-[#0F5132] bg-[#E8F5E9] hover:bg-[#D1FAE5] rounded transition-colors flex items-center gap-1"
                                title="Open PDF in embedded reader"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View PDF</span>
                              </button>

                              {/* Download Again */}
                              <button
                                onClick={() => handleDownloadPaper(paper)}
                                disabled={downloadingId === paper.id}
                                className="px-2.5 py-1 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded transition-colors flex items-center gap-1 disabled:opacity-60"
                                title="Download PDF again"
                              >
                                {downloadingId === paper.id ? (
                                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                <span>Download</span>
                              </button>

                              {/* Save/Remove status */}
                              {!isAlreadySaved && (
                                <button
                                  onClick={() => onToggleBookmark(paper.id)}
                                  className="px-2 py-1 text-xs font-medium text-[#5C6F68] hover:text-[#0F5132] hover:bg-[#FAF8F5] border border-[#E5DFD5] rounded transition-colors flex items-center gap-1"
                                  title="Save to My Archive"
                                >
                                  <Archive className="w-3 h-3" />
                                  <span className="hidden sm:inline">Save</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Suggested Curricular Papers for Student's Semester */}
      {semesterPapers.length > 0 && (
        <section className="pt-6 border-t border-[#E5DFD5]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-serif-academic font-bold text-[#1C2826]">
                Curricular Papers for {student.semester}
              </h3>
              <p className="text-xs text-[#5C6F68] mt-0.5">
                Recommended past papers based on your current enrolled academic semester.
              </p>
            </div>
            <button
              onClick={() => onNavigateToArchive({ semester: student.semester })}
              className="text-xs font-semibold text-[#0F5132] hover:underline"
            >
              Browse All {student.semester} Papers ({semesterPapers.length}) →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {semesterPapers.slice(0, 3).map(paper => {
              const isSaved = savedPaperEntries.some(s => s.paperId === paper.id);
              return (
                <article
                  key={paper.id}
                  className="bg-[#FFFFFF] border border-[#E5DFD5] hover:border-[#10B981]/50 rounded-lg p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs font-mono-code mb-2">
                      <span className="font-semibold text-[#0F5132]">{paper.subjectCode}</span>
                      <span className="text-[#CBD5E1]">·</span>
                      <span>{paper.academicYear}</span>
                      <span className="text-[#CBD5E1]">·</span>
                      <span className="text-[#0F5132] font-semibold">{paper.examType}</span>
                    </div>

                    <h4
                      onClick={() => onViewPaper(paper)}
                      className="text-base font-serif-academic font-bold text-[#1C2826] hover:text-[#0F5132] cursor-pointer line-clamp-1"
                    >
                      {paper.subjectName}
                    </h4>

                    <div className="mt-2 text-xs text-[#5C6F68] flex items-center justify-between">
                      <span>Date: {formatExamDate(paper.paperDate)}</span>
                      <span className="font-mono-code">{paper.fileSizeFormatted}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E5DFD5] flex items-center justify-between gap-2">
                    <button
                      onClick={() => onToggleBookmark(paper.id)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors flex items-center gap-1 ${
                        isSaved
                          ? 'bg-[#E8F5E9] text-[#0F5132] border-[#A7F3D0]'
                          : 'bg-white text-[#5C6F68] border-[#E5DFD5] hover:text-[#0F5132]'
                      }`}
                      title={isSaved ? 'Remove from My Archive' : 'Save to My Archive'}
                    >
                      <Bookmark className={`w-3 h-3 ${isSaved ? 'fill-current' : ''}`} />
                      <span>{isSaved ? 'Saved' : 'Save'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onViewPaper(paper)}
                        className="px-2.5 py-1 text-xs font-semibold text-[#0F5132] bg-[#E8F5E9] hover:bg-[#D1FAE5] rounded transition-colors"
                      >
                        View PDF
                      </button>
                      <button
                        onClick={() => handleDownloadPaper(paper)}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded transition-colors"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
