import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables for Supabase integration
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'academic-documents';

let supabaseClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_SERVICE_ROLE_KEY &&
    SUPABASE_URL.startsWith('http') &&
    SUPABASE_SERVICE_ROLE_KEY.length > 20
  );
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log(`[SUPABASE] Initialized persistent cloud client -> ${SUPABASE_URL}`);
  }
  return supabaseClient;
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

let bucketVerified = false;

async function ensureStorageBucketExists(sb: SupabaseClient): Promise<void> {
  if (bucketVerified) return;
  try {
    const { data: buckets } = await sb.storage.listBuckets();
    const exists = buckets?.some(b => b.id === SUPABASE_BUCKET || b.name === SUPABASE_BUCKET);
    if (!exists) {
      await sb.storage.createBucket(SUPABASE_BUCKET, {
        public: true,
        fileSizeLimit: 68157440,
        allowedMimeTypes: ['application/pdf', 'application/x-pdf', 'application/octet-stream', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      });
    }
    bucketVerified = true;
  } catch (err) {
    // Non-blocking check
  }
}

export async function uploadPdfToStorage(
  storagePath: string,
  fileBuffer: Buffer,
  contentType: string = 'application/pdf'
): Promise<{ success: boolean; path: string; error?: string }> {
  const sb = getSupabase();
  if (!sb) {
    return { success: false, path: '', error: 'Supabase is not configured' };
  }

  try {
    await ensureStorageBucketExists(sb);

    const { data, error } = await sb.storage
      .from(SUPABASE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error('[SUPABASE STORAGE] Upload error:', error);
      return { success: false, path: '', error: error.message };
    }

    return { success: true, path: data.path };
  } catch (err: any) {
    console.error('[SUPABASE STORAGE] Exception during upload:', err);
    return { success: false, path: '', error: err.message };
  }
}

export async function downloadPdfFromStorage(
  storagePath: string
): Promise<{ buffer: Buffer | null; error?: string }> {
  const sb = getSupabase();
  if (!sb) {
    return { buffer: null, error: 'Supabase is not configured' };
  }

  try {
    const { data, error } = await sb.storage
      .from(SUPABASE_BUCKET)
      .download(storagePath);

    if (error || !data) {
      return { buffer: null, error: error?.message || 'File not found in storage' };
    }

    const arrayBuffer = await data.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer) };
  } catch (err: any) {
    return { buffer: null, error: err.message };
  }
}

