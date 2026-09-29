import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { Paper, Subject } from '../../types';
import { api } from '../../services/api';

interface EditPaperModalProps {
  paper: Paper | null;
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  years: string[];
  examTypes: string[];
  onPaperUpdated: (updatedPaper: Paper) => void;
}

export const EditPaperModal: React.FC<EditPaperModalProps> = ({
  paper,
  isOpen,
  onClose,
  subjects,
  years,
  examTypes,
  onPaperUpdated,
}) => {
  if (!isOpen || !paper) return null;

  const [subjectName, setSubjectName] = useState(paper.subjectName);
  const [subjectCode, setSubjectCode] = useState(paper.subjectCode);
  const [examType, setExamType] = useState(paper.examType);
  const [academicYear, setAcademicYear] = useState(paper.academicYear);
  const [btechYear, setBtechYear] = useState(paper.btechYear);
  const [semester, setSemester] = useState(paper.semester);
  const [paperDate, setPaperDate] = useState(paper.paperDate || '');
  const [description, setDescription] = useState(paper.description || '');
  const [maxMarks, setMaxMarks] = useState(String(paper.maxMarks || 100));
  const [durationMinutes, setDurationMinutes] = useState(String(paper.durationMinutes || 180));

  // PDF Replacement state
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        setError('Replacement file must be an authentic PDF document (.pdf).');
        return;
      }
      if (file.size > 60 * 1024 * 1024) {
        setError('File size must be 60 MB or less.');
        return;
      }
      setReplacementFile(file);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsUpdating(true);

    try {
      const formData = new FormData();
      formData.append('subjectName', subjectName.trim());
      formData.append('subjectCode', subjectCode.trim());
      formData.append('examType', examType);
      formData.append('academicYear', academicYear);
      formData.append('btechYear', btechYear);
      formData.append('semester', semester);
      formData.append('paperDate', paperDate);
      formData.append('description', description.trim());
      formData.append('maxMarks', maxMarks);
      formData.append('durationMinutes', durationMinutes);

      if (replacementFile) {
        formData.append('pdfFile', replacementFile);
      }

      const updated = await api.updatePaper(paper.id, formData);
      onPaperUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update question paper.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#FAF8F5] border border-[#E5DFD5] w-full max-w-2xl rounded-xl shadow-2xl p-6 sm:p-8 relative max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-[#E5DFD5]">
          <div>
            <span className="text-[10px] tracking-widest uppercase text-[#0F5132] font-semibold block mb-0.5">
              Paper Curator
            </span>
            <h3 className="text-xl sm:text-2xl font-serif-academic font-bold text-[#1C2826]">
              Edit Examination Paper
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#5C6F68] hover:text-[#1C2826] hover:bg-[#E5DFD5]/50 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 pr-1">
          {error && (
            <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded-md flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form id="editPaperForm" onSubmit={handleSubmit} className="space-y-4">
            {/* Current & Replacement PDF Section */}
            <div className="bg-white border border-[#E5DFD5] rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1C2826]">
                  Archived PDF File
                </span>
                <span className="text-[11px] text-[#5C6F68] font-mono-code">
                  {paper.fileSizeFormatted}
                </span>
              </div>
              <p className="text-xs text-[#5C6F68] truncate font-mono-code">
                Current: {paper.originalFilename}
              </p>

              <div className="pt-2 border-t border-[#E5DFD5]">
                <label className="block text-[11px] font-semibold text-[#0F5132] mb-1">
                  Upload Replacement PDF (Optional, authentic PDF up to 60 MB)
                </label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileChange}
                  className="text-xs text-[#5C6F68] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#E8F5E9] file:text-[#0F5132] hover:file:bg-[#D1FAE5] cursor-pointer"
                />
                {replacementFile && (
                  <p className="text-[11px] text-[#0F5132] mt-1 font-semibold font-mono-code">
                    Selected Replacement: {replacementFile.name} ({replacementFile.size >= 1024 * 1024 ? `${(replacementFile.size / (1024 * 1024)).toFixed(2)} MB` : `${(replacementFile.size / 1024).toFixed(1)} KB`})
                  </p>
                )}
              </div>
            </div>

            {/* Subject details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                  Subject Name
                </label>
                <input
                  type="text"
                  required
                  value={subjectName}
                  onChange={e => setSubjectName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                  Subject Code
                </label>
                <input
                  type="text"
                  required
                  value={subjectCode}
                  onChange={e => setSubjectCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132] font-mono-code uppercase"
                />
              </div>
            </div>

            {/* Exam Type & Year */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                  Exam Type
                </label>
                <select
                  value={examType}
                  onChange={e => setExamType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                >
                  {examTypes.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                  Academic Year
                </label>
                <select
                  value={academicYear}
                  onChange={e => setAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132] font-mono-code"
                >
                  {years.map(y => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* B.Tech Year & Semester */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                  B.Tech Year
                </label>
                <select
                  value={btechYear}
                  onChange={e => setBtechYear(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                  Semester
                </label>
                <select
                  value={semester}
                  onChange={e => setSemester(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                >
                  <option value="Semester 1">Semester 1</option>
                  <option value="Semester 2">Semester 2</option>
                  <option value="Semester 3">Semester 3</option>
                  <option value="Semester 4">Semester 4</option>
                  <option value="Semester 5">Semester 5</option>
                  <option value="Semester 6">Semester 6</option>
                  <option value="Semester 7">Semester 7</option>
                  <option value="Semester 8">Semester 8</option>
                </select>
              </div>
            </div>

            {/* Date, Marks, Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                  Examination Date
                </label>
                <input
                  type="date"
                  value={paperDate}
                  onChange={e => setPaperDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                  Max Marks
                </label>
                <input
                  type="number"
                  value={maxMarks}
                  onChange={e => setMaxMarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132] font-mono-code"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                  Duration (Mins)
                </label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132] font-mono-code"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                Description & Syllabus Scope
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
              />
            </div>
          </form>
        </div>

        <div className="pt-4 border-t border-[#E5DFD5] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="px-4 py-2 text-xs font-medium text-[#5C6F68] hover:text-[#1C2826] bg-[#FFFFFF] border border-[#E5DFD5] hover:bg-[#F5F1EB] rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="editPaperForm"
            disabled={isUpdating}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{isUpdating ? 'Saving Changes...' : 'Save Updates'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
