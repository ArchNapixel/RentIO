import { money } from '../api.js';

export const col = (label, key, num = false) => ({ label, get: (r) => r[key], num });
export const mcol = (label, key) => ({ label, get: (r) => money(r[key]), num: true });

export default function Table({ columns, rows, empty = 'Nothing here yet.' }) {
  if (!rows) return <p className="muted">Loading…</p>;
  if (!rows.length) return <p className="empty">{empty}</p>;
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

export function Stat({ label, value, note, tone }) {
  return (
    <div className="stat">
      <span className="muted">{label}</span>
      <span className={`value ${tone ?? ''}`}>{value}</span>
      {note && <small>{note}</small>}
    </div>
  );
}
