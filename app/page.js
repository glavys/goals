'use client';

import { useEffect, useState } from 'react';

const TODAY = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

async function post(kind, payload) {
  const res = await fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, payload }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || 'Не сохранилось');
  }
}

export default function Page() {
  const [data, setData] = useState(null);
  const [needCode, setNeedCode] = useState(false);
  const [view, setView] = useState('list');
  const [err, setErr] = useState('');

  async function load() {
    setErr('');
    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      if (res.status === 401) {
        setNeedCode(true);
        setData(null);
        return;
      }
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.error || `Не загрузилось (${res.status})`);
        return;
      }
      setNeedCode(false);
      setData(j);
    } catch (e) {
      setErr('Нет связи с сервером. Проверь интернет и нажми «Ещё раз».');
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (needCode) return <Gate onDone={load} />;

  if (err)
    return (
      <main>
        <p className="warn">{err}</p>
        <button className="btn ghost" onClick={load}>
          Ещё раз
        </button>
      </main>
    );

  if (!data)
    return (
      <main>
        <p className="muted">Загружаю…</p>
      </main>
    );

  const shared = { data, reload: load, back: () => setView('list') };

  return (
    <main>
      {view === 'list' && <List data={data} go={setView} />}
      {view === 'cash' && <Cash {...shared} />}
      {view === 'gym' && <Gym {...shared} />}
      {view === 'sleep' && <Sleep {...shared} />}
    </main>
  );
}

function Gate({ onDone }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  async function submit() {
    if (!code.trim()) {
      setMsg('Введи код');
      return;
    }
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (res.ok) onDone();
    else setMsg('Неверный код');
  }

  return (
    <main>
      <div className="gate">
        <div className="head">
          <h1>Цели</h1>
          <div className="sub">Введи код доступа</div>
        </div>
        <input
          type="password"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setMsg('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {msg && <p className="warn" style={{ fontSize: 13 }}>{msg}</p>}
        <button className="btn" onClick={submit}>
          Войти
        </button>
      </div>
    </main>
  );
}

function List({ data, go }) {
  return (
    <>
      <div className="head">
        <h1>Цели</h1>
        <div className="sub">до 31 декабря · осталось {data.weeksLeft} недель</div>
      </div>
      <div className="list">
        <button className="row" onClick={() => go('cash')}>
          <span>Cash</span>
          <span className="chev">›</span>
        </button>
        <button className="row" onClick={() => go('gym')}>
          <span>Зал</span>
          <span className="chev">›</span>
        </button>
        <button className="row" onClick={() => go('sleep')}>
          <span>Сон</span>
          <span className="chev">›</span>
        </button>
      </div>
      <div className="quick">
        <button className="link" onClick={() => go('cash')}>
          Записать сделку
        </button>
        <button className="link" onClick={() => go('sleep')}>
          Отметить день
        </button>
      </div>
    </>
  );
}

function Back({ onClick }) {
  return (
    <button className="back" onClick={onClick}>
      ‹ Цели
    </button>
  );
}

function Stat({ label, value, warn }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span className={'value' + (warn ? ' warn' : '')}>{value}</span>
    </div>
  );
}

