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
