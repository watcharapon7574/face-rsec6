import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const COOLDOWN_HOURS = 24;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { teacher_uuid, pin_code, lat, lng } = body;

  if (!teacher_uuid || !pin_code) {
    return NextResponse.json({ error: 'กรุณาระบุ PIN' }, { status: 400 });
  }

  const supabase = createServerClient();

  // 1. Verify teacher + PIN
  const { data: teacher, error: fetchErr } = await supabase
    .from('teachers')
    .select('id, pin_code, enrolled_at, enrollment_status')
    .eq('id', teacher_uuid)
    .eq('is_active', true)
    .single();

  if (fetchErr || !teacher) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลครู' }, { status: 404 });
  }

  if (teacher.pin_code !== pin_code) {
    return NextResponse.json({ error: 'PIN ไม่ถูกต้อง' }, { status: 403 });
  }

  // 2. Rate limit: enrolled_at within last 24 hours
  if (teacher.enrolled_at) {
    const lastUpdate = new Date(teacher.enrolled_at);
    const hoursSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
    if (hoursSince < COOLDOWN_HOURS) {
      const remaining = Math.ceil(COOLDOWN_HOURS - hoursSince);
      return NextResponse.json(
        { error: `อัพเดทใบหน้าได้อีกครั้งใน ${remaining} ชั่วโมง` },
        { status: 429 }
      );
    }
  }

  // 3. Location check: must be within a registered location
  if (lat != null && lng != null) {
    const { data: locations } = await supabase
      .from('locations')
      .select('lat, lng, radius_meters, short_name')
      .eq('is_active', true);

    if (locations && locations.length > 0) {
      const withinAny = locations.some((loc) => {
        const R = 6371000;
        const dLat = ((loc.lat - lat) * Math.PI) / 180;
        const dLng = ((loc.lng - lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat * Math.PI) / 180) *
            Math.cos((loc.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return dist <= loc.radius_meters;
      });

      if (!withinAny) {
        return NextResponse.json(
          { error: 'ต้องอยู่ในพื้นที่หน่วยบริการเพื่ออัพเดทใบหน้า' },
          { status: 403 }
        );
      }
    }
  }

  // 4. Reset enrollment
  const { error: updateErr } = await supabase
    .from('teachers')
    .update({
      face_descriptor: null,
      enrollment_status: 'none',
    })
    .eq('id', teacher_uuid);

  if (updateErr) {
    return NextResponse.json(
      { error: 'ไม่สามารถรีเซ็ตได้: ' + updateErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'กรุณาลงทะเบียนใบหน้าใหม่',
  });
}
