import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import crypto from 'crypto';
import { Resend } from 'resend';
import {
  isSupabaseConfigured,
  getSupabase,
  uploadPdfToStorage,
  downloadPdfFromStorage,
  deletePdfFromStorage,
  syncDatabaseFromSupabase,
  persistStudentToSupabase,
  persistPaperToSupabase,
  persistNoteToSupabase,
  persistSessionToSupabase,
  removeSessionFromSupabase,
  persistSavedPaperToggle,
  persistSavedNoteToggle,
  persistRecentDownload,
  persistContactMessage,
  persistEventToSupabase,
} from './server/supabase.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Optimized middleware for JSON and form data (safe 10MB limit prevents V8 heap overflow)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global error handler for oversized payloads
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413)) {
    return res.status(413).json({ error: 'Request payload is too large. Maximum supported request size is 10 MB.' });
  }
  next(err);
});

// Directories
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const EVENT_IMAGES_DIR = path.join(DATA_DIR, 'event-images');
const TEMP_UPLOADS_DIR = path.join(DATA_DIR, 'temp-uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(EVENT_IMAGES_DIR)) {
  fs.mkdirSync(EVENT_IMAGES_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_UPLOADS_DIR)) {
  fs.mkdirSync(TEMP_UPLOADS_DIR, { recursive: true });
}

// 65 MB Maximum Allowed PDF Upload Size (generous limit supporting full 60 MB PDFs + multipart envelope)
const MAX_PDF_SIZE = 65 * 1024 * 1024;

// Multer Storage Configuration for Standard Single-Request Uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${sanitizedName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_PDF_SIZE, // 65 MB limit
    fieldSize: 25 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const isPdfExt = Boolean(file.originalname && file.originalname.toLowerCase().endsWith('.pdf'));
    const isPdfMime = file.mimetype === 'application/pdf' || file.mimetype === 'application/x-pdf' || file.mimetype === 'application/octet-stream';
    if (isPdfExt || isPdfMime) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only authentic PDF documents (.pdf) are supported.'));
    }
  },
});

// Multer Storage Configuration for Segmented / Chunked Uploads (to transparently bypass Cloud Run 32MB limit)
const chunkStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, TEMP_UPLOADS_DIR);
  },
  filename: (_req, _file, cb) => {
    cb(null, `chunk-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.part`);
  },
});

const chunkUpload = multer({
  storage: chunkStorage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB per chunk
});

const uploadFields = upload.fields([
  { name: 'pdfFile', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]);

const handleMulterUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  uploadFields(req, res, (err: any) => {
    if (err) {
      console.error('Multer file upload error:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File size exceeds the 60 MB limit.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'Error processing uploaded file.' });
    }
    // Map uploaded file to req.file
    if (req.files) {
      const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] };
      req.file = filesMap['pdfFile']?.[0] || filesMap['file']?.[0];
    }
    next();
  });
};

// Multer Storage Configuration for Event Photos / Images
const eventImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, EVENT_IMAGES_DIR);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `event-${timestamp}-${sanitizedName}`);
  },
});

const eventImageUpload = multer({
  storage: eventImageStorage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB limit for event photos
  },
  fileFilter: (_req, file, cb) => {
    const allowedExt = /\.(jpg|jpeg|png|webp|gif)$/i.test(file.originalname || '');
    const allowedMime = /^image\/(jpeg|png|webp|gif|jpg)$/i.test(file.mimetype || '');
    if (allowedExt || allowedMime) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image format. Only JPG, PNG, WEBP, and GIF images are supported.'));
    }
  },
});

const eventImageUploadFields = eventImageUpload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
  { name: 'eventPhoto', maxCount: 1 },
]);

const handleEventImageUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  eventImageUploadFields(req, res, (err: any) => {
    if (err) {
      console.error('Event image upload error:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'Event image size exceeds the 15 MB limit.' });
        }
        return res.status(400).json({ error: `Image upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'Error processing uploaded event photo.' });
    }
    if (req.files) {
      const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] };
      req.file = filesMap['image']?.[0] || filesMap['photo']?.[0] || filesMap['eventPhoto']?.[0];
    }
    next();
  });
};

// Assembly helpers for chunked file upload
async function appendChunkToAssembly(uploadId: string, chunkIndex: number, totalChunks: number, totalSize: number, chunkFilePath: string): Promise<{ success: boolean; bytesReceived: number }> {
  const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
  const tempTarget = path.join(TEMP_UPLOADS_DIR, `${safeUploadId}.assembly`);

  if (totalSize > MAX_PDF_SIZE) {
    if (fs.existsSync(chunkFilePath)) try { fs.unlinkSync(chunkFilePath); } catch (e) { /* ignore */ }
    if (fs.existsSync(tempTarget)) try { fs.unlinkSync(tempTarget); } catch (e) { /* ignore */ }
    throw new Error('File size exceeds the 60 MB limit.');
  }

  if (chunkIndex === 0 && fs.existsSync(tempTarget)) {
    try { fs.unlinkSync(tempTarget); } catch (e) { /* ignore */ }
  }

  const chunkReadStream = fs.createReadStream(chunkFilePath);
  const targetWriteStream = fs.createWriteStream(tempTarget, { flags: 'a' });

  await new Promise<void>((resolve, reject) => {
    chunkReadStream.pipe(targetWriteStream);
    targetWriteStream.on('finish', () => resolve());
    targetWriteStream.on('error', err => reject(err));
    chunkReadStream.on('error', err => reject(err));
  });

  if (fs.existsSync(chunkFilePath)) {
    try { fs.unlinkSync(chunkFilePath); } catch (e) { /* ignore */ }
  }

  const bytesReceived = fs.statSync(tempTarget).size;
  return { success: true, bytesReceived };
}

function finalizeAssembly(uploadId: string, originalFilename: string, _expectedSize?: number): { diskFilename: string; actualSize: number; finalPath: string } {
  const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
  const tempTarget = path.join(TEMP_UPLOADS_DIR, `${safeUploadId}.assembly`);

  if (!fs.existsSync(tempTarget)) {
    throw new Error('Upload assembly file not found or expired.');
  }

  const stat = fs.statSync(tempTarget);
  const actualSize = stat.size;

  if (actualSize > MAX_PDF_SIZE) {
    try { fs.unlinkSync(tempTarget); } catch (e) { /* ignore */ }
    throw new Error('File size exceeds the 60 MB limit.');
  }

  // Verify authentic PDF file header (%PDF magic bytes)
  const fileHeader = Buffer.alloc(5);
  const fd = fs.openSync(tempTarget, 'r');
  fs.readSync(fd, fileHeader, 0, 5, 0);
  fs.closeSync(fd);
  if (!fileHeader.toString('utf8').startsWith('%PDF')) {
    try { fs.unlinkSync(tempTarget); } catch (e) { /* ignore */ }
    throw new Error('Invalid file format. Only authentic PDF documents (.pdf) are supported.');
  }

  const safeOrigName = (originalFilename || 'document.pdf').replace(/[^a-zA-Z0-9.-]/g, '_');
  const timestamp = Date.now();
  const diskFilename = `${timestamp}-${safeOrigName}`;
  const finalPath = path.join(UPLOADS_DIR, diskFilename);

  fs.renameSync(tempTarget, finalPath);

  return { diskFilename, actualSize, finalPath };
}

// Text sanitizer for PDF string literals
function escapePdfText(str: string): string {
  return (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

// Standards-compliant multi-page PDF 1.4 binary builder
function buildMultiPagePdf(pagesContent: string[]): Buffer {
  const pageCount = pagesContent.length;
  const catObjStr = '<< /Type /Catalog /Pages 2 0 R >>';
  const fontBoldStr = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  const fontRegStr = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  const rawObjects = [
    catObjStr,
    '', // 2 placeholder for Pages tree
    fontBoldStr, // 3
    fontRegStr, // 4
  ];

  const pageObjectIndices: number[] = [];
  for (let p = 0; p < pageCount; p++) {
    const pageObjIdx = rawObjects.length + 1;
    const contentObjIdx = pageObjIdx + 1;
    pageObjectIndices.push(pageObjIdx);

    const stream = pagesContent[p];
    const streamLen = Buffer.byteLength(stream, 'utf8');
    rawObjects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjIdx} 0 R >>`);
    rawObjects.push(`<< /Length ${streamLen} >>\nstream\n${stream}\nendstream`);
  }

  const kidsStr = pageObjectIndices.map(i => `${i} 0 R`).join(' ');
  rawObjects[1] = `<< /Type /Pages /Kids [${kidsStr}] /Count ${pageCount} >>`;

  let body = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 0; i < rawObjects.length; i++) {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += `${i + 1} 0 obj\n${rawObjects[i]}\nendobj\n`;
  }

  const startxref = Buffer.byteLength(body, 'utf8');
  let xref = `xref\n0 ${rawObjects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= rawObjects.length; i++) {
    xref += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${rawObjects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(body + xref + trailer);
}

// Authentic multi-page examination question paper PDF generator
function generateSamplePdfBuffer(subjectName: string, subjectCode: string, examType: string, year: string, semester: string): Buffer {
  const escSubName = escapePdfText(subjectName.toUpperCase());
  const escSubCode = escapePdfText(subjectCode);
  const escExam = escapePdfText(examType);
  const escYear = escapePdfText(year);
  const escSem = escapePdfText(semester);

  // Page 1: Header, Examination Details, Section A (Short Questions)
  const page1 = `
BT
/F1 15 Tf
50 740 Td
(SCHOLARARCHIVE INSTITUTE OF TECHNOLOGY - AUTONOMOUS) Tj
/F2 10 Tf
0 -18 Td
(Affiliated to State Technical University | Department of Engineering & Technology) Tj
0 -14 Td
(--------------------------------------------------------------------------------------------------------------------------------) Tj
/F1 12.5 Tf
0 -22 Td
(EXAMINATION PAPER: ${escSubName} [${escSubCode}]) Tj
/F2 9.5 Tf
0 -16 Td
(Academic Year: ${escYear}   |   Semester: ${escSem}   |   Exam: ${escExam}) Tj
0 -14 Td
(Time Allowed: 3 Hours                                                     Maximum Marks: 100) Tj
0 -14 Td
(--------------------------------------------------------------------------------------------------------------------------------) Tj
/F1 11 Tf
0 -24 Td
(SECTION A: SHORT ANSWER QUESTIONS (Answer all questions - 5 x 4 = 20 Marks)) Tj
/F2 9.5 Tf
0 -18 Td
(1. Formulate the fundamental governing equations and define core system parameters for ${escSubName}.) Tj
0 -16 Td
(2. Contrast uninformed search vs informed search paradigms with state-space representation examples.) Tj
0 -16 Td
(3. Analyze admissibility, monotonicity, and consistency properties of heuristic functions in A* Search.) Tj
0 -16 Td
(4. Differentiate between Forward Chaining and Backward Chaining in knowledge-based inference engines.) Tj
0 -16 Td
(5. State and prove the alpha-beta pruning cutoff conditions with mathematical justification.) Tj
/F1 11 Tf
0 -28 Td
(INSTRUCTIONS TO CANDIDATES:) Tj
/F2 9 Tf
0 -15 Td
(a. Answer all questions from Section A and any four questions from Section B.) Tj
0 -13 Td
(b. Draw neat schematic diagrams wherever necessary. Assume suitable data if missing.) Tj
0 -13 Td
(c. Use of non-programmable scientific calculators is permitted.) Tj
0 -40 Td
/F2 9 Tf
(Page 1 of 2  --  SCHOLARARCHIVE CENTRAL ARCHIVES  --  [Turn Over]) Tj
ET
`;

  // Page 2: Section B (Comprehensive Problems) & Section C (Applied System Evaluation)
  const page2 = `
BT
/F1 13 Tf
50 740 Td
(${escSubName} [${escSubCode}] -- ${escExam} EXAMINATION) Tj
/F2 9.5 Tf
0 -16 Td
(Curricular Archive Reference: AY-${escYear}-${escSem} | Controller of Examinations) Tj
0 -14 Td
(--------------------------------------------------------------------------------------------------------------------------------) Tj
/F1 11 Tf
0 -22 Td
(SECTION B: COMPREHENSIVE PROBLEMS (Answer any 4 questions - 4 x 20 = 80 Marks)) Tj
/F2 9.5 Tf
0 -18 Td
(6. (a) Design an adversarial game-playing search tree using the Minimax algorithm with depth cutoff.) Tj
0 -16 Td
(    (b) Trace Alpha-Beta pruning on the game tree, demonstrating all pruned branches and cutoff nodes.) Tj
0 -18 Td
(7. (a) Given a constraint satisfaction problem (CSP), formulate constraint propagation using the AC-3 algorithm.) Tj
0 -16 Td
(    (b) Compare Backtracking search performance with MRV (Minimum Remaining Values) heuristics.) Tj
0 -18 Td
(8. (a) Outline the step-by-step diagnostic workflow for an autonomous expert system using First-Order Logic.) Tj
0 -16 Td
(    (b) Construct resolution refutation proof trees for propositional and predicate calculus clauses.) Tj
0 -18 Td
(9. (a) Formulate the mathematical model for packet latency, buffer throughput, and queueing theory.) Tj
0 -16 Td
(    (b) Construct a Bayesian Belief Network for system fault detection and calculate posterior probabilities.) Tj
0 -18 Td
(10. Implement pseudo-code algorithm for state synchronization and consensus verification across distributed clusters.) Tj
/F1 11 Tf
0 -32 Td
(SECTION C: APPLIED CASE STUDY & SYSTEM EVALUATION) Tj
/F2 9.5 Tf
0 -18 Td
(11. Evaluate scaling bottlenecks and reliability constraints under peak academic workloads.) Tj
0 -16 Td
(    Propose fault-tolerant architectural mitigations with end-to-end data flow diagrams.) Tj
0 -40 Td
/F1 9.5 Tf
(*** END OF QUESTION PAPER -- SCHOLARARCHIVE ARCHIVAL COPY -- Page 2 of 2 ***) Tj
ET
`;

  return buildMultiPagePdf([page1, page2]);
}

// Authentic multi-page study lecture notes PDF generator
function generateSampleNotePdfBuffer(title: string, subjectName: string, subjectCode: string, btechYear: string, semester: string): Buffer {
  const escTitle = escapePdfText(title);
  const escSubName = escapePdfText(subjectName.toUpperCase());
  const escSubCode = escapePdfText(subjectCode);
  const escYear = escapePdfText(btechYear);
  const escSem = escapePdfText(semester);

  // Page 1: Note Header, Unit Syllabus & Theoretical Foundations
  const page1 = `
BT
/F1 15 Tf
50 740 Td
(SCHOLARARCHIVE INSTITUTE OF TECHNOLOGY - ACADEMIC STUDY NOTES) Tj
/F2 10 Tf
0 -18 Td
(Department of Engineering & Technical Sciences | Student Study Material) Tj
0 -14 Td
(--------------------------------------------------------------------------------------------------------------------------------) Tj
/F1 12.5 Tf
0 -22 Td
(SUBJECT: ${escSubName} [${escSubCode}]) Tj
/F1 11 Tf
0 -17 Td
(Topic: ${escTitle}) Tj
/F2 9.5 Tf
0 -15 Td
(Academic Level: ${escYear}   |   Curriculum: ${escSem}) Tj
0 -14 Td
(Author: Faculty Academic Board                                    Format: Official Lecture Notes) Tj
0 -14 Td
(--------------------------------------------------------------------------------------------------------------------------------) Tj
/F1 11 Tf
0 -24 Td
(MODULE 1: THEORETICAL FOUNDATIONS & CORE ARCHITECTURE) Tj
/F2 9.5 Tf
0 -18 Td
(1. Core principles, design objectives, and formal architectural paradigms for ${escSubName}.) Tj
0 -16 Td
(2. Structural component decomposition, abstract data definitions, and interface boundaries.) Tj
0 -16 Td
(3. In-depth analysis of computational complexity, invariant properties, and algorithmic efficiency.) Tj
0 -16 Td
(4. Mathematical proofs, analytical derivations, and state machine models pertinent to ${escSubCode}.) Tj
/F1 11 Tf
0 -26 Td
(KEY TERMINOLOGY & DEFINITIONS:) Tj
/F2 9 Tf
0 -16 Td
(* Pipelining: Architectural technique executing multiple instructions concurrently across execution stages.) Tj
0 -15 Td
(* Cache Locality: Temporal and spatial reference patterns optimizing memory hierarchy latency.) Tj
0 -15 Td
(* Amdahl\\'s Law: Theoretical latency speedup limit of program execution with fixed workload.) Tj
0 -40 Td
/F2 9 Tf
(Page 1 of 2  --  SCHOLARARCHIVE STUDY REPOSITORY  --  [Turn Over]) Tj
ET
`;

  // Page 2: Applications, Solved Problems & Exam Cheatsheet
  const page2 = `
BT
/F1 13 Tf
50 740 Td
(${escSubName} [${escSubCode}] -- ${escTitle}) Tj
/F2 9.5 Tf
0 -16 Td
(Module 2 & Module 3 Comprehensive Lecture Notes | Academic Year Archive) Tj
0 -14 Td
(--------------------------------------------------------------------------------------------------------------------------------) Tj
/F1 11 Tf
0 -22 Td
(MODULE 2: PRACTICAL APPLICATIONS & IMPLEMENTATION METHODOLOGY) Tj
/F2 9.5 Tf
0 -18 Td
(5. Concrete step-by-step implementation guide with standard algorithmic paradigms.) Tj
0 -16 Td
(6. Industrial best practices, optimization strategies, and robust error management.) Tj
0 -16 Td
(7. Case studies: Troubleshooting edge cases, performance profiling, and memory footprint minimization.) Tj
/F1 11 Tf
0 -26 Td
(MODULE 3: REVIEW QUESTIONS, PRACTICE EXERCISES & FORMULA CHEATSHEET) Tj
/F2 9.5 Tf
0 -18 Td
(8. Essential summary formulas, theorem recaps, and standard benchmark results.) Tj
0 -16 Td
(9. Quick-reference checklist for end-semester examinations and university test assessments.) Tj
0 -16 Td
(10. Model questions with step-by-step scoring criteria and analytical solutions.) Tj
/F1 11 Tf
0 -30 Td
(EXAMINATION PREPARATION CHECKLIST:) Tj
/F2 9 Tf
0 -16 Td
([x] Review all chapter derivation summaries and core architectural diagrams.) Tj
0 -15 Td
([x] Solve past 5 years question papers available in the ScholarArchive digital library repository.) Tj
0 -15 Td
([x] Verify numerical problem practice sets for memory hierarchy, latency, and throughput.) Tj
0 -40 Td
/F1 9.5 Tf
(*** END OF LECTURE NOTES -- SCHOLARARCHIVE OFFICIAL REPOSITORY -- Page 2 of 2 ***) Tj
ET
`;

  return buildMultiPagePdf([page1, page2]);
}

// Database helper
interface Paper {
  id: string;
  subjectName: string;
  subjectCode: string;
  examType: string; // "UT 1" | "UT 2" | "Midterm 1" | "Midterm 2" | "University Exam"
  academicYear: string; // e.g. "2026", "2025", "2024"
  btechYear: string; // "1st Year" | "2nd Year" | "3rd Year" | "4th Year"
  semester: string; // "Semester 1" through "Semester 8"
  paperDate: string;
  filename: string;
  originalFilename: string;
  fileSize: number; // in bytes
  fileSizeFormatted: string;
  description: string;
  uploadedAt: string;
  downloadsCount: number;
  viewsCount: number;
  uploadedBy: string;
  maxMarks: number;
  durationMinutes: number;
}

interface Note {
  id: string;
  title: string;
  subjectName: string;
  subjectCode: string;
  btechYear: string; // "1st Year" | "2nd Year" | "3rd Year" | "4th Year"
  semester: string; // "Semester 1" through "Semester 8"
  description: string;
  filename: string;
  originalFilename: string;
  fileSize: number; // in bytes
  fileSizeFormatted: string;
  uploadedAt: string;
  uploadedBy: string;
  downloadsCount: number;
  viewsCount: number;
}

interface Subject {
  id: string;
  code: string;
  name: string;
  department: string;
  btechYear: string;
  semester: string;
  credits: number;
}

interface StudentArchiveEntry {
  paperId: string;
  savedAt: string;
}

interface StudentNoteArchiveEntry {
  noteId: string;
  savedAt: string;
}

interface StudentUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  year: string;
  semester: string;
  role: 'student';
  createdAt: string;
  bookmarks: string[]; // paper IDs
  savedPapers?: StudentArchiveEntry[]; // Persistent saved paper references
  savedNotes?: StudentNoteArchiveEntry[]; // Persistent saved study notes
  recentDownloads: { paperId: string; downloadedAt: string; itemType?: 'paper' | 'note'; noteId?: string }[];
  resetToken?: string;
  resetTokenExpires?: number;
  authMethod?: 'email' | 'google';
  status?: 'active' | 'disabled';
}

interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: 'admin';
  department: string;
  createdAt: string;
}

interface UserSession {
  token: string;
  userId: string;
  role: 'student' | 'admin';
  email: string;
  name: string;
  expiresAt: number;
  rememberMe: boolean;
  createdAt: string;
}

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  recipient: string;
  submittedAt: string;
  status: 'delivered' | 'failed' | 'stored';
  messageId?: string;
  deliveryError?: string;
  previewUrl?: string;
  senderRole?: 'student' | 'admin' | 'public';
  studentId?: string;
}

interface EventItem {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  category: string;
  description: string;
  organizer: string;
  imageUrl?: string;
  imageFilename?: string;
  createdAt: string;
  updatedAt: string;
}

interface DatabaseSchema {
  papers: Paper[];
  notes?: Note[];
  events?: EventItem[];
  subjects: Subject[];
  years: string[];
  examTypes: string[];
  students: StudentUser[];
  admins: AdminUserRecord[];
  sessions: Record<string, UserSession>;
  contactMessages?: ContactMessage[];
}

// Secure cryptographic password hashing (Scrypt KDF with random salt)
function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return { salt, hash };
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  try {
    const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(hash, 'hex'));
  } catch (err) {
    return false;
  }
}

function createSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Initial DB seed
function getInitialData(): DatabaseSchema {
  const years = ['2026', '2025', '2024', '2023'];
  const examTypes = ['UT 1', 'UT 2', 'Midterm 1', 'Midterm 2', 'University Exam'];

  const subjects: Subject[] = [
    { id: 'sub-1', code: 'CS501', name: 'Computer Networks', department: 'Computer Science & Engineering', btechYear: '3rd Year', semester: 'Semester 5', credits: 4 },
    { id: 'sub-2', code: 'CS502', name: 'Database Management Systems', department: 'Computer Science & Engineering', btechYear: '3rd Year', semester: 'Semester 5', credits: 4 },
    { id: 'sub-3', code: 'CS503', name: 'Theory of Computation', department: 'Computer Science & Engineering', btechYear: '3rd Year', semester: 'Semester 5', credits: 3 },
    { id: 'sub-4', code: 'CS601', name: 'Operating Systems', department: 'Computer Science & Engineering', btechYear: '3rd Year', semester: 'Semester 6', credits: 4 },
    { id: 'sub-5', code: 'CS602', name: 'Compiler Design', department: 'Computer Science & Engineering', btechYear: '3rd Year', semester: 'Semester 6', credits: 4 },
    { id: 'sub-6', code: 'CS301', name: 'Data Structures & Algorithms', department: 'Computer Science & Engineering', btechYear: '2nd Year', semester: 'Semester 3', credits: 4 },
    { id: 'sub-7', code: 'CS302', name: 'Digital Electronics & Logic Design', department: 'Electronics & Computer Eng', btechYear: '2nd Year', semester: 'Semester 3', credits: 3 },
    { id: 'sub-8', code: 'CS401', name: 'Object Oriented Programming with Java', department: 'Computer Science & Engineering', btechYear: '2nd Year', semester: 'Semester 4', credits: 4 },
    { id: 'sub-9', code: 'CS701', name: 'Artificial Intelligence & Machine Learning', department: 'Computer Science & Engineering', btechYear: '4th Year', semester: 'Semester 7', credits: 4 },
    { id: 'sub-10', code: 'CS702', name: 'Cloud Computing & Distributed Systems', department: 'Computer Science & Engineering', btechYear: '4th Year', semester: 'Semester 7', credits: 3 },
    { id: 'sub-11', code: 'CS801', name: 'Information & Cyber Security', department: 'Computer Science & Engineering', btechYear: '4th Year', semester: 'Semester 8', credits: 4 },
    { id: 'sub-12', code: 'MA101', name: 'Engineering Mathematics I', department: 'Basic Sciences & Humanities', btechYear: '1st Year', semester: 'Semester 1', credits: 4 },
    { id: 'sub-13', code: 'PH101', name: 'Engineering Physics', department: 'Basic Sciences & Humanities', btechYear: '1st Year', semester: 'Semester 1', credits: 3 },
    { id: 'sub-14', code: 'MA201', name: 'Engineering Mathematics II', department: 'Basic Sciences & Humanities', btechYear: '1st Year', semester: 'Semester 2', credits: 4 },
    { id: 'sub-15', code: 'CS201', name: 'Problem Solving & Programming in C', department: 'Computer Science & Engineering', btechYear: '1st Year', semester: 'Semester 2', credits: 4 },
  ];

  const samplePapersDefs = [
    // Exact requirement from prompt: 2026 -> 3rd Year -> Semester 5 -> Midterm 1 -> Computer Networks
    {
      subjectName: 'Computer Networks',
      subjectCode: 'CS501',
      examType: 'Midterm 1',
      academicYear: '2026',
      btechYear: '3rd Year',
      semester: 'Semester 5',
      paperDate: '2026-03-15',
      filename: 'Computer_Networks_Midterm1_2026.pdf',
      description: 'Official Midterm 1 question paper covering OSI Model, TCP/IP, Data Link Layer, Flow Control and Hamming Codes.',
      maxMarks: 100,
      durationMinutes: 180,
    },
    {
      subjectName: 'Computer Networks',
      subjectCode: 'CS501',
      examType: 'University Exam',
      academicYear: '2025',
      btechYear: '3rd Year',
      semester: 'Semester 5',
      paperDate: '2025-11-28',
      filename: 'Computer_Networks_University_2025.pdf',
      description: 'University end-semester theory exam question paper with comprehensive coverage of Network & Transport layers.',
      maxMarks: 100,
      durationMinutes: 180,
    },
    {
      subjectName: 'Database Management Systems',
      subjectCode: 'CS502',
      examType: 'Midterm 1',
      academicYear: '2026',
      btechYear: '3rd Year',
      semester: 'Semester 5',
      paperDate: '2026-03-18',
      filename: 'DBMS_Midterm1_2026.pdf',
      description: 'ER Modeling, Relational Algebra, SQL queries and B+ Trees indexing schemas.',
      maxMarks: 100,
      durationMinutes: 180,
    },
    {
      subjectName: 'Data Structures & Algorithms',
      subjectCode: 'CS301',
      examType: 'UT 1',
      academicYear: '2026',
      btechYear: '2nd Year',
      semester: 'Semester 3',
      paperDate: '2026-02-10',
      filename: 'DSA_UT1_2026.pdf',
      description: 'Unit Test 1 covering Stacks, Queues, Linked Lists, and Asymptotic Notations.',
      maxMarks: 50,
      durationMinutes: 90,
    },
    {
      subjectName: 'Operating Systems',
      subjectCode: 'CS601',
      examType: 'Midterm 2',
      academicYear: '2025',
      btechYear: '3rd Year',
      semester: 'Semester 6',
      paperDate: '2025-04-12',
      filename: 'Operating_Systems_Midterm2_2025.pdf',
      description: 'Process Synchronization, Semaphores, Deadlock detection, Memory Paging and Virtual Memory.',
      maxMarks: 100,
      durationMinutes: 180,
    },
    {
      subjectName: 'Artificial Intelligence & Machine Learning',
      subjectCode: 'CS701',
      examType: 'University Exam',
      academicYear: '2025',
      btechYear: '4th Year',
      semester: 'Semester 7',
      paperDate: '2025-12-04',
      filename: 'AIML_University_2025.pdf',
      description: 'Supervised vs Unsupervised Learning, Backpropagation, A* Search, and Convolutional Neural Networks.',
      maxMarks: 100,
      durationMinutes: 180,
    },
    {
      subjectName: 'Engineering Mathematics I',
      subjectCode: 'MA101',
      examType: 'UT 2',
      academicYear: '2024',
      btechYear: '1st Year',
      semester: 'Semester 1',
      paperDate: '2024-10-22',
      filename: 'Engg_Maths_1_UT2_2024.pdf',
      description: 'Differential Calculus, Taylor series expansion, Matrices Eigenvalues and Cayley-Hamilton Theorem.',
      maxMarks: 50,
      durationMinutes: 90,
    },
    {
      subjectName: 'Information & Cyber Security',
      subjectCode: 'CS801',
      examType: 'Midterm 1',
      academicYear: '2026',
      btechYear: '4th Year',
      semester: 'Semester 8',
      paperDate: '2026-03-20',
      filename: 'Cyber_Security_Midterm1_2026.pdf',
      description: 'Cryptographic algorithms, RSA, Elliptic Curve Cryptography, Digital Signatures and Network Intrusion detection.',
      maxMarks: 100,
      durationMinutes: 180,
    },
  ];

  const papers: Paper[] = samplePapersDefs.map((def, idx) => {
    const diskFilename = `paper-${idx + 1}-${def.filename}`;
    const filePath = path.join(UPLOADS_DIR, diskFilename);

    // Generate real PDF file on disk
    const pdfBuf = generateSamplePdfBuffer(def.subjectName, def.subjectCode, def.examType, def.academicYear, def.semester);
    fs.writeFileSync(filePath, pdfBuf);

    return {
      id: `paper-${idx + 1}`,
      subjectName: def.subjectName,
      subjectCode: def.subjectCode,
      examType: def.examType,
      academicYear: def.academicYear,
      btechYear: def.btechYear,
      semester: def.semester,
      paperDate: def.paperDate,
      filename: diskFilename,
      originalFilename: def.filename,
      fileSize: pdfBuf.length,
      fileSizeFormatted: formatBytes(pdfBuf.length),
      description: def.description,
      uploadedAt: new Date(Date.now() - (idx * 86400000 * 2)).toISOString(),
      downloadsCount: 142 - idx * 11,
      viewsCount: 380 - idx * 23,
      uploadedBy: 'College Academic Controller',
      maxMarks: def.maxMarks,
      durationMinutes: def.durationMinutes,
    };
  });

  const defaultAdmin = hashPassword('admin123');
  const admins: AdminUserRecord[] = [
    {
      id: 'admin-1',
      name: 'Office of the Controller of Examinations',
      email: 'admin@college.edu',
      passwordHash: defaultAdmin.hash,
      salt: defaultAdmin.salt,
      role: 'admin',
      department: 'University Examination Wing',
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ];

  const students: StudentUser[] = [];

  const notes: Note[] = [];

  const events: EventItem[] = [
    {
      id: 'evt-1',
      title: 'Annual B.Tech Research Symposium & Technical Colloquium 2026',
      date: '2026-04-18',
      time: '09:30 AM - 04:30 PM',
      location: 'Main Convocation Auditorium, Academic Block A',
      category: 'Academic Symposium',
      description: 'An institutional showcase of final-year undergraduate B.Tech dissertations, peer-reviewed engineering papers, and keynote addresses by visiting faculty and industry pioneers.',
      organizer: 'Office of Academic Research & Dean of Engineering',
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
    },
    {
      id: 'evt-2',
      title: 'Pre-Examination Preparatory Workshop: Data Structures & Computer Networks',
      date: '2026-04-25',
      time: '02:00 PM - 05:00 PM',
      location: 'Central Library Seminar Hall II',
      category: 'Examination Prep',
      description: 'Guided faculty review session analyzing past 5 years of University End-Semester question papers, marking scheme rubrics, and high-weightage algorithmic problem sets.',
      organizer: 'Department of Computer Science & Engineering',
      createdAt: '2026-03-05T10:00:00.000Z',
      updatedAt: '2026-03-05T10:00:00.000Z',
    },
    {
      id: 'evt-3',
      title: 'Autonomous Examination Board Briefing & Archival Digitization Drive',
      date: '2026-05-04',
      time: '11:00 AM - 01:00 PM',
      location: 'Conference Room 104, Examination Wing',
      category: 'Institutional Seminar',
      description: 'Orientation on newly digitized examination folios, academic integrity guidelines for Spring 2026 End-Semester examinations, and student archive utilization.',
      organizer: 'Office of the Controller of Examinations',
      createdAt: '2026-03-10T10:00:00.000Z',
      updatedAt: '2026-03-10T10:00:00.000Z',
    },
  ];

  return {
    papers,
    notes,
    events,
    subjects,
    years,
    examTypes,
    students,
    admins,
    sessions: {},
  };
}

let memoryDbCache: DatabaseSchema | null = null;
let lastDbMtime = 0;

function readDb(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      memoryDbCache = initial;
      try {
        lastDbMtime = fs.statSync(DB_FILE).mtimeMs;
      } catch {
        lastDbMtime = Date.now();
      }
      return initial;
    }

    // Fast-path: return cached memory instance if file hasn't changed on disk
    try {
      const stat = fs.statSync(DB_FILE);
      if (memoryDbCache && stat.mtimeMs === lastDbMtime) {
        return memoryDbCache;
      }
      lastDbMtime = stat.mtimeMs;
    } catch {
      // Continue to read if stat fails
    }

    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const data: DatabaseSchema = JSON.parse(raw);

    let needsWrite = false;

    // Ensure notes array exists
    if (!data.notes || !Array.isArray(data.notes)) {
      data.notes = [];
      needsWrite = true;
    }

    // Ensure events array exists with default institutional events if absent
    if (!data.events || !Array.isArray(data.events)) {
      data.events = getInitialData().events || [];
      needsWrite = true;
    }

    // Migrate admins table if absent
    if (!data.admins || data.admins.length === 0) {
      const adminCreds = hashPassword('admin123');
      data.admins = [
        {
          id: 'admin-1',
          name: 'Office of the Controller of Examinations',
          email: 'admin@college.edu',
          passwordHash: adminCreds.hash,
          salt: adminCreds.salt,
          role: 'admin',
          department: 'University Examination Wing',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ];
      needsWrite = true;
    }

    // Ensure students array exists
    if (!data.students || !Array.isArray(data.students)) {
      data.students = [];
      needsWrite = true;
    }

    // Migrate sessions table if absent
    if (!data.sessions) {
      data.sessions = {};
      needsWrite = true;
    }

    // Migrate contactMessages array if absent
    if (!data.contactMessages) {
      data.contactMessages = [];
      needsWrite = true;
    }

    // Prune expired sessions to prevent memory and database file bloat
    if (data.sessions) {
      const now = Date.now();
      let expiredCount = 0;
      for (const token of Object.keys(data.sessions)) {
        if (data.sessions[token].expiresAt <= now) {
          delete data.sessions[token];
          expiredCount++;
        }
      }
      if (expiredCount > 0) {
        needsWrite = true;
      }
    }

    // Migrate any student without passwordHash, status, or authMethod, and ensure savedPapers/bookmarks/recentDownloads exist
    if (data.students) {
      data.students.forEach((stu: any) => {
        if (!stu.passwordHash || !stu.salt) {
          const pass = stu.password || 'password123';
          const hashed = hashPassword(pass);
          stu.passwordHash = hashed.hash;
          stu.salt = hashed.salt;
          delete stu.password;
          stu.role = 'student';
          needsWrite = true;
        }
        if (!stu.status) {
          stu.status = 'active';
          needsWrite = true;
        }
        if (!stu.authMethod) {
          stu.authMethod = stu.email && (stu.email.includes('google') || stu.email.includes('@gmail.com')) ? 'google' : 'email';
          needsWrite = true;
        }
        if (!Array.isArray(stu.savedPapers)) {
          stu.savedPapers = [];
          if (Array.isArray(stu.bookmarks)) {
            stu.bookmarks.forEach((bId: string) => {
              if (!stu.savedPapers.some((p: any) => p.paperId === bId)) {
                stu.savedPapers.push({
                  paperId: bId,
                  savedAt: stu.createdAt || new Date().toISOString(),
                });
              }
            });
          }
          needsWrite = true;
        }
        if (!Array.isArray(stu.bookmarks)) {
          stu.bookmarks = [];
          needsWrite = true;
        }
        if (!Array.isArray(stu.recentDownloads)) {
          stu.recentDownloads = [];
          needsWrite = true;
        }
        if (!Array.isArray(stu.savedNotes)) {
          stu.savedNotes = [];
          needsWrite = true;
        }
      });
    }

    memoryDbCache = data;

    if (needsWrite) {
      writeDb(data);
    }

    return data;
  } catch (err) {
    console.error('Error reading DB, protecting existing file:', err);
    if (memoryDbCache) {
      return memoryDbCache;
    }
    if (fs.existsSync(DB_FILE)) {
      try {
        const backupFile = `${DB_FILE}.corrupt.${Date.now()}`;
        fs.copyFileSync(DB_FILE, backupFile);
        console.warn(`[DATABASE] Backup of unreadable DB saved to ${backupFile}`);
      } catch (backupErr) {
        console.error('Failed to create DB backup:', backupErr);
      }
    }
    const initial = getInitialData();
    writeDb(initial);
    return initial;
  }
}

function writeDb(data: DatabaseSchema) {
  memoryDbCache = data;
  const tempFile = `${DB_FILE}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
  try {
    lastDbMtime = fs.statSync(DB_FILE).mtimeMs;
  } catch {
    lastDbMtime = Date.now();
  }
}

// Clean up stale temporary chunk uploads older than 1 hour to prevent disk and inode exhaustion
function cleanStaleTempUploads() {
  try {
    if (!fs.existsSync(TEMP_UPLOADS_DIR)) return;
    const files = fs.readdirSync(TEMP_UPLOADS_DIR);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const f of files) {
      const p = path.join(TEMP_UPLOADS_DIR, f);
      try {
        const stat = fs.statSync(p);
        if (stat.mtimeMs < oneHourAgo) {
          fs.unlinkSync(p);
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}
cleanStaleTempUploads();

// Initialize database on startup and ensure PDF repository integrity & valid multi-page PDF files
const startupDb = readDb();
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
let startupDbNeedsSave = false;

// 1. Audit and heal question papers
if (startupDb && Array.isArray(startupDb.papers)) {
  startupDb.papers.forEach((p) => {
    if (p.filename) {
      const safeName = path.basename(p.filename);
      const seedFilePath = path.resolve(UPLOADS_DIR, safeName);
      let needsHeal = false;

      if (!fs.existsSync(seedFilePath)) {
        needsHeal = true;
      } else {
        const stat = fs.statSync(seedFilePath);
        if (stat.size === 0) {
          needsHeal = true;
        } else if (stat.size < 300) {
          // Check for damaged/0-page stubs (such as the 232-byte /Count 0 stub)
          try {
            const head = fs.readFileSync(seedFilePath, 'utf8');
            if (head.includes('/Count 0') || !head.startsWith('%PDF')) {
              needsHeal = true;
            }
          } catch {
            needsHeal = true;
          }
        }
      }

      if (needsHeal) {
        try {
          const buf = generateSamplePdfBuffer(p.subjectName, p.subjectCode, p.examType, p.academicYear, p.semester);
          fs.writeFileSync(seedFilePath, buf);
          console.log(`[STORAGE AUDIT] Healed valid multi-page PDF for paper ${p.id} (${p.subjectName}) -> ${buf.length} bytes`);
        } catch (e) {
          console.error(`Could not generate seed PDF for ${p.id}:`, e);
        }
      }

      // Always sync database record with actual filesystem size
      if (fs.existsSync(seedFilePath)) {
        const actualDiskSize = fs.statSync(seedFilePath).size;
        if (p.fileSize !== actualDiskSize) {
          p.fileSize = actualDiskSize;
          p.fileSizeFormatted = formatBytes(actualDiskSize);
          startupDbNeedsSave = true;
        }
      }
    }
  });
}

// 2. Audit and heal study notes
if (startupDb && Array.isArray(startupDb.notes)) {
  startupDb.notes.forEach((n) => {
    if (n.filename) {
      const safeName = path.basename(n.filename);
      const seedFilePath = path.resolve(UPLOADS_DIR, safeName);
      let needsHeal = false;

      if (!fs.existsSync(seedFilePath)) {
        needsHeal = true;
      } else {
        const stat = fs.statSync(seedFilePath);
        if (stat.size === 0) {
          needsHeal = true;
        } else if (stat.size < 300) {
          try {
            const head = fs.readFileSync(seedFilePath, 'utf8');
            if (head.includes('/Count 0') || !head.startsWith('%PDF')) {
              needsHeal = true;
            }
          } catch {
            needsHeal = true;
          }
        }
      }

      if (needsHeal) {
        try {
          const buf = generateSampleNotePdfBuffer(n.title, n.subjectName, n.subjectCode, n.btechYear, n.semester);
          fs.writeFileSync(seedFilePath, buf);
          console.log(`[STORAGE AUDIT] Healed valid multi-page PDF for note ${n.id} (${n.title}) -> ${buf.length} bytes`);
        } catch (e) {
          console.error(`Could not generate seed PDF for note ${n.id}:`, e);
        }
      }

      // Always sync database record with actual filesystem size
      if (fs.existsSync(seedFilePath)) {
        const actualDiskSize = fs.statSync(seedFilePath).size;
        if (n.fileSize !== actualDiskSize) {
          n.fileSize = actualDiskSize;
          n.fileSizeFormatted = formatBytes(actualDiskSize);
          startupDbNeedsSave = true;
        }
      }
    }
  });
}

if (startupDbNeedsSave) {
  writeDb(startupDb);
}

declare global {
  namespace Express {
    interface Request {
      user?: UserSession | null;
    }
  }
}

// If Supabase is configured, trigger initial database sync on startup
if (isSupabaseConfigured()) {
  syncDatabaseFromSupabase().then(cloudData => {
    if (cloudData) {
      const current = readDb();
      if (cloudData.students && cloudData.students.length > 0) current.students = cloudData.students;
      if (cloudData.papers && cloudData.papers.length > 0) current.papers = cloudData.papers;
      if (cloudData.notes && cloudData.notes.length > 0) current.notes = cloudData.notes;
      if (cloudData.events && cloudData.events.length > 0) current.events = cloudData.events;
      if (cloudData.subjects && cloudData.subjects.length > 0) current.subjects = cloudData.subjects;
      if (cloudData.sessions) current.sessions = { ...current.sessions, ...cloudData.sessions };
      writeDb(current);
      console.log('[SUPABASE] Cloud database synced with application memory cache.');
    }
  }).catch(err => {
    console.warn('[SUPABASE] Initial cloud sync notice:', err?.message || err);
  });
}

// Serve uploaded event photos publicly so they display cleanly on the Events page
app.get('/api/event-images/:filename', async (req, res) => {
  const safeName = path.basename(req.params.filename || '');
  if (!safeName) {
    return res.status(400).json({ error: 'Invalid image filename.' });
  }
  const localPath = path.join(EVENT_IMAGES_DIR, safeName);

  if (!fs.existsSync(localPath) && isSupabaseConfigured()) {
    try {
      const { buffer } = await downloadPdfFromStorage(`events/${safeName}`);
      if (buffer && buffer.length > 0) {
        fs.writeFileSync(localPath, buffer);
      }
    } catch {
      // ignore
    }
  }

  if (!fs.existsSync(localPath)) {
    return res.status(404).json({ error: 'Event image not found.' });
  }

  const ext = path.extname(safeName).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.sendFile(localPath);
});

// Explicitly block direct public access to uploads folder - all files must go through authenticated endpoints
app.all(['/uploads', '/uploads/*'], (_req, res) => {
  res.status(401).json({ error: 'Direct access to files is forbidden. Institutional authentication required.' });
});

// Session authentication middleware attached globally
app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-session-token'] as string);

  // Also support token passed in query parameter for authenticated inline PDF preview iframes & direct downloads
  if (!token && req.query && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    req.user = null;
    return next();
  }

  const db = readDb();
  const session = db.sessions ? db.sessions[token] : null;

  if (!session) {
    req.user = null;
    return next();
  }

  if (session.expiresAt <= Date.now()) {
    // Session expired, remove
    delete db.sessions[token];
    writeDb(db);
    req.user = null;
    return next();
  }

  req.user = session;
  next();
});

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in to access academic archives and question papers.' });
  }

  // Active status check for students
  if (req.user.role === 'student') {
    const db = readDb();
    const student = db.students.find(s => s.id === req.user!.userId);
    if (!student || student.status === 'disabled') {
      return res.status(403).json({ error: 'Your student account has been disabled by the university administration. Please contact the Office of the Controller of Examinations.' });
    }
  }

  next();
};

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in as an administrator.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrative authorization required.' });
  }
  next();
};

