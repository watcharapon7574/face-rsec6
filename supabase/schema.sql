-- =============================================
-- ระบบลงเวลา ศูนย์การศึกษาพิเศษ เขตการศึกษา 6
-- จังหวัดลพบุรี - Supabase Schema (NEW DB)
-- =============================================
-- Flow: FastDoc SSO (once) → Face Enrollment (once) → Daily face verify + liveness → Attendance

-- 1) Global settings (singleton)
CREATE TABLE IF NOT EXISTS attendance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name TEXT NOT NULL DEFAULT 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 จังหวัดลพบุรี',
  check_in_start TIME NOT NULL DEFAULT '07:00',
  check_in_end TIME NOT NULL DEFAULT '09:30',
  check_out_start TIME NOT NULL DEFAULT '16:00',
  check_out_end TIME NOT NULL DEFAULT '22:00',
  face_match_threshold REAL NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO attendance_settings (org_name) VALUES ('ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 จังหวัดลพบุรี');

-- 2) Locations = หน่วยบริการ
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  district TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 200,
  is_headquarters BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO locations (name, short_name, district, lat, lng, radius_meters, is_headquarters) VALUES
  ('ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 (สำนักงานใหญ่)', 'ศูนย์ฯ หลัก', 'เมืองลพบุรี', 14.7995, 100.6534, 200, TRUE),
  ('หน่วยบริการอำเภอพัฒนานิคม', 'หน่วยฯ พัฒนานิคม', 'พัฒนานิคม', 14.8361, 101.0514, 200, FALSE),
  ('หน่วยบริการอำเภอโคกสำโรง', 'หน่วยฯ โคกสำโรง', 'โคกสำโรง', 15.0186, 100.6842, 200, FALSE),
  ('หน่วยบริการอำเภอชัยบาดาล', 'หน่วยฯ ชัยบาดาล', 'ชัยบาดาล', 15.1889, 101.1150, 200, FALSE),
  ('หน่วยบริการอำเภอท่าวุ้ง', 'หน่วยฯ ท่าวุ้ง', 'ท่าวุ้ง', 14.8167, 100.5167, 200, FALSE),
  ('หน่วยบริการอำเภอบ้านหมี่', 'หน่วยฯ บ้านหมี่', 'บ้านหมี่', 14.8833, 100.5000, 200, FALSE),
  ('หน่วยบริการอำเภอท่าหลวง', 'หน่วยฯ ท่าหลวง', 'ท่าหลวง', 15.0000, 101.1833, 200, FALSE),
  ('หน่วยบริการอำเภอสระโบสถ์', 'หน่วยฯ สระโบสถ์', 'สระโบสถ์', 15.1167, 100.8833, 200, FALSE),
  ('หน่วยบริการอำเภอโคกเจริญ', 'หน่วยฯ โคกเจริญ', 'โคกเจริญ', 15.2333, 100.9500, 200, FALSE),
  ('หน่วยบริการอำเภอลำสนธิ', 'หน่วยฯ ลำสนธิ', 'ลำสนธิ', 15.3500, 101.1500, 200, FALSE),
  ('หน่วยบริการอำเภอหนองม่วง', 'หน่วยฯ หนองม่วง', 'หนองม่วง', 15.0833, 100.7333, 200, FALSE);

-- 3) Teachers - linked to FastDoc user, with face enrollment
CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  position TEXT DEFAULT '',
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  pin_code TEXT NOT NULL DEFAULT '1234',
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  -- FastDoc integration
  fastdoc_user_id TEXT UNIQUE,
  fastdoc_email TEXT,
  -- Face enrollment
  enrollment_status TEXT NOT NULL DEFAULT 'none' CHECK (enrollment_status IN ('none', 'enrolled', 'revoked')),
  face_descriptor JSONB,
  enrolled_at TIMESTAMPTZ,
  -- Device binding
  device_fingerprint TEXT,
  device_bound_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default admin
INSERT INTO teachers (teacher_id, full_name, position, pin_code, is_admin, enrollment_status)
VALUES ('ADMIN001', 'ผู้ดูแลระบบ', 'ผู้ดูแลระบบ', '0000', TRUE, 'none');

-- 4) Attendance records
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  check_in_lat DOUBLE PRECISION,
  check_in_lng DOUBLE PRECISION,
  check_out_lat DOUBLE PRECISION,
  check_out_lng DOUBLE PRECISION,
  device_fingerprint TEXT NOT NULL,
  check_in_liveness BOOLEAN DEFAULT FALSE,
  check_out_liveness BOOLEAN DEFAULT FALSE,
  check_in_face_match REAL,
  check_out_face_match REAL,
  status TEXT DEFAULT 'present',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, date),
  UNIQUE(device_fingerprint, date)
);

-- Indexes
CREATE INDEX idx_att_date ON attendance_records(date);
CREATE INDEX idx_att_teacher ON attendance_records(teacher_id);
CREATE INDEX idx_att_location ON attendance_records(location_id);
CREATE INDEX idx_att_device ON attendance_records(device_fingerprint, date);
CREATE INDEX idx_teachers_fastdoc ON teachers(fastdoc_user_id);

-- RLS (open for anon key - restrict in production)
ALTER TABLE attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on attendance_settings" ON attendance_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on locations" ON locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on teachers" ON teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on attendance_records" ON attendance_records FOR ALL USING (true) WITH CHECK (true);
