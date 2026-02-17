import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('teachers')
      .select('*, locations(id, short_name, district)')
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('teachers')
      .insert({
        teacher_id: body.teacher_id,
        full_name: body.full_name,
        position: body.position || '',
        location_id: body.location_id || null,
        pin_code: body.pin_code || '1234',
        is_admin: body.is_admin || false,
      })
      .select('*, locations(id, short_name, district)')
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'รหัสครูซ้ำ' }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 });

    const supabase = createServerClient();
    const { error } = await supabase.from('teachers').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