/* ==========================================================================
   API ROUTES
   ========================================================================== */

// --- 1. System Statistics for Authenticated Users ---
app.get('/api/stats', requireAuth, (_req, res) => {
  const db = readDb();
  const totalPapers = db.papers.length;
  const totalSubjects = db.subjects.length;
  const totalYears = db.years.length;
  const totalStudents = db.students.length;
  const totalDownloads = db.papers.reduce((sum, p) => sum + (p.downloadsCount || 0), 0);

  // Group by Exam Type
  const examTypeCounts: Record<string, number> = {};
  db.examTypes.forEach(t => (examTypeCounts[t] = 0));
  db.papers.forEach(p => {
    examTypeCounts[p.examType] = (examTypeCounts[p.examType] || 0) + 1;
  });

  // Group by B.Tech Year
  const btechYearCounts: Record<string, number> = {
    '1st Year': 0,
    '2nd Year': 0,
    '3rd Year': 0,
    '4th Year': 0,
  };
  db.papers.forEach(p => {
    btechYearCounts[p.btechYear] = (btechYearCounts[p.btechYear] || 0) + 1;
  });

  const recentPapers = [...db.papers]
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, 5);

  res.json({
    totalPapers,
    totalSubjects,
    totalYears,
    totalStudents,
    totalDownloads,
    examTypeCounts,
    btechYearCounts,
    recentPapers,
  });
});

// --- 2. Papers Query & Filtering (Authentication Required) ---
app.get('/api/papers', requireAuth, (req, res) => {
  const db = readDb();
  let papers = [...db.papers];

  const { search, year, btechYear, semester, examType, subject } = req.query as Record<string, string | undefined>;

  if (year && year !== 'All') {
    papers = papers.filter(p => p.academicYear === year);
  }
  if (btechYear && btechYear !== 'All') {
    papers = papers.filter(p => p.btechYear.toLowerCase() === btechYear.toLowerCase());
  }
  if (semester && semester !== 'All') {
    papers = papers.filter(p => p.semester.toLowerCase() === semester.toLowerCase());
  }
  if (examType && examType !== 'All') {
    papers = papers.filter(p => p.examType.toLowerCase() === examType.toLowerCase());
  }
  if (subject && subject !== 'All') {
    papers = papers.filter(p => p.subjectName.toLowerCase() === subject.toLowerCase() || p.subjectCode.toLowerCase() === subject.toLowerCase());
  }
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    papers = papers.filter(
      p =>
        p.subjectName.toLowerCase().includes(q) ||
        p.subjectCode.toLowerCase().includes(q) ||
        p.examType.toLowerCase().includes(q) ||
        p.academicYear.toLowerCase().includes(q) ||
        p.btechYear.toLowerCase().includes(q) ||
        p.semester.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }

  // Sort by uploadedAt desc
  papers.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  res.json(papers);
});

