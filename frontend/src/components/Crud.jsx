// Generic list + add/edit/delete for any collection in resources.js.
import { useState } from 'react';
import { api, money, useApi, useLookups } from '../api.js';
import { resources } from '../resources.js';
import Table from './Table.jsx';

export default function Crud({ name, filter, extra = [], actions, onChange, addable = true, empty }) {
  const { title, singular, fields } = resources[name];
  const [rows, reload] = useApi('/' + name);
  const [lookups, reloadLookups] = useLookups();
  const [editing, setEditing] = useState(null); // null | {} (new) | row
  const [error, setError] = useState('');

  const open = (row) => { setError(''); setEditing(row); };
  const refresh = () => { reload(); reloadLookups(); onChange?.(); };

  async function remove(row) {
    if (!confirm(`Delete this ${singular}? This can't be undone.`)) return;
    try { await api(`/${name}/${row.id}`, { method: 'DELETE' }); setError(''); refresh(); } catch (err) { setError(err.message); }
  }

  const show = (f, row) => {
    const v = row[f.key];
    if (f.ref) return lookups[f.ref]?.[v] ?? '';
    if (f.money) return v === '' || v == null ? '' : money(v);
    if (f.type === 'checkbox') return v ? 'Yes' : '';
    return v ?? '';
  };
  const columns = [
    ...fields.filter((f) => !f.hideInTable).map((f) => ({ label: f.label, get: (r) => show(f, r), num: f.money })),
    ...extra,
    {
      label: '',
      get: (r) => (
        <span className="row-actions">
          {actions?.(r)}
          <button className="btn sm" onClick={() => open(r)}>Edit</button>
          <button className="btn sm danger" onClick={() => remove(r)}>Delete</button>
        </span>
      ),
    },
  ];

  return (
    <section className="card">
      <header className="card-head">
        <h2>{title}</h2>
        <span className="row-actions">
          <a className="btn" href={`/api/export/${name}`}>Export CSV</a>
          {addable && <button className="btn primary" onClick={() => open({})}>Add {singular}</button>}
        </span>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {editing && <RecordForm key={editing.id ?? 'new'} name={name} row={editing} onDone={(saved) => { setEditing(null); if (saved) refresh(); }} />}
      <Table
        columns={columns}
        rows={rows && (filter ? rows.filter(filter) : rows)}
        empty={empty ?? `No ${title.toLowerCase()} yet.${addable ? ` Use "Add ${singular}" to create one.` : ''}`}
      />
    </section>
  );
}

// Add/edit form for one record. row = {} adds a new one. onDone(saved) fires on save or cancel.
export function RecordForm({ name, row, onDone }) {
  const { singular, fields } = resources[name];
  const [lookups] = useLookups();
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null); // live form values, for fields with showIf

  const initial = (f) => (row.id ? row[f.key] : f.default?.());
  const values = draft ?? Object.fromEntries(fields.map((f) => [f.key, initial(f)]));
  const visible = fields.filter((f) => !f.showIf || f.showIf(values));

  async function save(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    for (const f of fields) if (f.type === 'checkbox') body[f.key] = body[f.key] === 'on';
    for (const f of fields) if (f.showIf && !f.showIf(body)) body[f.key] = null; // clear values of hidden fields
    try {
      const saved = await api(row.id ? `/${name}/${row.id}` : `/${name}`, { method: row.id ? 'PUT' : 'POST', body });
      onDone(saved);
    } catch (err) { setError(err.message); }
  }

  if (!lookups.units) return <p className="muted">Loading…</p>;
  return (
    <form className="form" onSubmit={save} onChange={(e) => setDraft(Object.fromEntries(new FormData(e.currentTarget)))}>
      {error && <p className="error form-error" role="alert">{error}</p>}
      {visible.map((f, i) => <Field key={f.key} f={f} value={initial(f)} lookups={lookups} autoFocus={i === 0} />)}
      <div className="form-actions">
        <button className="btn primary">{row.id ? `Save ${singular}` : `Add ${singular}`}</button>
        <button type="button" className="btn" onClick={() => onDone(null)}>Cancel</button>
      </div>
    </form>
  );
}

function Field({ f, value, lookups, autoFocus }) {
  const v = value ?? '';
  let input;
  if (f.ref || f.options) {
    const opts = f.ref ? Object.entries(lookups[f.ref] ?? {}) : f.options.map((o) => [o, o]);
    input = (
      <select autoFocus={autoFocus} name={f.key} defaultValue={v} required={f.required}>
        <option value="">{f.required ? 'Select…' : '—'}</option>
        {opts.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
      </select>
    );
  } else if (f.type === 'textarea') {
    input = <textarea autoFocus={autoFocus} name={f.key} defaultValue={v} rows={3} required={f.required} />;
  } else if (f.type === 'checkbox') {
    input = <input type="checkbox" name={f.key} defaultChecked={!!v} />;
  } else {
    input = <input autoFocus={autoFocus} type={f.type ?? 'text'} name={f.key} defaultValue={v} required={f.required} min={f.min} step={f.step ?? (f.type === 'number' ? 'any' : undefined)} />;
  }
  return (
    <label className={`field ${f.type === 'textarea' ? 'wide' : ''} ${f.type === 'checkbox' ? 'check' : ''}`}>
      <span>{f.label}{f.required && ' *'}</span>
      {input}
      {f.hint && <small>{f.hint}</small>}
    </label>
  );
}
