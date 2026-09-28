import { money } from '../api.js';

export const col = (label, key, num = false) => ({ label, get: (r) => r[key], num });
export const mcol = (label, key) => ({ label, get: (r) => money(r[key]), num: true });

// Plain table (desktop lists, payment history). Rows need an id or a stable order.
export default function Table({ columns, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.label} className={c.num ? 'num' : undefined}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i}>
              {columns.map((c) => <td key={c.label} className={c.num ? 'num' : undefined}>{c.get(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// "Collected this month · ₱12,500.00 of ₱28,000.00", with an optional progress bar.
export function Stat({ label, value, of, note, progress, wide }) {
  return (
    <div className={`card stat ${wide ? 'wide' : ''}`}>
      <span className="label">{label}</span>
      <span className="value">{value}{of != null && <small>of {of}</small>}</span>
      {note && <span className="note">{note}</span>}
      {progress != null && (
        <div className="progress" role="progressbar" aria-label={label} aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