// Single Paper by ID
app.get(['/api/papers/:id', '/api/question-papers/:id'], (req, res) => {
  if (req.path.startsWith('/api/papers/')) {
    return requireAuth(req, res, () => {
      handleGetSinglePaper(req, res);
    });
  }
  handleGetSinglePaper(req, res);
});

function handleGetSinglePaper(req: express.Request, res: express.Response) {
  const db = readDb();
  const paper = db.papers.find(p => p.id === req.params.id);
  if (!paper) {
    return res.status(404).json({ error: 'Paper not found' });
  }

  // Increment view counter
  paper.viewsCount = (paper.viewsCount || 0) + 1;
  writeDb(db);

  res.json(paper);
}

// --- 3. Upload & Add Paper ---
app.post(
  '/api/papers',
  requireAuth,
  handleMulterUpload,
  async (req, res) => {
    try {
      const db = readDb();
      const {
        subjectName,
        subjectCode,
        examType,
        academicYear,
        btechYear,
        semester,
        paperDate,
        description,
        maxMarks,
        durationMinutes,
      } = req.body;

      if (!subjectName || !examType || !academicYear || !btechYear || !semester) {
        return res.status(400).json({ error: 'Missing required paper fields. Please complete all fields marked with *.' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Please select an authentic PDF file from your computer.' });
      }

      const diskFilename = req.file.filename;
      const originalFilename = req.file.originalname;
      const fileSize = req.file.size;

      // Check size limit (60 MB)
      if (fileSize > MAX_PDF_SIZE) {
        if (fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
        }
        return res.status(400).json({ error: 'File size must be 60 MB or less.' });
      }

      // Verify genuine PDF file header (%PDF magic bytes)
      try {
        const fileHeader = Buffer.alloc(5);
        const fd = fs.openSync(req.file.path, 'r');
        fs.readSync(fd, fileHeader, 0, 5, 0);
        fs.closeSync(fd);
        if (!fileHeader.toString('utf8').startsWith('%PDF')) {
          if (fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
          }
          return res.status(400).json({ error: 'Invalid file format. Only authentic PDF documents (.pdf) are supported.' });
        }
      } catch (readErr) {
        console.error('Error verifying PDF header:', readErr);
      }

      const uploaderTitle = req.user?.role === 'admin' ? 'Controller of Examinations' : (req.user?.name || 'Department Faculty');

      const newPaper: Paper = {
        id: `paper-${Date.now()}`,
        subjectName: subjectName.trim(),
        subjectCode: (subjectCode || 'N/A').trim().toUpperCase(),
        examType: examType.trim(),
        academicYear: academicYear.trim(),
        btechYear: btechYear.trim(),
        semester: semester.trim(),
        paperDate: paperDate || new Date().toISOString().split('T')[0],
        filename: diskFilename,
        originalFilename: originalFilename,
        fileSize: fileSize,
        fileSizeFormatted: formatBytes(fileSize),
        description: description ? description.trim() : '',
        uploadedAt: new Date().toISOString(),
        downloadsCount: 0,
        viewsCount: 0,
        uploadedBy: uploaderTitle,
        maxMarks: parseInt(maxMarks) || 100,
        durationMinutes: parseInt(durationMinutes) || 180,
      };

      db.papers.unshift(newPaper);

      // Auto-add subject if not already in subjects list
      const existingSubject = db.subjects.find(
        s => s.name.toLowerCase() === newPaper.subjectName.toLowerCase() || s.code.toLowerCase() === newPaper.subjectCode.toLowerCase()
      );
      if (!existingSubject && newPaper.subjectName) {
        db.subjects.push({
          id: `sub-${Date.now()}`,
          name: newPaper.subjectName,
          code: newPaper.subjectCode,
          department: 'Academic Division',
          btechYear: newPaper.btechYear,
          semester: newPaper.semester,
          credits: 4,
        });
      }

      // Auto-add year if not present
      if (!db.years.includes(newPaper.academicYear)) {
        db.years.push(newPaper.academicYear);
        db.years.sort((a, b) => b.localeCompare(a));
      }

      writeDb(db);

      // Persist metadata and file to Supabase if configured
      if (isSupabaseConfigured() && req.file) {
        try {
          const buf = await fs.promises.readFile(req.file.path);
          const uploadResult = await uploadPdfToStorage(`papers/${newPaper.filename}`, buf);
          if (!uploadResult.success) {
            console.error('[SUPABASE] Paper storage upload error:', uploadResult.error);
            return res.status(500).json({ error: uploadResult.error || 'Failed to upload paper PDF to Supabase Storage.' });
          }
          await persistPaperToSupabase(newPaper);
        } catch (readOrUploadErr: any) {
          console.error('[SUPABASE] Paper upload error:', readOrUploadErr);
          return res.status(500).json({ error: readOrUploadErr.message || 'Failed to persist paper to Supabase.' });
        }
      }

      res.status(201).json(newPaper);
    } catch (err: any) {
      console.error('Error adding paper:', err);
      res.status(500).json({ error: err.message || 'Failed to save question paper.' });
    }
  }
);

// --- 3b. Upload Paper Chunk (Supports Large PDFs up to 60 MB without proxy limits) ---
app.post(
  '/api/papers/upload-chunk',
  requireAuth,
  chunkUpload.single('chunk'),
  async (req, res) => {
    try {
      const { uploadId, chunkIndex, totalChunks, totalSize } = req.body;
      if (!uploadId || chunkIndex === undefined || !req.file) {
        return res.status(400).json({ error: 'Missing required paper chunk parameters.' });
      }
      const idx = parseInt(chunkIndex, 10);
      const total = parseInt(totalChunks, 10);
      const size = parseInt(totalSize, 10);

      const result = await appendChunkToAssembly(uploadId, idx, total, size, req.file.path);
      return res.json({
        success: true,
        chunkIndex: idx,
        totalChunks: total,
        bytesReceived: result.bytesReceived,
      });
    } catch (err: any) {
      if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
      }
      const status = err.message && err.message.includes('60 MB') ? 413 : 500;
      return res.status(status).json({ error: err.message || 'Error processing paper chunk.' });
    }
  }
);

// --- 3c. Complete Chunked Paper Upload ---
app.post(
  '/api/papers/complete-chunk-upload',
  requireAuth,
  async (req, res) => {
    try {
      const {
        uploadId,
        subjectName,
        subjectCode,
        examType,
        academicYear,
        btechYear,
        semester,
        paperDate,
        description,
        maxMarks,
        durationMinutes,
        originalFilename,
        totalSize,
      } = req.body;

      if (!uploadId) return res.status(400).json({ error: 'Upload ID is required.' });
      if (!subjectName || !examType || !academicYear || !btechYear || !semester) {
        return res.status(400).json({ error: 'Missing required paper fields.' });
      }

      const { diskFilename, actualSize } = finalizeAssembly(uploadId, originalFilename || 'paper.pdf', totalSize ? parseInt(totalSize, 10) : undefined);

      const uploaderTitle = req.user?.role === 'admin' ? 'Controller of Examinations' : (req.user?.name || 'Department Faculty');

      const newPaper: Paper = {
        id: `paper-${Date.now()}`,
        subjectName: subjectName.trim(),
        subjectCode: (subjectCode || 'N/A').trim().toUpperCase(),
        examType: examType.trim(),
        academicYear: academicYear.trim(),
        btechYear: btechYear.trim(),
        semester: semester.trim(),
        paperDate: paperDate || new Date().toISOString().split('T')[0],
        filename: diskFilename,
        originalFilename: originalFilename || diskFilename,
        fileSize: actualSize,
        fileSizeFormatted: formatBytes(actualSize),
        description: description ? description.trim() : '',
        uploadedAt: new Date().toISOString(),
        downloadsCount: 0,
        viewsCount: 0,
        uploadedBy: uploaderTitle,
        maxMarks: parseInt(maxMarks) || 100,
        durationMinutes: parseInt(durationMinutes) || 180,
      };

      const db = readDb();
      db.papers.unshift(newPaper);

      const existingSubject = db.subjects.find(
        s => s.name.toLowerCase() === newPaper.subjectName.toLowerCase() || s.code.toLowerCase() === newPaper.subjectCode.toLowerCase()
      );
      if (!existingSubject && newPaper.subjectName) {
        db.subjects.push({
          id: `sub-${Date.now()}`,
          name: newPaper.subjectName,
          code: newPaper.subjectCode,
          department: 'Academic Division',
          btechYear: newPaper.btechYear,
          semester: newPaper.semester,
          credits: 4,
        });
      }

      if (!db.years.includes(newPaper.academicYear)) {
        db.years.push(newPaper.academicYear);
        db.years.sort((a, b) => b.localeCompare(a));
      }

      writeDb(db);

      // Persist finalized chunked assembly to Supabase
      if (isSupabaseConfigured()) {
        const assembledFilePath = path.join(UPLOADS_DIR, newPaper.filename);
        try {
          const buf = await fs.promises.readFile(assembledFilePath);
          const uploadResult = await uploadPdfToStorage(`papers/${newPaper.filename}`, buf);
          if (!uploadResult.success) {
            console.error('[SUPABASE] Chunked paper storage upload error:', uploadResult.error);
            return res.status(500).json({ error: uploadResult.error || 'Failed to upload chunked paper PDF to Supabase Storage.' });
          }
          await persistPaperToSupabase(newPaper);
        } catch (readOrUploadErr: any) {
          console.error('[SUPABASE] Chunked paper upload error:', readOrUploadErr);
          return res.status(500).json({ error: readOrUploadErr.message || 'Failed to persist chunked paper to Supabase.' });
        }
      }

      return res.status(201).json(newPaper);
    } catch (err: any) {
      console.error('Error completing chunked paper upload:', err);
      const status = err.message && err.message.includes('60 MB') ? 413 : 500;
      return res.status(status).json({ error: err.message || 'Failed to finalize paper upload.' });
    }
  }
);

// --- 4. Edit Paper & Replace PDF ---
app.put('/api/papers/:id', requireAdmin, handleMulterUpload, async (req, res) => {
  try {
    const db = readDb();
    const paperIdx = db.papers.findIndex(p => p.id === req.params.id);
    if (paperIdx === -1) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const currentPaper = db.papers[paperIdx];
    const {
      subjectName,
      subjectCode,
      examType,
      academicYear,
      btechYear,
      semester,
      paperDate,
      description,
      maxMarks,
      durationMinutes,
    } = req.body;

    let diskFilename = currentPaper.filename;
    let originalFilename = currentPaper.originalFilename;
    let fileSize = currentPaper.fileSize;

    // Check if user uploaded a replacement PDF
    if (req.file) {
      if (req.file.size > MAX_PDF_SIZE) {
        if (fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
        }
        return res.status(400).json({ error: 'File size must be 60 MB or less.' });
      }

      // Verify genuine PDF file header (%PDF magic bytes)
      try {
        const fileHeader = Buffer.alloc(5);
        const fd = fs.openSync(req.file.path, 'r');
        fs.readSync(fd, fileHeader, 0, 5, 0);
        fs.closeSync(fd);
        if (!fileHeader.toString('utf8').startsWith('%PDF')) {
          if (fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
          }
          return res.status(400).json({ error: 'Invalid file format. Only authentic PDF documents (.pdf) are supported.' });
        }
      } catch (readErr) {
        console.error('Error verifying PDF header:', readErr);
      }

      // Remove old file if it exists
      const oldFilePath = path.join(UPLOADS_DIR, currentPaper.filename);
      if (fs.existsSync(oldFilePath)) {
        try { fs.unlinkSync(oldFilePath); } catch (e) { /* ignore */ }
      }
      diskFilename = req.file.filename;
      originalFilename = req.file.originalname;
      fileSize = req.file.size;
    }

    const updatedPaper: Paper = {
      ...currentPaper,
      subjectName: subjectName ? subjectName.trim() : currentPaper.subjectName,
      subjectCode: subjectCode ? subjectCode.trim().toUpperCase() : currentPaper.subjectCode,
      examType: examType ? examType.trim() : currentPaper.examType,
      academicYear: academicYear ? academicYear.trim() : currentPaper.academicYear,
      btechYear: btechYear ? btechYear.trim() : currentPaper.btechYear,
      semester: semester ? semester.trim() : currentPaper.semester,
      paperDate: paperDate || currentPaper.paperDate,
      description: description !== undefined ? description.trim() : currentPaper.description,
      filename: diskFilename,
      originalFilename: originalFilename,
      fileSize: fileSize,
      fileSizeFormatted: formatBytes(fileSize),
      maxMarks: maxMarks ? parseInt(maxMarks) : currentPaper.maxMarks,
      durationMinutes: durationMinutes ? parseInt(durationMinutes) : currentPaper.durationMinutes,
    };

    db.papers[paperIdx] = updatedPaper;
    writeDb(db);

    if (isSupabaseConfigured()) {
      try {
        if (req.file) {
          const buf = await fs.promises.readFile(req.file.path);
          const uploadResult = await uploadPdfToStorage(`papers/${updatedPaper.filename}`, buf);
          if (!uploadResult.success) {
            console.error('[SUPABASE] Paper update storage upload error:', uploadResult.error);
            return res.status(500).json({ error: uploadResult.error || 'Failed to upload updated paper PDF to Supabase Storage.' });
          }
        }
        await persistPaperToSupabase(updatedPaper);
      } catch (readOrUploadErr: any) {
        console.error('[SUPABASE] Paper update error:', readOrUploadErr);
        return res.status(500).json({ error: readOrUploadErr.message || 'Failed to update paper in Supabase.' });
      }
    }

    res.json(updatedPaper);
  } catch (err: any) {
    console.error('Error updating paper:', err);
    res.status(500).json({ error: err.message || 'Failed to update paper.' });
  }
});

// --- 5. Delete Paper (Admin Authorization Required) ---
app.delete('/api/papers/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const paperId = req.params.id;
  const paper = db.papers.find(p => p.id === paperId);
  if (!paper) {
    return res.status(404).json({ error: 'Question paper not found in archive repository.' });
  }

  // Remove physical PDF file from disk storage (/data/uploads)
  if (paper.filename) {
    const filePath = path.resolve(UPLOADS_DIR, paper.filename);
    if (filePath.startsWith(UPLOADS_DIR) && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error(`Could not delete file from disk (${filePath}):`, e);
      }
    }
  }

  // Remove record from db.json
  db.papers = db.papers.filter(p => p.id !== paperId);

  // Note: Student savedPapers references are retained so My Archive can safely display
  // "Paper no longer available" and allow the student to remove the entry (Requirement 10).
  // Bookmarks are also retained or cleaned only if desired, but retaining allows clean UI resolution.

  writeDb(db);

  if (isSupabaseConfigured()) {
    deletePdfFromStorage(`papers/${paper.filename}`).catch(() => {});
    getSupabase()?.from('papers').delete().eq('id', paperId).then(() => {}, () => {});
  }

  return res.json({
    success: true,
    message: `Question paper "${paper.subjectName}" (${paper.subjectCode}) permanently deleted from archive and storage.`,
    id: paperId,
  });
});

