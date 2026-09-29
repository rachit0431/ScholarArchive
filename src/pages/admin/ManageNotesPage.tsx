import React, { useState, useMemo } from 'react';
import { Search, Plus, Filter, Eye, Trash2, FileText, Download, AlertTriangle, Layers, BookOpen } from 'lucide-react';
import { Note } from '../../types';
import { api } from '../../services/api';

interface ManageNotesPageProps {
  notes: Note[];
  onOpenAddModal: () => void;
  onViewNote: (note: Note) => void;
  onDeleteNote: (noteId: string) => void;
}

export const ManageNotesPage: React.FC<ManageNotesPageProps> = ({
  notes,
  onOpenAddModal,
  onViewNote,
  onDeleteNote,
}) => {
  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState('All');
  const [filterSemester, setFilterSemester] = useState('All');

  // Deletion modal state
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (filterYear !== 'All' && n.btechYear.toLowerCase() !== filterYear.toLowerCase()) return false;
      if (filterSemester !== 'All' && n.semester.toLowerCase() !== filterSemester.toLowerCase()) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const inTitle = n.title.toLowerCase().includes(q);
        const inName = n.subjectName.toLowerCase().includes(q);
        const inCode = n.subjectCode.toLowerCase().includes(q);
        const inFilename = n.originalFilename?.toLowerCase().includes(q);
        if (!inTitle && !inName && !inCode && !inFilename) return false;
      }
      return true;
    });
  }, [notes, filterYear, filterSemester, search]);

  const confirmDelete = async () => {
    if (!deletingNote || isDeleting) return;
    setIsDeleting(true);
    setDeleteError('');
    const targetNoteId = deletingNote.id;
    try {
      await api.deleteNote(targetNoteId);
      onDeleteNote(targetNoteId);
      setDeletingNote(null);
    } catch (err: any) {
      console.error('Delete note error:', err);
      setDeleteError(err.message || 'Failed to delete note from library.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async (note: Note) => {
    try {
      await api.downloadNoteBlob(
        note.id,
        note.originalFilename || `${note.subjectCode}-Notes.pdf`
      );
    } catch (err: any) {
      alert(err.message || 'Failed to download note.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Prominent Add Note Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#0F5132]">
            Study Materials Control
          </span>
          <h2 className="text-2xl font-serif-academic font-bold text-[#1C2826]">
            All B.Tech Study Notes
          </h2>
          <p className="text-xs text-[#5C6F68] mt-0.5">
            Total of {notes.length} comprehensive study notes cataloged for B.Tech students.
          </p>
        </div>

        <button
          onClick={onOpenAddModal}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Note</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title, subject, or code..."
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
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
          </select>

          <select
            value={filterSemester}
            onChange={e => setFilterSemester(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-xs text-[#1C2826]"
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

          {(filterYear !== 'All' || filterSemester !== 'All' || search) && (
            <button
              onClick={() => {
                setSearch('');
                setFilterYear('All');
                setFilterSemester('All');
              }}
              className="px-2.5 py-1.5 text-xs text-[#DC2626] hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Notes Inventory Table */}
      <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] text-[#5C6F68] uppercase font-mono-code text-[11px] border-b border-[#E5DFD5]">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Title & Subject</th>
                <th className="py-3.5 px-4 font-semibold">Code</th>
                <th className="py-3.5 px-4 font-semibold">Year & Semester</th>
                <th className="py-3.5 px-4 font-semibold">Upload Date</th>
                <th className="py-3.5 px-4 font-semibold">File Size</th>
                <th className="py-3.5 px-4 font-semibold">Views / DL</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD5]">
              {filteredNotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#5C6F68]">
                    No study notes match the applied search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredNotes.map((note) => (
                  <tr key={note.id} className="hover:bg-[#FAF8F5] transition-colors group">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#1C2826] font-serif-academic text-sm leading-snug">
                        {note.title}
                      </div>
                      <div className="text-[11px] text-[#5C6F68] mt-0.5">
                        {note.subjectName}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono-code font-bold text-[#0F5132]">
                      {note.subjectCode}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-[#1C2826]">{note.btechYear}</span>
                      <span className="text-[#5C6F68] block text-[11px]">{note.semester}</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#5C6F68] font-mono-code">
                      {new Date(note.uploadedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-mono-code text-[#5C6F68]">
                      {note.fileSizeFormatted}
                    </td>
                    <td className="py-3.5 px-4 font-mono-code text-[11px] text-[#5C6F68]">
                      <span className="text-[#0F5132] font-semibold">{note.viewsCount || 0}</span> views · {note.downloadsCount || 0} dl
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onViewNote(note)}
                          className="p-1.5 text-[#5C6F68] hover:text-[#0F5132] hover:bg-[#E8F5E9] rounded-md transition-colors"
                          title="View Note PDF"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDownload(note)}
                          className="p-1.5 text-[#5C6F68] hover:text-[#0F5132] hover:bg-[#E8F5E9] rounded-md transition-colors"
                          title="Download Note PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            if (isDeleting) return;
                            setDeleteError('');
                            setDeletingNote(note);
                          }}
                          disabled={isDeleting}
                          className="p-1.5 text-[#5C6F68] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-md transition-colors disabled:opacity-50"
                          title="Delete Note"
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
      {deletingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] border border-[#E5DFD5] w-full max-w-md rounded-xl p-6 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="w-12 h-12 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-serif-academic font-bold text-[#1C2826]">
                Delete Study Note?
              </h3>
              <p className="text-xs text-[#5C6F68] mt-1">
                Are you sure you want to permanently delete <strong className="text-[#1C2826]">"{deletingNote.title}"</strong> ({deletingNote.subjectCode})?
              </p>
              <p className="text-[11px] text-[#DC2626] mt-2 font-mono-code">
                The PDF file will be permanently removed from disk storage. Existing Question Papers will not be affected.
              </p>
            </div>

            {deleteError && (
              <div className="p-2.5 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded-md">
                {deleteError}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingNote(null)}
                disabled={isDeleting}
                className="flex-1 py-2 text-xs font-semibold text-[#5C6F68] bg-[#FAF8F5] border border-[#E5DFD5] hover:bg-[#F5F1EB] rounded-md transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2 text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-md transition-colors shadow-xs disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