export async function deletePdfFromStorage(
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    const { error } = await sb.storage
      .from(SUPABASE_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.error('[SUPABASE STORAGE] Delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// DATABASE SYNCHRONIZATION & MUTATION HELPERS
// ============================================================================

export interface EventItem {
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

export type SyncedEventRecord = EventItem;

export interface SyncedDatabaseState {
  students?: any[];
  admins?: any[];
  papers?: any[];
  notes?: any[];
  events?: EventItem[];
  subjects?: any[];
  years?: string[];
  examTypes?: string[];
  sessions?: Record<string, any>;
  contactMessages?: any[];
}

export async function syncDatabaseFromSupabase(): Promise<SyncedDatabaseState | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    console.log('[SUPABASE] Fetching persistent database state...');

    const [
      studentsRes,
      savedPapersRes,
      savedNotesRes,
      recentDownloadsRes,
      adminsRes,
      papersRes,
      notesRes,
      eventsRes,
      subjectsRes,
      settingsRes,
      sessionsRes,
      messagesRes,
    ] = await Promise.all([
      sb.from('students').select('*'),
      sb.from('student_saved_papers').select('*'),
      sb.from('student_saved_notes').select('*'),
      sb.from('student_recent_downloads').select('*').order('downloaded_at', { ascending: false }).limit(500),
      sb.from('admins').select('*'),
      sb.from('papers').select('*').order('uploaded_at', { ascending: false }),
      sb.from('notes').select('*').order('uploaded_at', { ascending: false }),
      sb.from('events').select('*').order('date', { ascending: false }),
      sb.from('subjects').select('*'),
      sb.from('system_settings').select('*'),
      sb.from('sessions').select('*'),
      sb.from('contact_messages').select('*').order('submitted_at', { ascending: false }).limit(200),
    ]);

    if (studentsRes.error) {
      console.warn('[SUPABASE] Could not read students table:', studentsRes.error.message);
      return null;
    }

    // Map students with their bookmarks, savedPapers, and recentDownloads
    const savedPapersMap: Record<string, any[]> = {};
    (savedPapersRes.data || []).forEach(row => {
      if (!savedPapersMap[row.student_id]) savedPapersMap[row.student_id] = [];
      savedPapersMap[row.student_id].push({ paperId: row.paper_id, savedAt: row.saved_at });
    });

    const savedNotesMap: Record<string, any[]> = {};
    (savedNotesRes.data || []).forEach(row => {
      if (!savedNotesMap[row.student_id]) savedNotesMap[row.student_id] = [];
      savedNotesMap[row.student_id].push({ noteId: row.note_id, savedAt: row.saved_at });
    });

    const recentDownloadsMap: Record<string, any[]> = {};
    (recentDownloadsRes.data || []).forEach(row => {
      if (!recentDownloadsMap[row.student_id]) recentDownloadsMap[row.student_id] = [];
      recentDownloadsMap[row.student_id].push({
        paperId: row.paper_id || undefined,
        noteId: row.note_id || undefined,
        itemType: row.item_type,
        downloadedAt: row.downloaded_at,
      });
    });

    const students = (studentsRes.data || []).map(s => ({
      id: s.id,
      name: s.name,
      email: s.email,
      passwordHash: s.password_hash,
      salt: s.salt,
      year: s.year || '1st Year',
      semester: s.semester || 'Semester 1',
      role: s.role || 'student',
      status: s.status || 'active',
      authMethod: s.auth_method || 'email',
      createdAt: s.created_at,
      savedPapers: savedPapersMap[s.id] || [],
      bookmarks: (savedPapersMap[s.id] || []).map(p => p.paperId),
      savedNotes: savedNotesMap[s.id] || [],
      recentDownloads: recentDownloadsMap[s.id] || [],
    }));

    const papers = (papersRes.data || []).map(p => ({
      id: p.id,
      subjectName: p.subject_name,
      subjectCode: p.subject_code,
      examType: p.exam_type,
      academicYear: p.academic_year,
      btechYear: p.btech_year,
      semester: p.semester,
      paperDate: p.paper_date,
      description: p.description,
      maxMarks: p.max_marks,
      durationMinutes: p.duration_minutes,
      filename: p.storage_path || p.id,
      originalFilename: p.original_filename,
      fileSize: Number(p.file_size),
      fileSizeFormatted: p.file_size_formatted,
      downloadsCount: p.downloads_count || 0,
      viewsCount: p.views_count || 0,
      uploadedAt: p.uploaded_at,
      uploadedBy: p.uploaded_by,
    }));

    const notes = (notesRes.data || []).map(n => ({
      id: n.id,
      title: n.title,
      subjectName: n.subject_name,
      subjectCode: n.subject_code,
      btechYear: n.btech_year,
      semester: n.semester,
      description: n.description,
      filename: n.storage_path || n.id,
      originalFilename: n.original_filename,
      fileSize: Number(n.file_size),
      fileSizeFormatted: n.file_size_formatted,
      downloadsCount: n.downloads_count || 0,
      viewsCount: n.views_count || 0,
      uploadedAt: n.uploaded_at,
      uploadedBy: n.uploaded_by,
    }));

    const events: EventItem[] = (eventsRes.data || []).map(e => ({
      id: e.id,
      title: e.title,
      date: e.date,
      time: e.time,
      location: e.location,
      category: e.category,
      description: e.description,
      organizer: e.organizer,
      imageUrl: e.image_url || undefined,
      imageFilename: e.image_filename || undefined,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    }));

    const admins = (adminsRes.data || []).map(a => ({
      id: a.id,
      name: a.name,
      email: a.email,
      passwordHash: a.password_hash,
      salt: a.salt,
      role: a.role || 'admin',
      department: a.department || 'University Examination Wing',
      createdAt: a.created_at,
    }));

    const subjects = (subjectsRes.data || []).map(sub => ({
      id: sub.id,
      name: sub.name,
      code: sub.code,
      paperCount: sub.paper_count || 0,
    }));

    const sessions: Record<string, any> = {};
    const now = Date.now();
    (sessionsRes.data || []).forEach(sess => {
      if (Number(sess.expires_at) > now) {
        sessions[sess.token] = {
          token: sess.token,
          userId: sess.user_id,
          role: sess.role,
          email: sess.email,
          name: sess.name,
          createdAt: sess.created_at,
          expiresAt: Number(sess.expires_at),
          rememberMe: sess.remember_me,
        };
      }
    });

    let years: string[] | undefined;
    let examTypes: string[] | undefined;
    (settingsRes.data || []).forEach(setting => {
      if (setting.key === 'years' && Array.isArray(setting.value)) years = setting.value;
      if (setting.key === 'examTypes' && Array.isArray(setting.value)) examTypes = setting.value;
    });

    const contactMessages = (messagesRes.data || []).map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      subject: m.subject,
      message: m.message,
      recipient: m.recipient,
      submittedAt: m.submitted_at,
      status: m.status,
      messageId: m.message_id,
      deliveryError: m.delivery_error,
      senderRole: m.sender_role,
      studentId: m.student_id,
    }));

    console.log(`[SUPABASE] Synced successfully: ${students.length} students, ${papers.length} papers, ${notes.length} notes`);

    return {
      students,
      admins: admins.length > 0 ? admins : undefined,
      papers,
      notes,
      events: events.length > 0 ? events : undefined,
      subjects: subjects.length > 0 ? subjects : undefined,
      years,
      examTypes,
      sessions,
      contactMessages,
    };
  } catch (err: any) {
    console.error('[SUPABASE] Sync error:', err);
    return null;
  }
}

