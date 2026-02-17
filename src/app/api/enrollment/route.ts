import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { teacher_uuid, face_descriptor, device_fingerprint } = body;

  if (!teacher_uuid || !face_descriptor || !Array.isArray(face_descriptor)) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
  }

  if (face_descriptor.length !== 128) {
    return NextResponse.json({ error: 'Face descriptor ไม่ถูกต้อง' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: teacher, error: fetchErr } = await supabase
    .from('teachers')
    .select('id, enrollment_status')
    .eq('id', teacher_uuid)
    .eq('is_active', true)
    .single();

  if (fetchErr || !teacher) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลครู' }, { status: 404 });
  }

  const { error: updateErr } = await supabase
    .from('teachers')
    .update({
      face_descriptor,
      enrollment_status: 'enrolled',
      enrolled_at: new Date().toISOString(),
      device_fingerprint: device_fingerprint || null,
      device_bound_at: device_fingerprint ? new Date().toISOString() : null,
    })
    .eq('id', teacher_uuid);

  if (updateErr) {
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ: ' + updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'ลงทะเบียนใบหน้าสำเร็จ' });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const teacherUuid = searchParams.get('teacher_uuid');

  if (!teacherUuid) {
    return NextResponse.json({ error: 'ไม่ระบุ teacher_uuid' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { error } = await supabase
    .from('teachers')
    .update({
      face_descriptor: null,
      enrollment_status: 'revoked',
      enrolled_at: null,
    })
    .eq('id', teacherUuid);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'ยกเลิกลงทะเบียนใบหน้าแล้ว' });
}
