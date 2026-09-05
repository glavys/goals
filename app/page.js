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
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const digits = Math.abs(n) >= 100 ? 2 : Math.abs(n) >= 1 ? 4 : 8;
  return n.toLocaleString('ru-RU', { maximumFractionDigits: digits });
}

function fmtUsd(v, withSign = true) {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  const s = Math.abs(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  if (!withSign) return '$' + s;
  return (n > 0 ? '+$' : n < 0 ? '−$' : '$') + s;
}

function fmtDay(d) {
  return d ? d.slice(8, 10) + '.' + d.slice(5, 7) : '';
}

// Запятая как разделитель — привычнее, но серверу нужна точка.
function dot(v) {
  return typeof v === 'string' ? v.replace(',', '.') : v;
}

const DIR = { long: 'спот бай', short: 'шорт' };

// Что выйдет по этой цене — для живой подсказки в форме.
function preview({ direction, size_usd, entry_price, stop_price, price }) {
  const entry = Number(dot(entry_price));
  const stop = Number(dot(stop_price));
  const size = Number(dot(size_usd));
  const p = Number(dot(price));
  if (!entry || !size || !p) return null;
  const sign = direction === 'short' ? -1 : 1;
  return {
    result: (size * sign * (p - entry)) / entry,
    risk: stop ? Math.abs((size * (entry - stop)) / entry) : null,
  };
}

function Chip({ tone, children }) {
  return <span className={'chip' + (tone ? ' ' + tone : '')}>{children}</span>;
}

// Поле формы. type="text" с цифровой клавиатурой: у него нет ни стрелок,
// ни прокрутки колесом, которые меняют число мимо воли.
function Field({ k, wide, area, ...props }) {
  return (
    <label className={'cell' + (wide ? ' wide' : '')}>
      <span className="k">{k}</span>
      {area ? <textarea rows={2} {...props} /> : <input {...props} />}
    </label>
  );
}

function Num(props) {
  return <Field type="text" inputMode="decimal" autoComplete="off" {...props} />;
}

function Seg({ value, onChange, options }) {
  return (
    <div className="seg2">
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          className={value === v ? 'sel' : ''}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ——— Кривая накопленного результата ————————————————————

function Curve({ history, today }) {
  const [range, setRange] = useState('all');
  const [sel, setSel] = useState(null);

  const monthStart = today.slice(0, 8) + '01';
  const closed = history
    .filter((t) => t.result_usd !== null)
    .filter((t) => range === 'all' || (t.closed_on || t.date) >= monthStart)
    .slice()
    .sort((a, b) => (a.closed_on || a.date).localeCompare(b.closed_on || b.date));

  if (closed.length < 2) return null;

  let acc = 0;
  const pts = closed.map((t, i) => {
    acc += t.result_usd;
    return { i, v: acc, t };
  });
  pts.unshift({ i: -1, v: 0, t: null });
  pts.forEach((p, i) => (p.i = i));

  const W = 560;
  const H = 130;
  const PAD = 12;
  const hi = Math.max(...pts.map((p) => p.v), 0);
  const lo = Math.min(...pts.map((p) => p.v), 0);
  const span = hi - lo || 1;
  const x = (p) => (p.i / (pts.length - 1)) * W;
  const y = (v) => PAD + (1 - (v - lo) / span) * (H - PAD * 2);

  const line = pts.map((p, i) => (i ? 'L' : 'M') + x(p).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ');
  const area = `${line} L${W} ${H} L0 ${H} Z`;

  const peak = pts.reduce((a, b) => (b.v > a.v ? b : a));
  const shown = sel !== null ? pts[sel] : null;
  const total = pts[pts.length - 1].v;

  return (
    <div className="section">
      <div className="section-head">
        <h2>Накопленный результат</h2>
        <div className="switch">
          <button className={range === 'month' ? 'sel' : ''} onClick={() => { setRange('month'); setSel(null); }}>
            Месяц
          </button>
          <button className={range === 'all' ? 'sel' : ''} onClick={() => { setRange('all'); setSel(null); }}>
            Всё
          </button>
        </div>
      </div>

      <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" onMouseLeave={() => setSel(null)}>
        <path className="fill" d={area} />
        <line className="zero" x1="0" y1={y(0)} x2={W} y2={y(0)} />
        {peak.v > 0 && <line className="peak" x1="0" y1={y(peak.v)} x2={W} y2={y(peak.v)} />}
        <path className="stroke" d={line} />
        {pts.map((p, i) =>
          i === 0 ? null : (
            <g key={p.t.id}>
              <circle
                className={'dot' + (sel === i ? ' on' : '')}
                cx={x(p)}
                cy={y(p.v)}
                r={sel === i ? 5 : 3.5}
              />
              <circle
                className="hit"
                cx={x(p)}
                cy={y(p.v)}
                r={16}
                onMouseEnter={() => setSel(i)}
                onClick={() => setSel(sel === i ? null : i)}
              />
            </g>
          )
        )}
      </svg>

      <div className="spark-foot">
        {shown ? (
          <>
            <span className="who">
              {shown.t.instrument} · {fmtDay(shown.t.closed_on || shown.t.date)}
            </span>
            <span className={shown.t.result_usd >= 0 ? 'up' : 'down'}>
              {fmtUsd(shown.t.result_usd)}
            </span>
            <span>итого {fmtUsd(shown.v)}</span>
          </>
        ) : (
          <>
            <span className="who">{closed.length} сделок</span>
            <span>пик {fmtUsd(peak.v)}</span>
            <span className={total >= 0 ? 'up' : 'down'}>итого {fmtUsd(total)}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ——— Форма сделки ————————————————————————————————————

const BLANK = {
  date: '',
  instrument: '',
  direction: 'long',
  size_usd: '',
  entry_price: '',
  take_price: '',
  stop_price: '',
  thesis: '',
  by_system: true,
  exit_price: '',
  closed_on: '',
  take_by_rule: false,
  review: '',
};

function TradeForm({ value, onChange, closed }) {
  const f = value;
  const set = (patch) => onChange({ ...f, ...patch });

  return (
    <div className="form">
      <div className="g2">
        <Field
          k="Тикер"
          value={f.instrument}
          onChange={(e) => set({ instrument: e.target.value })}
          autoComplete="off"
        />
        <Field k="Дата" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
      </div>

      <Seg
        value={f.direction}
        onChange={(direction) => set({ direction })}
        options={[
          ['long', 'Спот бай'],
          ['short', 'Шорт'],
        ]}
      />

      <div className="g2">
        <Num k="Размер, $" value={f.size_usd} onChange={(e) => set({ size_usd: e.target.value })} />
        <Num k="Вход" value={f.entry_price} onChange={(e) => set({ entry_price: e.target.value })} />
        <Num k="Тейк" value={f.take_price} onChange={(e) => set({ take_price: e.target.value })} />
        <Num k="Стоп" value={f.stop_price} onChange={(e) => set({ stop_price: e.target.value })} />
      </div>

      {closed && (
        <div className="g2">
          <Num k="Выход" value={f.exit_price} onChange={(e) => set({ exit_price: e.target.value })} />
          <Field
            k="Закрыта"
            type="date"
            value={f.closed_on}
            onChange={(e) => set({ closed_on: e.target.value })}
          />
        </div>
      )}

      <Field
        k="Тезис"
        area
        value={f.thesis}
        onChange={(e) => set({ thesis: e.target.value })}
      />

      {closed && (
        <Field k="Разбор" area value={f.review} onChange={(e) => set({ review: e.target.value })} />
      )}

      <Seg
        value={f.by_system}
        onChange={(by_system) => set({ by_system })}
        options={[
          [true, 'По системе'],
          [false, 'Вне системы'],
        ]}
      />

      {closed && (
        <Seg
          value={f.take_by_rule}
          onChange={(take_by_rule) => set({ take_by_rule })}
          options={[
            [true, 'Фиксация по правилу'],
            [false, 'Не по правилу'],
          ]}
        />
      )}
    </div>
  );
}

// ——— Экран ————————————————————————————————————————————

function Cash({ data, reload, back }) {
  const c = data.cash;
  const [tab, setTab] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [bal, setBal] = useState('');
  const [t, setT] = useState({ ...BLANK, date: TODAY() });

  async function add() {
    setBusy(true);
    setMsg('');
    try {
      await post('trade_open', {
        ...t,
        size_usd: dot(t.size_usd),
        entry_price: dot(t.entry_price),
        take_price: dot(t.take_price),
        stop_price: dot(t.stop_price),
      });
      setT({ ...BLANK, date: t.date });
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
      await post('balance', { week_start: c.weekStart, total_usd: dot(bal) });
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
  const unguarded = c.open.filter((o) => !o.is_protected).length;

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
          value={`${c.open.length - unguarded} из ${c.open.length}`}
          warn={unguarded > 0}
        />
        {c.pnlMonth !== null && <Stat label="Результат месяца" value={fmtUsd(c.pnlMonth)} />}
      </div>

      <Curve history={c.history} today={data.today} />

      <div className="section">
        <div className="toggle">
          <button
            className={tab === 'trade' ? 'sel' : ''}
            onClick={() => {
              setTab(tab === 'trade' ? null : 'trade');
              setMsg('');
            }}
          >
            Добавить сделку
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

        {tab === 'trade' && (
          <>
            <TradeForm value={t} onChange={setT} />
            {plan && (
              <div className="form-foot">
                {plan.result !== null && <span>план {fmtUsd(plan.result)}</span>}
                {plan.risk !== null && <span>риск {fmtUsd(plan.risk, false)}</span>}
              </div>
            )}
            {msg && <p className="warn form-foot">{msg}</p>}
            <button className="btn wide" disabled={busy} onClick={add}>
              Добавить
            </button>
          </>
        )}

        {tab === 'bal' && (
          <>
            <div className="form">
              <Field
                k={`Всего в стейбле, $ · неделя от ${c.weekStart}`}
                type="text"
                inputMode="decimal"
                value={bal}
                onChange={(e) => setBal(e.target.value)}
              />
            </div>
            {msg && <p className="warn form-foot">{msg}</p>}
            <button className="btn wide" disabled={busy} onClick={saveBalance}>
              Сохранить
            </button>
          </>
        )}
      </div>

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
          <Closed key={tr.id} tr={tr} reload={reload} />
        ))}
      </div>
    </>
  );
}

// ——— Строки журнала ————————————————————————————————

function TradeCard({ open, onToggle, head, children }) {
  return (
    <div className={'trade' + (open ? ' open' : '')}>
      <div
        className="tapzone"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        {head}
      </div>
      {open && <div className="body">{children}</div>}
    </div>
  );
}

function Level({ k, v }) {
  return (
    <div className="lv">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

function useSend(reload) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function send(kind, payload, after) {
    setBusy(true);
    setMsg('');
    try {
      await post(kind, payload);
      if (after) after();
      await reload();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }
  return { busy, msg, setMsg, send };
}

function OpenPosition({ tr, reload }) {
  const [open, setOpen] = useState(!tr.is_protected);
  const [form, setForm] = useState(null); // 'close' | 'levels'
  const { busy, msg, send } = useSend(reload);
  const [x, setX] = useState({ exit_price: '', closed_on: TODAY(), take_by_rule: false, review: '' });
  const [lv, setLv] = useState({
    stop_price: tr.stop_price ?? '',
    take_price: tr.take_price ?? '',
    thesis: tr.thesis ?? '',
  });

  const now = preview({ ...tr, price: x.exit_price });

  const head = (
    <>
      <div className="line">
        <span className="ident">
          <span className="ticker">{tr.instrument}</span>
          <Chip>{DIR[tr.direction] || DIR.long}</Chip>
          {!tr.is_protected && <Chip tone="alarm">без стопа</Chip>}
        </span>
        <span className="money">
          {tr.size_usd === null ? '—' : fmtUsd(tr.size_usd, false)}
        </span>
      </div>
      <div className="meta">
        <span className="num">{fmtDay(tr.date)}</span>
        <span className="dot">·</span>
        <span>вход</span>
        <span className="num">{fmtPrice(tr.entry_price)}</span>
        <span className="dot">·</span>
        <span>{tr.by_system ? 'по системе' : 'вне системы'}</span>
      </div>
    </>
  );

  return (
    <TradeCard open={open} onToggle={() => setOpen(!open)} head={head}>
      <div className="levels">
        <Level k="Вход" v={fmtPrice(tr.entry_price)} />
        <Level k="Тейк" v={fmtPrice(tr.take_price)} />
        <Level k="Стоп" v={fmtPrice(tr.stop_price)} />
        <Level k="Риск" v={tr.risk_usd === null ? '—' : fmtUsd(tr.risk_usd, false)} />
      </div>

      {!tr.is_protected && (
        <p className="warn note">Стоп не выставлен — поставить сейчас</p>
      )}

      {tr.thesis && (
        <div className="thesis">
          <span className="k">Тезис</span>
          {tr.thesis}
        </div>
      )}

      {!form && (
        <div className="actions">
          <button className="btn ghost" onClick={() => setForm('close')}>
            Закрыть
          </button>
          <button className="btn ghost" onClick={() => setForm('levels')}>
            {tr.is_protected ? 'Стоп и тейк' : 'Выставить стоп'}
          </button>
          <DeleteButton busy={busy} onDelete={() => send('trade_delete', { id: tr.id })} />
        </div>
      )}

      {form === 'close' && (
        <div className="form">
          <div className="g2">
            <Num k="Цена выхода" value={x.exit_price} onChange={(e) => setX({ ...x, exit_price: e.target.value })} />
            <Field k="Дата" type="date" value={x.closed_on} onChange={(e) => setX({ ...x, closed_on: e.target.value })} />
          </div>
          <Seg
            value={x.take_by_rule}
            onChange={(take_by_rule) => setX({ ...x, take_by_rule })}
            options={[
              [true, 'Фиксация по правилу'],
              [false, 'Не по правилу'],
            ]}
          />
          <Field k="Разбор" area value={x.review} onChange={(e) => setX({ ...x, review: e.target.value })} />
        </div>
      )}

      {form === 'levels' && (
        <div className="form">
          <div className="g2">
            <Num k="Стоп" value={lv.stop_price} onChange={(e) => setLv({ ...lv, stop_price: e.target.value })} />
            <Num k="Тейк" value={lv.take_price} onChange={(e) => setLv({ ...lv, take_price: e.target.value })} />
          </div>
          <Field k="Тезис" area value={lv.thesis} onChange={(e) => setLv({ ...lv, thesis: e.target.value })} />
        </div>
      )}

      {form === 'close' && now && (
        <div className="form-foot">
          <span>выходит {fmtUsd(now.result)}</span>
        </div>
      )}
      {msg && <p className="warn form-foot">{msg}</p>}

      {form && (
        <div className="actions">
          <button className="btn ghost" onClick={() => setForm(null)}>
            Отмена
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              form === 'close'
                ? send('trade_close', { id: tr.id, ...x, exit_price: dot(x.exit_price) }, () => setForm(null))
                : send(
                    'trade_levels',
                    { id: tr.id, ...lv, stop_price: dot(lv.stop_price), take_price: dot(lv.take_price) },
                    () => setForm(null)
                  )
            }
          >
            {form === 'close' ? 'Закрыть сделку' : 'Сохранить'}
          </button>
        </div>
      )}
    </TradeCard>
  );
}

function DeleteButton({ busy, onDelete }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <button className="btn ghost danger" onClick={() => setArmed(true)}>
        Удалить
      </button>
    );
  }
  return (
    <>
      <button className="btn ghost" onClick={() => setArmed(false)}>
        Отмена
      </button>
      <button className="btn danger" disabled={busy} onClick={onDelete}>
        Точно удалить
      </button>
    </>
  );
}

function Closed({ tr, reload }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const { busy, msg, send } = useSend(reload);
  const [f, setF] = useState({
    ...BLANK,
    date: tr.date || '',
    instrument: tr.instrument || '',
    direction: tr.direction || 'long',
    size_usd: tr.size_usd ?? '',
    entry_price: tr.entry_price ?? '',
    take_price: tr.take_price ?? '',
    stop_price: tr.stop_price ?? '',
    thesis: tr.thesis || '',
    by_system: !!tr.by_system,
    exit_price: tr.exit_price ?? '',
    closed_on: tr.closed_on || tr.date || '',
    take_by_rule: !!tr.take_by_rule,
    review: tr.review || '',
  });

  const win = tr.result_usd !== null && tr.result_usd > 0;
  const lose = tr.result_usd !== null && tr.result_usd < 0;

  const head = (
    <>
      <div className="line">
        <span className="ident">
          <span className="ticker">{tr.instrument}</span>
          <Chip>{DIR[tr.direction] || DIR.long}</Chip>
        </span>
        <span className={'money' + (win ? ' up' : lose ? ' down' : '')}>{fmtUsd(tr.result_usd)}</span>
      </div>
      <div className="meta">
        <span className="num">{fmtDay(tr.date)}</span>
        {tr.closed_on && tr.closed_on !== tr.date && (
          <>
            <span className="dot">→</span>
            <span className="num">{fmtDay(tr.closed_on)}</span>
          </>
        )}
        <span className="dot">·</span>
        <span>{tr.by_system ? 'по системе' : 'вне системы'}</span>
        {tr.take_by_rule && (
          <>
            <span className="dot">·</span>
            <span>фиксация по правилу</span>
          </>
        )}
      </div>
    </>
  );

  return (
    <TradeCard open={open} onToggle={() => setOpen(!open)} head={head}>
      {!edit && (
        <>
          <div className="levels">
            <Level k="Вход" v={fmtPrice(tr.entry_price)} />
            <Level k="Выход" v={fmtPrice(tr.exit_price)} />
            <Level k="Стоп" v={fmtPrice(tr.stop_price)} />
            <Level k="Размер" v={tr.size_usd === null ? '—' : fmtUsd(tr.size_usd, false)} />
          </div>
          {tr.thesis && (
            <div className="thesis">
              <span className="k">Тезис</span>
              {tr.thesis}
            </div>
          )}
          {tr.review && (
            <div className="thesis">
              <span className="k">Разбор</span>
              {tr.review}
            </div>
          )}
          {msg && <p className="warn form-foot">{msg}</p>}
          <div className="actions">
            <button className="btn ghost" onClick={() => setEdit(true)}>
              Изменить
            </button>
            <DeleteButton busy={busy} onDelete={() => send('trade_delete', { id: tr.id })} />
          </div>
        </>
      )}

      {edit && (
        <>
          <TradeForm value={f} onChange={setF} closed />
          {msg && <p className="warn form-foot">{msg}</p>}
          <div className="actions">
            <button className="btn ghost" onClick={() => setEdit(false)}>
              Отмена
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                send(
                  'trade_edit',
                  {
                    id: tr.id,
                    ...f,
                    size_usd: dot(f.size_usd),
                    entry_price: dot(f.entry_price),
                    take_price: dot(f.take_price),
                    stop_price: dot(f.stop_price),
                    exit_price: dot(f.exit_price),
                  },
                  () => setEdit(false)
                )
              }
            >
              Сохранить
            </button>
          </div>
        </>
      )}
    </TradeCard>
  );
}
