import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { Subject, Note } from '../../types';
import { api } from '../../services/api';

interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects?: Subject[];
  onNoteAdded: (note: Note) => void;
}

export const AddNoteModal: React.FC<AddNoteModalProps> = ({
  isOpen,
  onClose,
  subjects = [],
  onNoteAdded,
}) => {
  // Form State
  const [title, setTitle] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [btechYear, setBtechYear] = useState('1st Year');
  const [semester, setSemester] = useState('Semester 1');
  const [description, setDescription] = useState('');

  // File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  // Autofill subject code, year, semester if user selects an existing subject
  const handleSubjectNameChange = (val: string) => {
    setSubjectName(val);
    const matched = subjects.find(
      s => s.name.toLowerCase() === val.trim().toLowerCase()
    );
    if (matched) {
      if (!subjectCode) setSubjectCode(matched.code);
      setBtechYear(matched.btechYear);
      setSemester(matched.semester);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError('');
    const isPdf =
      file.name.toLowerCase().endsWith('.pdf') ||
      file.type === 'application/pdf' ||
      file.type === 'application/x-pdf';

    if (!isPdf) {
      setError('Invalid file format. Please select an authentic PDF document (.pdf).');
      return;
    }

    if (file.size > 60 * 1024 * 1024) {
      setError('File size must be 60 MB or less.');
      return;
    }

    setSelectedFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!title.trim()) {
      setError('Please provide a descriptive Note Title.');
      return;
    }
    if (!subjectName.trim()) {
      setError('Please provide the Subject Name.');
      return;
    }
    if (!btechYear) {
      setError('Please select the B.Tech Year.');
      return;
    }
    if (!semester) {
      setError('Please select the Semester.');
      return;
    }
    if (!selectedFile) {
      setError('Please attach the Note PDF document.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('subjectName', subjectName.trim());
      formData.append('subjectCode', (subjectCode || 'N/A').trim().toUpperCase());
      formData.append('btechYear', btechYear);
      formData.append('semester', semester);
      formData.append('description', description.trim());
      formData.append('file', selectedFile);

      const newNote = await api.uploadNote(formData, progress => {
        setUploadProgress(progress);
      });

      setSuccessMessage('Note uploaded successfully!');
      onNoteAdded(newNote);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Upload note error:', err);
      const rawMsg = err?.message || 'Failed to upload note. Please verify file and retry.';
      const cleanMsg = typeof rawMsg === 'string' ? rawMsg.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : 'Failed to upload note.';
      setError(cleanMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const semestersForYear = (yr: string) => {
    switch (yr) {
      case '1st Year':
        return ['Semester 1', 'Semester 2'];
      case '2nd Year':
        return ['Semester 3', 'Semester 4'];
      case '3rd Year':
        return ['Semester 5', 'Semester 6'];
      case '4th Year':
        return ['Semester 7', 'Semester 8'];
      default:
        return [
          'Semester 1', 'Semester 2', 'Semester 3', 'Semester 4',
          'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8',
        ];
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#FFFFFF] border border-[#E5DFD5] w-full max-w-2xl rounded-xl shadow-2xl flex flex-col my-8 overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="bg-[#FAF8F5] border-b border-[#E5DFD5] px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono-code uppercase text-[#0F5132] font-semibold tracking-wider block">
              Academic Notes Archive
            </span>
            <h2 className="text-xl font-serif-academic font-bold text-[#1C2826]">
              Add New Study Note
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#5C6F68] hover:text-[#1C2826] hover:bg-[#E5DFD5]/50 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-xs text-[#991B1B] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-[#ECFDF5] border border-[#6EE7B7] rounded-lg text-xs text-[#065F46] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#10B981]" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Note Title */}
          <div>
            <label className="block text-xs font-semibold text-[#1C2826] mb-1">
              Note Title <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Data Structures & Algorithms - Complete Comprehensive Lecture Notes"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
              required
            />
          </div>

          {/* Subject Name and Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                Subject Name <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                list="subjects-datalist"
                placeholder="e.g. Computer Networks, DBMS"
                value={subjectName}
                onChange={e => handleSubjectNameChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                required
              />
              <datalist id="subjects-datalist">
                {subjects.map(s => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                Subject Code
              </label>
              <input
                type="text"
                placeholder="e.g. CS501"
                value={subjectCode}
                onChange={e => setSubjectCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-xs font-mono-code uppercase bg-[#FAF8F5] border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
              />
            </div>
          </div>

          {/* B.Tech Year & Semester */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                B.Tech Year <span className="text-[#DC2626]">*</span>
              </label>
              <select
                value={btechYear}
                onChange={e => {
                  const newYear = e.target.value;
                  setBtechYear(newYear);
                  const validSems = semestersForYear(newYear);
                  if (!validSems.includes(semester)) {
                    setSemester(validSems[0]);
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
              >
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                Semester <span className="text-[#DC2626]">*</span>
              </label>
              <select
                value={semester}
                onChange={e => setSemester(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
              >
                {semestersForYear(btechYear).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[#1C2826] mb-1">
              Optional Description / Syllabus Outline
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Unit-wise comprehensive handwritten & typed notes covering complete university syllabus."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
            />
          </div>

          {/* File Upload Zone */}
          <div>
            <label className="block text-xs font-semibold text-[#1C2826] mb-1">
              Note PDF Document <span className="text-[#DC2626]">*</span> (Max 60 MB)
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".pdf,application/pdf"
              className="hidden"
            />

            {selectedFile ? (
              <div className="p-3 bg-[#FAF8F5] border border-[#A7F3D0] rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded bg-[#E8F5E9] flex items-center justify-center text-[#0F5132]">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1C2826] truncate max-w-xs sm:max-w-sm">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-[#5C6F68] font-mono-code">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Authentic PDF
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1 text-[#5C6F68] hover:text-[#991B1B] hover:bg-[#FEE2E2] rounded transition-colors"
                  title="Remove File"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? 'border-[#0F5132] bg-[#E8F5E9]/30'
                    : 'border-[#E5DFD5] hover:border-[#0F5132] bg-[#FAF8F5]'
                }`}
              >
                <UploadCloud className="w-8 h-8 text-[#0F5132] mx-auto mb-2" />
                <p className="text-xs font-semibold text-[#1C2826]">
                  Click to select note PDF, or drag and drop file here
                </p>
                <p className="text-[11px] text-[#5C6F68] mt-1">
                  Supports authentic .pdf documents up to 60 MB
                </p>
              </div>
            )}
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-[11px] text-[#5C6F68] font-mono-code">
                <span>Saving note to academic storage...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-[#E5DFD5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0F5132] transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5DFD5]">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-xs font-medium text-[#5C6F68] hover:text-[#1C2826] bg-[#FAF8F5] border border-[#E5DFD5] rounded-md hover:bg-[#F5F1EB] transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs disabled:opacity-50"
            >
              {isUploading ? 'Uploading Note...' : 'Save Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
