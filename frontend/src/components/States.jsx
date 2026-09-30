// Loading, error, empty and offline states.
import { useEffect, useState } from 'react';
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
      <span className="icon"><Icon d={I.server} /></span>
      <h2>We couldn't load {what}</h2>
      <p>RentIO's server isn't answering right now. It's on our side, and your records are safe.</p>
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

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener('online', on);
    addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);
  return online;
}

export function OfflineBanner() {
  return (
    <p className="box due offline" role="status">
      <Icon d={I.wifiOff} />
      <span><strong>You're offline.</strong> What's on screen may be out of date, and changes won't save until you're back online.</span>
    </p>
  );
}