export async function persistEventToSupabase(eventItem: EventItem): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { error } = await sb.from('events').upsert({
      id: eventItem.id,
      title: eventItem.title,
      date: eventItem.date,
      time: eventItem.time,
      location: eventItem.location,
      category: eventItem.category,
      description: eventItem.description,
      organizer: eventItem.organizer,
      image_url: eventItem.imageUrl || null,
      image_filename: eventItem.imageFilename || null,
      created_at: eventItem.createdAt || new Date().toISOString(),
      updated_at: eventItem.updatedAt || new Date().toISOString(),
    });
    if (error) {
      console.error('[SUPABASE] Failed to persist event:', error.message);
    }
  } catch (e) {
    console.error('[SUPABASE] Failed to persist event:', e);
  }
}

// Background persistence helpers for real-time mutations
export async function persistStudentToSupabase(student: any): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from('students').upsert({
      id: student.id,
      name: student.name,
      email: student.email,
      password_hash: student.passwordHash,
      salt: student.salt,
      year: student.year,
      semester: student.semester,
      role: student.role,
      status: student.status,
      auth_method: student.authMethod,
      created_at: student.createdAt,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[SUPABASE] Failed to persist student:', e);
  }
}

export async function persistPaperToSupabase(paper: any): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from('papers').upsert({
    id: paper.id,
    subject_name: paper.subjectName,
    subject_code: paper.subjectCode,
    exam_type: paper.examType,
    academic_year: paper.academicYear,
    btech_year: paper.btechYear,
    semester: paper.semester,
    paper_date: paper.paperDate,
    description: paper.description,
    max_marks: paper.maxMarks,
    duration_minutes: paper.durationMinutes,
    storage_path: paper.filename,
    original_filename: paper.originalFilename,
    file_size: paper.fileSize,
    file_size_formatted: paper.fileSizeFormatted,
    downloads_count: paper.downloadsCount || 0,
    views_count: paper.viewsCount || 0,
    uploaded_at: paper.uploadedAt,
    uploaded_by: paper.uploadedBy,
  });
  if (error) {
    console.error('[SUPABASE] Failed to persist paper:', error.message);
    throw new Error(error.message || 'Failed to persist paper metadata to Supabase.');
  }
}

