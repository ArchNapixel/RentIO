// Add/edit form for any collection in resources.js.
import { useState } from 'react';
import { api, money, useLookups } from '../api.js';
import { resources } from '../resources.js';
import { I, Icon } from './Icons.jsx';

// "3500", "3,500" or "₱3,500" → 3500; null when it isn't a number.
const parseMoney = (s) => {
  const clean = String(s ?? '').replace(/[₱,\s]/g, '');
  return clean === '' ? '' : /^\d+(\.\d{1,2})?$/.test(clean) ? clean : null;
};

// Add/edit form for one record. row = {} adds a new one. onDone(saved) fires on save or cancel.
// `before` and `after` render extra content inside the scrolling area (summary box, history, danger zone).
export function RecordForm({ name, row, onDone, before, after }) {
  const { singular, fields } = resources[name];
  const [lookups] = useLookups();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null); // live form values, for fields with showIf

  const initial = (f) => (row.id ? row[f.key] : f.default?.());
  const values = draft ?? Object.fromEntries(fields.map((f) => [f.key, initial(f)]));
  const visible = fields.filter((f) => !f.showIf || f.showIf(values));

  async function save(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    for (const f of fields) {
      if (f.type === 'checkbox') body[f.key] = body[f.key] === 'on';
      if (f.money && body[f.key] != null) {
        const v = parseMoney(body[f.key]);
        if (v === null) return setError(`${f.label}: enter numbers only, like 3500.`);
        body[f.key] = v;
      }
      if (f.showIf && !f.showIf(body)) body[f.key] = null; // clear values of hidden fields
    }
    setBusy(true);
    try {
      onDone(await api(row.id ? `/${name}/${row.id}` : `/${name}`, { method: row.id ? 'PUT' : 'POST', body }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!lookups.properties) return <p className="muted">Loading…</p>;
  return (
    <form className="form" onSubmit={save} onChange={(e) => setDraft(Object.fromEntries(new FormData(e.currentTarget)))} noValidate={false}>
      {before}
      {visible.map((f, i) => <Field key={f.key} f={f} value={initial(f)} lookups={lookups} autoFocus={i === 0 && !row.id} />)}
      {after}
      {error && <p className="box error" role="alert"><Icon d={I.alert} />{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn" onClick={() => onDone(null)}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? <><span className="spinner" /> Saving…</> : row.id ? `Save ${singular}` : `Add ${singular}`}</button>
      </div>
    </form>
  );
}

function Field({ f, value, lookups, autoFocus }) {
  const v = value ?? '';
  const [fieldError, setFieldError] = useState('');
  const id = `f-${f.key}`;
  let input;

  if (f.chips) {
    return (
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{f.label}</span>
        <div className="chips">
          {f.options.map((o) => (
            <label key={o}><input type="radio" name={f.key} value={o} defaultChecked={v === o} required={f.required} /><span>{o}</span></label>
          ))}
        </div>
      </fieldset>
    );
  }
  if (f.ref || f.options) {
    const opts = f.ref ? Object.entries(lookups[f.ref] ?? {}) : f.options.map((o) => [o, o]);
    input = (
      <select id={id} autoFocus={autoFocus} name={f.key} defaultValue={v} required={f.required}>
        <option value="">{f.required ? 'Choose…' : '—'}</option>
        {opts.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
      </select>
    );
  } else if (f.type === 'textarea') {
    input = <textarea id={id} autoFocus={autoFocus} name={f.key} defaultValue={v} rows={3} required={f.required} />;
  } else if (f.type === 'checkbox') {
    return (
      <label className="field check">
        <span>{f.label}</span>
        <input type="checkbox" name={f.key} defaultChecked={!!v} />
      </label>
    );
  } else if (f.money) {
    input = (
      <input
        id={id} autoFocus={autoFocus} name={f.key} inputMode="decimal" required={f.required} placeholder={f.placeholder}
        defaultValue={v === '' || v == null ? '' : money(v)} aria-invalid={Boolean(fieldError)}
        onBlur={(e) => {
          const parsed = parseMoney(e.target.value);
          setFieldError(parsed === null ? 'Enter numbers only, like 3500.' : '');
          if (parsed) e.target.value = money(parsed);
        }}
        onInput={() => fieldError && setFieldError('')}
      />
    );
  } else {
    input = <input id={id} autoFocus={autoFocus} type={f.type ?? 'text'} name={f.key} defaultValue={v} required={f.required} min={f.min} step={f.step ?? (f.type === 'number' ? 'any' : undefined)} placeholder={f.placeholder} />;
  }
  return (
    <label className="field" htmlFor={id}>
      <span>{f.label}</span>
      {input}
      {fieldError ? <small className="error">{fieldError}</small> : f.hint && <small>{f.hint}</small>}
    </label>
  );
}
