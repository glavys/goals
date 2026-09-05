import { NextResponse } from 'next/server';
import { db, authed, localDate, isDrained } from '../../../lib/db';

export const dynamic = 'force-dynamic';

function bad(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}


// Достаём сделку и считаем, сколько токенов в ней всего и сколько уже продано.
async function loadTrade(supabase, id) {
  const { data, error } = await supabase
    .from('goals_trades')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { error: { message: 'Сделка не найдена' } };
  const entry = num(data.entry_price);
  const size = num(data.size_usd);
  const qty = entry && size !== null ? size / entry : null;
  const exits = Array.isArray(data.exits) ? data.exits : [];
  const sold = exits.reduce((s, e) => s + (num(e.qty) || 0), 0);
  return { trade: data, qty, exits, sold };
}

// Средняя цена выхода по списку продаж — взвешенная по количеству.
function avgPrice(exits) {
  const q = exits.reduce((s, e) => s + (num(e.qty) || 0), 0);
  if (!q) return null;
  return exits.reduce((s, e) => s + (num(e.qty) || 0) * (num(e.price) || 0), 0) / q;
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

    // Если по сделке есть частичные продажи, цену выхода задают они,
    // а не форма: правка не должна разъезжаться со списком.
    const cur = await loadTrade(supabase, p.id);
    if (cur.error) {
      return NextResponse.json({ error: cur.error.message }, { status: 500 });
    }
    const byExits = cur.exits.length > 0;

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
        exit_price: byExits ? avgPrice(cur.exits) : num(p.exit_price),
        closed_on: byExits ? cur.trade.closed_on : p.closed_on || null,
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
  } else if (kind === 'trade_tp') {
    if (!p.id) return bad('Не понял, какая сделка');
    const qty = num(p.qty);
    const price = num(p.price);
    if (qty === null || qty <= 0) return bad('Впиши количество токенов');
    if (price === null || price <= 0) return bad('Впиши цену продажи');

    const loaded = await loadTrade(supabase, p.id);
    if (loaded.error) {
      return NextResponse.json({ error: loaded.error.message }, { status: 500 });
    }
    if (loaded.qty === null) {
      return bad('Сначала впиши размер позиции и цену входа');
    }
    const left = loaded.qty - loaded.sold;
    if (qty > left * (1 + 1e-6)) {
      return bad('Продаёшь больше, чем осталось в позиции');
    }

    const exits = [...loaded.exits, { d: p.d || localDate(), qty, price }];
    const done = isDrained(loaded.qty, loaded.sold + qty);

    ({ error } = await supabase
      .from('goals_trades')
      .update({
        exits,
        is_open: !done,
        closed_on: done ? p.d || localDate() : null,
        exit_price: done ? avgPrice(exits) : null,
      })
      .eq('id', p.id));
  } else if (kind === 'trade_tp_remove') {
    if (!p.id) return bad('Не понял, какая сделка');
    const idx = Number(p.index);
    const loaded = await loadTrade(supabase, p.id);
    if (loaded.error) {
      return NextResponse.json({ error: loaded.error.message }, { status: 500 });
    }
    if (!Number.isInteger(idx) || idx < 0 || idx >= loaded.exits.length) {
      return bad('Такой продажи нет');
    }

    const exits = loaded.exits.filter((_, i) => i !== idx);
    const soldNow = exits.reduce((s, e) => s + (num(e.qty) || 0), 0);
    const done = loaded.qty !== null && exits.length > 0 && isDrained(loaded.qty, soldNow);

    ({ error } = await supabase
      .from('goals_trades')
      .update({
        exits,
        is_open: !done,
        closed_on: done ? loaded.trade.closed_on : null,
        exit_price: done ? avgPrice(exits) : null,
      })
      .eq('id', p.id));
  } else if (kind === 'trade_close') {
    if (!p.id) return bad('Не понял, какая позиция');
    const exit = num(p.exit_price);
    if (exit === null || exit <= 0) return bad('Впиши цену выхода');
    const when = p.closed_on || localDate();

    const loaded = await loadTrade(supabase, p.id);
    if (loaded.error) {
      return NextResponse.json({ error: loaded.error.message }, { status: 500 });
    }

    // Остаток закрывается одной продажей — тогда полный выход и выход
    // после частичных считаются по одной и той же формуле.
    const left = loaded.qty === null ? null : Math.max(0, loaded.qty - loaded.sold);
    const exits = left ? [...loaded.exits, { d: when, qty: left, price: exit }] : loaded.exits;

    ({ error } = await supabase
      .from('goals_trades')
      .update({
        exits,
        is_open: false,
        exit_price: exits.length ? avgPrice(exits) : exit,
        closed_on: when,
        take_by_rule: !!p.take_by_rule,
        review: (p.review || '').trim() || null,
      })
      .eq('id', p.id));
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
