-- Supabase Database Schema for Shiksharthi OS
-- Version: 1.0
-- Created: 2026-06-21

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types / enums
CREATE TYPE user_role AS ENUM ('Director', 'Mentor', 'Admin');
CREATE TYPE student_status AS ENUM ('Active', 'Leave of Absence', 'Batch Transfer', 'Branch Transfer', 'Class Promotion', 'Completed', 'Dropped Out');
CREATE TYPE exam_type AS ENUM ('Subject Test', 'Periodic Test', 'Mock Test', 'Full Syllabus Test');
CREATE TYPE report_card_status AS ENUM ('Draft', 'Under Review', 'Approved', 'Shared');
CREATE TYPE payment_status AS ENUM ('Paid', 'Due', 'Overdue');
CREATE TYPE payment_method AS ENUM ('Cash', 'UPI', 'Bank Transfer');

-- 1. Branches Table
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  code VARCHAR(10) UNIQUE NOT NULL,
  address TEXT,
  class_range_min INT NOT NULL,
  class_range_max INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed branches (Baguipara active, Pubali/Chinar Park inactive for MVP)
INSERT INTO branches (name, code, class_range_min, class_range_max, is_active) VALUES
('Baguipara', 'BGP', 11, 12, true),
('Pubali', 'PUB', 7, 10, false),
('Chinar Park', 'CHP', 7, 10, false);

-- 2. Academic Years Table
CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(10) UNIQUE NOT NULL, -- e.g., '2026–27'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed academic years
INSERT INTO academic_years (label, start_date, end_date, is_current) VALUES
('2025–26', '2025-04-01', '2026-03-31', false),
('2026–27', '2026-04-01', '2027-03-31', true);

-- 3. Profiles (extending auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'Mentor',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- User-Branch Mappings (Director has all, Mentor/Admin assigned to specific ones)
CREATE TABLE profile_branches (
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (profile_id, branch_id)
);

-- 4. Rooms Table (local to branch)
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  capacity INT NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(branch_id, name)
);

-- Seed Rooms for Baguipara
DO $$
DECLARE
  bgp_id UUID;
BEGIN
  SELECT id INTO bgp_id FROM branches WHERE code = 'BGP';
  IF bgp_id IS NOT NULL THEN
    INSERT INTO rooms (name, capacity, branch_id) VALUES
    ('0', 5, bgp_id),
    ('1', 15, bgp_id),
    ('2', 10, bgp_id),
    ('3', 10, bgp_id),
    ('4', 30, bgp_id),
    ('5', 15, bgp_id),
    ('6', 20, bgp_id),
    ('7', 30, bgp_id);
  END IF;
END $$;

-- 5. Batches Table (scoped by branch & academic year)
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  class VARCHAR(10) NOT NULL, -- e.g., '11', '12'
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(branch_id, academic_year_id, name)
);

-- 6. Faculty Table
CREATE TABLE faculty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  subjects VARCHAR(100)[] NOT NULL, -- list of subjects taught
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Faculty-Branch assignments
CREATE TABLE faculty_branches (
  faculty_id UUID REFERENCES faculty(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (faculty_id, branch_id)
);

-- 7. Batch Subject Progress
CREATE TABLE batch_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE NOT NULL,
  subject_name VARCHAR(100) NOT NULL,
  faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
  current_chapter VARCHAR(255) DEFAULT '' NOT NULL,
  progress_percentage INT DEFAULT 0 NOT NULL CHECK (progress_percentage BETWEEN 0 AND 100),
  last_exam_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(batch_id, subject_name)
);

-- 8. Students Table (Permanent identity, no contact info)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code VARCHAR(20) UNIQUE NOT NULL, -- e.g., 'SH-0001'
  name VARCHAR(150) NOT NULL,
  parent_name VARCHAR(150),
  date_of_birth DATE,
  gender VARCHAR(20),
  address TEXT,
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Enrollments Table (year-specific record)
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  class VARCHAR(10) NOT NULL, -- class enrolled for in this year
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  package_type VARCHAR(20), -- 'JEE', 'NEET', 'Boards'
  add_on_subjects JSONB DEFAULT '[]'::jsonb NOT NULL, -- e.g., ["Computer Science"]
  status student_status NOT NULL DEFAULT 'Active',
  status_effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(student_id, academic_year_id)
);

