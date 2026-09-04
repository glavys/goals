import { NextResponse } from 'next/server';
import { db, authed } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!authed()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { kind, payload } = body || {};
  const supabase = db();
  let error = null;

  if (kind === 'trade') {
    ({ error } = await supabase.from('goals_trades').insert({
      date: payload.date,
      instrument: payload.instrument,
      size_usd: payload.size_usd || null,
      result_usd: payload.result_usd ?? null,
      is_open: !!payload.is_open,
      by_system: !!payload.by_system,
      take_by_rule: payload.is_open ? null : !!payload.take_by_rule,
      protected: !!payload.protected,
      feeling: payload.feeling || null,
    }));
  } else if (kind === 'trade_update') {
    ({ error } = await supabase
      .from('goals_trades')
      .update({
        protected: payload.protected,
        is_open: payload.is_open,
        result_usd: payload.result_usd ?? null,
        take_by_rule: payload.take_by_rule ?? null,
        review: payload.review ?? null,
      })
      .eq('id', payload.id));
  } else if (kind === 'day') {
    ({ error } = await supabase.from('goals_days').upsert(
      {
        d: payload.d,
        morning: payload.morning ?? null,
        evening: payload.evening ?? null,
        charge: payload.charge ?? null,
        note: payload.note ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'd' }
    ));
  } else if (kind === 'balance') {
    ({ error } = await supabase.from('goals_balance').upsert(
      {
        week_start: payload.week_start,
        total_usd: payload.total_usd,
        note: payload.note || null,
      },
      { onConflict: 'week_start' }
    ));
  } else if (kind === 'skip') {
    ({ error } = await supabase.from('goals_skips').insert({
      d: payload.d,
      why: payload.why || null,
      feeling: payload.feeling || null,
      repay: payload.repay || null,
    }));
  } else {
    return NextResponse.json({ error: 'Неизвестный тип записи' }, { status: 400 });
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
