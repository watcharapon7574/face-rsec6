-- =============================================================
-- Additive schema for existing main DB (safe to run multiple times)
-- Face Attendance: multi-location + teachers
-- =============================================================

BEGIN;

-- 1) Base extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) attendance_settings (singleton-like)
CREATE TABLE IF NOT EXISTS public.attendance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name TEXT NOT NULL DEFAULT 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 จังหวัดลพบุรี',
  check_in_start TIME NOT NULL DEFAULT '07:00',
  check_in_end TIME NOT NULL DEFAULT '09:30',
  check_out_start TIME NOT NULL DEFAULT '16:00',
  check_out_end TIME NOT NULL DEFAULT '22:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.attendance_settings (org_name)
SELECT 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 จังหวัดลพบุรี'
WHERE NOT EXISTS (SELECT 1 FROM public.attendance_settings);

-- 3) locations
CREATE TABLE IF NOT EXISTS public.locations (
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

-- prevent duplicate same location seed
CREATE UNIQUE INDEX IF NOT EXISTS uq_locations_name_district
  ON public.locations(name, district);

INSERT INTO public.locations (name, short_name, district, lat, lng, radius_meters, is_headquarters)
VALUES
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
  ('หน่วยบริการอำเภอหนองม่วง', 'หน่วยฯ หนองม่วง', 'หนองม่วง', 15.0833, 100.7333, 200, FALSE)
ON CONFLICT (name, district) DO NOTHING;

-- 4) teachers
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  position TEXT DEFAULT '',
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  pin_code TEXT NOT NULL DEFAULT '1234',
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_teachers_teacher_id
  ON public.teachers(teacher_id);

-- optional migration from old employees table (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'employees'
  ) THEN
    INSERT INTO public.teachers (teacher_id, full_name, position, pin_code, is_admin, is_active)
    SELECT
      COALESCE(e.employee_id, 'EMP-' || left(e.id::text, 8)) AS teacher_id,
      COALESCE(e.full_name, 'ไม่ระบุชื่อ') AS full_name,
      COALESCE(e.department, '') AS position,
      COALESCE(e.pin_code, '1234') AS pin_code,
      COALESCE(e.is_admin, false) AS is_admin,
      COALESCE(e.is_active, true) AS is_active
    FROM public.employees e
    ON CONFLICT (teacher_id) DO NOTHING;
  END IF;
END $$;

INSERT INTO public.teachers (teacher_id, full_name, position, pin_code, is_admin)
VALUES ('ADMIN001', 'ผู้ดูแลระบบ', 'ผู้ดูแลระบบ', '0000', TRUE)
ON CONFLICT (teacher_id) DO NOTHING;

-- 5) attendance_records
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
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
  status TEXT DEFAULT 'present',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_attendance_teacher_date'
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT uq_attendance_teacher_date UNIQUE (teacher_id, date);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_attendance_device_date'
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT uq_attendance_device_date UNIQUE (device_fingerprint, date);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_att_date ON public.attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_att_teacher ON public.attendance_records(teacher_id);
CREATE INDEX IF NOT EXISTS idx_att_location ON public.attendance_records(location_id);
CREATE INDEX IF NOT EXISTS idx_att_device ON public.attendance_records(device_fingerprint, date);

-- 6) RLS + broad policy (as current app expects)
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_settings' AND policyname = 'allow_all_attendance_settings'
  ) THEN
    CREATE POLICY allow_all_attendance_settings ON public.attendance_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'locations' AND policyname = 'allow_all_locations'
  ) THEN
    CREATE POLICY allow_all_locations ON public.locations FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'teachers' AND policyname = 'allow_all_teachers'
  ) THEN
    CREATE POLICY allow_all_teachers ON public.teachers FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_records' AND policyname = 'allow_all_attendance_records'
  ) THEN
    CREATE POLICY allow_all_attendance_records ON public.attendance_records FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;