// Helper to sanitize filenames for Content-Disposition header
function getSafePdfFilenames(originalFilename?: string, fallbackName?: string) {
  const name = (originalFilename || fallbackName || 'question-paper.pdf').trim();
  // Safe ASCII filename for older browsers
  const safeAscii = name.replace(/[/\\?%*:|"<>]/g, '_').replace(/[^\x20-\x7E]/g, '_');
  // RFC 5987 / RFC 6266 encoded UTF-8 filename
  const utf8Encoded = encodeURIComponent(name);
  return { safeAscii, utf8Encoded };
}

// Helper to stream paper PDF for browser inline viewing or attachment download
async function streamPaperPdf(req: express.Request, res: express.Response, asAttachment: boolean = false) {
  const paperId = req.params.id;
  const db = readDb();
  const paper = db.papers.find(p => p.id === paperId);
  if (!paper) {
    return res.status(404).json({ error: 'Question paper record not found in repository.' });
  }

  // Only increment counters on initial view or download request, not on HEAD or Range chunks
  const isHead = req.method === 'HEAD';
  const isSubsequentChunk = Boolean(req.headers.range && !req.headers.range.startsWith('bytes=0-'));
  if (!isHead && !isSubsequentChunk) {
    if (asAttachment) {
      paper.downloadsCount = (paper.downloadsCount || 0) + 1;
    } else {
      paper.viewsCount = (paper.viewsCount || 0) + 1;
    }
    writeDb(db);
  }

  const safeFilename = path.basename(paper.filename);
  const filePath = path.resolve(UPLOADS_DIR, safeFilename);

  // Verify file existence and integrity, self-heal if missing or corrupted 0-page stub
  let needsHeal = false;
  if (!fs.existsSync(filePath)) {
    needsHeal = true;
  } else {
    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      needsHeal = true;
    } else if (stat.size < 300) {
      try {
        const head = fs.readFileSync(filePath, 'utf8');
        if (head.includes('/Count 0') || !head.startsWith('%PDF')) {
          needsHeal = true;
        }
      } catch {
        needsHeal = true;
      }
    }
  }

  // First attempt to restore from Supabase Storage before falling back to synthesize
  if (needsHeal && isSupabaseConfigured()) {
    try {
      const cloud = await downloadPdfFromStorage(`papers/${paper.filename}`);
      if (cloud.buffer && cloud.buffer.length > 0) {
        fs.writeFileSync(filePath, cloud.buffer);
        paper.fileSize = cloud.buffer.length;
        paper.fileSizeFormatted = formatBytes(cloud.buffer.length);
        writeDb(db);
        needsHeal = false;
        console.log(`[SUPABASE STORAGE] Restored paper ${paper.id} (${paper.filename}) from cloud bucket -> ${cloud.buffer.length} bytes`);
      }
    } catch (e) {
      console.warn(`[SUPABASE STORAGE] Could not restore paper ${paper.id} from cloud:`, e);
    }
  }

  if (needsHeal) {
    try {
      const newBuf = generateSamplePdfBuffer(paper.subjectName, paper.subjectCode, paper.examType, paper.academicYear, paper.semester);
      fs.writeFileSync(filePath, newBuf);
      paper.fileSize = newBuf.length;
      paper.fileSizeFormatted = formatBytes(newBuf.length);
      writeDb(db);
      console.log(`[STORAGE] Self-healed valid multi-page PDF for paper ${paper.id} (${paper.subjectName}) -> ${newBuf.length} bytes`);
    } catch (e) {
      console.error(`Failed to heal PDF for ${paper.id}:`, e);
      return res.status(500).json({ error: 'Stored PDF file could not be read or synthesized.' });
    }
  }

  try {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    if (fileSize === 0) {
      return res.status(500).json({ error: 'Stored PDF file is empty (0 bytes).' });
    }

    // Verify PDF magic bytes header
    const headerBuf = Buffer.alloc(5);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, headerBuf, 0, 5, 0);
    fs.closeSync(fd);
    if (!headerBuf.toString('utf8').startsWith('%PDF')) {
      return res.status(500).json({ error: 'Stored file is not an authentic PDF document.' });
    }

    const { safeAscii, utf8Encoded } = getSafePdfFilenames(paper.originalFilename, `${paper.subjectCode}-${paper.examType}.pdf`);
    const dispositionType = asAttachment ? 'attachment' : 'inline';

    console.log(`[PDF SERVE PAPER] requested ID: ${paperId}, resolved path: ${filePath}, file existence: ${fs.existsSync(filePath)}, actual file size: ${fileSize}, Content-Type: application/pdf, Content-Length: ${fileSize}`);

    const rangeHeader = req.headers.range;
    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      let start: number;
      let end: number;

      if (parts[0] === '') {
        const suffixLength = parseInt(parts[1], 10);
        if (isNaN(suffixLength) || suffixLength <= 0) {
          res.setHeader('Content-Range', `bytes */${fileSize}`);
          return res.status(416).json({ error: 'Requested Range Not Satisfiable' });
        }
        start = Math.max(0, fileSize - suffixLength);
        end = fileSize - 1;
      } else {
        start = parseInt(parts[0], 10);
        end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      }

      if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).json({ error: 'Requested Range Not Satisfiable' });
      }

      const chunkSize = (end - start) + 1;
      res.status(206);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize.toString());
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeAscii}"; filename*=UTF-8''${utf8Encoded}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Disposition');
      res.setHeader('Cache-Control', asAttachment ? 'private, no-cache, no-store, must-revalidate' : 'public, max-age=3600');

      if (req.method === 'HEAD') {
        return res.end();
      }

      const fileStream = fs.createReadStream(filePath, { start, end });
      fileStream.on('error', (streamErr) => {
        console.error('File stream range error for Paper PDF:', streamErr);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream requested PDF byte range.' });
        } else {
          res.destroy();
        }
      });
      req.on('close', () => {
        fileStream.destroy();
      });
      return fileStream.pipe(res);
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', fileSize.toString());
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeAscii}"; filename*=UTF-8''${utf8Encoded}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Disposition');
    res.setHeader('Cache-Control', asAttachment ? 'private, no-cache, no-store, must-revalidate' : 'public, max-age=3600');

    if (req.method === 'HEAD') {
      return res.end();
    }

    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (streamErr) => {
      console.error('File stream error for Paper PDF:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream PDF document from server storage.' });
      } else {
        res.destroy();
      }
    });

    req.on('close', () => {
      fileStream.destroy();
    });

    fileStream.pipe(res);
  } catch (err: any) {
    console.error('Error serving paper PDF:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Error loading PDF document.' });
    }
  }
}

// --- 6. View PDF in Browser (Inline) ---
// Protected endpoint aliases for audit testing
app.get([
  '/api/papers/view/:id',
  '/api/papers/:id/pdf',
  '/api/papers/:id/view',
], requireAuth, (req, res) => {
  streamPaperPdf(req, res, false);
});

// Dedicated browser-viewable PDF endpoints for embedded Paper Details Viewer (Content-Type: application/pdf)
app.get([
  '/api/question-papers/:id/pdf',
  '/api/question-papers/view/:id',
  '/api/question-papers/:id/view',
], (req, res) => {
  streamPaperPdf(req, res, false);
});

// --- 7. Download PDF as Attachment (Authentication Required) ---
app.get([
  '/api/papers/download/:id',
  '/api/papers/:id/download',
  '/api/question-papers/download/:id',
  '/api/question-papers/:id/download',
], requireAuth, (req, res) => {
  streamPaperPdf(req, res, true);
});

// ==========================================================================
// NOTES REPOSITORY & MANAGEMENT ENDPOINTS
// ==========================================================================

// 1. Get all notes with filters (Accessible to students & visitors)
app.get('/api/notes', (req, res) => {
  const db = readDb();
  let notes = [...(db.notes || [])];

  const { search, btechYear, semester, subject } = req.query as Record<string, string | undefined>;

  if (btechYear && btechYear !== 'All') {
    notes = notes.filter(n => n.btechYear.toLowerCase() === btechYear.toLowerCase());
  }
  if (semester && semester !== 'All') {
    notes = notes.filter(n => n.semester.toLowerCase() === semester.toLowerCase());
  }
  if (subject && subject !== 'All') {
    notes = notes.filter(n => n.subjectName.toLowerCase() === subject.toLowerCase() || n.subjectCode.toLowerCase() === subject.toLowerCase());
  }
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    notes = notes.filter(
      n =>
        n.title.toLowerCase().includes(q) ||
        n.subjectName.toLowerCase().includes(q) ||
        n.subjectCode.toLowerCase().includes(q) ||
        (n.description && n.description.toLowerCase().includes(q))
    );
  }

  // Sort by uploadedAt desc
  notes.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  res.json(notes);
});

// 2. Single Note by ID
app.get('/api/notes/:id', (req, res) => {
  const db = readDb();
  const note = (db.notes || []).find(n => n.id === req.params.id);
  if (!note) {
    return res.status(404).json({ error: 'Note document not found.' });
  }

  note.viewsCount = (note.viewsCount || 0) + 1;
  writeDb(db);
  res.json(note);
});

// 3. Add New Note (Admin Only)
app.post(
  '/api/notes',
  requireAdmin,
  handleMulterUpload,
  async (req, res) => {
    try {
      const db = readDb();
      if (!db.notes) db.notes = [];

      const { title, subjectName, subjectCode, btechYear, semester, description } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Note title is required.' });
      }
      if (!subjectName || !subjectName.trim()) {
        return res.status(400).json({ error: 'Subject name is required.' });
      }
      if (!btechYear || !btechYear.trim()) {
        return res.status(400).json({ error: 'B.Tech year is required.' });
      }
      if (!semester || !semester.trim()) {
        return res.status(400).json({ error: 'Semester is required.' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Please upload a PDF document for this note.' });
      }

      const diskFilename = req.file.filename;
      const originalFilename = req.file.originalname;
      const fileSize = req.file.size;

      if (fileSize > MAX_PDF_SIZE) {
        if (fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
        }
        return res.status(400).json({ error: 'File size must be 60 MB or less.' });
      }

      // Verify genuine PDF file header (%PDF magic bytes)
      try {
        const fileHeader = Buffer.alloc(5);
        const fd = fs.openSync(req.file.path, 'r');
        fs.readSync(fd, fileHeader, 0, 5, 0);
        fs.closeSync(fd);
        if (!fileHeader.toString('utf8').startsWith('%PDF')) {
          if (fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
          }
          return res.status(400).json({ error: 'Invalid file format. Only authentic PDF documents (.pdf) are supported.' });
        }
      } catch (readErr) {
        console.error('Error verifying PDF header for note:', readErr);
      }

      const uploaderTitle = req.user?.role === 'admin' ? 'Office of Academic Dean' : (req.user?.name || 'Department Faculty');

      const newNote: Note = {
        id: `note-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        title: title.trim(),
        subjectName: subjectName.trim(),
        subjectCode: (subjectCode || 'N/A').trim().toUpperCase(),
        btechYear: btechYear.trim(),
        semester: semester.trim(),
        description: description ? description.trim() : '',
        filename: diskFilename,
        originalFilename: originalFilename,
        fileSize: fileSize,
        fileSizeFormatted: formatBytes(fileSize),
        uploadedAt: new Date().toISOString(),
        uploadedBy: uploaderTitle,
        downloadsCount: 0,
        viewsCount: 0,
      };

      db.notes.unshift(newNote);
      writeDb(db);

      if (isSupabaseConfigured() && req.file) {
        try {
          const buf = await fs.promises.readFile(req.file.path);
          const uploadResult = await uploadPdfToStorage(`notes/${newNote.filename}`, buf);
          if (!uploadResult.success) {
            console.error('[SUPABASE] Note direct storage upload error:', uploadResult.error);
            return res.status(500).json({ error: uploadResult.error || 'Failed to upload note PDF to Supabase Storage.' });
          }
          await persistNoteToSupabase(newNote);
        } catch (readOrUploadErr: any) {
          console.error('[SUPABASE] Note direct upload error:', readOrUploadErr);
          return res.status(500).json({ error: readOrUploadErr.message || 'Failed to persist note to Supabase.' });
        }
      }

      res.status(201).json(newNote);
    } catch (err: any) {
      console.error('Error creating note:', err);
      res.status(500).json({ error: err.message || 'Failed to save note.' });
    }
  }
);

// 3b. Upload Note Chunk (Admin Only - Supports Large PDFs up to 60 MB without proxy limits)
app.post(
  '/api/notes/upload-chunk',
  requireAdmin,
  chunkUpload.single('chunk'),
  async (req, res) => {
    try {
      const { uploadId, chunkIndex, totalChunks, totalSize } = req.body;
      if (!uploadId || chunkIndex === undefined || !req.file) {
        return res.status(400).json({ error: 'Missing required note chunk parameters.' });
      }
      const idx = parseInt(chunkIndex, 10);
      const total = parseInt(totalChunks, 10);
      const size = parseInt(totalSize, 10);

      const result = await appendChunkToAssembly(uploadId, idx, total, size, req.file.path);
      return res.json({
        success: true,
        chunkIndex: idx,
        totalChunks: total,
        bytesReceived: result.bytesReceived,
      });
    } catch (err: any) {
      if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
      }
      const status = err.message && err.message.includes('60 MB') ? 413 : 500;
      return res.status(status).json({ error: err.message || 'Error processing note chunk.' });
    }
  }
);

// 3c. Complete Chunked Note Upload (Admin Only - Assembles and creates note record)
app.post(
  '/api/notes/complete-chunk-upload',
  requireAdmin,
  async (req, res) => {
    try {
      const {
        uploadId,
        title,
        subjectName,
        subjectCode,
        btechYear,
        semester,
        description,
        originalFilename,
        totalSize,
      } = req.body;

      if (!uploadId) return res.status(400).json({ error: 'Upload ID is required.' });
      if (!title || !title.trim()) return res.status(400).json({ error: 'Note title is required.' });
      if (!subjectName || !subjectName.trim()) return res.status(400).json({ error: 'Subject name is required.' });
      if (!btechYear || !btechYear.trim()) return res.status(400).json({ error: 'B.Tech year is required.' });
      if (!semester || !semester.trim()) return res.status(400).json({ error: 'Semester is required.' });

      const { diskFilename, actualSize } = finalizeAssembly(uploadId, originalFilename || 'note.pdf', totalSize ? parseInt(totalSize, 10) : undefined);

      const uploaderTitle = req.user?.role === 'admin' ? 'Office of Academic Dean' : (req.user?.name || 'Department Faculty');

      const newNote: Note = {
        id: `note-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        title: title.trim(),
        subjectName: subjectName.trim(),
        subjectCode: (subjectCode || 'N/A').trim().toUpperCase(),
        btechYear: btechYear.trim(),
        semester: semester.trim(),
        description: description ? description.trim() : '',
        filename: diskFilename,
        originalFilename: originalFilename || diskFilename,
        fileSize: actualSize,
        fileSizeFormatted: formatBytes(actualSize),
        uploadedAt: new Date().toISOString(),
        uploadedBy: uploaderTitle,
        downloadsCount: 0,
        viewsCount: 0,
      };

      const db = readDb();
      if (!db.notes) db.notes = [];
      db.notes.unshift(newNote);
      writeDb(db);

      if (isSupabaseConfigured()) {
        const assembledFilePath = path.join(UPLOADS_DIR, newNote.filename);
        try {
          const buf = await fs.promises.readFile(assembledFilePath);
          const uploadResult = await uploadPdfToStorage(`notes/${newNote.filename}`, buf);
          if (!uploadResult.success) {
            console.error('[SUPABASE] Note chunked storage upload error:', uploadResult.error);
            return res.status(500).json({ error: uploadResult.error || 'Failed to upload chunked note PDF to Supabase Storage.' });
          }
          await persistNoteToSupabase(newNote);
        } catch (readOrUploadErr: any) {
          console.error('[SUPABASE] Note chunked commit upload error:', readOrUploadErr);
          return res.status(500).json({ error: readOrUploadErr.message || 'Failed to persist chunked note to Supabase.' });
        }
      }

      return res.status(201).json(newNote);
    } catch (err: any) {
      console.error('Error completing chunked note upload:', err);
      const status = err.message && err.message.includes('60 MB') ? 413 : 500;
      return res.status(status).json({ error: err.message || 'Failed to finalize note upload.' });
    }
  }
);

// Helper to stream note PDF for browser inline viewing or attachment download
async function streamNotePdf(req: express.Request, res: express.Response, asAttachment: boolean = false) {
  const noteId = req.params.id;
  const db = readDb();
  const note = (db.notes || []).find(n => n.id === noteId);
  if (!note) {
    return res.status(404).json({ error: 'Note record not found in repository.' });
  }

  // Only increment counters on initial view or download request, not on HEAD or Range chunks
  const isHead = req.method === 'HEAD';
  const isSubsequentChunk = Boolean(req.headers.range && !req.headers.range.startsWith('bytes=0-'));
  if (!isHead && !isSubsequentChunk) {
    if (asAttachment) {
      note.downloadsCount = (note.downloadsCount || 0) + 1;
    } else {
      note.viewsCount = (note.viewsCount || 0) + 1;
    }
    writeDb(db);
  }

  const safeFilename = path.basename(note.filename);
  const filePath = path.resolve(UPLOADS_DIR, safeFilename);

  // Verify file existence and integrity, self-heal if missing or corrupted 0-page stub
  let needsHeal = false;
  if (!fs.existsSync(filePath)) {
    needsHeal = true;
  } else {
    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      needsHeal = true;
    } else if (stat.size < 300) {
      try {
        const head = fs.readFileSync(filePath, 'utf8');
        if (head.includes('/Count 0') || !head.startsWith('%PDF')) {
          needsHeal = true;
        }
      } catch {
        needsHeal = true;
      }
    }
  }

  // First attempt to restore from Supabase Storage before falling back to synthesize
  if (needsHeal && isSupabaseConfigured()) {
    try {
      const cloud = await downloadPdfFromStorage(`notes/${note.filename}`);
      if (cloud.buffer && cloud.buffer.length > 0) {
        fs.writeFileSync(filePath, cloud.buffer);
        note.fileSize = cloud.buffer.length;
        note.fileSizeFormatted = formatBytes(cloud.buffer.length);
        writeDb(db);
        needsHeal = false;
        console.log(`[SUPABASE STORAGE] Restored note ${note.id} (${note.filename}) from cloud bucket -> ${cloud.buffer.length} bytes`);
      }
    } catch (e) {
      console.warn(`[SUPABASE STORAGE] Could not restore note ${note.id} from cloud:`, e);
    }
  }

  if (needsHeal) {
    try {
      const newBuf = generateSampleNotePdfBuffer(note.title, note.subjectName, note.subjectCode, note.btechYear, note.semester);
      fs.writeFileSync(filePath, newBuf);
      note.fileSize = newBuf.length;
      note.fileSizeFormatted = formatBytes(newBuf.length);
      writeDb(db);
      console.log(`[STORAGE] Self-healed valid multi-page PDF for note ${note.id} (${note.title}) -> ${newBuf.length} bytes`);
    } catch (e) {
      console.error(`Failed to heal note PDF for ${note.id}:`, e);
      return res.status(500).json({ error: 'Stored note PDF file could not be read or synthesized.' });
    }
  }

  try {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    if (fileSize === 0) {
      return res.status(500).json({ error: 'Stored note PDF file is empty (0 bytes).' });
    }

    const headerBuf = Buffer.alloc(5);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, headerBuf, 0, 5, 0);
    fs.closeSync(fd);
    if (!headerBuf.toString('utf8').startsWith('%PDF')) {
      return res.status(500).json({ error: 'Stored file is not an authentic PDF document.' });
    }

    const { safeAscii, utf8Encoded } = getSafePdfFilenames(note.originalFilename, `${note.subjectCode}-Notes.pdf`);
    const dispositionType = asAttachment ? 'attachment' : 'inline';

    console.log(`[PDF SERVE NOTE] requested ID: ${noteId}, resolved path: ${filePath}, file existence: ${fs.existsSync(filePath)}, actual file size: ${fileSize}, Content-Type: application/pdf, Content-Length: ${fileSize}`);

    const rangeHeader = req.headers.range;
    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      let start: number;
      let end: number;

      if (parts[0] === '') {
        const suffixLength = parseInt(parts[1], 10);
        if (isNaN(suffixLength) || suffixLength <= 0) {
          res.setHeader('Content-Range', `bytes */${fileSize}`);
          return res.status(416).json({ error: 'Requested Range Not Satisfiable' });
        }
        start = Math.max(0, fileSize - suffixLength);
        end = fileSize - 1;
      } else {
        start = parseInt(parts[0], 10);
        end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      }

      if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).json({ error: 'Requested Range Not Satisfiable' });
      }

      const chunkSize = (end - start) + 1;
      res.status(206);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize.toString());
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeAscii}"; filename*=UTF-8''${utf8Encoded}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Disposition');
      res.setHeader('Cache-Control', asAttachment ? 'private, no-cache, no-store, must-revalidate' : 'public, max-age=3600');

      if (req.method === 'HEAD') {
        return res.end();
      }

      const fileStream = fs.createReadStream(filePath, { start, end });
      fileStream.on('error', (streamErr) => {
        console.error('File stream range error for Note PDF:', streamErr);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream requested note PDF byte range.' });
        } else {
          res.destroy();
        }
      });
      req.on('close', () => {
        fileStream.destroy();
      });
      return fileStream.pipe(res);
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', fileSize.toString());
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeAscii}"; filename*=UTF-8''${utf8Encoded}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Disposition');
    res.setHeader('Cache-Control', asAttachment ? 'private, no-cache, no-store, must-revalidate' : 'public, max-age=3600');

    if (req.method === 'HEAD') {
      return res.end();
    }

    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (streamErr) => {
      console.error('File stream error for Note PDF:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream note PDF document.' });
      } else {
        res.destroy();
      }
    });

    req.on('close', () => {
      fileStream.destroy();
    });

    fileStream.pipe(res);
  } catch (err: any) {
    console.error('Error serving note PDF:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Error loading note document.' });
    }
  }
}

