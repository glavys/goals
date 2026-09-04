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

function Cash({ data, reload, back }) {
  const c = data.cash;
  const [tab, setTab] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [bal, setBal] = useState('');
  const [t, setT] = useState({
    date: TODAY(),
    instrument: '',
    size_usd: '',
    result_usd: '',
    is_open: true,
    by_system: true,
    take_by_rule: false,
    protected: false,
    feeling: '',
  });

  async function saveTrade() {
    if (!t.instrument.trim()) {
      setMsg('Впиши инструмент');
      return;
    }
    setBusy(true);
    try {
      await post('trade', {
        ...t,
        size_usd: t.size_usd === '' ? null : Number(t.size_usd),
        result_usd: t.result_usd === '' ? null : Number(t.result_usd),
      });
      setT({ ...t, instrument: '', size_usd: '', result_usd: '', feeling: '' });
      setTab(null);
      setMsg('');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function saveBalance() {
    if (bal === '') {
      setMsg('Впиши сумму');
      return;
    }
    setBusy(true);
    try {
      await post('balance', { week_start: c.weekStart, total_usd: Number(bal) });
      setBal('');
      setTab(null);
      setMsg('');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function toggleProtected(tr) {
    setBusy(true);
    try {
      await post('trade_update', {
        id: tr.id,
        protected: !tr.protected,
        is_open: tr.is_open,
        result_usd: tr.result_usd,
        take_by_rule: tr.take_by_rule,
        review: tr.review,
      });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const pct = c.latest ? Math.min(100, (c.latest / 50000) * 100) : 0;

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
          value={`${data.sleep.protectedOpen} из ${data.sleep.totalOpen}`}
          warn={data.sleep.totalOpen > data.sleep.protectedOpen}
        />
      </div>

      <div className="section">
        <div className="toggle">
          <button
            className={tab === 'trade' ? 'sel' : ''}
            onClick={() => setTab(tab === 'trade' ? null : 'trade')}
          >
            Записать сделку
          </button>
          <button
            className={tab === 'bal' ? 'sel' : ''}
            onClick={() => setTab(tab === 'bal' ? null : 'bal')}
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
            placeholder="Инструмент"
            value={t.instrument}
            onChange={(e) => {
              setT({ ...t, instrument: e.target.value });
              setMsg('');
            }}
          />
          <input
            type="number"
            placeholder="Размер, $"
            value={t.size_usd}
            onChange={(e) => setT({ ...t, size_usd: e.target.value })}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={t.is_open}
              onChange={(e) => setT({ ...t, is_open: e.target.checked })}
            />
            Позиция ещё открыта
          </label>
          {!t.is_open && (
            <>
              <input
                type="number"
                placeholder="Результат, $ (минус если убыток)"
                value={t.result_usd}
                onChange={(e) => setT({ ...t, result_usd: e.target.value })}
              />
              <label className="check">
                <input
                  type="checkbox"
                  checked={t.take_by_rule}
                  onChange={(e) => setT({ ...t, take_by_rule: e.target.checked })}
                />
                Зафиксировал по правилу
              </label>
            </>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={t.by_system}
              onChange={(e) => setT({ ...t, by_system: e.target.checked })}
            />
            Вход по системе
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={t.protected}
              onChange={(e) => setT({ ...t, protected: e.target.checked })}
            />
            Уровни выставлены
          </label>
          <textarea
            placeholder="Что чувствовал"
            value={t.feeling}
            onChange={(e) => setT({ ...t, feeling: e.target.value })}
          />
          {msg && <p className="warn" style={{ fontSize: 13 }}>{msg}</p>}
          <button className="btn" disabled={busy} onClick={saveTrade}>
            Записать
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
            onChange={(e) => {
              setBal(e.target.value);
              setMsg('');
            }}
          />
          {msg && <p className="warn" style={{ fontSize: 13 }}>{msg}</p>}
          <button className="btn" disabled={busy} onClick={saveBalance}>
            Сохранить
          </button>
        </div>
      )}

      <div className="section">
        <h2>Журнал</h2>
        {c.trades.length === 0 && (
          <p className="muted">Пока пусто. Первая запись — сверху.</p>
        )}
        {c.trades.map((tr) => (
          <div className="entry" key={tr.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>{tr.instrument}</span>
              <span>
                {tr.is_open
                  ? 'открыта'
                  : tr.result_usd === null
                  ? '—'
                  : (tr.result_usd > 0 ? '+' : '') +
                    '$' +
                    Number(tr.result_usd).toLocaleString('ru-RU')}
              </span>
            </div>
            <div className="meta">
              {tr.date}
              {tr.by_system ? ' · по системе' : ' · вне системы'}
              {!tr.is_open && tr.take_by_rule ? ' · фиксация по правилу' : ''}
            </div>
            {tr.is_open && (
              <button
                className="link"
                style={{ marginTop: 6 }}
                disabled={busy}
                onClick={() => toggleProtected(tr)}
              >
                {tr.protected ? 'Уровни выставлены' : 'Отметить, что уровни выставлены'}
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
