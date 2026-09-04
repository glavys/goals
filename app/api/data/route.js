import { NextResponse } from 'next/server';
import {
  db,
  authed,
  localDate,
  shiftDate,
  mondayOf,
  daysBetween,
  tradeMath,
  GYM_TARGET,
  GYM_MIN_MINUTES,
} from '../../../lib/db';

export const dynamic = 'force-dynamic';

const SEASON_START = '2026-09-01';
const SEASON_END = '2026-12-31';
const PER_WEEK = 3;

export async function GET() {
  if (!authed()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const today = localDate();
  const supabase = db();

  const [wRes, tRes, bRes, dRes, sRes] = await Promise.all([
    supabase
      .from('workouts')
      // Берём с запасом в сутки по краям: в базе время в UTC,
      // а день считаем по моей таймзоне.
      .select('date, duration')
      .gte('date', shiftDate(SEASON_START, -1))
      .lt('date', '2027-01-02'),
    supabase.from('goals_trades').select('*').order('date', { ascending: false }),
    supabase.from('goals_balance').select('*').order('week_start', { ascending: true }),
    supabase.from('goals_days').select('*').gte('d', shiftDate(today, -40)),
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
    .map((w) => localDate(w.date))
    .filter((d) => d >= SEASON_START && d <= SEASON_END)
    .sort();

  const thisMonday = mondayOf(today);
  const thisWeek = sessions.filter((d) => d >= thisMonday).length;

  const byWeek = {};
  for (const d of sessions) {
    const wk = mondayOf(d);
    byWeek[wk] = (byWeek[wk] || 0) + 1;
  }

  let streak = 0;
  let cursor = shiftDate(thisMonday, -7);
  while ((byWeek[cursor] || 0) >= PER_WEEK) {
    streak += 1;
    cursor = shiftDate(cursor, -7);
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
    const d = shiftDate(today, -i);
    const row = dayMap[d] || {};
    days.push({
      d,
      morning: row.morning ?? null,
      evening: row.evening ?? null,
      charge: row.charge ?? null,
      note: row.note || '',
    });
  }

  function tail(key) {
    let n = 0;
    let started = false;
    for (let i = days.length - 1; i >= 0; i--) {
      const v = days[i][key];
      if (v === null && !started) continue;
      if (v === true) {
        n += 1;
        started = true;
      } else break;
    }
    return n;
  }

  const trades = (tRes.data || []).map(tradeMath);
  const open = trades.filter((t) => t.is_open);
  const history = trades
    .filter((t) => !t.is_open)
    .sort((a, b) => (b.closed_on || b.date).localeCompare(a.closed_on || a.date));

  const protectedOpen = open.filter((t) => t.is_protected).length;

  const sleep = {
    days,
    morningStreak: tail('morning'),
    eveningStreak: tail('evening'),
    chargeStreak: tail('charge'),
    protectedOpen,
    totalOpen: open.length,
  };

  const monthStart = today.slice(0, 8) + '01';
  const monthTrades = trades.filter((t) => t.date >= monthStart);
  const closedMonth = history.filter((t) => (t.closed_on || t.date) >= monthStart);
  const withR = closedMonth.filter((t) => t.r !== null);
  const balances = bRes.data || [];

  const cash = {
    open,
    history,
    bySystem: monthTrades.filter((t) => t.by_system).length,
    tradesMonth: monthTrades.length,
    takeByRule: closedMonth.filter((t) => t.take_by_rule === true).length,
    closedMonth: closedMonth.length,
    rMonth: withR.length ? withR.reduce((s, t) => s + t.r, 0) : null,
    balances,
    latest: balances.length ? Number(balances[balances.length - 1].total_usd) : null,
    thisWeekLogged: balances.some((b) => b.week_start === thisMonday),
    weekStart: thisMonday,
  };

  const weeksLeft = Math.max(0, Math.ceil(daysBetween(today, SEASON_END) / 7));

  return NextResponse.json({ today, weeksLeft, gym, sleep, cash });
}