// 4. View Note PDF in Browser (Inline)
app.get([
  '/api/notes/view/:id',
  '/api/notes/:id/pdf',
  '/api/notes/:id/view',
], (req, res) => {
  streamNotePdf(req, res, false);
});

// 5. Download Note PDF as Attachment
app.get([
  '/api/notes/download/:id',
  '/api/notes/:id/download',
], (req, res) => {
  streamNotePdf(req, res, true);
});

// 6. Delete Note (Admin Authorization Required)
app.delete('/api/notes/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const noteId = req.params.id;
  if (!noteId || typeof noteId !== 'string') {
    return res.status(400).json({ error: 'Valid note ID is required.' });
  }

  if (!db.notes) {
    db.notes = [];
  }

  const noteIndex = db.notes.findIndex(n => n.id === noteId);
  if (noteIndex === -1) {
    return res.status(404).json({ error: 'Note not found in repository.' });
  }

  const note = db.notes[noteIndex];

  // Remove physical PDF file from disk storage (/data/uploads) if not referenced by any question paper
  if (note.filename) {
    const filePath = path.resolve(UPLOADS_DIR, note.filename);
    const isUsedByPaper = (db.papers || []).some(p => p.filename === note.filename);
    if (!isUsedByPaper && filePath.startsWith(UPLOADS_DIR) && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error(`Could not delete note file from disk (${filePath}):`, e);
      }
    }
  }

  // Remove record from db.notes
  db.notes.splice(noteIndex, 1);
  writeDb(db);

  if (isSupabaseConfigured()) {
    deletePdfFromStorage(`notes/${note.filename}`).catch(() => {});
    getSupabase()?.from('notes').delete().eq('id', noteId).then(() => {}, () => {});
  }

  return res.json({
    success: true,
    message: `Note "${note.title}" (${note.subjectCode}) permanently deleted from repository and storage.`,
    id: noteId,
  });
});

// --- 8. Subjects Management (Authentication Required) ---
app.get('/api/subjects', requireAuth, (_req, res) => {
  const db = readDb();
  res.json(db.subjects);
});

app.post('/api/subjects', requireAdmin, (req, res) => {
  const db = readDb();
  const { name, code, department, btechYear, semester, credits } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'Subject name and code are required.' });
  }

  const newSubject: Subject = {
    id: `sub-${Date.now()}`,
    name: name.trim(),
    code: code.trim().toUpperCase(),
    department: department ? department.trim() : 'Computer Science & Engineering',
    btechYear: btechYear || '1st Year',
    semester: semester || 'Semester 1',
    credits: parseInt(credits) || 4,
  };

  db.subjects.push(newSubject);
  writeDb(db);

  if (isSupabaseConfigured()) {
    getSupabase()?.from('subjects').upsert({
      id: newSubject.id,
      name: newSubject.name,
      code: newSubject.code,
      paper_count: 0
    }).then(() => {}, () => {});
  }

  res.status(201).json(newSubject);
});

app.delete('/api/subjects/:id', requireAdmin, (req, res) => {
  const db = readDb();
  db.subjects = db.subjects.filter(s => s.id !== req.params.id);
  writeDb(db);

  if (isSupabaseConfigured()) {
    getSupabase()?.from('subjects').delete().eq('id', req.params.id).then(() => {}, () => {});
  }

  res.json({ success: true });
});

// --- 9. Academic Years Management (Authentication Required) ---
app.get('/api/years', requireAuth, (_req, res) => {
  const db = readDb();
  res.json(db.years);
});

app.post('/api/years', requireAdmin, (req, res) => {
  const db = readDb();
  const { year } = req.body;
  if (!year || !year.trim()) {
    return res.status(400).json({ error: 'Year is required.' });
  }
  const cleanYear = year.trim();
  if (!db.years.includes(cleanYear)) {
    db.years.unshift(cleanYear);
    db.years.sort((a, b) => b.localeCompare(a));
    writeDb(db);

    if (isSupabaseConfigured()) {
      getSupabase()?.from('system_settings').upsert({ key: 'years', value: db.years }).then(() => {}, () => {});
    }
  }
  res.status(201).json(db.years);
});

app.delete('/api/years/:year', requireAdmin, (req, res) => {
  const db = readDb();
  db.years = db.years.filter(y => y !== req.params.year);
  writeDb(db);

  if (isSupabaseConfigured()) {
    getSupabase()?.from('system_settings').upsert({ key: 'years', value: db.years }).then(() => {}, () => {});
  }

  res.json({ success: true, years: db.years });
});

// --- 10. Exam Types Management (Authentication Required) ---
app.get('/api/exam-types', requireAuth, (_req, res) => {
  const db = readDb();
  res.json(db.examTypes);
});

app.post('/api/exam-types', requireAdmin, (req, res) => {
  const db = readDb();
  const { typeName } = req.body;
  if (!typeName || !typeName.trim()) {
    return res.status(400).json({ error: 'Exam Type name is required.' });
  }
  const clean = typeName.trim();
  if (!db.examTypes.includes(clean)) {
    db.examTypes.push(clean);
    writeDb(db);

    if (isSupabaseConfigured()) {
      getSupabase()?.from('system_settings').upsert({ key: 'examTypes', value: db.examTypes }).then(() => {}, () => {});
    }
  }
  res.status(201).json(db.examTypes);
});

app.delete('/api/exam-types/:type', requireAdmin, (req, res) => {
  const db = readDb();
  db.examTypes = db.examTypes.filter(t => t.toLowerCase() !== req.params.type.toLowerCase());
  writeDb(db);

  if (isSupabaseConfigured()) {
    getSupabase()?.from('system_settings').upsert({ key: 'examTypes', value: db.examTypes }).then(() => {}, () => {});
  }

  res.json({ success: true, examTypes: db.examTypes });
});

// --- 11. Real Authentication & Session Endpoints ---

// Get current session user (Student or Admin)
app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No active session or session expired.' });
  }

  const db = readDb();
  if (req.user.role === 'admin') {
    const admin = db.admins.find(a => a.id === req.user!.userId);
    if (!admin) {
      return res.status(401).json({ error: 'Admin record not found.' });
    }
    return res.json({
      role: 'admin',
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        department: admin.department,
      },
    });
  } else {
    const student = db.students.find(s => s.id === req.user!.userId);
    if (!student) {
      return res.status(401).json({ error: 'Student record not found.' });
    }
    if (student.status === 'disabled') {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-session-token'] as string);
      if (token && db.sessions[token]) {
        delete db.sessions[token];
        writeDb(db);
      }
      return res.status(403).json({ error: 'Your student account has been disabled by the university administration.' });
    }
    const { passwordHash: _, salt: __, resetToken: ___, resetTokenExpires: ____, ...safeStudent } = student;
    return res.json({
      role: 'student',
      user: {
        ...safeStudent,
        status: student.status || 'active',
        authMethod: student.authMethod || (student.email?.includes('google') ? 'google' : 'email'),
      },
    });
  }
});

// Student Sign Up with secure scrypt hashing
app.post('/api/auth/student-signup', (req, res) => {
  const db = readDb();
  const { name, email, password, year, semester } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Full name is required.' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'College email is required.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.students.find(s => s.email.toLowerCase() === normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this college email already exists. Please sign in.' });
  }

  // Hash password using crypto scrypt with random 16-byte salt
  const { salt, hash } = hashPassword(password);

  const newStudent: StudentUser = {
    id: `stu-${Date.now()}`,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hash,
    salt,
    year: year || '1st Year',
    semester: semester || 'Semester 1',
    role: 'student',
    createdAt: new Date().toISOString(),
    bookmarks: [],
    savedPapers: [],
    recentDownloads: [],
    authMethod: 'email',
    status: 'active',
  };

  db.students.push(newStudent);

  // Generate authenticated session token
  const token = createSessionToken();
  const session: UserSession = {
    token,
    userId: newStudent.id,
    role: 'student',
    email: newStudent.email,
    name: newStudent.name,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    rememberMe: true,
    createdAt: new Date().toISOString(),
  };

  db.sessions[token] = session;
  writeDb(db);

  if (isSupabaseConfigured()) {
    persistStudentToSupabase(newStudent).catch(e => console.error('[SUPABASE] Failed to persist student:', e));
    persistSessionToSupabase(session).catch(e => console.error('[SUPABASE] Failed to persist session:', e));
  }

  const { passwordHash: _, salt: __, ...safeUser } = newStudent;
  res.status(201).json({
    success: true,
    token,
    user: safeUser,
  });
});

// Student Login with cryptographic hash verification
app.post('/api/auth/student-login', (req, res) => {
  const db = readDb();
  const { email, password, rememberMe } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Both email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const student = db.students.find(s => s.email.toLowerCase() === normalizedEmail);

  if (!student) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const isValid = verifyPassword(password, student.salt, student.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Check if student account is disabled by admin
  if (student.status === 'disabled') {
    return res.status(403).json({
      error: 'Your student account has been disabled by the university administration. Please contact the Office of the Controller of Examinations.',
    });
  }

  // Issue session token
  const token = createSessionToken();
  const isRemember = Boolean(rememberMe);
  const durationMs = isRemember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  const session: UserSession = {
    token,
    userId: student.id,
    role: 'student',
    email: student.email,
    name: student.name,
    expiresAt: Date.now() + durationMs,
    rememberMe: isRemember,
    createdAt: new Date().toISOString(),
  };

  db.sessions[token] = session;
  writeDb(db);

  if (isSupabaseConfigured()) {
    persistSessionToSupabase(session).catch(e => console.error('[SUPABASE] Failed to persist session:', e));
  }

  const { passwordHash: _, salt: __, resetToken: ___, resetTokenExpires: ____, ...safeUser } = student;
  res.json({
    success: true,
    token,
    user: safeUser,
  });
});

// Admin Login verified against database admin credentials
app.post('/api/auth/admin-login', (req, res) => {
  const db = readDb();
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Administrator email and security key are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const admin = db.admins.find(a => a.email.toLowerCase() === normalizedEmail);

  if (!admin) {
    return res.status(401).json({ error: 'Invalid administrator credentials.' });
  }

  const isValid = verifyPassword(password, admin.salt, admin.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid administrator credentials.' });
  }

  // Create real admin session token
  const token = createSessionToken();
  const session: UserSession = {
    token,
    userId: admin.id,
    role: 'admin',
    email: admin.email,
    name: admin.name,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    rememberMe: true,
    createdAt: new Date().toISOString(),
  };

  db.sessions[token] = session;
  writeDb(db);

  if (isSupabaseConfigured()) {
    persistSessionToSupabase(session).catch(e => console.error('[SUPABASE] Failed to persist session:', e));
  }

  res.json({
    success: true,
    token,
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      department: admin.department,
    },
  });
});

// Logout destroys the authenticated session in database
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-session-token'] as string);

  if (token) {
    const db = readDb();
    if (db.sessions && db.sessions[token]) {
      delete db.sessions[token];
      writeDb(db);
    }
    if (isSupabaseConfigured()) {
      removeSessionFromSupabase(token).catch(e => console.error('[SUPABASE] Failed to remove session:', e));
    }
  }

  res.json({ success: true, message: 'Session terminated successfully.' });
});

