// Native <select> and <input type="date">: the phone's own pickers (bottom sheets, with year and month jumps) beat rebuilding them.
// Both keep the name/onChange shape Crud.jsx and the Tenants filter already use.
import { useState } from 'react';
import { today } from '../api.js';

// options = [[value, label], …]. clear = label of an "empty" choice (e.g. "All properties"); omit when a value is required.
export function Select({ id, name, defaultValue = '', options, clear, placeholder = 'Choose…', onChange, autoFocus, className = '', ...aria }) {
  const [value, setValue] = useState(defaultValue ?? '');
  return (
    <select id={id} name={name} className={className} value={value} autoFocus={autoFocus} {...aria} onChange={(e) => { setValue(e.target.value); onChange?.(e.target.value); }}>
      {clear == null ? <option value="" disabled>{placeholder}</option> : <option value="">{clear}</option>}
      {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
    </select>
  );
}

// value is an ISO date (YYYY-MM-DD).
export function DateField({ id, name, defaultValue = '', onChange, autoFocus }) {
  return <input type="date" id={id} name={name} defaultValue={defaultValue ?? ''} autoFocus={autoFocus} onChange={(e) => onChange?.(e.target.value)} />;
}
