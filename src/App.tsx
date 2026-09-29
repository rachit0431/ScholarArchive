import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { ArchivePage } from './pages/ArchivePage';
import { LibraryPage } from './pages/LibraryPage';
import { NotesPage } from './pages/NotesPage';
import { SearchPage } from './pages/SearchPage';
import { StudentProfilePage } from './pages/StudentProfilePage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AuthPortalPage } from './pages/AuthPortalPage';
import { ContactPage } from './pages/ContactPage';
import { PdfViewerModal } from './components/PdfViewerModal';
import { NoteViewerModal } from './components/NoteViewerModal';
import { StudentAuthModal } from './components/StudentAuthModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AddPaperModal } from './pages/admin/AddPaperModal';
import { AddNoteModal } from './pages/admin/AddNoteModal';
import { EditPaperModal } from './pages/admin/EditPaperModal';
import { api, tokenStorage } from './services/api';
import { Paper, Note, Subject, StudentUser, AdminUser, SystemStats } from './types';
import { NavView } from './components/Navbar';
import { CheckCircle2, AlertCircle, Shield } from 'lucide-react';

function getPaperIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/(?:papers|paper|question-papers)\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function App() {
  // Authentication & Session State
  const [authChecking, setAuthChecking] = useState(true);
  const [currentStudent, setCurrentStudent] = useState<StudentUser | null>(null);
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [authPortalTab, setAuthPortalTab] = useState<'student-login' | 'student-signup' | 'admin-login'>('student-login');

  // Navigation View State
  const [currentView, setCurrentView] = useState<NavView>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/contact') return 'contact';
      if (window.location.pathname === '/notes') return 'notes';
      if (getPaperIdFromUrl()) return 'library';
    }
    return 'library';
  });
  const [archiveInitialFilters, setArchiveInitialFilters] = useState<{
    year?: string;
    btechYear?: string;
    semester?: string;
    examType?: string;
    subject?: string;
  } | undefined>(undefined);
  const [searchInitialQuery, setSearchInitialQuery] = useState<string>('');

  // Paper Details route & viewer state
  const [selectedPaperDetails, setSelectedPaperDetails] = useState<Paper | null>(null);
  const [selectedPaperDetailsId, setSelectedPaperDetailsId] = useState<string | null>(getPaperIdFromUrl);

  // Modal Visibility States
  const [isStudentAuthOpen, setIsStudentAuthOpen] = useState(false);
  const [studentAuthMode, setStudentAuthMode] = useState<'login' | 'signup'>('login');
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [activeViewingPaper, setActiveViewingPaper] = useState<Paper | null>(null);
  const [activeViewingNote, setActiveViewingNote] = useState<Note | null>(null);
  const [isAddPaperOpen, setIsAddPaperOpen] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);

  // App Data State (Protected - only populated when authenticated)
  const [papers, setPapers] = useState<Paper[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [years, setYears] = useState<string[]>(['2026', '2025', '2024']);
  const [examTypes, setExamTypes] = useState<string[]>([
    'UT 1', 'UT 2', 'Midterm 1', 'Midterm 2', 'University Exam',
  ]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Fetch repository data securely using authenticated session
  const fetchData = useCallback(async (showBlockingSpinner = false) => {
    if (showBlockingSpinner) {
      setLoading(true);
    }
    try {
      const [papersData, notesData, subjectsData, yearsData, examTypesData, statsData] = await Promise.all([
        api.getPapers(),
        api.getNotes(),
        api.getSubjects(),
        api.getYears(),
        api.getExamTypes(),
        api.getStats(),
      ]);

      setPapers(papersData);
      setNotes(notesData);
      setSubjects(subjectsData);
      setYears(yearsData);
      setExamTypes(examTypesData);
      setStats(statsData);
    } catch (err: any) {
      console.error('Error fetching archive data:', err);
      // If server returned 401 unauthorized, force logout
      if (err?.message?.includes('401') || err?.message?.includes('Authentication')) {
        tokenStorage.clearToken();
        setCurrentStudent(null);
        setCurrentAdmin(null);
        setPapers([]);
        setNotes([]);
        setStats(null);
      }
    } finally {
      if (showBlockingSpinner) {
        setLoading(false);
      }
    }
  }, []);

  // Check real backend session on mount
  useEffect(() => {
    async function verifyInitialSession() {
      setAuthChecking(true);
      try {
        const session = await api.getMe();
        if (session) {
          if (session.role === 'admin' && session.admin) {
            setCurrentAdmin(session.admin);
            setCurrentStudent(null);
            if (window.location.pathname === '/contact') {
              setCurrentView('contact');
            } else if (window.location.pathname === '/notes') {
              setCurrentView('notes');
            } else {
              setCurrentView('admin');
            }
            await fetchData(true);
          } else if (session.role === 'student' && session.user) {
            setCurrentStudent(session.user);
            setCurrentAdmin(null);
            if (window.location.pathname === '/contact') {
              setCurrentView('contact');
            } else if (window.location.pathname === '/notes') {
              setCurrentView('notes');
            } else {
              setCurrentView('library');
            }
            await fetchData(true);
          } else {
            setCurrentStudent(null);
            setCurrentAdmin(null);
            tokenStorage.clearToken();
            if (window.location.pathname === '/contact') {
              setCurrentView('contact');
            } else if (window.location.pathname === '/notes') {
              setCurrentView('notes');
            }
          }
        } else {
          setCurrentStudent(null);
          setCurrentAdmin(null);
          tokenStorage.clearToken();
          if (window.location.pathname === '/contact') {
            setCurrentView('contact');
          } else if (window.location.pathname === '/notes') {
            setCurrentView('notes');
          }
        }
      } catch (err) {
        console.error('Session verification error:', err);
        setCurrentStudent(null);
        setCurrentAdmin(null);
        tokenStorage.clearToken();
        if (window.location.pathname === '/contact') {
          setCurrentView('contact');
        } else if (window.location.pathname === '/notes') {
          setCurrentView('notes');
        }
      } finally {
        setAuthChecking(false);
      }
    }

    verifyInitialSession();
  }, [fetchData]);

  // Load notes for public or authenticated viewers
  useEffect(() => {
    if (notes.length === 0) {
      api.getNotes()
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setNotes(data);
          }
        })
        .catch(err => console.error('Failed to load notes:', err));
    }
  }, [notes.length]);

  // Handle browser back button / history popstate
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === '/contact') {
        setCurrentView('contact');
      } else if (window.location.pathname === '/notes') {
        setCurrentView('notes');
      } else if (!currentStudent && !currentAdmin) {
        // Force view to stay on login portal
        setCurrentView('archive');
      } else if (currentAdmin) {
        setCurrentView('admin');
      } else {
        setCurrentView('library');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentStudent, currentAdmin]);

  // Navigation handlers
  const handleNavigateToContact = () => {
    if (window.location.pathname !== '/contact') {
      window.history.pushState(null, '', '/contact');
    }
    setCurrentView('contact');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToNotes = () => {
    if (window.location.pathname !== '/notes') {
      window.history.pushState(null, '', '/notes');
    }
    setCurrentView('notes');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToArchive = (filters?: {
    year?: string;
    btechYear?: string;
    semester?: string;
    examType?: string;
    subject?: string;
  }) => {
    if (window.location.pathname === '/contact' || window.location.pathname === '/notes') {
      window.history.pushState(null, '', '/');
    }
    setArchiveInitialFilters(filters);
    setCurrentView('archive');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToSearch = (query?: string) => {
    if (window.location.pathname === '/contact' || window.location.pathname === '/notes') {
      window.history.pushState(null, '', '/');
    }
    setSearchInitialQuery(query || '');
    setCurrentView('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Persistent Archive & Bookmark handlers
  const isBookmarked = (paperId: string): boolean => {
    if (!currentStudent) return false;
    const inSaved = currentStudent.savedPapers?.some(p => p.paperId === paperId);
    const inBookmarks = currentStudent.bookmarks?.includes(paperId);
    return !!(inSaved || inBookmarks);
  };

  const isNoteBookmarked = (noteId: string): boolean => {
    if (!currentStudent) return false;
    return !!currentStudent.savedNotes?.some(n => n.noteId === noteId);
  };

  const handleToggleBookmark = async (paperId: string) => {
    if (!currentStudent) {
      setAuthPortalTab('student-login');
      setIsStudentAuthOpen(true);
      return;
    }

    try {
      const result = await api.toggleArchive(paperId);
      const updatedStudent: StudentUser = {
        ...currentStudent,
        bookmarks: result.bookmarks || currentStudent.bookmarks,
        savedPapers: result.savedPapers || currentStudent.savedPapers,
      };
      setCurrentStudent(updatedStudent);
      showToast(result.isSaved ? 'Paper saved to My Archive' : 'Removed from My Archive');
    } catch (e: any) {
      showToast(e.message || 'Failed to update archive');
    }
  };

  const handleToggleNoteBookmark = async (noteId: string) => {
    if (!currentStudent) {
      setAuthPortalTab('student-login');
      setIsStudentAuthOpen(true);
      return;
    }

    try {
      const result = await api.toggleNoteArchive(noteId);
      const updatedStudent: StudentUser = {
        ...currentStudent,
        savedNotes: result.savedNotes || currentStudent.savedNotes,
      };
      setCurrentStudent(updatedStudent);
      showToast(result.isSaved ? 'Study note saved to My Archive' : 'Removed from My Archive');
    } catch (e: any) {
      showToast(e.message || 'Failed to update note archive');
    }
  };

  const handleRemoveFromArchive = async (paperId: string) => {
    if (!currentStudent) return;
    try {
      const result = await api.removePaperFromArchive(paperId);
      const updatedStudent: StudentUser = {
        ...currentStudent,
        bookmarks: result.bookmarks || currentStudent.bookmarks.filter(id => id !== paperId),
        savedPapers: result.savedPapers || currentStudent.savedPapers?.filter(p => p.paperId !== paperId),
      };
      setCurrentStudent(updatedStudent);
      showToast('Paper removed from My Archive');
    } catch (e: any) {
      showToast(e.message || 'Failed to remove paper from archive');
    }
  };

  const handleRemoveNoteFromArchive = async (noteId: string) => {
    if (!currentStudent) return;
    try {
      const result = await api.removeNoteFromArchive(noteId);
      const updatedStudent: StudentUser = {
        ...currentStudent,
        savedNotes: result.savedNotes || currentStudent.savedNotes?.filter(n => n.noteId !== noteId),
      };
      setCurrentStudent(updatedStudent);
      showToast('Study note removed from My Archive');
    } catch (e: any) {
      showToast(e.message || 'Failed to remove note from archive');
    }
  };

  // Download recorded handler
  // Saves persistent reference into student's archive record without duplicates
  const handleDownloadRecorded = async (id: string, type: 'paper' | 'note' = 'paper') => {
    try {
      const result = await api.recordDownload(id, type);
      if (type === 'paper') {
        setPapers(prev =>
          prev.map(p => (p.id === id ? { ...p, downloadsCount: p.downloadsCount + 1 } : p))
        );
      } else {
        setNotes(prev =>
          prev.map(n => (n.id === id ? { ...n, downloadsCount: n.downloadsCount + 1 } : n))
        );
      }
      if (currentStudent) {
        const newRecord = {
          paperId: id,
          noteId: type === 'note' ? id : undefined,
          itemType: type,
          downloadedAt: new Date().toISOString(),
        };
        setCurrentStudent(prev => {
          if (!prev) return null;
          const updatedSaved = result?.savedPapers || (
            type === 'paper'
              ? (prev.savedPapers?.some(p => p.paperId === id)
                ? prev.savedPapers
                : [{ paperId: id, savedAt: new Date().toISOString() }, ...(prev.savedPapers || [])])
              : prev.savedPapers
          );
          const updatedSavedNotes = result?.savedNotes || (
            type === 'note'
              ? (prev.savedNotes?.some(n => n.noteId === id)
                ? prev.savedNotes
                : [{ noteId: id, savedAt: new Date().toISOString() }, ...(prev.savedNotes || [])])
              : prev.savedNotes
          );
          const updatedBookmarks = result?.bookmarks || (
            type === 'paper' && !prev.bookmarks.includes(id) ? [...prev.bookmarks, id] : prev.bookmarks
          );
          return {
            ...prev,
            savedPapers: updatedSaved,
            savedNotes: updatedSavedNotes,
            bookmarks: updatedBookmarks,
            recentDownloads: [newRecord, ...(prev.recentDownloads || [])].slice(0, 50),
          };
        });
        showToast(type === 'note' ? 'Study notes saved to My Archive' : 'Paper saved to My Archive');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Admin Paper mutation callbacks
  const handlePaperAdded = (newPaper: Paper) => {
    setPapers(prev => [newPaper, ...prev]);
    fetchData();
    showToast('Question paper uploaded successfully to repository');
  };

  const handlePaperUpdated = (updatedPaper: Paper) => {
    setPapers(prev => prev.map(p => (p.id === updatedPaper.id ? updatedPaper : p)));
    fetchData();
    showToast(`Updated "${updatedPaper.subjectName}"`);
  };

  const handlePaperDeleted = (deletedId: string) => {
    setPapers(prev => prev.filter(p => p.id !== deletedId));
    fetchData();
    showToast('Question paper deleted from archive');
  };

  // Note mutation callbacks
  const handleNoteAdded = (newNote: Note) => {
    setNotes(prev => [newNote, ...prev]);
    fetchData(false);
    showToast(`Study note "${newNote.title}" uploaded to library`);
  };

  const handleNoteDeleted = (deletedId: string) => {
    setNotes(prev => prev.filter(n => n.id !== deletedId));
    fetchData(false);
    showToast('Study note deleted from library');
  };

  // Admin Subject mutation callbacks
  const handleSubjectAdded = (newSubject: Subject) => {
    setSubjects(prev => [...prev, newSubject]);
    fetchData();
    showToast(`Subject "${newSubject.name}" registered`);
  };

  const handleSubjectDeleted = (subjectId: string) => {
    setSubjects(prev => prev.filter(s => s.id !== subjectId));
    fetchData();
    showToast('Subject removed from catalog');
  };

  // Admin Years and Exam Types updates
  const handleYearsUpdated = (newYears: string[]) => {
    setYears(newYears);
    fetchData();
    showToast('Academic years updated');
  };

  const handleExamTypesUpdated = (newTypes: string[]) => {
    setExamTypes(newTypes);
    fetchData();
    showToast('Examination categories updated');
  };

  // Student auth success callback
  const handleStudentAuthSuccess = (student: StudentUser) => {
    setCurrentStudent(student);
    setCurrentAdmin(null);
    setIsStudentAuthOpen(false);
    setCurrentView('library');
    fetchData(true);
    showToast(`Welcome back, ${student.name}. Access to academic papers granted.`);
  };

  // Admin auth success callback
  const handleAdminAuthSuccess = (admin: AdminUser) => {
    setCurrentAdmin(admin);
    setCurrentStudent(null);
    setIsAdminLoginOpen(false);
    setCurrentView('admin');
    fetchData(true);
    showToast(`Authenticated as ${admin.name} (Controller of Examinations)`);
  };

  // Student sign out
  const handleStudentSignOut = async () => {
    try {
      await api.logout();
    } catch (e) {
      // Ignore
    }
    tokenStorage.clearToken();
    setCurrentStudent(null);
    setCurrentAdmin(null);
    setPapers([]);
    setNotes([]);
    setStats(null);
    setActiveViewingPaper(null);
    setActiveViewingNote(null);
    setAuthPortalTab('student-login');
    showToast('Signed out of student portal. Academic session closed.');
  };

  // Admin sign out
  const handleAdminSignOut = async () => {
    try {
      await api.logout();
    } catch (e) {
      // Ignore
    }
    tokenStorage.clearToken();
    setCurrentStudent(null);
    setCurrentAdmin(null);
    setPapers([]);
    setNotes([]);
    setStats(null);
    setActiveViewingPaper(null);
    setActiveViewingNote(null);
    setAuthPortalTab('admin-login');
    showToast('Signed out of Admin Portal. Session revoked.');
  };

  // Loading Screen while verifying active session on cold boot
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-3 border-[#0F5132] border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-serif-academic font-bold text-[#1C2826]">
          Checking authentication...
        </h2>
        <p className="text-xs text-[#5C6F68] font-mono-code mt-1">
          Verifying institutional security credentials
        </p>
      </div>
    );
  }

  // Is user authenticated?
  const isAuthenticated = !!(currentStudent || currentAdmin);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C2826] flex flex-col font-sans-body antialiased selection:bg-[#E8F5E9] selection:text-[#0F5132]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#1C2826] text-white px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 border border-[#2D3E3A] animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Institutional Top Bar Navigation */}
      <Navbar
        currentView={currentView}
        onNavigate={view => {
          if (view === 'contact') {
            handleNavigateToContact();
            return;
          }
          if (view === 'notes') {
            handleNavigateToNotes();
            return;
          }
          if (window.location.pathname === '/contact' || window.location.pathname === '/notes') {
            window.history.pushState(null, '', '/');
          }
          if (!isAuthenticated) {
            setAuthPortalTab(view === 'admin' ? 'admin-login' : 'student-login');
            setCurrentView(view === 'admin' ? 'admin' : 'archive');
            return;
          }
          if (view === 'admin' && !currentAdmin) {
            showToast('Administrative authorization required');
            return;
          }
          setCurrentView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        currentStudent={currentStudent}
        currentAdmin={currentAdmin}
        onOpenStudentLogin={() => {
          setStudentAuthMode('login');
          setAuthPortalTab('student-login');
          setIsStudentAuthOpen(true);
        }}
        onOpenStudentSignup={() => {
          setStudentAuthMode('signup');
          setAuthPortalTab('student-signup');
          setIsStudentAuthOpen(true);
        }}
        onOpenAdminLogin={() => {
          setAuthPortalTab('admin-login');
          setIsAdminLoginOpen(true);
        }}
        onStudentSignOut={handleStudentSignOut}
        onAdminSignOut={handleAdminSignOut}
      />

      {/* Main Viewport Content */}
      <main className="flex-1">
        {currentView === 'contact' ? (
          <ContactPage
            currentStudent={currentStudent}
            currentAdmin={currentAdmin}
            onNavigateBack={() => {
              if (window.location.pathname === '/contact') {
                window.history.pushState(null, '', '/');
              }
              if (currentAdmin) {
                setCurrentView('admin');
              } else if (currentStudent) {
                setCurrentView('library');
              } else {
                setCurrentView('archive');
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenLogin={() => {
              if (window.location.pathname === '/contact') {
                window.history.pushState(null, '', '/');
              }
              setAuthPortalTab('student-login');
              setCurrentView('archive');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : currentView === 'notes' ? (
          <NotesPage
            notes={notes}
            onViewNote={note => setActiveViewingNote(note)}
            onDownloadRecorded={handleDownloadRecorded}
            isBookmarked={isNoteBookmarked}
            onToggleBookmark={handleToggleNoteBookmark}
            onNavigateToQuestionPapers={() => {
              if (window.location.pathname === '/notes') {
                window.history.pushState(null, '', '/');
              }
              if (isAuthenticated) {
                setCurrentView('library');
              } else {
                setAuthPortalTab('student-login');
                setCurrentView('archive');
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : !isAuthenticated ? (
          /* ==========================================================================
             AUTHENTICATION-FIRST ARCHITECTURE:
             Public access without authenticated session renders ONLY the login/signup portal.
             No paper archive, no exam types, no PDF buttons, no paper data are exposed.
             ========================================================================== */
          <AuthPortalPage
            onStudentAuthenticated={handleStudentAuthSuccess}
            onAdminAuthenticated={handleAdminAuthSuccess}
            initialTab={authPortalTab}
          />
        ) : loading ? (
          <div className="max-w-7xl mx-auto px-4 py-24 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#0F5132] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-[#5C6F68] font-mono-code">
              Accessing institutional archives...
            </p>
          </div>
        ) : (
          /* ==========================================================================
             AUTHENTICATED VIEWS
             ========================================================================== */
          <>
            {currentView === 'home' && (
              <HomePage
                stats={stats}
                recentPapers={papers.slice(0, 6)}
                onNavigateToArchive={handleNavigateToArchive}
                onNavigateToSearch={handleNavigateToSearch}
                onNavigateToNotes={handleNavigateToNotes}
                onViewPaper={paper => setActiveViewingPaper(paper)}
                isBookmarked={isBookmarked}
                onToggleBookmark={handleToggleBookmark}
                onDownloadRecorded={handleDownloadRecorded}
              />
            )}

            {currentView === 'library' && (
              <LibraryPage
                papers={papers}
                subjects={subjects}
                years={years}
                examTypes={examTypes}
                isAdmin={Boolean(currentAdmin)}
                onOpenAddPaper={currentAdmin ? () => setIsAddPaperOpen(true) : undefined}
                onViewPdfModal={paper => setActiveViewingPaper(paper)}
                onPaperDeleted={handlePaperDeleted}
                isBookmarked={isBookmarked}
                onToggleBookmark={handleToggleBookmark}
                onDownloadRecorded={handleDownloadRecorded}
              />
            )}

            {currentView === 'archive' && (
              <ArchivePage
                papers={papers}
                subjects={subjects}
                years={years}
                examTypes={examTypes}
                initialFilters={archiveInitialFilters}
                onViewPaper={paper => setActiveViewingPaper(paper)}
                isBookmarked={isBookmarked}
                onToggleBookmark={handleToggleBookmark}
                onDownloadRecorded={handleDownloadRecorded}
              />
            )}

            {currentView === 'search' && (
              <SearchPage
                papers={papers}
                initialQuery={searchInitialQuery}
                onViewPaper={paper => setActiveViewingPaper(paper)}
                isBookmarked={isBookmarked}
                onToggleBookmark={handleToggleBookmark}
                onDownloadRecorded={handleDownloadRecorded}
              />
            )}

            {currentView === 'profile' && (
              currentStudent ? (
                <StudentProfilePage
                  student={currentStudent}
                  allPapers={papers}
                  allNotes={notes}
                  onViewPaper={paper => setActiveViewingPaper(paper)}
                  onViewNote={note => setActiveViewingNote(note)}
                  onToggleBookmark={handleToggleBookmark}
                  onRemoveFromArchive={handleRemoveFromArchive}
                  onRemoveNoteFromArchive={handleRemoveNoteFromArchive}
                  onDownloadRecorded={handleDownloadRecorded}
                  onNavigateToArchive={handleNavigateToArchive}
                  onNavigateToNotes={() => setCurrentView('notes')}
                />
              ) : (
                <div className="max-w-md mx-auto my-20 p-8 bg-white border border-[#E5DFD5] rounded-xl text-center space-y-4 shadow-sm">
                  <Shield className="w-8 h-8 text-[#0F5132] mx-auto" />
                  <h2 className="text-xl font-serif-academic font-bold text-[#1C2826]">
                    Student Profile Unavailable
                  </h2>
                  <p className="text-xs text-[#5C6F68]">
                    Please authenticate as a student to access your personal paper checklist.
                  </p>
                </div>
              )
            )}

            {currentView === 'admin' && (
              currentAdmin ? (
                <AdminDashboard
                  admin={currentAdmin}
                  stats={stats}
                  papers={papers}
                  notes={notes}
                  subjects={subjects}
                  years={years}
                  examTypes={examTypes}
                  onOpenAddModal={() => setIsAddPaperOpen(true)}
                  onOpenAddNoteModal={() => setIsAddNoteOpen(true)}
                  onEditPaper={paper => setEditingPaper(paper)}
                  onViewPaper={paper => setActiveViewingPaper(paper)}
                  onViewNote={note => setActiveViewingNote(note)}
                  onDeletePaper={handlePaperDeleted}
                  onDeleteNote={handleNoteDeleted}
                  onSubjectAdded={handleSubjectAdded}
                  onSubjectDeleted={handleSubjectDeleted}
                  onYearsUpdated={handleYearsUpdated}
                  onExamTypesUpdated={handleExamTypesUpdated}
                />
              ) : (
                <div className="max-w-md mx-auto my-20 p-8 bg-white border border-[#E5DFD5] rounded-xl text-center space-y-4 shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-[#FEF2F2] text-[#991B1B] flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-serif-academic font-bold text-[#1C2826]">
                    Admin Authorization Required
                  </h2>
                  <p className="text-xs text-[#5C6F68]">
                    This administrative sector requires Controller of Examinations privileges.
                  </p>
                  <button
                    onClick={() => setAuthPortalTab('admin-login')}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs"
                  >
                    Open Admin Sign In
                  </button>
                </div>
              )
            )}
          </>
        )}
      </main>

      {/* Institutional Repository Footer */}
      <Footer onNavigateToContact={handleNavigateToContact} />

      {/* Global Modals */}
      {/* 1. Note Viewer Modal (Accessible in all states) */}
      <NoteViewerModal
        note={activeViewingNote}
        onClose={() => setActiveViewingNote(null)}
        onDownloadRecorded={handleDownloadRecorded}
      />

      {/* 2. Student Auth Modal (Accessible to unauthenticated users) */}
      <StudentAuthModal
        isOpen={isStudentAuthOpen}
        onClose={() => setIsStudentAuthOpen(false)}
        onSuccess={handleStudentAuthSuccess}
        initialMode={studentAuthMode}
      />

      {/* 3. Admin Login Modal (Accessible to unauthenticated users) */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onSuccess={handleAdminAuthSuccess}
      />

      {/* Protected Modals - Mounted when authenticated */}
      {isAuthenticated && (
        <>
          {/* 4. PDF Viewer Modal */}
          <PdfViewerModal
            paper={activeViewingPaper}
            onClose={() => setActiveViewingPaper(null)}
            isBookmarked={activeViewingPaper ? isBookmarked(activeViewingPaper.id) : false}
            onToggleBookmark={handleToggleBookmark}
            onDownloadRecorded={handleDownloadRecorded}
          />

          {/* 5. Add Paper Modal (Admin) */}
          <AddPaperModal
            isOpen={isAddPaperOpen}
            onClose={() => setIsAddPaperOpen(false)}
            subjects={subjects}
            years={years}
            examTypes={examTypes}
            onPaperAdded={handlePaperAdded}
          />

          {/* 6. Edit Paper Modal (Admin) */}
          <EditPaperModal
            paper={editingPaper}
            isOpen={!!editingPaper}
            onClose={() => setEditingPaper(null)}
            subjects={subjects}
            years={years}
            examTypes={examTypes}
            onPaperUpdated={handlePaperUpdated}
          />

          {/* 7. Add Note Modal (Admin) */}
          <AddNoteModal
            isOpen={isAddNoteOpen}
            onClose={() => setIsAddNoteOpen(false)}
            subjects={subjects}
            onNoteAdded={handleNoteAdded}
          />
        </>
      )}
    </div>
  );
}