export async function persistNoteToSupabase(note: any): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from('notes').upsert({
    id: note.id,
    title: note.title,
    subject_name: note.subjectName,
    subject_code: note.subjectCode,
    btech_year: note.btechYear,
    semester: note.semester,
    description: note.description,
    storage_path: note.filename,
    original_filename: note.originalFilename,
    file_size: note.fileSize,
    file_size_formatted: note.fileSizeFormatted,
    downloads_count: note.downloadsCount || 0,
    views_count: note.viewsCount || 0,
    uploaded_at: note.uploadedAt,
    uploaded_by: note.uploadedBy,
  });
  if (error) {
    console.error('[SUPABASE] Failed to persist note:', error.message);
    throw new Error(error.message || 'Failed to persist note metadata to Supabase.');
  }
}

export async function persistSessionToSupabase(session: any): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from('sessions').upsert({
      token: session.token,
      user_id: session.userId,
      role: session.role,
      email: session.email,
      name: session.name,
      created_at: session.createdAt || new Date().toISOString(),
      expires_at: session.expiresAt,
      remember_me: session.rememberMe ?? true,
    });
  } catch (e) {
    console.error('[SUPABASE] Failed to persist session:', e);
  }
}

export async function removeSessionFromSupabase(token: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from('sessions').delete().eq('token', token);
  } catch (e) {
    console.error('[SUPABASE] Failed to delete session:', e);
  }
}

export async function persistSavedPaperToggle(studentId: string, paperId: string, isSaved: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    if (isSaved) {
      await sb.from('student_saved_papers').upsert({
        student_id: studentId,
        paper_id: paperId,
        saved_at: new Date().toISOString(),
      });
    } else {
      await sb.from('student_saved_papers').delete().match({ student_id: studentId, paper_id: paperId });
    }
  } catch (e) {
    console.error('[SUPABASE] Failed to toggle saved paper:', e);
  }
}

export async function persistSavedNoteToggle(studentId: string, noteId: string, isSaved: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    if (isSaved) {
      await sb.from('student_saved_notes').upsert({
        student_id: studentId,
        note_id: noteId,
        saved_at: new Date().toISOString(),
      });
    } else {
      await sb.from('student_saved_notes').delete().match({ student_id: studentId, note_id: noteId });
    }
  } catch (e) {
    console.error('[SUPABASE] Failed to toggle saved note:', e);
  }
}

export async function persistRecentDownload(studentId: string, itemType: 'paper' | 'note', itemId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from('student_recent_downloads').insert({
      student_id: studentId,
      item_type: itemType,
      paper_id: itemType === 'paper' ? itemId : null,
      note_id: itemType === 'note' ? itemId : null,
      downloaded_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[SUPABASE] Failed to persist download history:', e);
  }
}

export async function persistContactMessage(msg: any): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from('contact_messages').insert({
      id: msg.id,
      name: msg.name,
      email: msg.email,
      subject: msg.subject,
      message: msg.message,
      recipient: msg.recipient,
      submitted_at: msg.submittedAt,
      status: msg.status,
      message_id: msg.messageId,
      delivery_error: msg.deliveryError,
      sender_role: msg.senderRole,
      student_id: msg.studentId,
    });
  } catch (e) {
    console.error('[SUPABASE] Failed to persist contact message:', e);
  }
}
