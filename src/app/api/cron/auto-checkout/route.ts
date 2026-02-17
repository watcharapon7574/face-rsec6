import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sets this automatically for cron jobs)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Get settings
    const { data: settings } = await supabase
      .from('attendance_settings')
      .select('check_out_start, check_out_end')
      .single();

    if (!settings) {
      return NextResponse.json({ error: 'No settings found' }, { status: 500 });
    }

    // Calculate Thai date
    const now = new Date();
    const thaiNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const today = `${thaiNow.getFullYear()}-${String(thaiNow.getMonth() + 1).padStart(2, '0')}-${String(thaiNow.getDate()).padStart(2, '0')}`;

    // Find records with check-in but no check-out today
    const { data: pendingRecords, error: fetchErr } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('date', today)
      .not('check_in_time', 'is', null)
      .is('check_out_time', null);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!pendingRecords || pendingRecords.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending records', count: 0 });
    }

    // Build auto check-out time: today's date + check_out_start in Thai timezone
    // e.g., "2025-01-15T16:00:00+07:00"
    const autoCheckoutTime = `${today}T${settings.check_out_start}+07:00`;

    // Update all pending records
    const ids = pendingRecords.map((r) => r.id);
    const { error: updateErr, count } = await supabase
      .from('attendance_records')
      .update({
        check_out_time: autoCheckoutTime,
        check_out_liveness: false,
        check_out_face_match: null,
        auto_checkout: true,
      })
      .in('id', ids);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Auto check-out completed for ${count ?? ids.length} records`,
      count: count ?? ids.length,
      date: today,
    });
  } catch (err) {
    console.error('Auto-checkout cron error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