// Real Password Reset Request (Generates cryptographic 6-digit verification code)
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'College email is required.' });
  }

  const db = readDb();
  const normalizedEmail = email.trim().toLowerCase();
  const student = db.students.find(s => s.email.toLowerCase() === normalizedEmail);

  if (!student) {
    return res.status(404).json({ error: 'No account registered with this college email address.' });
  }

  const resetCode = crypto.randomInt(100000, 999999).toString();
  student.resetToken = resetCode;
  student.resetTokenExpires = Date.now() + 15 * 60 * 1000; // 15 mins expiry

  writeDb(db);

  res.json({
    success: true,
    message: `Verification code generated for ${normalizedEmail}.`,
    resetCode,
  });
});

// Real Password Reset Confirmation
app.post('/api/auth/reset-password', (req, res) => {
  const { email, resetCode, newPassword } = req.body;

  if (!email || !resetCode || !newPassword) {
    return res.status(400).json({ error: 'Email, verification code, and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const db = readDb();
  const student = db.students.find(s => s.email.toLowerCase() === email.trim().toLowerCase());

  if (!student || !student.resetToken || student.resetToken !== resetCode.trim()) {
    return res.status(400).json({ error: 'Invalid or expired verification code.' });
  }

  if (student.resetTokenExpires && student.resetTokenExpires < Date.now()) {
    return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
  }

  const { salt, hash } = hashPassword(newPassword);
  student.passwordHash = hash;
  student.salt = salt;
  delete student.resetToken;
  delete student.resetTokenExpires;

  writeDb(db);

  res.json({
    success: true,
    message: 'Password reset successfully. You can now log in with your new password.',
  });
});

// Google OAuth configuration endpoint
app.get('/api/auth/config', (_req, res) => {
  let googleClientId = process.env.VITE_GOOGLE_CLIENT_ID || '';
  if (!googleClientId) {
    try {
      const configPath = path.join(__dirname, 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        googleClientId = cfg.oAuthClientId || '';
      }
    } catch (e) {
      // ignore
    }
  }
  res.json({
    googleClientId,
  });
});

// Real Google OAuth verification endpoint
app.post('/api/auth/google', async (req, res) => {
  const { credential, accessToken } = req.body;

  if (!credential && !accessToken) {
    return res.status(400).json({ error: 'Google authentication credential is required.' });
  }

  try {
    let googleUser: { email: string; name: string } | null = null;

    if (credential) {
      // Decode and verify Google ID token
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (googleRes.ok) {
        const payload = await googleRes.json();
        if (payload.email) {
          googleUser = {
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
          };
        }
      } else {
        // Fallback safely parse JWT token parts
        const parts = credential.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
          if (payload.email) {
            googleUser = {
              email: payload.email,
              name: payload.name || payload.email.split('@')[0],
            };
          }
        }
      }
    } else if (accessToken) {
      const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (googleRes.ok) {
        const payload = await googleRes.json();
        if (payload.email) {
          googleUser = {
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
          };
        }
      }
    }

    if (!googleUser || !googleUser.email) {
      return res.status(401).json({ error: 'Failed to verify Google Workspace credential.' });
    }

    const db = readDb();
    const normalizedEmail = googleUser.email.trim().toLowerCase();
    let student = db.students.find(s => s.email.toLowerCase() === normalizedEmail);

    if (student) {
      if (student.status === 'disabled') {
        return res.status(403).json({
          error: 'Your student account has been disabled by the university administration. Please contact the Office of the Controller of Examinations.',
        });
      }
    } else {
      const dummySecret = crypto.randomBytes(24).toString('hex');
      const { salt, hash } = hashPassword(dummySecret);

      student = {
        id: `stu-${Date.now()}`,
        name: googleUser.name,
        email: normalizedEmail,
        passwordHash: hash,
        salt,
        year: '1st Year',
        semester: 'Semester 1',
        role: 'student',
        createdAt: new Date().toISOString(),
        bookmarks: [],
        savedPapers: [],
        recentDownloads: [],
        authMethod: 'google',
        status: 'active',
      };
      db.students.push(student);

      if (isSupabaseConfigured()) {
        persistStudentToSupabase(student).catch(e => console.error('[SUPABASE] Failed to persist google student:', e));
      }
    }

    // Issue real session
    const token = createSessionToken();
    const session: UserSession = {
      token,
      userId: student.id,
      role: 'student',
      email: student.email,
      name: student.name,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      rememberMe: true,
      createdAt: new Date().toISOString(),
    };

    db.sessions[token] = session;
    writeDb(db);

    if (isSupabaseConfigured()) {
      persistSessionToSupabase(session).catch(e => console.error('[SUPABASE] Failed to persist session:', e));
    }

    const { passwordHash: _, salt: __, resetToken: ___, resetTokenExpires: ____, ...safeUser } = student;
    res.json({
      success: true,
      token,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: err.message || 'Google authentication failed.' });
  }
});

// --- 11b. Student Persistent Archive Endpoints ---

// Get student resolved archive (Saved Papers + Recent Downloads)
app.get('/api/student/archive', requireAuth, (req, res) => {
  const db = readDb();
  const student = db.students.find(s => s.id === req.user!.userId);
  if (!student) {
    return res.status(404).json({ error: 'Student account not found.' });
  }

  if (!Array.isArray(student.savedPapers)) student.savedPapers = [];
  if (!Array.isArray(student.recentDownloads)) student.recentDownloads = [];

  // Resolve saved papers against db.papers
  const savedPapers = student.savedPapers.map(entry => {
    const paper = db.papers.find(p => p.id === entry.paperId);
    if (paper) {
      return {
        paperId: entry.paperId,
        savedAt: entry.savedAt,
        isAvailable: true,
        paper,
        pdfUrl: `/api/papers/view/${paper.id}`,
        downloadUrl: `/api/papers/download/${paper.id}`,
      };
    } else {
      // Paper deleted by admin: handled safely without crashing (Requirement 10)
      return {
        paperId: entry.paperId,
        savedAt: entry.savedAt,
        isAvailable: false,
        paper: null,
      };
    }
  });

  // Resolve saved notes against db.notes
  if (!Array.isArray(student.savedNotes)) student.savedNotes = [];
  const savedNotes = student.savedNotes.map(entry => {
    const note = (db.notes || []).find(n => n.id === entry.noteId);
    if (note) {
      return {
        noteId: entry.noteId,
        savedAt: entry.savedAt,
        isAvailable: true,
        note,
        pdfUrl: `/api/notes/view/${note.id}`,
        downloadUrl: `/api/notes/download/${note.id}`,
      };
    } else {
      return {
        noteId: entry.noteId,
        savedAt: entry.savedAt,
        isAvailable: false,
        note: null,
      };
    }
  });

  // Resolve recent downloads against db.papers and db.notes
  const recentDownloads = (student.recentDownloads || []).map((entry: any) => {
    const isNote = entry.itemType === 'note' || Boolean(entry.noteId) || (typeof entry.paperId === 'string' && entry.paperId.startsWith('note-'));
    if (isNote) {
      const noteId = entry.noteId || entry.paperId;
      const note = (db.notes || []).find(n => n.id === noteId);
      return {
        paperId: noteId,
        noteId,
        downloadedAt: entry.downloadedAt,
        itemType: 'note',
        isAvailable: !!note,
        paper: null,
        note: note || null,
        pdfUrl: note ? `/api/notes/view/${note.id}` : null,
        downloadUrl: note ? `/api/notes/download/${note.id}` : null,
      };
    }

    const paper = db.papers.find(p => p.id === entry.paperId);
    return {
      paperId: entry.paperId,
      downloadedAt: entry.downloadedAt,
      itemType: 'paper',
      isAvailable: !!paper,
      paper: paper || null,
      note: null,
      pdfUrl: paper ? `/api/papers/view/${paper.id}` : null,
      downloadUrl: paper ? `/api/papers/download/${paper.id}` : null,
    };
  });

  res.json({
    savedPapers,
    savedNotes,
    recentDownloads,
    totalSaved: savedPapers.length,
    totalSavedNotes: savedNotes.length,
    totalDownloads: recentDownloads.length,
  });
});

// Save paper to persistent archive (Prevent duplicate entries)
app.post('/api/student/archive/save', requireAuth, (req, res) => {
  const db = readDb();
  const { paperId } = req.body;
  if (!paperId) {
    return res.status(400).json({ error: 'Paper ID is required.' });
  }

  const student = db.students.find(s => s.id === req.user!.userId);
  if (!student) {
    return res.status(404).json({ error: 'Student account not found.' });
  }

  if (!Array.isArray(student.savedPapers)) student.savedPapers = [];
  if (!Array.isArray(student.bookmarks)) student.bookmarks = [];

  const exists = student.savedPapers.some(p => p.paperId === paperId);
  if (!exists) {
    student.savedPapers.unshift({
      paperId,
      savedAt: new Date().toISOString(),
    });
  }
  if (!student.bookmarks.includes(paperId)) {
    student.bookmarks.push(paperId);
  }

  writeDb(db);

  if (isSupabaseConfigured()) {
    persistSavedPaperToggle(student.id, paperId, true).catch(e => console.error('[SUPABASE] Save paper toggle error:', e));
  }

  res.json({
    success: true,
    isSaved: true,
    isBookmarked: true,
    savedPapers: student.savedPapers,
    bookmarks: student.bookmarks,
  });
});

// Remove paper from persistent archive
app.post('/api/student/archive/remove', requireAuth, (req, res) => {
  const db = readDb();
  const { paperId } = req.body;
  if (!paperId) {
    return res.status(400).json({ error: 'Paper ID is required.' });
  }

  const student = db.students.find(s => s.id === req.user!.userId);
  if (!student) {
    return res.status(404).json({ error: 'Student account not found.' });
  }

  if (Array.isArray(student.savedPapers)) {
    student.savedPapers = student.savedPapers.filter(p => p.paperId !== paperId);
  }
  if (Array.isArray(student.bookmarks)) {
    student.bookmarks = student.bookmarks.filter(id => id !== paperId);
  }

  writeDb(db);

  if (isSupabaseConfigured()) {
    persistSavedPaperToggle(student.id, paperId, false).catch(e => console.error('[SUPABASE] Remove paper toggle error:', e));
  }

  res.json({
    success: true,
    isSaved: false,
    isBookmarked: false,
    savedPapers: student.savedPapers,
    bookmarks: student.bookmarks,
  });
});

// Toggle Archive status (Saves if not present, removes if present)
app.post('/api/student/archive/toggle', requireAuth, (req, res) => {
  const db = readDb();
  const { paperId } = req.body;
  if (!paperId) {
    return res.status(400).json({ error: 'Paper ID is required.' });
  }

  const student = db.students.find(s => s.id === req.user!.userId);
  if (!student) {
    return res.status(404).json({ error: 'Student account not found.' });
  }

  if (!Array.isArray(student.savedPapers)) student.savedPapers = [];
  if (!Array.isArray(student.bookmarks)) student.bookmarks = [];

  const isSaved = student.savedPapers.some(p => p.paperId === paperId);
  if (isSaved) {
    student.savedPapers = student.savedPapers.filter(p => p.paperId !== paperId);
    student.bookmarks = student.bookmarks.filter(id => id !== paperId);
  } else {
    student.savedPapers.unshift({
      paperId,
      savedAt: new Date().toISOString(),
    });
    if (!student.bookmarks.includes(paperId)) {
      student.bookmarks.push(paperId);
    }
  }

  writeDb(db);

  if (isSupabaseConfigured()) {
    persistSavedPaperToggle(student.id, paperId, !isSaved).catch(e => console.error('[SUPABASE] Toggle paper error:', e));
  }

  res.json({
    success: true,
    isSaved: !isSaved,
    isBookmarked: !isSaved,
    savedPapers: student.savedPapers,
    bookmarks: student.bookmarks,
  });
});

// Bookmarks toggle (maintains backward compatibility and keeps savedPapers in sync)
app.post('/api/student/bookmarks/toggle', requireAuth, (req, res) => {
  const db = readDb();
  const { paperId } = req.body;

  const student = db.students.find(s => s.id === req.user!.userId);
  if (!student) {
    return res.status(404).json({ error: 'Student account not found.' });
  }

  if (!Array.isArray(student.savedPapers)) student.savedPapers = [];
  if (!Array.isArray(student.bookmarks)) student.bookmarks = [];

  const isBookmarked = student.savedPapers.some(p => p.paperId === paperId) || student.bookmarks.includes(paperId);
  if (isBookmarked) {
    student.savedPapers = student.savedPapers.filter(p => p.paperId !== paperId);
    student.bookmarks = student.bookmarks.filter(id => id !== paperId);
  } else {
    student.savedPapers.unshift({
      paperId,
      savedAt: new Date().toISOString(),
    });
    if (!student.bookmarks.includes(paperId)) {
      student.bookmarks.push(paperId);
    }
  }

  writeDb(db);

  if (isSupabaseConfigured()) {
    persistSavedPaperToggle(student.id, paperId, !isBookmarked).catch(e => console.error('[SUPABASE] Toggle bookmark error:', e));
  }

  res.json({
    bookmarks: student.bookmarks,
    savedPapers: student.savedPapers,
    isBookmarked: !isBookmarked,
    isSaved: !isBookmarked,
  });
});

// Record Student Download (Authentication Required)
// Automatically saves to student's archive record without duplicates for both Papers and Notes
app.post('/api/student/downloads/record', requireAuth, (req, res) => {
  const db = readDb();
  const { paperId, noteId, type } = req.body;
  const isNote = type === 'note' || Boolean(noteId) || (typeof paperId === 'string' && paperId.startsWith('note-'));
  const targetId = isNote ? (noteId || paperId) : paperId;

  if (req.user) {
    const student = db.students.find(s => s.id === req.user!.userId);
    if (student) {
      if (!Array.isArray(student.recentDownloads)) student.recentDownloads = [];
      if (!Array.isArray(student.savedPapers)) student.savedPapers = [];
      if (!Array.isArray(student.savedNotes)) student.savedNotes = [];
      if (!Array.isArray(student.bookmarks)) student.bookmarks = [];

      let alreadyArchived = false;
      if (isNote) {
        // Record in recent downloads
        student.recentDownloads.unshift({
          paperId: targetId,
          noteId: targetId,
          itemType: 'note',
          downloadedAt: new Date().toISOString(),
        });
        student.recentDownloads = student.recentDownloads.slice(0, 50);

        // Also automatically save to student's archive record without duplicates
        const alreadySavedNote = student.savedNotes.some(n => n.noteId === targetId);
        alreadyArchived = alreadySavedNote;
        if (!alreadySavedNote) {
          student.savedNotes.unshift({
            noteId: targetId,
            savedAt: new Date().toISOString(),
          });
        }
      } else {
        // Record in recent downloads
        student.recentDownloads.unshift({
          paperId: targetId,
          itemType: 'paper',
          downloadedAt: new Date().toISOString(),
        });
        student.recentDownloads = student.recentDownloads.slice(0, 50);

        // Save to student's archive record without duplicates
        const alreadySaved = student.savedPapers.some(p => p.paperId === targetId);
        alreadyArchived = alreadySaved;
        if (!alreadySaved) {
          student.savedPapers.unshift({
            paperId: targetId,
            savedAt: new Date().toISOString(),
          });
        }
        if (!student.bookmarks.includes(targetId)) {
          student.bookmarks.push(targetId);
        }
      }

      writeDb(db);

      if (isSupabaseConfigured()) {
        persistRecentDownload(student.id, isNote ? 'note' : 'paper', targetId).catch(e => console.error('[SUPABASE] Record download error:', e));
        if (isNote && !alreadyArchived) {
          persistSavedNoteToggle(student.id, targetId, true).catch(e => console.error('[SUPABASE] Auto-archive note error:', e));
        } else if (!isNote && !alreadyArchived) {
          persistSavedPaperToggle(student.id, targetId, true).catch(e => console.error('[SUPABASE] Auto-archive paper error:', e));
        }
      }

      return res.json({
        success: true,
        alreadyArchived,
        savedPapers: student.savedPapers,
        savedNotes: student.savedNotes,
        bookmarks: student.bookmarks,
        recentDownloads: student.recentDownloads,
      });
    }
  }

  res.json({ success: true });
});

// Save note to student archive
app.post('/api/student/archive/notes/save', requireAuth, (req, res) => {
  const db = readDb();
  const { noteId } = req.body;
  if (!noteId) return res.status(400).json({ error: 'Note ID is required.' });

  const student = db.students.find(s => s.id === req.user!.userId);
  if (!student) return res.status(404).json({ error: 'Student account not found.' });

  if (!Array.isArray(student.savedNotes)) student.savedNotes = [];
  const exists = student.savedNotes.some(n => n.noteId === noteId);
  if (!exists) {
    student.savedNotes.unshift({
      noteId,
      savedAt: new Date().toISOString(),
    });
  }

  writeDb(db);

  if (isSupabaseConfigured()) {
    persistSavedNoteToggle(student.id, noteId, true).catch(e => console.error('[SUPABASE] Save note archive error:', e));
  }

  res.json({
    success: true,
    isSaved: true,
    savedNotes: student.savedNotes,
  });
});

// Remove note from student archive
app.post('/api/student/archive/notes/remove', requireAuth, (req, res) => {
  const db = readDb();
  const { noteId } = req.body;
  if (!noteId) return res.status(400).json({ error: 'Note ID is required.' });

  const student = db.students.find(s => s.id === req.user!.userId);
  if (!student) return res.status(404).json({ error: 'Student account not found.' });

  if (Array.isArray(student.savedNotes)) {
    student.savedNotes = student.savedNotes.filter(n => n.noteId !== noteId);
  }

  writeDb(db);

  if (isSupabaseConfigured()) {
    persistSavedNoteToggle(student.id, noteId, false).catch(e => console.error('[SUPABASE] Remove note archive error:', e));
  }

  res.json({
    success: true,
    isSaved: false,
    savedNotes: student.savedNotes,
  });
});

// Toggle note in student archive
app.post('/api/student/archive/notes/toggle', requireAuth, (req, res) => {
  const db = readDb();
  const { noteId } = req.body;
  if (!noteId) return res.status(400).json({ error: 'Note ID is required.' });

  const student = db.students.find(s => s.id === req.user!.userId);
  if (!student) return res.status(404).json({ error: 'Student account not found.' });

  if (!Array.isArray(student.savedNotes)) student.savedNotes = [];
  const exists = student.savedNotes.some(n => n.noteId === noteId);
  if (exists) {
    student.savedNotes = student.savedNotes.filter(n => n.noteId !== noteId);
  } else {
    student.savedNotes.unshift({
      noteId,
      savedAt: new Date().toISOString(),
    });
  }

  writeDb(db);

  if (isSupabaseConfigured()) {
    persistSavedNoteToggle(student.id, noteId, !exists).catch(e => console.error('[SUPABASE] Toggle note archive error:', e));
  }

  res.json({
    success: true,
    isSaved: !exists,
    savedNotes: student.savedNotes,
  });
});

// --- 12. Student Management Endpoints (Admin Only) ---

// Students list with search, filtering, and safe field mapping
app.get('/api/students', requireAdmin, (req, res) => {
  const db = readDb();
  let students = [...db.students];

  const { search, year, semester, status, authMethod } = req.query as Record<string, string | undefined>;

  if (year && year !== 'All') {
    students = students.filter(s => s.year?.toLowerCase() === year.toLowerCase());
  }

  if (semester && semester !== 'All') {
    students = students.filter(s => s.semester?.toLowerCase() === semester.toLowerCase());
  }

  if (status && status !== 'All') {
    students = students.filter(s => (s.status || 'active').toLowerCase() === status.toLowerCase());
  }

  if (authMethod && authMethod !== 'All') {
    students = students.filter(s => {
      const method = s.authMethod || (s.email?.includes('google') ? 'google' : 'email');
      return method.toLowerCase() === authMethod.toLowerCase();
    });
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    students = students.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.year?.toLowerCase().includes(q) ||
        s.semester?.toLowerCase().includes(q)
    );
  }

  // Sort by registration date descending
  students.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Strict security projection: NEVER expose passwordHash, salt, or recovery tokens
  const safeList = students.map(({ passwordHash: _, salt: __, resetToken: ___, resetTokenExpires: ____, ...s }) => ({
    ...s,
    status: s.status || 'active',
    authMethod: s.authMethod || (s.email?.includes('google') ? 'google' : 'email'),
    bookmarksCount: Array.isArray(s.bookmarks) ? s.bookmarks.length : 0,
    downloadsCount: Array.isArray(s.recentDownloads) ? s.recentDownloads.length : 0,
  }));

  res.json(safeList);
});

// Single student details for admin
app.get('/api/students/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const student = db.students.find(s => s.id === req.params.id);

  if (!student) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  const { passwordHash: _, salt: __, resetToken: ___, resetTokenExpires: ____, ...safeStudent } = student;
  res.json({
    ...safeStudent,
    status: student.status || 'active',
    authMethod: student.authMethod || (student.email?.includes('google') ? 'google' : 'email'),
    bookmarksCount: Array.isArray(student.bookmarks) ? student.bookmarks.length : 0,
    downloadsCount: Array.isArray(student.recentDownloads) ? student.recentDownloads.length : 0,
  });
});

