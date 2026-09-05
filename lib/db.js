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

// Считаем сделку по ценам. Размер задан в долларах, а количество токенов
// выводится из него: qty = размер / вход. Дальше всё считается в токенах,
// поэтому частичные продажи ложатся ровно.
//
//   выручка по продаже   = qty × цена
//   прибыль по продаже   = qty × (цена − вход)      (в шорте знак обратный)
//   остаток позиции, $   = оставшиеся токены × вход
//
// Из позиции вычитается стоимость проданного по цене входа, а не выручка:
// иначе удачная продажа уменьшала бы позицию сильнее, чем продано на самом
// деле. Прибыль уходит в «зафиксировано», а не в остаток.
export function tradeMath(t) {
  const entry = num(t.entry_price);
  const stop = num(t.stop_price);
  const take = num(t.take_price);
  const exitPrice = num(t.exit_price);
  const size = num(t.size_usd);
  const sign = t.direction === 'short' ? -1 : 1;

  const qty = entry && size !== null ? size / entry : null;

  // Список продаж. У старых записей его нет — там одна продажа всей позиции
  // по exit_price.
  let raw = Array.isArray(t.exits) ? t.exits : [];
  if (!raw.length && !t.is_open && exitPrice !== null && qty !== null) {
    raw = [{ d: t.closed_on || t.date, qty, price: exitPrice }];
  }

  const exits = raw
    .map((e, i) => {
      const q = num(e.qty);
      const p = num(e.price);
      if (q === null || p === null) return null;
      return {
        i,
        d: e.d || t.closed_on || t.date,
        qty: q,
        price: p,
        usd: q * sign * (p - entry),
      };
    })
    .filter(Boolean);

  const soldQty = exits.reduce((s, e) => s + e.qty, 0);
  const realized = exits.length ? exits.reduce((s, e) => s + e.usd, 0) : null;
  const avgExit = soldQty ? exits.reduce((s, e) => s + e.qty * e.price, 0) / soldQty : null;

  const leftQty = qty === null ? null : Math.max(0, qty - soldQty);
  const leftUsd = leftQty === null || entry === null ? null : leftQty * entry;

  // Риск считается на остаток, а не на исходный размер.
  const risk =
    entry && stop !== null && leftUsd !== null
      ? Math.abs((leftUsd * (entry - stop)) / entry)
      : null;

  // Совсем старые записи без цен: результат остаётся тем, что вписан руками.
  const result = !t.is_open ? (realized !== null ? realized : num(t.result_usd)) : null;

  return {
    ...t,
    entry_price: entry,
    stop_price: stop,
    take_price: take,
    exit_price: exitPrice,
    size_usd: size,
    qty,
    exits,
    sold_qty: soldQty,
    left_qty: leftQty,
    left_usd: leftUsd,
    sold_share: qty ? Math.min(1, soldQty / qty) : null,
    avg_exit: avgExit,
    realized_usd: realized,
    risk_usd: risk,
    planned_usd:
      entry && take !== null && leftUsd !== null ? (leftUsd * sign * (take - entry)) / entry : null,
    result_usd: result,
    // Защищённость — это наличие стопа, а не галочка.
    is_protected: stop !== null,
  };
}

// Позиция считается закрытой, когда остаток стёрся до нуля. Сравнение
// не строгое: дробные доли не делятся нацело.
export function isDrained(qty, soldQty) {
  if (!qty) return false;
  return qty - soldQty <= qty * 1e-6;
}