-- 10. Schedules Table (Weekly recurring slots)
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  subject_name VARCHAR(100) NOT NULL,
  faculty_id UUID REFERENCES faculty(id) ON DELETE CASCADE NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Mon, 7=Sun
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Class Sessions Table (Conducted sessions for denominator calculations)
CREATE TABLE class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE NOT NULL,
  subject_name VARCHAR(100) NOT NULL,
  faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_extra_class BOOLEAN NOT NULL DEFAULT false,
  extra_class_reason TEXT,
  extra_class_notes TEXT,
  chapter_covered VARCHAR(255),
  conducted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Attendance Table
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES class_sessions(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('Present', 'Absent', 'Leave')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(enrollment_id, session_id)
);

-- 13. Exams Table
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  type exam_type NOT NULL DEFAULT 'Subject Test',
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE NOT NULL,
  subject_name VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  max_marks INT NOT NULL,
  chapters_covered TEXT,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. Results Table
CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE NOT NULL,
  marks_obtained NUMERIC(5, 2) NOT NULL,
  percentage NUMERIC(5, 2) NOT NULL,
  rank_in_batch INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(exam_id, enrollment_id)
);

-- 15. Report Cards Table
CREATE TABLE report_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
  attendance_percentage NUMERIC(5, 2) NOT NULL,
  mentor_remarks TEXT,
  status report_card_status NOT NULL DEFAULT 'Draft',
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(enrollment_id, month, academic_year_id)
);

-- 16. Student Fees Table (financial, hidden from Mentor)
CREATE TABLE student_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE UNIQUE NOT NULL,
  package_fee NUMERIC(10, 2) NOT NULL,
  discount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
  scholarship NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
  total_payable NUMERIC(10, 2) GENERATED ALWAYS AS (package_fee - discount - scholarship) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 17. Fee Installments Table (financial, hidden from Mentor)
CREATE TABLE fee_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_fee_id UUID REFERENCES student_fees(id) ON DELETE CASCADE NOT NULL,
  installment_number INT NOT NULL,
  due_date DATE NOT NULL,
  due_amount NUMERIC(10, 2) NOT NULL,
  status payment_status NOT NULL DEFAULT 'Due',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(student_fee_id, installment_number)
);

