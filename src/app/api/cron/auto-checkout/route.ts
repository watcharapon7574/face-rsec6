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
      .select('check_out_start')
      .single();

    if (!settings) {
      return NextResponse.json({ error: 'No settings found' }, { status: 500 });
    }

    // Calculate cutoff: 7 days ago (catch any missed days)
    const now = new Date();
    const thaiNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const cutoff = new Date(thaiNow);
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffDate = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

    // Find ALL records (last 7 days) with check-in but no check-out
    const { data: pendingRecords, error: fetchErr } = await supabase
      .from('attendance_records')
      .select('id, date')
      .gte('date', cutoffDate)
      .not('check_in_time', 'is', null)
      .is('check_out_time', null);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!pendingRecords || pendingRecords.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending records', count: 0 });
    }

    // Update each record: check_out_time = record's own date + check_out_start
    let updated = 0;
    for (const record of pendingRecords) {
      const autoCheckoutTime = `${record.date}T${settings.check_out_start}+07:00`;
      const { error: updateErr } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: autoCheckoutTime,
          check_out_liveness: false,
          check_out_face_match: null,
          auto_checkout: true,
        })
        .eq('id', record.id);

      if (!updateErr) updated++;
    }

    return NextResponse.json({
      success: true,
      message: `Auto check-out completed for ${updated} records`,
      count: updated,
    });
  } catch (err) {
    console.error('Auto-checkout cron error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
