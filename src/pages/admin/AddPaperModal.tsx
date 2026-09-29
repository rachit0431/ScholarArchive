import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Trash2, ArrowRight } from 'lucide-react';
import { Subject, Paper } from '../../types';
import { api } from '../../services/api';

interface AddPaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  years: string[];
  examTypes: string[];
  onPaperAdded: (paper: Paper) => void;
}

export const AddPaperModal: React.FC<AddPaperModalProps> = ({
  isOpen,
  onClose,
  subjects,
  years,
  examTypes,
  onPaperAdded,
}) => {
  // Form State
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [examType, setExamType] = useState(examTypes[0] || 'Midterm 1');
  const [academicYear, setAcademicYear] = useState(years[0] || '2026');
  const [btechYear, setBtechYear] = useState('3rd Year');
  const [semester, setSemester] = useState('Semester 5');
  const [paperDate, setPaperDate] = useState(new Date().toISOString().split('T')[0]);
  const [maxMarks, setMaxMarks] = useState('100');
  const [durationMinutes, setDurationMinutes] = useState('180');
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
      if (!subjectCode || subjectCode === 'ENG100') setSubjectCode(matched.code);
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

  const handleClearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // Field Validations
    if (!subjectName.trim()) {
      setError('Subject Name is required.');
      return;
    }
    if (!subjectCode.trim()) {
      setError('Subject Code is required (e.g. CS501).');
      return;
    }
    if (!selectedFile) {
      setError('Please select a valid PDF question paper file from your computer.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);

    try {
      const formData = new FormData();
      formData.append('subjectName', subjectName.trim());
      formData.append('subjectCode', subjectCode.trim().toUpperCase());
      formData.append('examType', examType);
      formData.append('academicYear', academicYear);
      formData.append('btechYear', btechYear);
      formData.append('semester', semester);
      formData.append('paperDate', paperDate);
      formData.append('maxMarks', maxMarks);
      formData.append('durationMinutes', durationMinutes);
      formData.append('description', description.trim());
      formData.append('pdfFile', selectedFile);

      // Real upload with byte-level progress reporting from XMLHttpRequest
      const newPaper = await api.uploadPaper(formData, (percent) => {
        setUploadProgress(percent);
      });

      setUploadProgress(100);
      setSuccessMessage('Paper uploaded successfully');

      // Allow visual confirmation, then trigger repository update and close
      setTimeout(() => {
        setIsUploading(false);
        onPaperAdded(newPaper);
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setIsUploading(false);
      setUploadProgress(0);
      setError(err.message || 'Failed to upload paper. Please check connection and try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#FAF8F5] border border-[#E5DFD5] w-full max-w-2xl rounded-xl shadow-2xl p-6 sm:p-8 relative max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5DFD5] shrink-0">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#0F5132]">
              Archival Intake
            </span>
            <h2 className="text-2xl font-serif-academic font-bold text-[#1C2826]">
              Add New Question Paper
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 text-[#5C6F68] hover:text-[#1C2826] hover:bg-[#E5DFD5]/50 rounded-md transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mt-4 p-3 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded-md flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs rounded-md flex items-center gap-2 shrink-0 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#10B981]" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form
          id="addPaperForm"
          onSubmit={handleSubmit}
          className="space-y-4 pt-4 overflow-y-auto pr-1 flex-1 text-xs"
        >
          {/* Row 1: Subject Name & Subject Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-[#1C2826] mb-1">
                Subject Name <span className="text-[#991B1B]">*</span>
              </label>
              <input
                type="text"
                required
                list="subjects-list"
                placeholder="e.g. Computer Networks"
                value={subjectName}
                onChange={e => handleSubjectNameChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
              />
              <datalist id="subjects-list">
                {subjects.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.code} - {s.semester}
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-semibold text-[#1C2826] mb-1">
                Subject Code <span className="text-[#991B1B]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. CS501"
                value={subjectCode}
                onChange={e => setSubjectCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132] font-mono-code uppercase"
              />
            </div>
          </div>

          {/* Row 2: Exam Type & Academic Year */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#1C2826] mb-1">
                Exam Type <span className="text-[#991B1B]">*</span>
              </label>
              <select
                value={examType}
                onChange={e => setExamType(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
              >
                {examTypes.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#1C2826] mb-1">
                Academic Year <span className="text-[#991B1B]">*</span>
              </label>
              <select
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132] font-mono-code"
              >
                {years.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: B.Tech Year & Semester */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#1C2826] mb-1">
                B.Tech Year <span className="text-[#991B1B]">*</span>
              </label>
              <select
                value={btechYear}
                onChange={e => setBtechYear(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
              >
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#1C2826] mb-1">
                Semester <span className="text-[#991B1B]">*</span>
              </label>
              <select
                value={semester}
                onChange={e => setSemester(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
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

          {/* Row 4: Examination Date, Max Marks & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-[#1C2826] mb-1">
                Examination Date <span className="text-[#991B1B]">*</span>
              </label>
              <input
                type="date"
                required
                value={paperDate}
                onChange={e => setPaperDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#1C2826] mb-1">
                Maximum Marks
              </label>
              <input
                type="number"
                min="10"
                max="150"
                value={maxMarks}
                onChange={e => setMaxMarks(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132] font-mono-code"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#1C2826] mb-1">
                Duration (Minutes)
              </label>
              <input
                type="number"
                min="30"
                max="360"
                step="15"
                value={durationMinutes}
                onChange={e => setDurationMinutes(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132] font-mono-code"
              />
            </div>
          </div>

          {/* Row 5: Real PDF File Upload (Dropzone + Native File Browser) */}
          <div>
            <label className="block font-semibold text-[#1C2826] mb-1">
              Upload Question Paper PDF <span className="text-[#991B1B]">*</span>
            </label>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors bg-white cursor-pointer ${
                dragActive
                  ? 'border-[#0F5132] bg-[#E8F5E9]/30'
                  : selectedFile
                  ? 'border-[#10B981] bg-[#FAF8F5]'
                  : 'border-[#E5DFD5] hover:border-[#0F5132]'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex items-center justify-between p-2 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-left">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-[#E8F5E9] rounded text-[#0F5132] shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <p className="font-semibold text-[#1C2826] truncate text-xs">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-[#0F5132] font-semibold font-mono-code">
                        Selected File Size: {selectedFile.size >= 1024 * 1024 ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : `${(selectedFile.size / 1024).toFixed(1)} KB`} (Limit: 60 MB)
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearFile();
                    }}
                    className="p-1.5 text-[#5C6F68] hover:text-[#991B1B] hover:bg-[#FEE2E2] rounded transition-colors"
                    title="Remove selected file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 py-2">
                  <UploadCloud className="w-8 h-8 mx-auto text-[#0F5132]" />
                  <p className="font-semibold text-[#1C2826] text-xs">
                    Click to browse or drag and drop question paper PDF
                  </p>
                  <p className="text-[11px] text-[#5C6F68]">
                    Authentic PDF files only (up to 60 MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Row 6: Description (Optional) */}
          <div>
            <label className="block font-semibold text-[#1C2826] mb-1">
              Archival Scope & Syllabus Notes <span className="text-[#5C6F68] font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Covers Units 1 to 3: OSI Reference Model, Sliding Window Protocols, and IPv4 Subnetting."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132] text-xs"
            />
          </div>

          {/* Real Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1.5 bg-[#FFFFFF] border border-[#E5DFD5] p-3 rounded-md">
              <div className="flex justify-between text-[11px] font-mono-code">
                <span className="text-[#0F5132] font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                  {uploadProgress === 100
                    ? 'Processing & archiving PDF into repository...'
                    : `Uploading PDF document (${uploadProgress}%)...`}
                </span>
                <span className="text-[#1C2826] font-bold">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-[#FAF8F5] border border-[#E5DFD5] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#0F5132] h-full transition-all duration-150 rounded-full"
                  style={{ width: `${Math.max(5, uploadProgress)}%` }}
                />
              </div>
              <p className="text-[10px] text-[#5C6F68]">
                {uploadProgress === 100
                  ? 'Server is validating file format and cataloging metadata into permanent repository.'
                  : 'Asynchronously streaming PDF binary content to server storage. Please keep this window open.'}
              </p>
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="pt-4 mt-2 border-t border-[#E5DFD5] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-xs font-semibold text-[#5C6F68] hover:text-[#1C2826] border border-[#E5DFD5] rounded-md transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            form="addPaperForm"
            disabled={isUploading || !selectedFile || !subjectName.trim()}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Uploading ({uploadProgress}%)...</span>
              </>
            ) : (
              <>
                <span>Archive Paper</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
