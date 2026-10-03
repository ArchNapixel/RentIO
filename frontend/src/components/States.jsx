// Loading, error and empty states.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { I, Icon } from './Icons.jsx';

// Nothing for the first second (most loads finish), then a skeleton.
export function Loading({ rows = 3 }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 1000); return () => clearTimeout(t); }, []);
  if (!show) return null;
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div className="card" key={i}><i style={{ width: '40%' }} /><i style={{ width: '65%', height: 24 }} /></div>
      ))}
    </div>
  );
}

// Blame-free, with a way out.
export function LoadError({ what, onRetry }) {
  return (
    <div className="card state">
      <span className="icon"><Icon d={I.alert} /></span>
      <h2>We couldn't load {what}</h2>
      <p>Something went wrong reading this phone's storage. Your records are still saved.</p>
      <div className="row-actions">
        <button className="btn primary sm" onClick={onRetry}>Try again</button>
        <a className="link" href="#dashboard">Go to Home</a>
      </div>
    </div>
  );
}

export function Empty({ icon = I.building, title, children, action }) {
  return (
    <div className="card state">
      <span className="icon"><Icon d={icon} /></span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

// One status look everywhere: dot + label. kind = paid | due | behind | idle.
export function Status({ kind = 'idle', children }) {
  return <span className={`st ${kind}`}>{children}</span>;
}

// Renders a page's main action in the page header (slot comes from App). Nothing until the header is mounted.
export function HeadAction({ slot, children }) {
  return slot ? createPortal(children, slot) : null;
}
