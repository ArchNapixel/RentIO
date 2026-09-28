// Toasts: bottom of the screen, above Nena. 4s, or 6s when there's an action (e.g. Undo).
import { useEffect, useState } from 'react';
import { I, Icon } from './Icons.jsx';

let push = () => {};
let nextId = 1;

// toast('Saved.') · toast({ text, action: 'Undo', onAction, error: true })
export function toast(t) {
  push(typeof t === 'string' ? { text: t } : t);
}

export default function Toasts() {
  const [list, setList] = useState([]);
  useEffect(() => {
    push = (t) => {
      const id = nextId++;
      setList((l) => [...l.slice(-2), { ...t, id }]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), t.action ? 6000 : 4000);
    };
    return () => { push = () => {}; };
  }, []);
  const dismiss = (id) => setList((l) => l.filter((x) => x.id !== id));

  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.error ? 'error' : ''}`}>
          {!t.error && !t.action && <Icon d={I.check} />}
          <span className="grow">{t.text}</span>
          {t.action && <button onClick={() => { dismiss(t.id); t.onAction(); }}>{t.action}</button>}
        </div>
      ))}
    </div>
  );
}
