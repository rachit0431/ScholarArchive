import React, { useState } from 'react';
import {
  FileText,
  BookOpen,
  Calendar,
  Users,
  Plus,
  Download,
  Eye,
  Edit2,
  Trash2,
  Layers,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  GraduationCap,
  Mail,
} from 'lucide-react';
import { SystemStats, Paper, Note, Subject, AdminUser } from '../../types';
import { api } from '../../services/api';
import { ManagePapersPage } from './ManagePapersPage';
import { ManageNotesPage } from './ManageNotesPage';
import { ManageSubjectsPage } from './ManageSubjectsPage';
import { ManageYearsPage } from './ManageYearsPage';
import { ManageExamTypesPage } from './ManageExamTypesPage';
import { ManageStudentsPage } from './ManageStudentsPage';
import { ManageContactMessagesPage } from './ManageContactMessagesPage';

interface AdminDashboardProps {
  admin: AdminUser;
  stats: SystemStats | null;
  papers: Paper[];
  notes: Note[];
  subjects: Subject[];
  years: string[];
  examTypes: string[];
  onOpenAddModal: () => void;
  onOpenAddNoteModal: () => void;
  onEditPaper: (paper: Paper) => void;
  onViewPaper: (paper: Paper) => void;
  onViewNote: (note: Note) => void;
  onDeletePaper: (paperId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onSubjectAdded: (subject: Subject) => void;
  onSubjectDeleted: (id: string) => void;
  onYearsUpdated: (years: string[]) => void;
  onExamTypesUpdated: (types: string[]) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  admin,
  stats,
  papers,
  notes,
  subjects,
  years,
  examTypes,
  onOpenAddModal,
  onOpenAddNoteModal,
  onEditPaper,
  onViewPaper,
  onViewNote,
  onDeletePaper,
  onDeleteNote,
  onSubjectAdded,
  onSubjectDeleted,
  onYearsUpdated,
  onExamTypesUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'papers' | 'notes' | 'subjects' | 'years' | 'examTypes' | 'students' | 'messages'>('overview');
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [deletingPaper, setDeletingPaper] = useState<Paper | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const totalPapers = stats?.totalPapers ?? papers.length;
  const totalSubjects = stats?.totalSubjects ?? subjects.length;
  const totalYears = stats?.totalYears ?? years.length;
  const totalStudents = studentCount ?? stats?.totalStudents ?? 0;
  const totalDownloads = stats?.totalDownloads ?? papers.reduce((acc, p) => acc + (p.downloadsCount || 0), 0);

  const recentPapers = [...papers]
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, 5);

