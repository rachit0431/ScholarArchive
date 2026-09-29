import React, { useState, useMemo } from 'react';
import { Search, Plus, Filter, Eye, Edit2, Trash2, FileText, Download, AlertTriangle } from 'lucide-react';
import { Paper, Subject } from '../../types';
import { api } from '../../services/api';

interface ManagePapersPageProps {
  papers: Paper[];
  subjects: Subject[];
  years: string[];
  examTypes: string[];
  onOpenAddModal: () => void;
  onEditPaper: (paper: Paper) => void;
  onViewPaper: (paper: Paper) => void;
  onDeletePaper: (paperId: string) => void;
}

export const ManagePapersPage: React.FC<ManagePapersPageProps> = ({
  papers,
  subjects,
  years,
  examTypes,
  onOpenAddModal,
  onEditPaper,
  onViewPaper,
  onDeletePaper,
}) => {
  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState('All');
  const [filterBtechYear, setFilterBtechYear] = useState('All');
  const [filterExamType, setFilterExamType] = useState('All');
  const [filterSemester, setFilterSemester] = useState('All');

  // Deletion modal state
  const [deletingPaper, setDeletingPaper] = useState<Paper | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const filteredPapers = useMemo(() => {
    return papers.filter((p) => {
      if (filterYear !== 'All' && p.academicYear !== filterYear) return false;
      if (filterBtechYear !== 'All' && p.btechYear.toLowerCase() !== filterBtechYear.toLowerCase()) return false;
      if (filterExamType !== 'All' && p.examType.toLowerCase() !== filterExamType.toLowerCase()) return false;
      if (filterSemester !== 'All' && p.semester.toLowerCase() !== filterSemester.toLowerCase()) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const inName = p.subjectName.toLowerCase().includes(q);
        const inCode = p.subjectCode.toLowerCase().includes(q);
        const inFilename = p.originalFilename.toLowerCase().includes(q);
        if (!inName && !inCode && !inFilename) return false;
      }
      return true;
    });
  }, [papers, filterYear, filterBtechYear, filterExamType, filterSemester, search]);

  const confirmDelete = async () => {
    if (!deletingPaper) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await api.deletePaper(deletingPaper.id);
      onDeletePaper(deletingPaper.id);
      setDeletingPaper(null);
    } catch (err: any) {
      console.error('Delete paper error:', err);
      setDeleteError(err.message || 'Failed to delete question paper from archive.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Prominent Add Paper Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#0F5132]">
            Repository Operations
          </span>
          <h2 className="text-2xl font-serif-academic font-bold text-[#1C2826]">
            All Examination Papers
          </h2>
          <p className="text-xs text-[#5C6F68] mt-0.5">
            Total of {papers.length} digitized question papers archived in system records.
          </p>
        </div>

        <button
          onClick={onOpenAddModal}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Paper</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by subject, code, or file..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
          />
        </div>

        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto">
          <select
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-xs text-[#1C2826]"
          >
            <option value="All">All Years</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            value={filterBtechYear}
            onChange={e => setFilterBtechYear(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-xs text-[#1C2826]"
          >
            <option value="All">All B.Tech Years</option>
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
          </select>

          <select
            value={filterExamType}
            onChange={e => setFilterExamType(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-xs text-[#1C2826]"
          >
            <option value="All">All Exam Types</option>
            {examTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {(filterYear !== 'All' || filterBtechYear !== 'All' || filterExamType !== 'All' || search) && (
            <button
              onClick={() => {
                setSearch('');
                setFilterYear('All');
                setFilterBtechYear('All');
                setFilterExamType('All');
                setFilterSemester('All');
              }}
              className="text-[11px] text-[#991B1B] hover:underline px-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* All Papers Admin Table (Exact specification: Subject | Year | Semester | Exam Type | B.Tech Year | Date | Actions) */}
      <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] border-b border-[#E5DFD5] text-[#5C6F68] uppercase font-mono-code font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-3">Year</th>
                <th className="py-3 px-3">Semester</th>
                <th className="py-3 px-3">Exam Type</th>
                <th className="py-3 px-3">B.Tech Year</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD5] text-[#1C2826]">
              {filteredPapers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#5C6F68]">
                    No question papers found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredPapers.map((paper) => (
                  <tr key={paper.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                    {/* Subject Column */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-sm font-serif-academic text-[#1C2826]">
                        {paper.subjectName}
                      </div>
                      <div className="text-[11px] text-[#5C6F68] font-mono-code flex items-center gap-1.5 mt-0.5">
                        <span className="text-[#0F5132] font-semibold">{paper.subjectCode}</span>
                        <span>·</span>
                        <span className="truncate max-w-[140px]" title={paper.originalFilename}>
                          {paper.originalFilename}
                        </span>
                        <span>·</span>
                        <span>{paper.fileSizeFormatted}</span>
                      </div>
                    </td>

                    {/* Year Column */}
                    <td className="py-3.5 px-3 font-mono-code font-medium">
                      {paper.academicYear}
                    </td>

                    {/* Semester Column */}
                    <td className="py-3.5 px-3">
                      {paper.semester}
                    </td>

                    {/* Exam Type Column */}
                    <td className="py-3.5 px-3 font-semibold text-[#0F5132]">
                      {paper.examType}
                    </td>

                    {/* B.Tech Year Column */}
                    <td className="py-3.5 px-3 text-[#5C6F68]">
                      {paper.btechYear}
                    </td>

                    {/* Date Column */}
                    <td className="py-3.5 px-3 text-[#5C6F68] font-mono-code">
                      {paper.paperDate || 'N/A'}
                    </td>

                    {/* Actions Column (View | Edit | Delete) */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Action */}
                        <button
                          onClick={() => onViewPaper(paper)}
                          title="View PDF"
                          className="p-1.5 text-[#5C6F68] hover:text-[#0F5132] hover:bg-[#E8F5E9] rounded-md transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit Action */}
                        <button
                          onClick={() => onEditPaper(paper)}
                          title="Edit Paper Details & Replace PDF"
                          className="p-1.5 text-[#5C6F68] hover:text-[#1C2826] hover:bg-[#E5DFD5]/60 rounded-md transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete Action */}
                        <button
                          onClick={() => setDeletingPaper(paper)}
                          title="Delete Paper"
                          className="p-1.5 text-[#5C6F68] hover:text-[#991B1B] hover:bg-[#FEE2E2] rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E5DFD5] w-full max-w-md rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-[#991B1B]">
              <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-serif-academic font-bold text-[#1C2826]">
                  Delete Examination Paper?
                </h4>
                <p className="text-xs text-[#5C6F68]">
                  This action permanently removes the PDF file from the server.
                </p>
              </div>
            </div>

            <div className="bg-[#FAF8F5] p-3 rounded-md border border-[#E5DFD5] text-xs text-[#5C6F68] space-y-1">
              <p><strong className="text-[#1C2826]">Subject:</strong> {deletingPaper.subjectName} ({deletingPaper.subjectCode})</p>
              <p><strong className="text-[#1C2826]">Exam:</strong> {deletingPaper.examType} · {deletingPaper.academicYear}</p>
              <p className="font-mono-code text-[11px] truncate"><strong className="text-[#1C2826]">File:</strong> {deletingPaper.originalFilename}</p>
            </div>

            {deleteError && (
              <div className="p-2.5 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded-md">
                {deleteError}
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
