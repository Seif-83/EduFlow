-- =========================================================================
-- EduFlow Enterprise Schema for Supabase (PostgreSQL)
-- Capstone Graduation Project - AI-Powered Automated Education & Early Warning Engine
-- =========================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Students Master Directory Table
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id VARCHAR(50) UNIQUE NOT NULL,      -- e.g. 'EDU-8492' or 'STU-101'
    student_name VARCHAR(255) NOT NULL,
    pin VARCHAR(50) DEFAULT '1234',
    grade_level VARCHAR(100) NOT NULL,          -- e.g. 'الصف الثاني الإعدادي'
    student_phone VARCHAR(50),                  -- WhatsApp Number
    parent_name VARCHAR(255) NOT NULL,
    parent_email VARCHAR(255) NOT NULL,         -- e.g. 'seifamrmohsen2005@gmail.com'
    parent_phone VARCHAR(50),
    avatar VARCHAR(20) DEFAULT '👨‍🎓',
    consecutive_absences INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Teacher Published Exams & Homework Table
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id VARCHAR(50) UNIQUE NOT NULL,        -- e.g. 'EXAM-2026-01'
    title VARCHAR(255) NOT NULL,
    grade_level VARCHAR(100) NOT NULL,          -- Target Grade Level
    subject VARCHAR(100) NOT NULL,              -- e.g. 'علوم' / 'رياضيات'
    duration_minutes INT DEFAULT 20,
    deadline VARCHAR(100),
    questions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of questions {question, choices, correctIndex, explanation}
    created_by VARCHAR(100) DEFAULT 'المعلم',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Assessments & Quiz Results Table
CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id VARCHAR(50) UNIQUE NOT NULL,
    student_id VARCHAR(50) REFERENCES public.students(student_id) ON DELETE CASCADE,
    exam_id VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    grade_level VARCHAR(100),
    subject VARCHAR(100),
    score NUMERIC(5,2) NOT NULL,
    max_score NUMERIC(5,2) NOT NULL,
    pct NUMERIC(5,2) NOT NULL,
    warning_flag BOOLEAN DEFAULT FALSE,         -- True if pct < 70%
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Daily Attendance Logs Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    student_id VARCHAR(50) REFERENCES public.students(student_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('حاضر', 'غائب', 'متأخر')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (date, student_id)
);

-- 6. Early Warning & Alert Logs (n8n & Gemini Dispatched)
CREATE TABLE IF NOT EXISTS public.alerts_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id VARCHAR(50) REFERENCES public.students(student_id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,            -- 'ACADEMIC_EARLY_WARNING', 'ATTENDANCE_RISK', 'DEADLINE_REMINDER'
    recipient_email VARCHAR(255) NOT NULL,
    content_summary TEXT,
    gemini_diagnostic TEXT,
    status VARCHAR(50) DEFAULT 'SENT',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Row-Level Security (RLS) Configuration
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for educational demo / anon client key:
CREATE POLICY "Allow public read access to students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Allow public write access to students" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to students" ON public.students FOR UPDATE USING (true);

CREATE POLICY "Allow public read access to exams" ON public.exams FOR SELECT USING (true);
CREATE POLICY "Allow public write access to exams" ON public.exams FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to exams" ON public.exams FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to exams" ON public.exams FOR DELETE USING (true);

CREATE POLICY "Allow public read access to assessments" ON public.assessments FOR SELECT USING (true);
CREATE POLICY "Allow public write access to assessments" ON public.assessments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to assessments" ON public.assessments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to assessments" ON public.assessments FOR DELETE USING (true);

CREATE POLICY "Allow public read access to attendance" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Allow public write access to attendance" ON public.attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to attendance" ON public.attendance FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to attendance" ON public.attendance FOR DELETE USING (true);

CREATE POLICY "Allow public read access to alerts_logs" ON public.alerts_logs FOR SELECT USING (true);
CREATE POLICY "Allow public write access to alerts_logs" ON public.alerts_logs FOR INSERT WITH CHECK (true);

-- 8. Default Seed Data
INSERT INTO public.students (student_id, student_name, pin, grade_level, student_phone, parent_name, parent_email, parent_phone, avatar, consecutive_absences)
VALUES 
('STU-101', 'أحمد محمود علي', '1234', 'الصف الثاني الإعدادي', '01012345678', 'محمود علي إبراهيم', 'seifamrmohsen2005@gmail.com', '01012345678', '👨‍🎓', 0),
('STU-102', 'مريم شريف إبراهيم', '1234', 'الصف الثاني الإعدادي', '01123456789', 'شريف إبراهيم النجار', 'seifamrmohsen2005@gmail.com', '01123456789', '👩‍🎓', 1),
('STU-103', 'عمر خالد الصاوي', '1234', 'الصف الثاني الإعدادي', '01234567890', 'خالد الصاوي محمد', 'seifamrmohsen2005@gmail.com', '01234567890', '👨‍🎓', 0),
('STU-104', 'سارة طارق حسن', '1234', 'الصف الأول الإعدادي', '01512345678', 'طارق حسن عبد الرحمن', 'seifamrmohsen2005@gmail.com', '01512345678', '👩‍🎓', 0),
('STU-105', 'يوسف كريم عبد الله', '1234', 'الصف الثالث الإعدادي', '01098765432', 'كريم عبد الله رضوان', 'seifamrmohsen2005@gmail.com', '01098765432', '👨‍🎓', 2)
ON CONFLICT (student_id) DO NOTHING;

