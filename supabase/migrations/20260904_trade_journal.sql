-- Журнал сделок в два захода + догоняем колонку charge.
-- Прогоняется поверх 20260903_goals.sql, повторный запуск безопасен.

-- 1. Зарядка на экране «Сон». Код её уже пишет, колонки не было.
alter table goals_days add column if not exists charge boolean;

-- 2. Позиция: чем открыли.
alter table goals_trades add column if not exists direction   text;
alter table goals_trades add column if not exists entry_price numeric;
alter table goals_trades add column if not exists stop_price  numeric;
alter table goals_trades add column if not exists take_price  numeric;
alter table goals_trades add column if not exists thesis      text;

-- 3. Позиция: чем закрыли.
alter table goals_trades add column if not exists exit_price numeric;
alter table goals_trades add column if not exists closed_on  date;

-- Направление только спот: лонг или шорт, плеча нет.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'goals_trades_direction_chk'
  ) then
    alter table goals_trades
      add constraint goals_trades_direction_chk
      check (direction is null or direction in ('long', 'short'));
  end if;
end $$;

-- Старые записи без направления считаем лонгами, чтобы журнал не спорил сам с собой.
update goals_trades set direction = 'long' where direction is null;

create index if not exists goals_trades_open_idx on goals_trades (is_open, date desc);
