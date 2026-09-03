create extension if not exists "pgcrypto";

create table if not exists goals_trades (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  date         date not null,
  instrument   text not null,
  size_usd     numeric,
  result_usd   numeric,
  is_open      boolean not null default false,
  by_system    boolean not null default true,
  take_by_rule boolean,
  protected    boolean not null default false,
  feeling      text,
  review       text
);

create index if not exists goals_trades_date_idx on goals_trades (date desc);

create table if not exists goals_balance (
  week_start  date primary key,
  total_usd   numeric not null,
  note        text,
  created_at  timestamptz not null default now()
);

create table if not exists goals_days (
  d          date primary key,
  morning    boolean,
  evening    boolean,
  note       text,
  updated_at timestamptz not null default now()
);

create table if not exists goals_skips (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  d          date not null,
  why        text,
  feeling    text,
  repay      text
);

alter table goals_trades  enable row level security;
alter table goals_balance enable row level security;
alter table goals_days    enable row level security;
alter table goals_skips   enable row level security;
