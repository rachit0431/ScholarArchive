import React, { useState, useEffect, useTransition } from 'react';
import {
  Users,
  Search,
  Filter,
  Shield,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Mail,
  Calendar,
  GraduationCap,
  Bookmark,
  Download,
  Lock,
  Copy,
  Check,
  X,
  UserCheck,
  UserX,
} from 'lucide-react';
import { StudentUser } from '../../types';
import { api } from '../../services/api';

interface ManageStudentsPageProps {
  onStudentCountChange?: (count: number) => void;
}

export const ManageStudentsPage: React.FC<ManageStudentsPageProps> = ({ onStudentCountChange }) => {
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  // Filter States
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('All');
  const [semesterFilter, setSemesterFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [authMethodFilter, setAuthMethodFilter] = useState('All');

  // Modal / Action States
  const [selectedStudent, setSelectedStudent] = useState<StudentUser | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<StudentUser | null>(null);
  const [isUpdatingStatusId, setIsUpdatingStatusId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  const loadStudents = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getStudents({
        search,
        year: yearFilter,
        semester: semesterFilter,
        status: statusFilter,
        authMethod: authMethodFilter,
      });
      setStudents(data);
      if (onStudentCountChange) {
        onStudentCountChange(data.length);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve student directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [yearFilter, semesterFilter, statusFilter, authMethodFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadStudents();
  };

  const handleResetFilters = () => {
    setSearch('');
    setYearFilter('All');
    setSemesterFilter('All');
    setStatusFilter('All');
    setAuthMethodFilter('All');
    startTransition(() => {
      api.getStudents().then(data => {
        setStudents(data);
        if (onStudentCountChange) onStudentCountChange(data.length);
      });
    });
  };

  const handleToggleStatus = async (student: StudentUser) => {
    const newStatus = student.status === 'disabled' ? 'active' : 'disabled';
    setIsUpdatingStatusId(student.id);
    setError('');
    setSuccessBanner('');

    try {
      const res = await api.updateStudentStatus(student.id, newStatus);
      setStudents(prev =>
        prev.map(s => (s.id === student.id ? { ...s, status: newStatus } : s))
      );
      if (selectedStudent?.id === student.id) {
        setSelectedStudent(prev => (prev ? { ...prev, status: newStatus } : null));
      }
      setSuccessBanner(res.message);
      setTimeout(() => setSuccessBanner(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update account status.');
    } finally {
      setIsUpdatingStatusId(null);
    }
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    setError('');
    setSuccessBanner('');

    try {
      const res = await api.deleteStudent(studentToDelete.id);
      setStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
      if (onStudentCountChange) {
        onStudentCountChange(students.length - 1);
      }
      if (selectedStudent?.id === studentToDelete.id) {
        setSelectedStudent(null);
      }
      setSuccessBanner(res.message);
      setStudentToDelete(null);
      setTimeout(() => setSuccessBanner(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete student account.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Metrics computation
  const totalCount = students.length;
  const activeCount = students.filter(s => s.status !== 'disabled').length;
  const disabledCount = students.filter(s => s.status === 'disabled').length;
  const googleCount = students.filter(s => s.authMethod === 'google').length;
  const emailCount = totalCount - googleCount;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E5DFD5] rounded-xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#0F5132] mb-1">
            <Shield className="w-4 h-4 text-[#10B981]" />
            <span>Autonomous Student Registry</span>
          </div>
          <h2 className="text-2xl font-serif-academic font-bold text-[#1C2826]">
            Students & User Management
          </h2>
          <p className="text-xs text-[#5C6F68] mt-1">
            Browse, inspect, toggle account credentials, and administer registered student profiles from the live database.
          </p>
        </div>

        <button
          onClick={loadStudents}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#1C2826] bg-[#FAF8F5] hover:bg-[#E5DFD5] border border-[#E5DFD5] rounded-md transition-colors self-start sm:self-auto disabled:opacity-50"
          title="Reload students directory"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Directory</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white border border-[#E5DFD5] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#5C6F68] uppercase tracking-wider block">
            Total Students
          </span>
          <span className="text-2xl font-bold font-serif-academic text-[#1C2826] mt-1 block">
            {totalCount}
          </span>
        </div>

        <div className="bg-white border border-[#E5DFD5] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#0F5132] uppercase tracking-wider block">
            Active Accounts
          </span>
          <span className="text-2xl font-bold font-serif-academic text-[#0F5132] mt-1 block">
            {activeCount}
          </span>
        </div>

        <div className="bg-white border border-[#E5DFD5] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#991B1B] uppercase tracking-wider block">
            Disabled Accounts
          </span>
          <span className="text-2xl font-bold font-serif-academic text-[#991B1B] mt-1 block">
            {disabledCount}
          </span>
        </div>

        <div className="bg-white border border-[#E5DFD5] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#1E40AF] uppercase tracking-wider block">
            Google Workspace
          </span>
          <span className="text-2xl font-bold font-serif-academic text-[#1E40AF] mt-1 block">
            {googleCount}
          </span>
        </div>

        <div className="bg-white border border-[#E5DFD5] rounded-lg p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#5C6F68] uppercase tracking-wider block">
            Email & Password
          </span>
          <span className="text-2xl font-bold font-serif-academic text-[#1C2826] mt-1 block">
            {emailCount}
          </span>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-4 bg-[#E8F5E9] border border-[#A7F3D0] rounded-lg flex items-center justify-between text-xs text-[#065F46] animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            <span className="font-semibold">{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner('')}
            className="p-1 hover:bg-[#A7F3D0]/50 rounded text-[#065F46]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {error && (
        <div className="p-4 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg flex items-center justify-between text-xs text-[#991B1B] animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            onClick={() => setError('')}
            className="p-1 hover:bg-[#FCA5A5]/50 rounded text-[#991B1B]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E5DFD5] rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C6F68]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by student name or college email..."
              className="w-full pl-9 pr-8 py-2 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-xs focus:outline-none focus:border-[#0F5132] focus:bg-white text-[#1C2826]"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  api.getStudents({
                    search: '',
                    year: yearFilter,
                    semester: semesterFilter,
                    status: statusFilter,
                    authMethod: authMethodFilter,
                  }).then(data => setStudents(data));
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5C6F68] hover:text-[#1C2826]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors"
          >
            Search
          </button>
        </form>

        {/* Filter Dropdowns Row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#E5DFD5] text-xs">
          <div className="flex items-center gap-1.5 text-[#5C6F68] font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Year Filter */}
          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-xs text-[#1C2826] focus:outline-none focus:border-[#0F5132]"
          >
            <option value="All">All B.Tech Years</option>
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
          </select>

          {/* Semester Filter */}
          <select
            value={semesterFilter}
            onChange={e => setSemesterFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-xs text-[#1C2826] focus:outline-none focus:border-[#0F5132]"
          >
            <option value="All">All Semesters</option>
            <option value="Semester 1">Semester 1</option>
            <option value="Semester 2">Semester 2</option>
            <option value="Semester 3">Semester 3</option>
            <option value="Semester 4">Semester 4</option>
            <option value="Semester 5">Semester 5</option>
            <option value="Semester 6">Semester 6</option>
            <option value="Semester 7">Semester 7</option>
            <option value="Semester 8">Semester 8</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-xs text-[#1C2826] focus:outline-none focus:border-[#0F5132]"
          >
            <option value="All">All Statuses</option>
            <option value="active">Active Accounts Only</option>
            <option value="disabled">Disabled Accounts Only</option>
          </select>

          {/* Auth Method Filter */}
          <select
            value={authMethodFilter}
            onChange={e => setAuthMethodFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-xs text-[#1C2826] focus:outline-none focus:border-[#0F5132]"
          >
            <option value="All">All Auth Methods</option>
            <option value="email">College Email & Password</option>
            <option value="google">Google Workspace</option>
          </select>

          {(search || yearFilter !== 'All' || semesterFilter !== 'All' || statusFilter !== 'All' || authMethodFilter !== 'All') && (
            <button
              onClick={handleResetFilters}
              className="ml-auto text-xs text-[#0F5132] hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Students Data Table */}
      <div className="bg-white border border-[#E5DFD5] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E5DFD5] text-[#5C6F68] uppercase tracking-wider font-semibold text-[11px]">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">College Email</th>
                <th className="py-3 px-4">B.Tech Year</th>
                <th className="py-3 px-4">Semester</th>
                <th className="py-3 px-4">Registration Date</th>
                <th className="py-3 px-4">Auth Method</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD5]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#5C6F68]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#0F5132]" />
                      <span>Loading registered student database...</span>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#5C6F68]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-[#5C6F68]/50" />
                      <p className="font-semibold text-[#1C2826]">No student records match the active criteria.</p>
                      <p className="text-[11px]">Try adjusting your search terms or clearing applied filters.</p>
                      {(search || yearFilter !== 'All' || semesterFilter !== 'All' || statusFilter !== 'All' || authMethodFilter !== 'All') && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-2 px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded hover:bg-[#E5DFD5]"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                students.map(student => {
                  const isGoogle = student.authMethod === 'google';
                  const isDisabled = student.status === 'disabled';
                  const isUpdating = isUpdatingStatusId === student.id;

                  // Initials for avatar
                  const initials = student.name
                    .split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  const regDateFormatted = new Date(student.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-[#FAF8F5]/60 transition-colors ${
                        isDisabled ? 'bg-neutral-50/70 text-neutral-500' : ''
                      }`}
                    >
                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isDisabled
                                ? 'bg-neutral-200 text-neutral-600'
                                : isGoogle
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-[#E8F5E9] text-[#0F5132]'
                            }`}
                          >
                            {initials || 'ST'}
                          </div>
                          <div>
                            <p className="font-semibold text-[#1C2826]">{student.name}</p>
                            <span className="text-[10px] text-[#5C6F68] font-mono-code">
                              ID: {student.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* College Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono-code text-[11px] text-[#1C2826]">
                          <span>{student.email}</span>
                          <button
                            onClick={() => handleCopyEmail(student.email)}
                            className="p-1 text-[#5C6F68] hover:text-[#0F5132] rounded transition-colors"
                            title="Copy email to clipboard"
                          >
                            {copiedEmail === student.email ? (
                              <Check className="w-3 h-3 text-[#10B981]" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* B.Tech Year */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#FAF8F5] border border-[#E5DFD5] text-[#1C2826]">
                          {student.year || '1st Year'}
                        </span>
                      </td>

                      {/* Semester */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#FAF8F5] border border-[#E5DFD5] text-[#5C6F68]">
                          {student.semester || 'Semester 1'}
                        </span>
                      </td>

                      {/* Registration Date */}
                      <td className="py-3 px-4 text-[#5C6F68] text-[11px] whitespace-nowrap">
                        {regDateFormatted}
                      </td>

                      {/* Auth Method */}
                      <td className="py-3 px-4">
                        {isGoogle ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 border border-blue-200 text-blue-700">
                            <svg className="w-3 h-3" viewBox="0 0 24 24">
                              <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              />
                              <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                              />
                              <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                              />
                            </svg>
                            <span>Google</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
                            <Mail className="w-3 h-3" />
                            <span>Email</span>
                          </span>
                        )}
                      </td>

                      {/* Account Status */}
                      <td className="py-3 px-4">
                        {isDisabled ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 border border-red-200 text-red-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            <span>Disabled</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                            <span>Active</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Details */}
                          <button
                            onClick={() => setSelectedStudent(student)}
                            className="p-1.5 text-[#5C6F68] hover:text-[#0F5132] hover:bg-[#FAF8F5] rounded transition-colors"
                            title="View student profile details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Toggle Account Status */}
                          <button
                            onClick={() => handleToggleStatus(student)}
                            disabled={isUpdating}
                            className={`p-1.5 rounded transition-colors ${
                              isDisabled
                                ? 'text-[#10B981] hover:bg-emerald-50'
                                : 'text-amber-600 hover:bg-amber-50'
                            } disabled:opacity-50`}
                            title={isDisabled ? 'Enable student account' : 'Disable student account'}
                          >
                            {isUpdating ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : isDisabled ? (
                              <UserCheck className="w-4 h-4" />
                            ) : (
                              <UserX className="w-4 h-4" />
                            )}
                          </button>

                          {/* Delete Account */}
                          <button
                            onClick={() => setStudentToDelete(student)}
                            className="p-1.5 text-[#5C6F68] hover:text-[#991B1B] hover:bg-[#FEE2E2] rounded transition-colors"
                            title="Delete student record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Details Inspection Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-[#FAF8F5] border border-[#E5DFD5] w-full max-w-lg rounded-xl shadow-2xl p-6 sm:p-8 relative">
            <button
              onClick={() => setSelectedStudent(null)}
              className="absolute top-4 right-4 p-1.5 text-[#5C6F68] hover:text-[#1C2826] hover:bg-[#E5DFD5]/50 rounded-md transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <span className="text-[10px] tracking-widest uppercase text-[#0F5132] font-semibold block mb-1">
                Student Profile Inspector
              </span>
              <h3 className="text-2xl font-serif-academic font-bold text-[#1C2826]">
                {selectedStudent.name}
              </h3>
              <p className="text-xs text-[#5C6F68] font-mono-code mt-0.5">
                {selectedStudent.email}
              </p>
            </div>

            {/* Profile Information Grid */}
            <div className="bg-white border border-[#E5DFD5] rounded-lg p-4 space-y-3 text-xs mb-6">
              <div className="flex justify-between py-1.5 border-b border-[#E5DFD5]">
                <span className="text-[#5C6F68] font-medium flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Academic Level</span>
                </span>
                <span className="font-semibold text-[#1C2826]">
                  {selectedStudent.year} · {selectedStudent.semester}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-[#E5DFD5]">
                <span className="text-[#5C6F68] font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Account Created</span>
                </span>
                <span className="font-mono-code text-[#1C2826]">
                  {new Date(selectedStudent.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-[#E5DFD5]">
                <span className="text-[#5C6F68] font-medium flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Authentication Method</span>
                </span>
                <span className="font-semibold text-[#1C2826] uppercase">
                  {selectedStudent.authMethod === 'google' ? 'Google Workspace' : 'College Email & Password'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-[#E5DFD5]">
                <span className="text-[#5C6F68] font-medium flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Account Status</span>
                </span>
                <span
                  className={`font-semibold ${
                    selectedStudent.status === 'disabled' ? 'text-[#991B1B]' : 'text-[#0F5132]'
                  }`}
                >
                  {selectedStudent.status === 'disabled' ? 'Disabled by Admin' : 'Active and Authorized'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-[#E5DFD5]">
                <span className="text-[#5C6F68] font-medium flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Bookmarked Papers</span>
                </span>
                <span className="font-bold text-[#1C2826]">
                  {selectedStudent.bookmarks?.length || 0} papers
                </span>
              </div>

              <div className="flex justify-between py-1.5">
                <span className="text-[#5C6F68] font-medium flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  <span>Recent Downloads</span>
                </span>
                <span className="font-bold text-[#1C2826]">
                  {selectedStudent.recentDownloads?.length || 0} downloads recorded
                </span>
              </div>
            </div>

            {/* Cryptographic Security Assurance Notice */}
            <div className="p-3 bg-[#E8F5E9]/50 border border-[#A7F3D0] rounded-lg text-[11px] text-[#065F46] flex items-start gap-2 mb-6">
              <Lock className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Cryptographic Security Enforced</p>
                <p className="text-[#065F46]/90 mt-0.5">
                  Plaintext passwords are never stored or accessible by college administration. Passwords are salted with 16 random bytes and hashed using Scrypt KDF.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#E5DFD5]">
              <button
                onClick={() => handleToggleStatus(selectedStudent)}
                disabled={isUpdatingStatusId === selectedStudent.id}
                className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  selectedStudent.status === 'disabled'
                    ? 'bg-[#0F5132] text-white hover:bg-[#064E3B]'
                    : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                }`}
              >
                {selectedStudent.status === 'disabled' ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Enable Account</span>
                  </>
                ) : (
                  <>
                    <UserX className="w-3.5 h-3.5" />
                    <span>Disable Account</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setStudentToDelete(selectedStudent);
                  setSelectedStudent(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2] border border-[#FCA5A5] rounded-md transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-[#FAF8F5] border border-[#E5DFD5] w-full max-w-md rounded-xl shadow-2xl p-6 relative">
            <div className="flex items-center gap-3 text-[#991B1B] mb-4">
              <div className="p-2.5 bg-[#FEE2E2] rounded-full">
                <AlertTriangle className="w-6 h-6 text-[#DC2626]" />
              </div>
              <div>
                <h3 className="text-lg font-serif-academic font-bold text-[#1C2826]">
                  Delete Student Account?
                </h3>
                <p className="text-xs text-[#5C6F68]">
                  Permanent removal from institutional database
                </p>
              </div>
            </div>

            <p className="text-xs text-[#5C6F68] leading-relaxed mb-4">
              Are you sure you want to permanently delete the account of{' '}
              <strong className="text-[#1C2826]">{studentToDelete.name}</strong> (
              <span className="font-mono-code">{studentToDelete.email}</span>)? All session tokens, bookmarks, and account associations will be permanently purged.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5DFD5]">
              <button
                onClick={() => setStudentToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-[#5C6F68] hover:text-[#1C2826] bg-[#FAF8F5] hover:bg-[#E5DFD5] border border-[#E5DFD5] rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteStudent}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-md transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
