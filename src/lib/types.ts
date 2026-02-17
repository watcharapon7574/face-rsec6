export interface AttendanceSettings {
  id: string;
  org_name: string;
  check_in_start: string;
  check_in_end: string;
  check_out_start: string;
  check_out_end: string;
  face_match_threshold: number;
  late_after: string;
}

export interface Location {
  id: string;
  name: string;
  short_name: string;
  district: string;
  lat: number;
  lng: number;
  radius_meters: number;
  is_headquarters: boolean;
  is_active: boolean;
  created_at: string;
}

export type EnrollmentStatus = 'none' | 'enrolled' | 'revoked';

export interface Teacher {
  id: string;
  teacher_id: string;
  full_name: string;
  position: string;
  location_id: string | null;
  pin_code: string;
  is_admin: boolean;
  is_active: boolean;
  fastdoc_user_id: string | null;
  fastdoc_email: string | null;
  enrollment_status: EnrollmentStatus;
  face_descriptor: number[] | null;
  enrolled_at: string | null;
  device_fingerprint: string | null;
  device_bound_at: string | null;
  created_at: string;
  locations?: Location;
}

export interface AttendanceRecord {
  id: string;
  teacher_id: string;
  location_id: string | null;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  device_fingerprint: string;
  check_in_liveness: boolean;
  check_out_liveness: boolean;
  check_in_face_match: number | null;
  check_out_face_match: number | null;
  status: string;
  auto_checkout: boolean;
  created_at: string;
  teachers?: Teacher;
  locations?: Location;
}

export type AttendanceAction = 'check_in' | 'check_out';

export interface AttendanceRequest {
  teacher_uuid: string;
  action: AttendanceAction;
  lat: number;
  lng: number;
  location_id: string | null;
  device_fingerprint: string;
  liveness_passed: boolean;
  face_match_score: number;
}

export interface TimeStatus {
  canCheckIn: boolean;
  canCheckOut: boolean;
  message: string;
  currentTime: string;
}

export interface UserSession {
  teacherUuid: string;
  teacherId: string;
  fullName: string;
  enrollmentStatus: EnrollmentStatus;
  locationId: string | null;
  isAdmin: boolean;
}
