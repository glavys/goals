import { NextResponse } from 'next/server';
import { db, authed, localDate } from '../../../lib/db';

export const dynamic = 'force-dynamic';

function bad(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request) {
  if (!authed()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { kind, payload } = body || {};
  const p = payload || {};
  const supabase = db();
  let error = null;

  if (kind === 'trade_open') {
    const instrument = (p.instrument || '').trim();
    const entry = num(p.entry_price);
    const stop = num(p.stop_price);
    const direction = p.direction === 'short' ? 'short' : 'long';

    if (!instrument) return bad('Впиши тикер');
    if (entry === null || entry <= 0) return bad('Впиши цену входа');

    ({ error } = await supabase.from('goals_trades').insert({
      date: p.date || localDate(),
      instrument,
      direction,
      size_usd: num(p.size_usd),
      entry_price: entry,
      take_price: num(p.take_price),
      stop_price: stop,
      thesis: (p.thesis || '').trim() || null,
      by_system: !!p.by_system,
      is_open: true,
      protected: stop !== null,
      feeling: (p.feeling || '').trim() || null,
    }));
  } else if (kind === 'trade_edit') {
    // Правка уже записанной сделки, чаще всего закрытой.
    if (!p.id) return bad('Не понял, какая сделка');
    const instrument = (p.instrument || '').trim();
    const entry = num(p.entry_price);
    const stop = num(p.stop_price);
    const direction = p.direction === 'short' ? 'short' : 'long';

    if (!instrument) return bad('Впиши тикер');
    if (entry === null || entry <= 0) return bad('Впиши цену входа');

    ({ error } = await supabase
      .from('goals_trades')
      .update({
        date: p.date || localDate(),
        instrument,
        direction,
        size_usd: num(p.size_usd),
        entry_price: entry,
        take_price: num(p.take_price),
        stop_price: stop,
        exit_price: num(p.exit_price),
        closed_on: p.closed_on || null,
        thesis: (p.thesis || '').trim() || null,
        review: (p.review || '').trim() || null,
        by_system: !!p.by_system,
        take_by_rule: !!p.take_by_rule,
        protected: stop !== null,
      })
      .eq('id', p.id));
  } else if (kind === 'trade_delete') {
    if (!p.id) return bad('Не понял, какая сделка');
    ({ error } = await supabase.from('goals_trades').delete().eq('id', p.id));
  } else if (kind === 'trade_close') {
    if (!p.id) return bad('Не понял, какая позиция');
    const exit = num(p.exit_price);
    if (exit === null || exit <= 0) return bad('Впиши цену выхода');

    ({ error } = await supabase
      .from('goals_trades')
      .update({
        is_open: false,
        exit_price: exit,
        closed_on: p.closed_on || localDate(),
        take_by_rule: !!p.take_by_rule,
        review: (p.review || '').trim() || null,
      })
      .eq('id', p.id)
      .eq('is_open', true));
  } else if (kind === 'day') {
    ({ error } = await supabase.from('goals_days').upsert(
      {
        d: p.d,
        morning: p.morning ?? null,
        evening: p.evening ?? null,
        charge: p.charge ?? null,
        note: p.note ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'd' }
    ));
  } else if (kind === 'balance') {
    const total = num(p.total_usd);
    if (total === null) return bad('Впиши сумму');
    ({ error } = await supabase.from('goals_balance').upsert(
      { week_start: p.week_start, total_usd: total, note: p.note || null },
      { onConflict: 'week_start' }
    ));
  } else if (kind === 'skip') {
    ({ error } = await supabase.from('goals_skips').insert({
      d: p.d,
      why: p.why || null,
      feeling: p.feeling || null,
      repay: p.repay || null,
    }));
  } else {
    return bad('Неизвестный тип записи');
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
