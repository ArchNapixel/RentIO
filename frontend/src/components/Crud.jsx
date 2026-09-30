// Add/edit form for any collection in resources.js.
import { useRef, useState } from 'react';
import { api, money, useApi, useLookups } from '../api.js';
import { resources } from '../resources.js';
import { I, Icon } from './Icons.jsx';
import { DateField, Select } from './Picker.jsx';

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
  const formRef = useRef(null);
  const [draft, setDraft] = useState(null); // live form values, for fields with showIf

  // New tenants start with the rent the last tenant at that property pays (rooms there usually cost the same).
  const [others, , othersError] = useApi(name === 'tenants' && !row.id ? '/tenants' : null);
  const rents = {};
  for (const t of [...(others ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))) if (t.monthlyRent > 0) rents[t.propertyId] = t.monthlyRent;

  const initial = (f) => {
    if (row.id) return row[f.key];
    if (f.key === 'monthlyRent' && rents[row.propertyId]) return rents[row.propertyId];
    return row[f.key] ?? f.default?.();
  };
  const values = draft ?? Object.fromEntries(fields.map((f) => [f.key, initial(f)]));
  const visible = fields.filter((f) => !f.showIf || f.showIf(values));
  const main = visible.filter((f) => !f.more), more = visible.filter((f) => f.more);

  // Live values for showIf. Picked values are passed in because the hidden input only updates after the next render.
  const sync = (picked) => setDraft({ ...Object.fromEntries(new FormData(formRef.current)), ...picked });
  const rentBox = () => formRef.current.elements.monthlyRent;
  const onChange = (e) => {
    sync();
    if (e.target.name === 'monthlyRent') e.target.dataset.typed = '1';
  };
  // Picking a property fills in its usual rent, unless the owner already typed one.
  const onPick = (key, value) => {
    sync({ [key]: value });
    if (key === 'propertyId' && rentBox() && !rentBox().dataset.typed && rents[value]) rentBox().value = money(rents[value]);
  };

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
      else if (f.required && (f.ref || f.options) && !f.chips && !body[f.key]) return setError(`${f.label}: choose one from the list.`);
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

  if (!lookups.properties || (name === 'tenants' && !row.id && !others && !othersError)) return <p className="muted">Loading…</p>;
  return (
    <form className="form" ref={formRef} onSubmit={save} onChange={onChange}>
      {before}
      {main.map((f, i) => <Field key={f.key} f={f} value={initial(f)} lookups={lookups} onPick={onPick} autoFocus={i === 0 && !row.id} />)}
      {more.length > 0 && (
        <details className="more" open={Boolean(row.id) && more.some((f) => row[f.key])}>
          <summary>More details</summary>
          <div className="form">{more.map((f) => <Field key={f.key} f={f} value={initial(f)} lookups={lookups} onPick={onPick} />)}</div>
        </details>
      )}
      {after}
      {error && <p className="box error" role="alert"><Icon d={I.alert} />{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn" onClick={() => onDone(null)}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? <><span className="spinner" /> Saving…</> : row.id ? `Save ${singular}` : `Add ${singular}`}</button>
      </div>
    </form>
  );
}

function Field({ f, value, lookups, onPick, autoFocus }) {
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
    input = <Select id={id} name={f.key} defaultValue={v} options={opts} clear={f.required ? undefined : '—'} title={f.label} autoFocus={autoFocus} onChange={(val) => onPick(f.key, val)} />;
  } else if (f.type === 'date') {
    input = <DateField id={id} name={f.key} defaultValue={v} title={f.label} autoFocus={autoFocus} onChange={(val) => onPick(f.key, val)} />;
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
