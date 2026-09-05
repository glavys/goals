import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

let client = null;

export function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Не заданы SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export function authed() {
  const code = process.env.ACCESS_CODE;
  if (!code) return false;
  return cookies().get('goals_access')?.value === code;
}

export const DEADLINE = '2026-12-31';
export const GYM_TARGET = 40;
export const GYM_MIN_MINUTES = 60;
export const CASH_TARGET_USD = 50000;

// Моя таймзона. Сервер на Vercel живёт в UTC, поэтому дату дня
// и границы недели считаем здесь. Переехал в другой пояс — меняется
// только эта строка.
export const TZ = 'Europe/Moscow';

// Дата в виде ГГГГ-ММ-ДД в моей таймзоне.
// en-CA даёт ровно такой формат, это не про Канаду, а про порядок цифр.
export function localDate(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

// Сдвиг даты на n дней. Считаем в полдень UTC, чтобы перевод часов
// не сдвинул результат на сутки.
export function shiftDate(date, days) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(date) {
  const d = new Date(date + 'T12:00:00Z');
  const shift = (d.getUTCDay() + 6) % 7;
  return shiftDate(date, -shift);
}

export function daysBetween(a, b) {
  return Math.round(
    (new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000
  );
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Считаем сделку по ценам. Размер задан в долларах, поэтому количество
// не нужно: доля движения от входа умножается на размер позиции.
//   риск      = размер × |вход − стоп| / вход
//   результат = размер × (выход − вход) / вход, для шорта знак обратный
export function tradeMath(t) {
  const entry = num(t.entry_price);
  const stop = num(t.stop_price);
  const take = num(t.take_price);
  const exit = num(t.exit_price);
  const size = num(t.size_usd);
  const short = t.direction === 'short';
  const sign = short ? -1 : 1;

  const move = (price) =>
    entry && price !== null && size !== null
      ? (size * sign * (price - entry)) / entry
      : null;

  const risk =
    entry && stop !== null && size !== null
      ? Math.abs((size * (entry - stop)) / entry)
      : null;

  // Для закрытых считаем от цены выхода; у старых записей цен нет,
  // там остаётся результат, введённый руками.
  const computed = move(exit);
  const result = computed !== null ? computed : num(t.result_usd);

  return {
    ...t,
    entry_price: entry,
    stop_price: stop,
    take_price: take,
    exit_price: exit,
    size_usd: size,
    risk_usd: risk,
    planned_usd: move(take),
    result_usd: result,
    // Защищённость — это наличие стопа, а не галочка.
    is_protected: stop !== null,
  };
}