function Gym({ data, reload, back }) {
  const g = data.gym;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ why: '', feeling: '', repay: '' });
  const [busy, setBusy] = useState(false);

  const days = [];
  const done = new Set(g.dates);
  const start = new Date('2026-09-01T00:00:00Z');
  const end = new Date('2026-12-31T00:00:00Z');
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const s = d.toISOString().slice(0, 10);
    days.push({ s, on: done.has(s) });
  }

  async function save() {
    setBusy(true);
    try {
      await post('skip', { d: TODAY(), ...f });
      setF({ why: '', feeling: '', repay: '' });
      setOpen(false);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Back onClick={back} />
      <div className="head">
        <h1>Зал</h1>
        <div className="sub">три раза в неделю, от часа</div>
      </div>

      <div className="big">
        {g.thisWeek} из {g.perWeek}
      </div>
      <div className="sub">на этой неделе</div>

      <div className="section">
        <Stat label="Всего" value={`${g.total} из ${g.target}`} />
        <div className="bar">
          <i style={{ width: Math.min(100, (g.total / g.target) * 100) + '%' }} />
        </div>
        <Stat label="Недель подряд по три" value={g.streak} />
        <Stat
          label="Против плана"
          value={g.ahead >= 0 ? `+${g.ahead}` : g.ahead}
          warn={g.ahead < 0}
        />
      </div>

      <div className="section">
        <h2>Сентябрь — декабрь</h2>
        <div className="grid">
          {days.map((d) => (
            <span
              key={d.s}
              title={d.s}
              className={'cell' + (d.on ? ' on' : '') + (d.s === data.today ? ' today' : '')}
            />
          ))}
        </div>
      </div>

      <div className="section">
        {!open && (
          <button className="btn ghost" onClick={() => setOpen(true)}>
            Я не пошёл в зал
          </button>
        )}
        {open && (
          <>
            <h2>Почему не пошёл</h2>
            <textarea
              placeholder="Что помешало"
              value={f.why}
              onChange={(e) => setF({ ...f, why: e.target.value })}
            />
            <textarea
              placeholder="Что чувствовал"
              value={f.feeling}
              onChange={(e) => setF({ ...f, feeling: e.target.value })}
            />
            <textarea
              placeholder="Как возмещу"
              value={f.repay}
              onChange={(e) => setF({ ...f, repay: e.target.value })}
            />
            <div className="toggle">
              <button onClick={() => setOpen(false)}>Отмена</button>
              <button className="sel" disabled={busy} onClick={save}>
                Записать
              </button>
            </div>
          </>
        )}
      </div>

      {g.skips.length > 0 && (
        <div className="section">
          <h2>Записи</h2>
          {g.skips.map((s) => (
            <div className="entry" key={s.id}>
              {s.why || '—'}
              <div className="meta">{s.d}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Sleep({ data, reload, back }) {
  const s = data.sleep;
  const today = TODAY();
  const todayRow = s.days.find((d) => d.d === today) || {};
  const [note, setNote] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!dirty) setNote(todayRow.note || '');
  }, [todayRow.note, dirty]);

  async function mark(key, val) {
    setBusy(true);
    try {
      await post('day', {
        d: today,
        morning: todayRow.morning ?? null,
        evening: todayRow.evening ?? null,
        charge: todayRow.charge ?? null,
        note: todayRow.note ?? null,
        [key]: todayRow[key] === val ? null : val,
      });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    setBusy(true);
    try {
      await post('day', {
        d: today,
        morning: todayRow.morning ?? null,
        evening: todayRow.evening ?? null,
        charge: todayRow.charge ?? null,
        note,
      });
      setDirty(false);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const cls = (v) => 'cell' + (v === true ? ' on' : v === false ? ' off' : '');

  const rows = [
    ['morning', 'Утро без телефона'],
    ['evening', 'Вечер без ленты'],
    ['charge', 'Зарядка'],
  ];

  return (
    <>
      <Back onClick={back} />
      <div className="head">
        <h1>Сон</h1>
        <div className="sub">телефон ночует на столе</div>
      </div>

      <div className="section" style={{ marginTop: 0 }}>
        <h2>Сегодня</h2>
        {rows.map(([key, label]) => (
          <div className="day-row" key={key}>
            <span className="name">{label}</span>
            <div className="seg">
              <button
                disabled={busy}
                className={todayRow[key] === true ? 'yes' : ''}
                onClick={() => mark(key, true)}
              >
                Да
              </button>
              <button
                disabled={busy}
                className={todayRow[key] === false ? 'no' : ''}
                onClick={() => mark(key, false)}
              >
                Нет
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="section">
        <Stat label="Утро без телефона" value={`${s.morningStreak} дней подряд`} />
        <Stat label="Вечер без ленты" value={`${s.eveningStreak} дней подряд`} />
        <Stat label="Зарядка" value={`${s.chargeStreak ?? 0} дней подряд`} />
        <Stat
          label="Позиции под защитой"
          value={`${s.protectedOpen} из ${s.totalOpen}`}
          warn={s.totalOpen > s.protectedOpen}
        />
      </div>

      <div className="section">
        <h2>Утро</h2>
        <div className="grid">
          {s.days.map((d) => (
            <span key={'m' + d.d} title={d.d} className={cls(d.morning)} />
          ))}
        </div>
      </div>

      <div className="section">
        <h2>Вечер</h2>
        <div className="grid">
          {s.days.map((d) => (
            <span key={'e' + d.d} title={d.d} className={cls(d.evening)} />
          ))}
        </div>
      </div>

      <div className="section">
        <h2>Зарядка</h2>
        <div className="grid">
          {s.days.map((d) => (
            <span key={'c' + d.d} title={d.d} className={cls(d.charge)} />
          ))}
        </div>
      </div>

      <div className="section">
        <h2>Заметка, если есть что сказать</h2>
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setDirty(true);
          }}
        />
        <button className="btn ghost" disabled={busy || !dirty} onClick={saveNote}>
          Сохранить
        </button>
      </div>
    </>
  );
}

// ——— Cash ———————————————————————————————————————————————

// Цена: у BTC и у мелких монет разный масштаб, поэтому знаки после
// запятой подбираются под число, а не задаются жёстко.
function fmtPrice(v) {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  const digits = Math.abs(n) >= 100 ? 2 : Math.abs(n) >= 1 ? 4 : 8;
  return n.toLocaleString('ru-RU', { maximumFractionDigits: digits });
}

function fmtUsd(v) {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  const s = Math.abs(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  return (n > 0 ? '+$' : n < 0 ? '−$' : '$') + s;
}

function fmtR(r) {
  if (r === null || r === undefined) return null;
  return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(1) + 'R';
}

// То же, что tradeMath на сервере, но для живого предпросмотра в форме.
function preview({ direction, size_usd, entry_price, stop_price, price }) {
  const entry = Number(entry_price);
  const stop = Number(stop_price);
  const size = Number(size_usd);
  const p = Number(price);
  if (!entry || !size || !p) return null;
  const sign = direction === 'short' ? -1 : 1;
  const result = (size * sign * (p - entry)) / entry;
  const risk = stop ? Math.abs((size * (entry - stop)) / entry) : null;
  return { result, r: risk ? result / risk : null };
}

const DIR = { long: 'лонг', short: 'шорт' };

function Cash({ data, reload, back }) {
  const c = data.cash;
  const [tab, setTab] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [bal, setBal] = useState('');

  const blank = {
    date: TODAY(),
    instrument: '',
    direction: 'long',
    size_usd: '',
    entry_price: '',
    take_price: '',
    stop_price: '',
    thesis: '',
    by_system: true,
  };
  const [t, setT] = useState(blank);

  async function openTrade() {
    setBusy(true);
    setMsg('');
    try {
      await post('trade_open', t);
      setT({ ...blank, date: t.date });
      setTab(null);
      await reload();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveBalance() {
    setBusy(true);
    setMsg('');
    try {
      await post('balance', { week_start: c.weekStart, total_usd: Number(bal) });
      setBal('');
      setTab(null);
      await reload();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  const pct = c.latest ? Math.min(100, (c.latest / 50000) * 100) : 0;
  const plan = preview({ ...t, price: t.take_price });

  return (
    <>
      <Back onClick={back} />
      <div className="head">
        <h1>Cash</h1>
        <div className="sub">сделки по системе, фиксация по правилу</div>
      </div>

      <div className="big">
        {c.latest === null ? '—' : '$' + c.latest.toLocaleString('ru-RU')}
      </div>
      <div className="sub">
        {c.thisWeekLogged ? 'записано на этой неделе' : 'на этой неделе ещё не записан'}
      </div>
      <div className="bar">
        <i style={{ width: pct + '%' }} />
      </div>
      <div className="sub">цель $50 000</div>

      <div className="section">
        <Stat label="Сделок по системе" value={`${c.bySystem} из ${c.tradesMonth}`} />
        <Stat label="Фиксация по правилу" value={`${c.takeByRule} из ${c.closedMonth}`} />
        <Stat
          label="Позиции под защитой"
          value={`${c.open.filter((o) => o.is_protected).length} из ${c.open.length}`}
          warn={c.open.some((o) => !o.is_protected)}
        />
        {c.rMonth !== null && (
          <Stat label="Результат месяца" value={fmtR(c.rMonth)} />
        )}
      </div>

      <div className="section">
        <div className="toggle">
          <button
            className={tab === 'trade' ? 'sel' : ''}
            onClick={() => {
              setTab(tab === 'trade' ? null : 'trade');
              setMsg('');
            }}
          >
            Открыть позицию
          </button>
          <button
            className={tab === 'bal' ? 'sel' : ''}
            onClick={() => {
              setTab(tab === 'bal' ? null : 'bal');
              setMsg('');
            }}
          >
            Баланс за неделю
          </button>
        </div>
      </div>

      {tab === 'trade' && (
        <div className="section">
          <input
            type="date"
            value={t.date}
            onChange={(e) => setT({ ...t, date: e.target.value })}
          />
          <input
            type="text"
            placeholder="Тикер"
            value={t.instrument}
            onChange={(e) => setT({ ...t, instrument: e.target.value })}
          />
          <div className="toggle" style={{ marginBottom: 10 }}>
            <button
              className={t.direction === 'long' ? 'sel' : ''}
              onClick={() => setT({ ...t, direction: 'long' })}
            >
              Лонг
            </button>
            <button
              className={t.direction === 'short' ? 'sel' : ''}
              onClick={() => setT({ ...t, direction: 'short' })}
            >
              Шорт
            </button>
          </div>
          <input
            type="number"
            placeholder="Размер, $"
            value={t.size_usd}
            onChange={(e) => setT({ ...t, size_usd: e.target.value })}
          />
          <input
            type="number"
            placeholder="Цена входа"
            value={t.entry_price}
            onChange={(e) => setT({ ...t, entry_price: e.target.value })}
          />
          <input
            type="number"
            placeholder="Тейк"
            value={t.take_price}
            onChange={(e) => setT({ ...t, take_price: e.target.value })}
          />
          <input
            type="number"
            placeholder="Стоп"
            value={t.stop_price}
            onChange={(e) => setT({ ...t, stop_price: e.target.value })}
          />
          {plan && plan.r !== null && (
            <div className="muted" style={{ marginBottom: 10 }}>
              По плану {fmtR(plan.r)} · риск {fmtUsd(Math.abs(plan.result / plan.r))}
            </div>
          )}
          <textarea
            placeholder="Тезис: почему входишь"
            value={t.thesis}
            onChange={(e) => setT({ ...t, thesis: e.target.value })}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={t.by_system}
              onChange={(e) => setT({ ...t, by_system: e.target.checked })}
            />
            Вход по системе
          </label>
          {msg && <p className="warn" style={{ fontSize: 13 }}>{msg}</p>}
          <button className="btn" disabled={busy} onClick={openTrade}>
            Открыть
          </button>
        </div>
      )}

      {tab === 'bal' && (
        <div className="section">
          <div className="muted" style={{ marginBottom: 8 }}>
            Неделя от {c.weekStart}
          </div>
          <input
            type="number"
            placeholder="Всего в стейбле, $"
            value={bal}
            onChange={(e) => setBal(e.target.value)}
          />
          {msg && <p className="warn" style={{ fontSize: 13 }}>{msg}</p>}
          <button className="btn" disabled={busy} onClick={saveBalance}>
            Сохранить
          </button>
        </div>
      )}

      <div className="section">
        <h2>Открытые позиции</h2>
        {c.open.length === 0 && <p className="muted">Открытых позиций нет.</p>}
        {c.open.map((tr) => (
          <OpenPosition key={tr.id} tr={tr} reload={reload} />
        ))}
      </div>

      <div className="section">
        <h2>История</h2>
        {c.history.length === 0 && (
          <p className="muted">Пока пусто. Закрытые сделки приезжают сюда.</p>
        )}
        {c.history.map((tr) => (
          <Closed key={tr.id} tr={tr} />
        ))}
      </div>
    </>
  );
}

function OpenPosition({ tr, reload }) {
  const [form, setForm] = useState(null); // 'close' | 'levels'
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [x, setX] = useState({
    exit_price: '',
    closed_on: TODAY(),
    take_by_rule: false,
    review: '',
  });
  const [lv, setLv] = useState({
    stop_price: tr.stop_price ?? '',
    take_price: tr.take_price ?? '',
    thesis: tr.thesis ?? '',
  });

  async function send(kind, payload) {
    setBusy(true);
    setMsg('');
    try {
      await post(kind, payload);
      setForm(null);
      await reload();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  const now = preview({ ...tr, price: x.exit_price });

  return (
    <div className="entry">
      <div className="line">
        <span>
          {tr.instrument} · {DIR[tr.direction] || 'лонг'}
        </span>
        <span>{tr.size_usd === null ? '—' : '$' + Number(tr.size_usd).toLocaleString('ru-RU')}</span>
      </div>
      <div className="meta">
        вход {fmtPrice(tr.entry_price)}
        {tr.take_price !== null && ` · тейк ${fmtPrice(tr.take_price)}`}
        {tr.stop_price !== null && ` · стоп ${fmtPrice(tr.stop_price)}`}
        {tr.r_planned !== null && ` · по плану ${fmtR(tr.r_planned)}`}
      </div>
      <div className="meta">
        {tr.date}
        {tr.by_system ? ' · по системе' : ' · вне системы'}
      </div>
      {!tr.is_protected && (
        <div className="meta warn">Стоп не выставлен — поставить сейчас</div>
      )}
      {tr.thesis && <div className="thesis">{tr.thesis}</div>}

      {!form && (
        <div className="actions">
          <button className="link" onClick={() => setForm('close')}>
            Закрыть позицию
          </button>
          <button className="link" onClick={() => setForm('levels')}>
            {tr.is_protected ? 'Подвинуть стоп или тейк' : 'Выставить стоп'}
          </button>
        </div>
      )}

      {form === 'close' && (
        <div className="form">
          <input
            type="number"
            placeholder="Цена выхода"
            value={x.exit_price}
            onChange={(e) => setX({ ...x, exit_price: e.target.value })}
          />
          <input
            type="date"
            value={x.closed_on}
            onChange={(e) => setX({ ...x, closed_on: e.target.value })}
          />
          {now && (
            <div className="muted" style={{ marginBottom: 10 }}>
              Выходит {fmtUsd(now.result)}
              {now.r !== null && ` · ${fmtR(now.r)}`}
            </div>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={x.take_by_rule}
              onChange={(e) => setX({ ...x, take_by_rule: e.target.checked })}
            />
            Зафиксировал по правилу
          </label>
          <textarea
            placeholder="Разбор: что сработало, что нет"
            value={x.review}
            onChange={(e) => setX({ ...x, review: e.target.value })}
          />
          {msg && <p className="warn" style={{ fontSize: 13 }}>{msg}</p>}
          <div className="toggle">
            <button onClick={() => setForm(null)}>Отмена</button>
            <button
              className="sel"
              disabled={busy}
              onClick={() => send('trade_close', { id: tr.id, ...x })}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {form === 'levels' && (
        <div className="form">
          <input
            type="number"
            placeholder="Стоп"
            value={lv.stop_price}
            onChange={(e) => setLv({ ...lv, stop_price: e.target.value })}
          />
          <input
            type="number"
            placeholder="Тейк"
            value={lv.take_price}
            onChange={(e) => setLv({ ...lv, take_price: e.target.value })}
          />
          <textarea
            placeholder="Тезис"
            value={lv.thesis}
            onChange={(e) => setLv({ ...lv, thesis: e.target.value })}
          />
          {msg && <p className="warn" style={{ fontSize: 13 }}>{msg}</p>}
          <div className="toggle">
            <button onClick={() => setForm(null)}>Отмена</button>
            <button
              className="sel"
              disabled={busy}
              onClick={() => send('trade_levels', { id: tr.id, ...lv })}
            >
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Closed({ tr }) {
  const r = fmtR(tr.r);
  return (
    <div className="entry">
      <div className="line">
        <span>
          {tr.instrument} · {DIR[tr.direction] || 'лонг'}
        </span>
        <span>
          {fmtUsd(tr.result_usd)}
          {r && <span className="muted"> · {r}</span>}
        </span>
      </div>
      <div className="meta">
        {tr.date}
        {tr.closed_on && tr.closed_on !== tr.date ? ` → ${tr.closed_on}` : ''}
        {tr.by_system ? ' · по системе' : ' · вне системы'}
        {tr.take_by_rule ? ' · фиксация по правилу' : ''}
      </div>
      {tr.entry_price !== null && (
        <div className="meta">
          вход {fmtPrice(tr.entry_price)} → выход {fmtPrice(tr.exit_price)}
          {tr.stop_price !== null && ` · стоп ${fmtPrice(tr.stop_price)}`}
          {tr.size_usd !== null &&
            ` · размер $${Number(tr.size_usd).toLocaleString('ru-RU')}`}
        </div>
      )}
      {tr.thesis && <div className="thesis">{tr.thesis}</div>}
      {tr.review && <div className="thesis">{tr.review}</div>}
    </div>
  );
}
