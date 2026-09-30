// In-app replacements for the browser's <select> and date popouts. Both open the same bottom sheet as everything else,
// and keep a hidden input so forms read them through FormData like any other field.
import { useState } from 'react';
import { today } from '../api.js';
import Doc from './Doc.jsx';
import { I, Icon } from './Icons.jsx';

const pad = (n) => String(n).padStart(2, '0');
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function Trigger({ id, autoFocus, open, onClick, children, className = '', ...aria }) {
  return (
    <button type="button" id={id} className={`picker ${className}`} autoFocus={autoFocus} aria-haspopup="dialog" aria-expanded={open} onClick={onClick} {...aria}>
      {children}<Icon d={I.chevron} />
    </button>
  );
}

// options = [[value, label], …]. clear = label of an "empty" choice (e.g. "All properties"); omit when a value is required.
export function Select({ id, name, defaultValue = '', options, clear, placeholder = 'Choose…', title, onChange, autoFocus, className, ...aria }) {
  const [value, setValue] = useState(defaultValue ?? '');
  const [open, setOpen] = useState(false);
  const all = clear == null ? options : [['', clear], ...options];
  const label = all.find(([v]) => v === value)?.[1];
  const pick = (v) => { setValue(v); setOpen(false); onChange?.(v); };

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <Trigger id={id} autoFocus={autoFocus} open={open} className={className} onClick={() => setOpen(true)} {...aria}>
        <span className={label ? '' : 'muted'}>{label ?? placeholder}</span>
      </Trigger>
      {open && (
        <Doc title={title ?? placeholder} onClose={() => setOpen(false)}>
          <ul className="list">
            {all.length === 0 && <li className="state muted">Nothing to choose from yet.</li>}
            {all.map(([v, text]) => (
              <li key={v} className="tap">
                <button type="button" className="row-btn" aria-pressed={v === value} onClick={() => pick(v)}>
                  <span className="grow title">{text}</span>{v === value && <Icon d={I.check} />}
                </button>
              </li>
            ))}
          </ul>
        </Doc>
      )}
    </>
  );
}

// value is an ISO date (YYYY-MM-DD).
export function DateField({ id, name, defaultValue = '', title = 'Pick a date', onChange, autoFocus }) {
  const [value, setValue] = useState(defaultValue ?? '');
  const [open, setOpen] = useState(false);
  const start = (value || today()).split('-').map(Number);
  const [view, setView] = useState({ y: start[0], m: start[1] - 1 }); // m is 0-based
  const now = today();

  const step = (n) => setView(({ y, m }) => { const i = y * 12 + m + n; return { y: Math.floor(i / 12), m: i % 12 }; });
  const pick = (iso) => { setValue(iso); setOpen(false); onChange?.(iso); };
  const label = value && new Date(`${value}T00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  const blanks = new Date(view.y, view.m, 1).getDay();
  const days = new Date(view.y, view.m + 1, 0).getDate();

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <Trigger id={id} autoFocus={autoFocus} open={open} onClick={() => { setView({ y: start[0], m: start[1] - 1 }); setOpen(true); }}>
        <span className={label ? '' : 'muted'}>{label || 'Pick a date'}</span>
      </Trigger>
      {open && (
        <Doc title={title} onClose={() => setOpen(false)}>
          <div className="form">
            <div className="year-nav">
              <button type="button" className="btn" aria-label="Previous month" onClick={() => step(-1)}><Icon d={I.left} /></button>
              <strong aria-live="polite" style={{ flex: 1 }}>{MONTH_NAMES[view.m]} {view.y}</strong>
              <button type="button" className="btn" aria-label="Next month" onClick={() => step(1)}><Icon d={I.right} /></button>
            </div>
            <div className="cal">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="cal-head" aria-hidden="true">{d}</span>)}
              {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}
              {Array.from({ length: days }, (_, i) => {
                const iso = `${view.y}-${pad(view.m + 1)}-${pad(i + 1)}`;
                return (
                  <button
                    key={iso} type="button" className={`cal-day ${iso === value ? 'on' : ''} ${iso === now ? 'now' : ''}`}
                    aria-pressed={iso === value} aria-label={new Date(`${iso}T00:00`).toLocaleDateString('en-PH', { dateStyle: 'long' })}
                    onClick={() => pick(iso)}
                  >{i + 1}</button>
                );
              })}
            </div>
            <button type="button" className="btn ghost block" onClick={() => pick(now)}>Today</button>
          </div>
        </Doc>
      )}
    </>
  );
}