// Update student account status (Enable / Disable)
app.patch('/api/students/:id/status', requireAdmin, (req, res) => {
  const db = readDb();
  const { status } = req.body;

  if (status !== 'active' && status !== 'disabled') {
    return res.status(400).json({ error: "Invalid status value. Must be either 'active' or 'disabled'." });
  }

  const student = db.students.find(s => s.id === req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  student.status = status;

  // If disabled: immediately invalidate all active sessions for this student
  if (status === 'disabled') {
    Object.keys(db.sessions).forEach(token => {
      if (db.sessions[token].userId === student.id) {
        delete db.sessions[token];
      }
    });
  }

  writeDb(db);

  if (isSupabaseConfigured()) {
    persistStudentToSupabase(student).catch(e => console.error('[SUPABASE] Status update sync error:', e));
  }

  const { passwordHash: _, salt: __, resetToken: ___, resetTokenExpires: ____, ...safeStudent } = student;
  res.json({
    success: true,
    message: `Student account for ${student.name} has been ${status === 'active' ? 'enabled' : 'disabled'}.`,
    student: {
      ...safeStudent,
      status: student.status,
      authMethod: student.authMethod || (student.email?.includes('google') ? 'google' : 'email'),
      bookmarksCount: Array.isArray(student.bookmarks) ? student.bookmarks.length : 0,
      downloadsCount: Array.isArray(student.recentDownloads) ? student.recentDownloads.length : 0,
    },
  });
});

// Delete student account permanently
app.delete('/api/students/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const idx = db.students.findIndex(s => s.id === req.params.id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  const deletedStudent = db.students[idx];

  // Invalidate any active sessions for this student
  Object.keys(db.sessions).forEach(token => {
    if (db.sessions[token].userId === deletedStudent.id) {
      delete db.sessions[token];
    }
  });

  // Remove student from database
  db.students.splice(idx, 1);
  writeDb(db);

  if (isSupabaseConfigured()) {
    getSupabase()?.from('students').delete().eq('id', req.params.id).then(() => {}, () => {});
  }

  res.json({
    success: true,
    message: `Student account for ${deletedStudent.name} (${deletedStudent.email}) has been permanently deleted.`,
  });
});

// --- 16. Institutional Contact & Direct Email Dispatching (via Resend HTTPS API) ---
const TARGET_CONTACT_EMAIL = process.env.CONTACT_RECIPIENT_EMAIL || 'rqchit2009@gmail.com';
const RESEND_SENDER_ADDRESS = process.env.RESEND_FROM_EMAIL || 'ScholarArchive <onboarding@resend.dev>';

function createResendClient(): Resend {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY is not configured in server environment variables.'
    );
  }
  return new Resend(apiKey);
}

// Contact form submission endpoint (Saves record & dispatches email notification via Resend HTTPS API)
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate Name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Please provide your full name (at least 2 characters).' });
    }
    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Name must be 100 characters or fewer.' });
    }

    // Validate Email
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address (e.g., student@college.edu).' });
    }

    // Validate Subject
    if (!subject || typeof subject !== 'string' || subject.trim().length < 3) {
      return res.status(400).json({ error: 'Subject is required (at least 3 characters).' });
    }
    if (subject.trim().length > 200) {
      return res.status(400).json({ error: 'Subject must be 200 characters or fewer.' });
    }

    // Validate Message
    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return res.status(400).json({ error: 'Message must be at least 10 characters long.' });
    }
    if (message.trim().length > 5000) {
      return res.status(400).json({ error: 'Message cannot exceed 5000 characters.' });
    }

    const cleanName = name.trim();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    const submittedAt = new Date().toISOString();

    // Determine sender profile if user is authenticated
    let senderRole: 'student' | 'admin' | 'public' = 'public';
    let senderAffiliation = 'Public / Prospective Student';
    let studentId: string | undefined = undefined;

    if (req.user) {
      if (req.user.role === 'admin') {
        senderRole = 'admin';
        senderAffiliation = 'Controller of Examinations / Academic Administrator';
      } else if (req.user.role === 'student') {
        senderRole = 'student';
        studentId = req.user.userId;
        const db = readDb();
        const stu = db.students.find(s => s.id === req.user!.userId);
        if (stu) {
          senderAffiliation = `Registered Student (${stu.year}, ${stu.semester})`;
        } else {
          senderAffiliation = 'Registered Student';
        }
      }
    }

    // Format institutional HTML email template
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF8F5; margin: 0; padding: 24px; color: #1C2826; }
    .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5DFD5; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.04); }
    .header { background: #0F5132; color: #FFFFFF; padding: 24px 28px; }
    .header h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 0; font-size: 12px; opacity: 0.9; }
    .content { padding: 28px; }
    .meta-box { background: #F5F1EB; border-left: 4px solid #0F5132; padding: 14px 18px; margin-bottom: 24px; font-size: 13px; line-height: 1.6; }
    .meta-box div { margin-bottom: 4px; }
    .meta-box div:last-child { margin-bottom: 0; }
    .message-box { background: #FAF8F5; border: 1px solid #E5DFD5; border-radius: 6px; padding: 18px; font-size: 14px; line-height: 1.7; white-space: pre-wrap; color: #1C2826; margin-bottom: 24px; }
    .footer { border-top: 1px solid #E5DFD5; padding: 18px 28px; font-size: 11px; color: #5C6F68; text-align: center; background: #FAF8F5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ScholarArchive Digital Archive — New Inquiry</h1>
      <p>Direct institutional contact submission for Office of the Controller of Examinations</p>
    </div>
    <div class="content">
      <div class="meta-box">
        <div><strong>Sender Name:</strong> ${cleanName}</div>
        <div><strong>Sender Email:</strong> <a href="mailto:${cleanEmail}" style="color: #0F5132;">${cleanEmail}</a></div>
        <div><strong>Affiliation:</strong> ${senderAffiliation}</div>
        <div><strong>Date & Time:</strong> ${new Date(submittedAt).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' })}</div>
        <div><strong>Subject:</strong> ${cleanSubject}</div>
      </div>

      <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #0F5132; margin-bottom: 8px;">Inquiry Content:</h3>
      <div class="message-box">${cleanMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>

      <p style="font-size: 12px; color: #5C6F68; margin-bottom: 0;">
        You can reply directly to this email to contact <strong>${cleanName}</strong> at <strong>${cleanEmail}</strong>.
      </p>
    </div>
    <div class="footer">
      This transmission was generated by the ScholarArchive Digital Question-Paper Archive student contact gateway.<br/>
      Destination: ${TARGET_CONTACT_EMAIL} · Autonomous Engineering Institution
    </div>
  </div>
</body>
</html>
    `;

    const emailText = `
ScholarArchive Digital Archive — New Direct Inquiry
--------------------------------------------------
Sender Name: ${cleanName}
Sender Email: ${cleanEmail}
Sender Affiliation: ${senderAffiliation}
Date: ${submittedAt}
Subject: ${cleanSubject}

Message:
${cleanMessage}

--------------------------------------------------
Recipient: ${TARGET_CONTACT_EMAIL}
Reply to: ${cleanEmail}
    `.trim();

    let deliveryStatus: 'delivered' | 'failed' = 'failed';
    let messageId: string | undefined = undefined;
    let deliveryError: string | undefined = undefined;

    try {
      const resend = createResendClient();
      const { data, error } = await resend.emails.send({
        from: RESEND_SENDER_ADDRESS,
        to: [TARGET_CONTACT_EMAIL],
        replyTo: cleanEmail,
        subject: `[ScholarArchive Contact] ${cleanSubject}`,
        text: emailText,
        html: emailHtml,
      });

      if (error) {
        deliveryStatus = 'failed';
        deliveryError = error.message || 'Resend API returned an error';
        console.error('[Contact Service] Resend API email delivery error:', error);
      } else {
        messageId = data?.id;
        deliveryStatus = 'delivered';
        console.log(`[Contact Service] Message delivered successfully to ${TARGET_CONTACT_EMAIL} via Resend API. MessageId: ${messageId}`);
      }
    } catch (mailErr: any) {
      deliveryStatus = 'failed';
      deliveryError = mailErr?.message || 'Resend HTTPS API transmission error';
      console.error('[Contact Service] Resend email delivery exception:', mailErr);
    }

    // Persist to database so message is permanently recorded in institutional records even if email fails
    const db = readDb();
    if (!db.contactMessages) {
      db.contactMessages = [];
    }

    const contactRecord: ContactMessage = {
      id: `msg-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
      recipient: TARGET_CONTACT_EMAIL,
      submittedAt,
      status: deliveryStatus,
      messageId,
      deliveryError,
      senderRole,
      studentId,
    };

    db.contactMessages.unshift(contactRecord);
    writeDb(db);

    if (isSupabaseConfigured()) {
      persistContactMessage(contactRecord).catch(e => console.error('[SUPABASE] Contact message sync error:', e));
    }

    if (deliveryStatus !== 'delivered') {
      return res.status(200).json({
        success: true,
        emailDelivered: false,
        message: 'Your query has been saved in ScholarArchive institutional records, though the instant email notification could not be dispatched at this moment. Our academic desk will review your submission.',
        id: contactRecord.id,
      });
    }

    return res.status(200).json({
      success: true,
      emailDelivered: true,
      message: `Your message has been delivered directly to ${TARGET_CONTACT_EMAIL}. Our academic desk will get back to you shortly.`,
      messageId,
      id: contactRecord.id,
    });
  } catch (err: any) {
    console.error('Error handling contact submission:', err);
    return res.status(500).json({
      error: 'An internal error occurred while processing your message. Please try again or reach out directly to rqchit2009@gmail.com.',
    });
  }
});

// Admin-only: list submitted contact inquiries
app.get('/api/contact/messages', requireAdmin, (_req, res) => {
  const db = readDb();
  res.json(db.contactMessages || []);
});

/* ==========================================================================
   Vite Middleware or Production Static Serving
   ========================================================================== */

async function startServer() {
  const distDir = fs.existsSync(path.join(__dirname, 'dist', 'index.html'))
    ? path.join(__dirname, 'dist')
    : fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))
    ? path.join(process.cwd(), 'dist')
    : null;

  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER) || distDir !== null;

  if (distDir && (isProduction || process.env.NODE_ENV !== 'development')) {
    console.log(`[PRODUCTION] Serving pre-built static client from ${distDir}`);
    app.use(express.static(distDir, {
      maxAge: '1d',
      etag: true,
    }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    console.log('[DEVELOPMENT] Initializing Vite middleware mode...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Academic Archive Server listening on http://0.0.0.0:${PORT}`);
  });

  // Standard keep-alive timeouts for reverse proxies (Render / Cloudflare / Nginx)
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
