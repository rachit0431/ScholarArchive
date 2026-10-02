-- ============================================================================
-- SCHOLARARCHIVE / ATHENAEUM - SUPABASE DATABASE MIGRATION SCRIPT
-- ============================================================================
-- This script provisions the complete relational schema, indexes, RLS policies,
-- storage bucket configuration, and initial admin seeds for ScholarArchive.
-- Execute this entire script once in your Supabase Dashboard -> SQL Editor.
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TABLE DEFINITIONS
-- ============================================================================

-- 2.1 Students Directory
CREATE TABLE IF NOT EXISTS public.students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  salt TEXT,
  year TEXT DEFAULT '1st Year',
  semester TEXT DEFAULT 'Semester 1',
  role TEXT DEFAULT 'student',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  auth_method TEXT DEFAULT 'email' CHECK (auth_method IN ('email', 'google')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 Examination Board Administrators
CREATE TABLE IF NOT EXISTS public.admins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  department TEXT DEFAULT 'University Examination Wing',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 Active Authentication Sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'admin')),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at BIGINT NOT NULL,
  remember_me BOOLEAN DEFAULT TRUE
);

-- 2.4 Curricular Course Modules / Subjects Catalog
CREATE TABLE IF NOT EXISTS public.subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  paper_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 Curricular Metadata (Academic Years & Exam Types)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.6 Question Papers Archive
CREATE TABLE IF NOT EXISTS public.papers (
  id TEXT PRIMARY KEY,
  subject_name TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  btech_year TEXT NOT NULL,
  semester TEXT NOT NULL,
  paper_date TEXT,
  description TEXT,
  max_marks INTEGER DEFAULT 100,
  duration_minutes INTEGER DEFAULT 180,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_size_formatted TEXT NOT NULL,
  downloads_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by TEXT
);

-- 2.7 Academic Study Lecture Notes
CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  btech_year TEXT NOT NULL,
  semester TEXT NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_size_formatted TEXT NOT NULL,
  downloads_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by TEXT
);

-- 2.8 Student Saved Question Papers (My Archive / Bookmarks)
CREATE TABLE IF NOT EXISTS public.student_saved_papers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  paper_id TEXT NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, paper_id)
);

-- 2.9 Student Saved Study Notes (My Archive / Bookmarks)
CREATE TABLE IF NOT EXISTS public.student_saved_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  note_id TEXT NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, note_id)
);

-- 2.10 Student Recent Downloads History
CREATE TABLE IF NOT EXISTS public.student_recent_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('paper', 'note')),
  paper_id TEXT REFERENCES public.papers(id) ON DELETE SET NULL,
  note_id TEXT REFERENCES public.notes(id) ON DELETE SET NULL,
  downloaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.11 Institutional Contact Messages & Inquiries
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  recipient TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'delivered',
  message_id TEXT,
  delivery_error TEXT,
  sender_role TEXT,
  student_id TEXT
);

-- ============================================================================
-- 3. PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_students_email ON public.students(email);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);
CREATE INDEX IF NOT EXISTS idx_students_year_sem ON public.students(year, semester);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_papers_subject_code ON public.papers(subject_code);
CREATE INDEX IF NOT EXISTS idx_papers_academic_year ON public.papers(academic_year);
CREATE INDEX IF NOT EXISTS idx_papers_exam_type ON public.papers(exam_type);
CREATE INDEX IF NOT EXISTS idx_papers_btech_year ON public.papers(btech_year);
CREATE INDEX IF NOT EXISTS idx_papers_uploaded_at ON public.papers(uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_subject_code ON public.notes(subject_code);
CREATE INDEX IF NOT EXISTS idx_notes_btech_year ON public.notes(btech_year);
CREATE INDEX IF NOT EXISTS idx_notes_uploaded_at ON public.notes(uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_papers_student ON public.student_saved_papers(student_id);
CREATE INDEX IF NOT EXISTS idx_saved_notes_student ON public.student_saved_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_recent_downloads_student ON public.student_recent_downloads(student_id);

-- ============================================================================
-- 4. STORAGE BUCKET CONFIGURATION (academic-documents)
-- ============================================================================

-- Create 'academic-documents' storage bucket if not already existing
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'academic-documents',
  'academic-documents',
  true,
  68157440, -- 65 MB maximum upload limit
  ARRAY['application/pdf', 'application/x-pdf', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 68157440,
  allowed_mime_types = ARRAY['application/pdf', 'application/x-pdf', 'application/octet-stream'];

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS across all application tables
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_saved_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_saved_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_recent_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Note: The Express backend interacts with Supabase using the SUPABASE_SERVICE_ROLE_KEY,
-- which intentionally bypasses RLS for server-side endpoints and applies the application's
-- strict institutional authentication & RBAC middleware.
-- The following policies provide defense-in-depth for anon/authenticated client access:

-- Public & Catalog Read Policies
CREATE POLICY "Public read access for subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Public read access for system settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Public read access for papers" ON public.papers FOR SELECT USING (true);
CREATE POLICY "Public read access for notes" ON public.notes FOR SELECT USING (true);

-- Storage Bucket Access Policies
CREATE POLICY "Public Access for academic documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'academic-documents');

CREATE POLICY "Service Role Uploads for academic documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'academic-documents');

CREATE POLICY "Service Role Updates for academic documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'academic-documents');

CREATE POLICY "Service Role Deletions for academic documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'academic-documents');

-- ============================================================================
-- 6. INITIAL SEED DATA
-- ============================================================================

-- 6.1 Default System Settings (Years and Examination Types)
INSERT INTO public.system_settings (key, value)
VALUES
  ('years', '["2025-2026", "2024-2025", "2023-2024", "2022-2023", "2021-2022", "2020-2021"]'::jsonb),
  ('examTypes', '["Midterm 1", "Midterm 2", "End Semester", "Supplementary", "Model Exam"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 6.2 Default Core Subjects
INSERT INTO public.subjects (id, name, code, paper_count)
VALUES
  ('sub-1', 'Data Structures & Algorithms', 'CS201', 3),
  ('sub-2', 'Computer Organization & Architecture', 'CS202', 2),
  ('sub-3', 'Database Management Systems', 'CS301', 4),
  ('sub-4', 'Operating Systems', 'CS302', 3),
  ('sub-5', 'Discrete Mathematics', 'MA201', 2),
  ('sub-6', 'Computer Networks', 'CS401', 3),
  ('sub-7', 'Artificial Intelligence', 'CS501', 2),
  ('sub-8', 'Machine Learning', 'CS502', 2)
ON CONFLICT (id) DO NOTHING;

-- 6.3 Default Institutional Admin
-- Credentials: admin@college.edu / admin123
INSERT INTO public.admins (id, name, email, password_hash, salt, role, department, created_at)
VALUES (
  'admin-1',
  'Office of the Controller of Examinations',
  'admin@college.edu',
  '7ab013d548b29ff5e91129ee746ca35d21469e3a35ec19e7a4f5fbe183c7cefe2298642a8b9f07727c62bb1e1beab2ad9d9ef54c86cb32cfd1e9fbb515d9a96e',
  '29ec82195dfb8f2bf29a6dc86efbe1b1',
  'admin',
  'University Examination Wing',
  NOW()
)
ON CONFLICT (id) DO NOTHING;
