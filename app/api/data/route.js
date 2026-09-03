import { NextResponse } from 'next/server';
import { db, authed, GYM_TARGET, GYM_MIN_MINUTES } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const SEASON_START = '2026-09-01';
const SEASON_END = '2026-12-31';
const PER_WEEK = 3;

function iso(d) {
  return d.toISOString().slice(0, 10);
}

function mondayOf(date) {
  const d = new Date(date + 'T00:00:00Z');
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return iso(d);
}

function daysBetween(a, b) {
  return Math.round(
    (new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000
  );
}

export async function GET() {
  if (!authed()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const today = iso(new Date());
  const supabase = db();

  const [wRes, tRes, bRes, dRes, sRes] = await Promise.all([
    supabase
      .from('workouts')
      .select('date, duration')
      .gte('date', SEASON_START)
      .lte('date', SEASON_END),
    supabase.from('goals_trades').select('*').order('date', { ascending: false }),
    supabase.from('goals_balance').select('*').order('week_start', { ascending: true }),
    supabase.from('goals_days').select('*').gte('d', iso(new Date(Date.now() - 40 * 86400000))),
    supabase.from('goals_skips').select('*').order('created_at', { ascending: false }).limit(20),
  ]);

  const firstError = [wRes, tRes, bRes, dRes, sRes].find((r) => r.error);
  if (firstError) {
    return NextResponse.json(
      { error: 'Ошибка базы: ' + firstError.error.message },
      { status: 500 }
    );
  }

  const sessions = (wRes.data || [])
    .filter((w) => (w.duration || 0) >= GYM_MIN_MINUTES)
    .map((w) => w.date)
    .sort();

  const thisMonday = mondayOf(today);
  const thisWeek = sessions.filter((d) => d >= thisMonday).length;

  const byWeek = {};
  for (const d of sessions) {
    const wk = mondayOf(d);
    byWeek[wk] = (byWeek[wk] || 0) + 1;
  }

  let streak = 0;
  let cursor = new Date(thisMonday + 'T00:00:00Z');
  cursor.setUTCDate(cursor.getUTCDate() - 7);
  while ((byWeek[iso(cursor)] || 0) >= PER_WEEK) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  if (thisWeek >= PER_WEEK) streak += 1;

  const weeksElapsed = Math.max(
    1,
    Math.ceil((daysBetween(SEASON_START, today) + 1) / 7)
  );
  const plan = Math.min(GYM_TARGET, weeksElapsed * PER_WEEK);

  const gym = {
    thisWeek,
    perWeek: PER_WEEK,
    total: sessions.length,
    target: GYM_TARGET,
    streak,
    ahead: sessions.length - plan,
    dates: sessions,
    skips: sRes.data || [],
  };

  const dayMap = {};
  for (const row of dRes.data || []) dayMap[row.d] = row;

  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = iso(new Date(Date.now() - i * 86400000));
    const row = dayMap[d] || {};
    days.push({
      d,
      morning: row.morning ?? null,
      evening: row.evening ?? null,
      note: row.note || '',
    });
  }

  function tail(key) {
    let n = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i][key] === true) n += 1;
      else break;
    }
    return n;
  }

  const trades = tRes.data || [];
  const open = trades.filter((t) => t.is_open);

  const sleep = {
    days,
    morningStreak: tail('morning'),
    eveningStreak: tail('evening'),
    protectedOpen: open.filter((t) => t.protected).length,
    totalOpen: open.length,
  };

  const monthStart = today.slice(0, 8) + '01';
  const monthTrades = trades.filter((t) => t.date >= monthStart);
  const closedMonth = monthTrades.filter((t) => !t.is_open);
  const balances = bRes.data || [];

  const cash = {
    trades,
    bySystem: monthTrades.filter((t) => t.by_system).length,
    tradesMonth: monthTrades.length,
    takeByRule: closedMonth.filter((t) => t.take_by_rule === true).length,
    closedMonth: closedMonth.length,
    balances,
    latest: balances.length ? Number(balances[balances.length - 1].total_usd) : null,
    thisWeekLogged: balances.some((b) => b.week_start === thisMonday),
    weekStart: thisMonday,
  };

  const weeksLeft = Math.max(0, Math.ceil(daysBetween(today, SEASON_END) / 7));

  return NextResponse.json({ today, weeksLeft, gym, sleep, cash });
}