-- 18. Payments Table (financial, hidden from Mentor)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID REFERENCES fee_installments(id) ON DELETE CASCADE NOT NULL,
  amount_paid NUMERIC(10, 2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_type payment_method NOT NULL,
  transaction_id VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 19. Activity Logs Table
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

--------------------------------------------------------------------------------
-- AUTOMATIC TIMESTAMPS TRIGGERS
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON batches FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_faculty_updated_at BEFORE UPDATE ON faculty FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_batch_subjects_updated_at BEFORE UPDATE ON batch_subjects FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON exams FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_results_updated_at BEFORE UPDATE ON results FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_report_cards_updated_at BEFORE UPDATE ON report_cards FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_student_fees_updated_at BEFORE UPDATE ON student_fees FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_fee_installments_updated_at BEFORE UPDATE ON fee_installments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
--------------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS checks
CREATE OR REPLACE FUNCTION get_user_role(uid UUID)
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = uid;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_director(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT get_user_role(uid) = 'Director';
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_branch_access(uid UUID, bid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profile_branches
    WHERE profile_id = uid AND branch_id = bid
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- RLS Policies: Branches & Academic Years
CREATE POLICY "Public Read Branches" ON branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Director Edit Branches" ON branches FOR ALL TO authenticated USING (is_director(auth.uid()));

CREATE POLICY "Public Read Academic Years" ON academic_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "Director Edit Academic Years" ON academic_years FOR ALL TO authenticated USING (is_director(auth.uid()));

-- RLS Policies: Profiles
CREATE POLICY "Public Read Profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Director Manage Profiles" ON profiles FOR ALL TO authenticated USING (is_director(auth.uid()));
CREATE POLICY "Self Update Profile" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- RLS Policies: User-Branch mappings
CREATE POLICY "Public Read profile_branches" ON profile_branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Director Manage profile_branches" ON profile_branches FOR ALL TO authenticated USING (is_director(auth.uid()));

-- RLS Policies: Rooms
CREATE POLICY "Public Read Rooms" ON rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Rooms based on branch assignment" ON rooms FOR ALL TO authenticated
  USING (is_director(auth.uid()) OR has_branch_access(auth.uid(), branch_id));

-- RLS Policies: Batches
CREATE POLICY "Public Read Batches" ON batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Batches based on branch assignment" ON batches FOR ALL TO authenticated
  USING (is_director(auth.uid()) OR has_branch_access(auth.uid(), branch_id));

-- RLS Policies: Faculty
CREATE POLICY "Public Read Faculty" ON faculty FOR SELECT TO authenticated USING (true);
CREATE POLICY "Director Manage Faculty" ON faculty FOR ALL TO authenticated USING (is_director(auth.uid()));

CREATE POLICY "Public Read Faculty Branches" ON faculty_branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Director Manage Faculty Branches" ON faculty_branches FOR ALL TO authenticated USING (is_director(auth.uid()));

-- RLS Policies: Batch Subjects Progress
CREATE POLICY "Public Read Batch Subjects" ON batch_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Batch Subjects based on batch branch" ON batch_subjects FOR ALL TO authenticated
  USING (
    is_director(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM batches b
      WHERE b.id = batch_subjects.batch_id AND has_branch_access(auth.uid(), b.branch_id)
    )
  );

-- RLS Policies: Students (permanent records)
CREATE POLICY "View Students if enrolled in user branch" ON students FOR SELECT TO authenticated
  USING (
    is_director(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.student_id = students.id AND has_branch_access(auth.uid(), e.branch_id)
    )
  );
CREATE POLICY "Manage Students if director" ON students FOR ALL TO authenticated USING (is_director(auth.uid()));

-- RLS Policies: Enrollments
CREATE POLICY "View Enrollments based on branch assignment" ON enrollments FOR SELECT TO authenticated
  USING (is_director(auth.uid()) OR has_branch_access(auth.uid(), branch_id));
CREATE POLICY "Manage Enrollments based on branch assignment" ON enrollments FOR ALL TO authenticated
  USING (is_director(auth.uid()) OR has_branch_access(auth.uid(), branch_id));

-- RLS Policies: Schedules
CREATE POLICY "View Schedules based on branch assignment" ON schedules FOR SELECT TO authenticated
  USING (is_director(auth.uid()) OR has_branch_access(auth.uid(), branch_id));
CREATE POLICY "Manage Schedules based on branch assignment" ON schedules FOR ALL TO authenticated
  USING (is_director(auth.uid()) OR has_branch_access(auth.uid(), branch_id));

-- RLS Policies: Class Sessions
CREATE POLICY "View Class Sessions based on batch branch" ON class_sessions FOR SELECT TO authenticated
  USING (
    is_director(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM batches b
      WHERE b.id = class_sessions.batch_id AND has_branch_access(auth.uid(), b.branch_id)
    )
  );
CREATE POLICY "Manage Class Sessions based on batch branch" ON class_sessions FOR ALL TO authenticated
  USING (
    is_director(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM batches b
      WHERE b.id = class_sessions.batch_id AND has_branch_access(auth.uid(), b.branch_id)
    )
  );

-- RLS Policies: Attendance
CREATE POLICY "View Attendance based on enrollment branch" ON attendance FOR SELECT TO authenticated
  USING (
    is_director(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.id = attendance.enrollment_id AND has_branch_access(auth.uid(), e.branch_id)
    )
  );
CREATE POLICY "Manage Attendance based on enrollment branch" ON attendance FOR ALL TO authenticated
  USING (
    is_director(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.id = attendance.enrollment_id AND has_branch_access(auth.uid(), e.branch_id)
    )
  );

-- RLS Policies: Exams
CREATE POLICY "View Exams based on branch assignment" ON exams FOR SELECT TO authenticated
  USING (is_director(auth.uid()) OR has_branch_access(auth.uid(), branch_id));
CREATE POLICY "Manage Exams based on branch assignment" ON exams FOR ALL TO authenticated
  USING (is_director(auth.uid()) OR has_branch_access(auth.uid(), branch_id));

-- RLS Policies: Results
CREATE POLICY "View Results based on exam branch" ON results FOR SELECT TO authenticated
  USING (
    is_director(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM exams ex
      WHERE ex.id = results.exam_id AND has_branch_access(auth.uid(), ex.branch_id)
    )
  );
CREATE POLICY "Manage Results based on exam branch" ON results FOR ALL TO authenticated
  USING (
    is_director(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM exams ex
      WHERE ex.id = results.exam_id AND has_branch_access(auth.uid(), ex.branch_id)
    )
  );

-- RLS Policies: Report Cards
CREATE POLICY "View Report Cards based on enrollment branch" ON report_cards FOR SELECT TO authenticated
  USING (
    is_director(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.id = report_cards.enrollment_id AND has_branch_access(auth.uid(), e.branch_id)
    )
  );
CREATE POLICY "Manage Report Cards based on enrollment branch" ON report_cards FOR ALL TO authenticated
  USING (
    is_director(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.id = report_cards.enrollment_id AND has_branch_access(auth.uid(), e.branch_id)
    )
  );

-- RLS Policies: Student Fees (Directors and Admins ONLY, Mentors strictly blocked)
CREATE POLICY "View Fees for Director and branch Admin" ON student_fees FOR SELECT TO authenticated
  USING (
    (get_user_role(auth.uid()) IN ('Director', 'Admin')) AND (
      is_director(auth.uid()) OR
      EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.id = student_fees.enrollment_id AND has_branch_access(auth.uid(), e.branch_id)
      )
    )
  );
CREATE POLICY "Manage Fees for Director and branch Admin" ON student_fees FOR ALL TO authenticated
  USING (
    (get_user_role(auth.uid()) IN ('Director', 'Admin')) AND (
      is_director(auth.uid()) OR
      EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.id = student_fees.enrollment_id AND has_branch_access(auth.uid(), e.branch_id)
      )
    )
  );

-- RLS Policies: Fee Installments (Directors and Admins ONLY, Mentors strictly blocked)
CREATE POLICY "View Installments for Director and branch Admin" ON fee_installments FOR SELECT TO authenticated
  USING (
    (get_user_role(auth.uid()) IN ('Director', 'Admin')) AND (
      is_director(auth.uid()) OR
      EXISTS (
        SELECT 1 FROM student_fees sf
        JOIN enrollments e ON sf.enrollment_id = e.id
        WHERE sf.id = fee_installments.student_fee_id AND has_branch_access(auth.uid(), e.branch_id)
      )
    )
  );
CREATE POLICY "Manage Installments for Director and branch Admin" ON fee_installments FOR ALL TO authenticated
  USING (
    (get_user_role(auth.uid()) IN ('Director', 'Admin')) AND (
      is_director(auth.uid()) OR
      EXISTS (
        SELECT 1 FROM student_fees sf
        JOIN enrollments e ON sf.enrollment_id = e.id
        WHERE sf.id = fee_installments.student_fee_id AND has_branch_access(auth.uid(), e.branch_id)
      )
    )
  );

-- RLS Policies: Payments (Directors and Admins ONLY, Mentors strictly blocked)
CREATE POLICY "View Payments for Director and branch Admin" ON payments FOR SELECT TO authenticated
  USING (
    (get_user_role(auth.uid()) IN ('Director', 'Admin')) AND (
      is_director(auth.uid()) OR
      EXISTS (
        SELECT 1 FROM fee_installments fi
        JOIN student_fees sf ON fi.student_fee_id = sf.id
        JOIN enrollments e ON sf.enrollment_id = e.id
        WHERE fi.id = payments.installment_id AND has_branch_access(auth.uid(), e.branch_id)
      )
    )
  );
CREATE POLICY "Manage Payments for Director and branch Admin" ON payments FOR ALL TO authenticated
  USING (
    (get_user_role(auth.uid()) IN ('Director', 'Admin')) AND (
      is_director(auth.uid()) OR
      EXISTS (
        SELECT 1 FROM fee_installments fi
        JOIN student_fees sf ON fi.student_fee_id = sf.id
        JOIN enrollments e ON sf.enrollment_id = e.id
        WHERE fi.id = payments.installment_id AND has_branch_access(auth.uid(), e.branch_id)
      )
    )
  );

-- RLS Policies: Activity Logs
CREATE POLICY "View Logs for Director or branch specific users" ON activity_logs FOR SELECT TO authenticated
  USING (is_director(auth.uid()) OR has_branch_access(auth.uid(), branch_id));
CREATE POLICY "Create Logs for all authenticated" ON activity_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id);
