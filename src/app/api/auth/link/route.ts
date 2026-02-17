import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { teacher_id, pin_code } = body;

  if (!teacher_id || !pin_code) {
    return NextResponse.json({ error: 'กรุณากรอกรหัสครูและ PIN' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: teacher, error } = await supabase
    .from('teachers')
    .select('id, teacher_id, full_name, position, location_id, enrollment_status, device_fingerprint')
    .eq('teacher_id', teacher_id)
    .eq('pin_code', pin_code)
    .eq('is_active', true)
    .single();

  if (error || !teacher) {
    return NextResponse.json({ error: 'รหัสครูหรือ PIN ไม่ถูกต้อง' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    teacher: {
      uuid: teacher.id,
      teacherId: teacher.teacher_id,
      fullName: teacher.full_name,
      enrollmentStatus: teacher.enrollment_status,
      locationId: teacher.location_id,
      deviceFingerprint: teacher.device_fingerprint,
    },
  });
}
