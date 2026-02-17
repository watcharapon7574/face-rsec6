import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const teacherId = searchParams.get('teacher_id');
    const locationId = searchParams.get('location_id');

    const supabase = createServerClient();

    let query = supabase
      .from('attendance_records')
      .select('*, teachers(full_name, teacher_id, position), locations(short_name, district)')
      .order('check_in_time', { ascending: true });

    if (date) query = query.eq('date', date);
    if (teacherId) query = query.eq('teacher_id', teacherId);
    if (locationId) query = query.eq('location_id', locationId);

    const { data, error } = await query.limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
