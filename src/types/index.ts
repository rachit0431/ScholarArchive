export interface Paper {
  id: string;
  subjectName: string;
  subjectCode: string;
  examType: string; // 'UT 1' | 'UT 2' | 'Midterm 1' | 'Midterm 2' | 'University Exam' | string
  academicYear: string; // '2026', '2025', '2024', etc.
  btechYear: string; // '1st Year' | '2nd Year' | '3rd Year' | '4th Year'
  semester: string; // 'Semester 1' ... 'Semester 8'
  paperDate: string;
  filename: string;
  originalFilename: string;
  fileSize: number;
  fileSizeFormatted: string;
  description: string;
  uploadedAt: string;
  downloadsCount: number;
  viewsCount: number;
  uploadedBy: string;
  maxMarks: number;
  durationMinutes: number;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  department: string;
  btechYear: string;
  semester: string;
  credits: number;
}

export interface SavedPaperEntry {
  paperId: string;
  savedAt: string;
}

export interface SavedNoteEntry {
  noteId: string;
  savedAt: string;
}

export interface StudentUser {
  id: string;
  name: string;
  email: string;
  year: string;
  semester: string;
  role?: 'student';
  createdAt: string;
  bookmarks: string[];
  savedPapers?: SavedPaperEntry[];
  savedNotes?: SavedNoteEntry[];
  recentDownloads: { paperId: string; downloadedAt: string; itemType?: 'paper' | 'note'; noteId?: string }[];
  authMethod?: 'email' | 'google';
  status?: 'active' | 'disabled';
  bookmarksCount?: number;
  downloadsCount?: number;
}

export interface ResolvedArchivePaper {
  paperId: string;
  savedAt: string;
  isAvailable: boolean;
  paper: Paper | null;
  pdfUrl?: string;
  downloadUrl?: string;
}

export interface ResolvedArchiveNote {
  noteId: string;
  savedAt: string;
  isAvailable: boolean;
  note: Note | null;
  pdfUrl?: string;
  downloadUrl?: string;
}

export interface ResolvedDownloadEntry {
  paperId: string;
  downloadedAt: string;
  isAvailable: boolean;
  itemType?: 'paper' | 'note';
  noteId?: string;
  paper: Paper | null;
  note?: Note | null;
  pdfUrl?: string;
  downloadUrl?: string;
}

export interface ArchiveResponse {
  savedPapers: ResolvedArchivePaper[];
  savedNotes?: ResolvedArchiveNote[];
  recentDownloads: ResolvedDownloadEntry[];
  totalSaved: number;
  totalSavedNotes?: number;
  totalDownloads: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  lastLogin: string;
}

export interface SystemStats {
  totalPapers: number;
  totalSubjects: number;
  totalYears: number;
  totalStudents: number;
  totalDownloads: number;
  examTypeCounts: Record<string, number>;
  btechYearCounts: Record<string, number>;
  recentPapers: Paper[];
}

export interface FilterParams {
  year?: string;
  btechYear?: string;
  semester?: string;
  examType?: string;
  subject?: string;
  search?: string;
}

export interface ContactMessagePayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactMessageResponse {
  success: boolean;
  message: string;
  messageId?: string;
  previewUrl?: string;
}

export interface Note {
  id: string;
  title: string;
  subjectName: string;
  subjectCode: string;
  btechYear: string; // '1st Year' | '2nd Year' | '3rd Year' | '4th Year'
  semester: string; // 'Semester 1' ... 'Semester 8'
  description?: string;
  filename: string;
  originalFilename: string;
  fileSize: number;
  fileSizeFormatted: string;
  uploadedAt: string;
  uploadedBy: string;
  downloadsCount: number;
  viewsCount: number;
}
