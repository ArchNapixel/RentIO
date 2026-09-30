// Toasts: bottom of the screen, above Nena. 4s, or 8s when there's an action (e.g. Undo). Hover or focus pauses the clock.
import { useEffect, useState } from 'react';
import { I, Icon } from './Icons.jsx';

let push = () => {};
let nextId = 1;

// toast('Saved.') · toast({ text, action: 'Undo', onAction, error: true })
export function toast(t) {
  push(typeof t === 'string' ? { text: t } : t);
}

function Toast({ t, onDone }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDone, t.action ? 8000 : 4000);
    return () => clearTimeout(timer);
  }, [paused]);
  return (
    <div
      className={`toast ${t.error ? 'error' : ''}`}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
    >
      {!t.error && !t.action && <Icon d={I.check} />}
      <span className="grow">{t.text}</span>
      {t.action && <button onClick={() => { onDone(); t.onAction(); }}>{t.action}</button>}
    </div>
  );
}

export default function Toasts() {
  const [list, setList] = useState([]);
  useEffect(() => {
    push = (t) => setList((l) => [...l.slice(-2), { ...t, id: nextId++ }]);
    return () => { push = () => {}; };
  }, []);

  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => <Toast key={t.id} t={t} onDone={() => setList((l) => l.filter((x) => x.id !== t.id))} />)}
    </div>
  );
}
