import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      teacher_uuid,
      action,
      lat,
      lng,
      location_id,
      device_fingerprint,
      liveness_passed,
      face_match_score,
    } = body;

    if (!teacher_uuid || !action || !device_fingerprint) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }
    if (!liveness_passed) {
      return NextResponse.json({ error: 'ไม่ผ่านการตรวจสอบใบหน้า' }, { status: 400 });
    }
    if (face_match_score === undefined || face_match_score === null) {
      return NextResponse.json({ error: 'ไม่มีผลการยืนยันใบหน้า' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Verify teacher by UUID
    const { data: teacher, error: tErr } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', teacher_uuid)
      .eq('is_active', true)
      .single();

    if (tErr || !teacher) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลครู' }, { status: 401 });
    }
    if (teacher.enrollment_status !== 'enrolled') {
      return NextResponse.json({ error: 'ยังไม่ได้ลงทะเบียนใบหน้า' }, { status: 400 });
    }

    // Get global settings
    const { data: settings } = await supabase.from('attendance_settings').select('*').single();
    if (!settings) {
      return NextResponse.json({ error: 'ไม่พบการตั้งค่าระบบ' }, { status: 500 });
    }

    // Verify face match score against threshold
    const threshold = settings.face_match_threshold || 0.5;
    if (face_match_score >= threshold) {
      return NextResponse.json(
        { error: `ใบหน้าไม่ตรงกับที่ลงทะเบียน (ค่าความต่าง: ${face_match_score.toFixed(3)})` },
        { status: 400 }
      );
    }

    // Check time window (use Thai time, UTC+7)
    const now = new Date();
    const thaiNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const currentMinutes = thaiNow.getHours() * 60 + thaiNow.getMinutes();
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

    if (action === 'check_in') {
      const s = toMin(settings.check_in_start), e = toMin(settings.check_in_end);
      if (currentMinutes < s || currentMinutes > e) {
        return NextResponse.json({ error: `ไม่อยู่ในเวลาเข้างาน (${settings.check_in_start}-${settings.check_in_end})` }, { status: 400 });
      }
    } else if (action === 'check_out') {
      const s = toMin(settings.check_out_start), e = toMin(settings.check_out_end);
      if (currentMinutes < s || currentMinutes > e) {
        return NextResponse.json({ error: `ไม่อยู่ในเวลาออกงาน (${settings.check_out_start}-${settings.check_out_end})` }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 });
    }

    // Resolve location
    const locationForRecord = location_id || teacher.location_id;
    const today = `${thaiNow.getFullYear()}-${String(thaiNow.getMonth() + 1).padStart(2, '0')}-${String(thaiNow.getDate()).padStart(2, '0')}`;

    if (action === 'check_in') {
      // Device uniqueness per day
      const { data: existingDevice } = await supabase
        .from('attendance_records')
        .select('teacher_id')
        .eq('device_fingerprint', device_fingerprint)
        .eq('date', today)
        .neq('teacher_id', teacher.id)
        .maybeSingle();

      if (existingDevice) {
        return NextResponse.json({ error: 'อุปกรณ์นี้ถูกใช้ลงเวลาโดยครูท่านอื่นแล้ววันนี้' }, { status: 400 });
      }

      const { data: existing } = await supabase
        .from('attendance_records')
        .select('check_in_time')
        .eq('teacher_id', teacher.id)
        .eq('date', today)
        .maybeSingle();

      if (existing?.check_in_time) {
        return NextResponse.json({ error: 'ลงเวลาเข้างานวันนี้แล้ว' }, { status: 400 });
      }

      const { data: record, error: insertErr } = await supabase
        .from('attendance_records')
        .upsert({
          teacher_id: teacher.id,
          location_id: locationForRecord,
          date: today,
          check_in_time: now.toISOString(),
          check_in_lat: lat,
          check_in_lng: lng,
          device_fingerprint,
          check_in_liveness: true,
          check_in_face_match: face_match_score,
          status: 'present',
        }, { onConflict: 'teacher_id,date' })
        .select()
        .single();

      if (insertErr) {
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึก' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: `เข้างานสำเร็จ - ${teacher.full_name}`, record });
    }

    // check_out
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('teacher_id', teacher.id)
      .eq('date', today)
      .maybeSingle();

    if (!existing?.check_in_time) {
      return NextResponse.json({ error: 'ยังไม่ได้ลงเวลาเข้างานวันนี้' }, { status: 400 });
    }
    if (existing.check_out_time) {
      return NextResponse.json({ error: 'ลงเวลาออกงานวันนี้แล้ว' }, { status: 400 });
    }
    if (existing.device_fingerprint !== device_fingerprint) {
      return NextResponse.json({ error: 'ต้องใช้อุปกรณ์เดียวกันกับที่เข้างาน' }, { status: 400 });
    }

    const { data: record, error: updateErr } = await supabase
      .from('attendance_records')
      .update({
        check_out_time: now.toISOString(),
        check_out_lat: lat,
        check_out_lng: lng,
        check_out_liveness: true,
        check_out_face_match: face_match_score,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึก' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `ออกงานสำเร็จ - ${teacher.full_name}`, record });
  } catch (err) {
    console.error('Attendance API error:', err);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 });
  }
}