  const confirmDelete = async () => {
    if (!deletingPaper) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await api.deletePaper(deletingPaper.id);
      onDeletePaper(deletingPaper.id);
      setDeletingPaper(null);
    } catch (err: any) {
      console.error('Delete error in AdminDashboard:', err);
      setDeleteError(err.message || 'Failed to delete question paper from archive.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Admin Panel Header & Authority Banner */}
      <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#0F5132] mb-1">
              <ShieldCheck className="w-4 h-4 text-[#10B981]" />
              <span>Office of the Controller of Examinations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif-academic font-bold text-[#1C2826]">
              Digital Examination Control Panel
            </h1>
            <p className="text-xs text-[#5C6F68] mt-1">
              Signed in as <strong className="text-[#1C2826]">{admin.name}</strong> ({admin.email}) · Autonomous Engineering Repository
            </p>
          </div>

          {/* Prominent Add Paper Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs self-stretch sm:self-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            <span>Add Paper</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-[#E5DFD5] flex items-center flex-wrap gap-2 sm:gap-6 text-sm">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'text-[#0F5132] border-b-2 border-[#0F5132]'
              : 'text-[#5C6F68] hover:text-[#1C2826]'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Dashboard Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('papers')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'papers'
              ? 'text-[#0F5132] border-b-2 border-[#0F5132]'
              : 'text-[#5C6F68] hover:text-[#1C2826]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Manage Papers ({papers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'notes'
              ? 'text-[#0F5132] border-b-2 border-[#0F5132]'
              : 'text-[#5C6F68] hover:text-[#1C2826]'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Manage Notes ({notes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('subjects')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'subjects'
              ? 'text-[#0F5132] border-b-2 border-[#0F5132]'
              : 'text-[#5C6F68] hover:text-[#1C2826]'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Manage Subjects ({subjects.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('years')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'years'
              ? 'text-[#0F5132] border-b-2 border-[#0F5132]'
              : 'text-[#5C6F68] hover:text-[#1C2826]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Manage Years ({years.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('examTypes')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'examTypes'
              ? 'text-[#0F5132] border-b-2 border-[#0F5132]'
              : 'text-[#5C6F68] hover:text-[#1C2826]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Manage Exam Types ({examTypes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'students'
              ? 'text-[#0F5132] border-b-2 border-[#0F5132]'
              : 'text-[#5C6F68] hover:text-[#1C2826]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Students / Users ({totalStudents})</span>
        </button>

        <button
          onClick={() => setActiveTab('messages')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'messages'
              ? 'text-[#0F5132] border-b-2 border-[#0F5132]'
              : 'text-[#5C6F68] hover:text-[#1C2826]'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Contact Inquiries</span>
        </button>
      </div>

      {/* Tab 1: Dashboard Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Key Metric KPI Tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-5 shadow-2xs">
              <div className="flex items-center justify-between text-[#5C6F68] mb-2">
                <span className="text-xs uppercase tracking-wider font-semibold">Total Papers</span>
                <FileText className="w-4 h-4 text-[#0F5132]" />
              </div>
              <div className="text-3xl font-serif-academic font-bold text-[#1C2826] font-mono-code">
                {totalPapers}
              </div>
              <p className="text-[11px] text-[#5C6F68] mt-1">Archived PDF question folios</p>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-5 shadow-2xs">
              <div className="flex items-center justify-between text-[#5C6F68] mb-2">
                <span className="text-xs uppercase tracking-wider font-semibold">Total Subjects</span>
                <BookOpen className="w-4 h-4 text-[#0F5132]" />
              </div>
              <div className="text-3xl font-serif-academic font-bold text-[#1C2826] font-mono-code">
                {totalSubjects}
              </div>
              <p className="text-[11px] text-[#5C6F68] mt-1">Approved course modules</p>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-5 shadow-2xs">
              <div className="flex items-center justify-between text-[#5C6F68] mb-2">
                <span className="text-xs uppercase tracking-wider font-semibold">Total Years</span>
                <Calendar className="w-4 h-4 text-[#0F5132]" />
              </div>
              <div className="text-3xl font-serif-academic font-bold text-[#1C2826] font-mono-code">
                {totalYears}
              </div>
              <p className="text-[11px] text-[#5C6F68] mt-1">Academic batch years</p>
            </div>

            <div
              onClick={() => setActiveTab('students')}
              className="bg-[#FFFFFF] border border-[#E5DFD5] hover:border-[#0F5132] rounded-xl p-5 shadow-2xs cursor-pointer transition-all group"
              title="Click to view and manage registered student accounts"
            >
              <div className="flex items-center justify-between text-[#5C6F68] group-hover:text-[#0F5132] mb-2">
                <span className="text-xs uppercase tracking-wider font-semibold">Total Students</span>
                <Users className="w-4 h-4 text-[#0F5132]" />
              </div>
              <div className="text-3xl font-serif-academic font-bold text-[#1C2826] font-mono-code">
                {totalStudents}
              </div>
              <p className="text-[11px] text-[#0F5132] font-semibold mt-1 flex items-center gap-1 group-hover:underline">
                <span>Manage students</span>
                <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
              </p>
            </div>
          </div>

          {/* Curricular Distribution Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-5 sm:p-6 shadow-xs">
              <h3 className="text-base font-serif-academic font-bold text-[#1C2826] mb-4">
                Examination Category Distribution
              </h3>
              <div className="space-y-3">
                {examTypes.map((type) => {
                  const count = papers.filter(p => p.examType.toLowerCase() === type.toLowerCase()).length;
                  const percentage = totalPapers > 0 ? Math.round((count / totalPapers) * 100) : 0;
                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-[#1C2826]">{type}</span>
                        <span className="font-mono-code text-[#5C6F68]">{count} papers ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-[#FAF8F5] border border-[#E5DFD5] h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#0F5132] h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-5 sm:p-6 shadow-xs">
              <h3 className="text-base font-serif-academic font-bold text-[#1C2826] mb-4">
                Progression Year Distribution
              </h3>
              <div className="space-y-3">
                {['1st Year', '2nd Year', '3rd Year', '4th Year'].map((yr) => {
                  const count = papers.filter(p => p.btechYear.toLowerCase() === yr.toLowerCase()).length;
                  const percentage = totalPapers > 0 ? Math.round((count / totalPapers) * 100) : 0;
                  return (
                    <div key={yr} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-[#1C2826]">{yr}</span>
                        <span className="font-mono-code text-[#5C6F68]">{count} papers ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-[#FAF8F5] border border-[#E5DFD5] h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#10B981] h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recently Added Papers (Direct Requirement from Prompt) */}
          <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-[#E5DFD5] flex items-center justify-between">
              <div>
                <h3 className="text-base font-serif-academic font-bold text-[#1C2826]">
                  Recently Added Papers
                </h3>
                <p className="text-xs text-[#5C6F68]">
                  The 5 most recent question paper uploads in the academic database.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('papers')}
                className="text-xs font-semibold text-[#0F5132] hover:underline flex items-center gap-1"
              >
                <span>View All Papers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F5] border-b border-[#E5DFD5] text-[#5C6F68] uppercase font-mono-code font-semibold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-3">Year</th>
                    <th className="py-3 px-3">Semester</th>
                    <th className="py-3 px-3">Exam Type</th>
                    <th className="py-3 px-3">File Size</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DFD5]">
                  {recentPapers.map((paper) => (
                    <tr key={paper.id} className="hover:bg-[#FAF8F5]">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#1C2826]">{paper.subjectName}</div>
                        <div className="text-[11px] text-[#0F5132] font-mono-code">{paper.subjectCode}</div>
                      </td>
                      <td className="py-3 px-3 font-mono-code">{paper.academicYear}</td>
                      <td className="py-3 px-3">{paper.semester}</td>
                      <td className="py-3 px-3 font-semibold text-[#0F5132]">{paper.examType}</td>
                      <td className="py-3 px-3 font-mono-code text-[#5C6F68]">{paper.fileSizeFormatted}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onViewPaper(paper)}
                            title="View PDF"
                            className="p-1.5 text-[#5C6F68] hover:text-[#0F5132] hover:bg-[#E8F5E9] rounded transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onEditPaper(paper)}
                            title="Edit Paper"
                            className="p-1.5 text-[#5C6F68] hover:text-[#1C2826] hover:bg-[#E5DFD5]/60 rounded transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteError('');
                              setDeletingPaper(paper);
                            }}
                            title="Delete Paper"
                            className="p-1.5 text-[#5C6F68] hover:text-[#991B1B] hover:bg-[#FEE2E2] rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: All Papers Table */}
      {activeTab === 'papers' && (
        <ManagePapersPage
          papers={papers}
          subjects={subjects}
          years={years}
          examTypes={examTypes}
          onOpenAddModal={onOpenAddModal}
          onEditPaper={onEditPaper}
          onViewPaper={onViewPaper}
          onDeletePaper={onDeletePaper}
        />
      )}

      {/* Tab: Manage Notes */}
      {activeTab === 'notes' && (
        <ManageNotesPage
          notes={notes}
          onOpenAddModal={onOpenAddNoteModal}
          onViewNote={onViewNote}
          onDeleteNote={onDeleteNote}
        />
      )}

      {/* Tab 3: Manage Subjects */}
      {activeTab === 'subjects' && (
        <ManageSubjectsPage
          subjects={subjects}
          onSubjectAdded={onSubjectAdded}
          onSubjectDeleted={onSubjectDeleted}
        />
      )}

      {/* Tab 4: Manage Years */}
      {activeTab === 'years' && (
        <ManageYearsPage
          years={years}
          papers={papers}
          onYearsUpdated={onYearsUpdated}
        />
      )}

      {/* Tab 5: Manage Exam Types */}
      {activeTab === 'examTypes' && (
        <ManageExamTypesPage
          examTypes={examTypes}
          papers={papers}
          onExamTypesUpdated={onExamTypesUpdated}
        />
      )}

      {/* Tab 6: Manage Students & Users */}
      {activeTab === 'students' && (
        <ManageStudentsPage
          onStudentCountChange={(count) => setStudentCount(count)}
        />
      )}

      {/* Tab 7: Manage Contact Inquiries & Correspondence */}
      {activeTab === 'messages' && (
        <ManageContactMessagesPage />
      )}

      {/* Delete Confirmation Modal for Overview Tab */}
      {deletingPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-[#E5DFD5] space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-[#991B1B]">
              <div className="w-10 h-10 rounded-full bg-[#FEF2F2] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-[#991B1B]" />
              </div>
              <div>
                <h4 className="text-base font-serif-academic font-bold text-[#1C2826]">
                  Delete Examination Paper?
                </h4>
                <p className="text-xs text-[#5C6F68]">
                  This action permanently removes the PDF file from the repository and server disk.
                </p>
              </div>
            </div>

            <div className="bg-[#FAF8F5] p-3 rounded-md border border-[#E5DFD5] text-xs text-[#5C6F68] space-y-1">
              <p><strong className="text-[#1C2826]">Subject:</strong> {deletingPaper.subjectName} ({deletingPaper.subjectCode})</p>
              <p><strong className="text-[#1C2826]">Exam:</strong> {deletingPaper.examType} · {deletingPaper.academicYear}</p>
              <p className="font-mono-code text-[11px] truncate"><strong className="text-[#1C2826]">File:</strong> {deletingPaper.originalFilename}</p>
            </div>

            {deleteError && (
              <div className="p-2.5 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded-md flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingPaper(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs font-medium text-[#5C6F68] bg-[#FAF8F5] border border-[#E5DFD5] rounded-md hover:bg-[#F5F1EB]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] rounded-md shadow-xs disabled:opacity-60"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
