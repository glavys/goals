# goals

Личный трекер трёх целей до конца 2026: Cash, Зал, Сон.

## Переменные окружения

Vercel → Settings → Environment Variables:

| Имя | Где взять |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API → API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | там же, Secret keys (не Publishable) |
| `ACCESS_CODE` | придумывается сам, это код входа на сайт |

Ключи живут только на сервере, в браузер не попадают.

## Установка

1. Supabase → SQL Editor → выполнить по очереди файлы из `supabase/migrations/`
   в порядке дат: сначала `20260903_goals.sql`, потом `20260904_trade_journal.sql`
2. Vercel → Add New → Project → выбрать этот репозиторий
3. Вписать три переменные выше → Deploy

Root Directory оставить пустым: файлы лежат в корне.

## Данные

Тренировки читаются из таблицы `workouts` того же проекта Supabase,
куда пишет workout-tracker. Считаются записи с `duration >= 60`.
Остальное пишется в таблицы `goals_*`.

Цели и решения по ним — в `GOALS.md`.
