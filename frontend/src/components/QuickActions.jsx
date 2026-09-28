// Floating assistant (bottom-right): a bot sprite that talks through a speech bubble.
// Tap the bubble to chat; tap the bot for quick actions.
import { useEffect, useRef, useState } from 'react';
import { resources } from '../resources.js';
import Chat from './Chat.jsx';
import { RecordForm } from './Crud.jsx';
import Doc from './Doc.jsx';

export default function QuickActions({ hint, onSaved }) {
  const [open, setOpen] = useState(false); // quick actions menu
  const [chatting, setChatting] = useState(false);
  const [dismissed, setDismissed] = useState(null); // text of the message the user closed
  const [adding, setAdding] = useState(null); // collection name being added
  const [notice, setNotice] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open && !chatting) return;
    const onDown = (e) => open && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setChatting(false); } };
    addEventListener('pointerdown', onDown);
    addEventListener('keydown', onKey);
    return () => { removeEventListener('pointerdown', onDown); removeEventListener('keydown', onKey); };
  }, [open, chatting]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const add = (name) => { setOpen(false); setAdding(name); };
  const chat = () => { setOpen(false); setChatting(true); };
  const done = (saved) => {
    if (saved) {
      setNotice(`${saved.name} added as a ${resources[adding].singular}.`);
      onSaved?.();
    }
    setAdding(null);
  };

  // Listed top to bottom; the one nearest the button appears first.
  const items = [
    ['Check leases', () => { setOpen(false); location.hash = 'leases'; }],
    ['Chat with Nena', chat],
    ['Add property', () => add('properties')],
    ['Add tenant', () => add('tenants')],
  ];
  const showBubble = hint && hint !== dismissed && !open && !chatting;

  return (
    <>
      <section className={`chat-panel ${chatting ? 'open' : ''}`} inert={!chatting} aria-label="Nena, RentIO assistant">
        <header className="chat-head">
          <span className="bot-avatar" aria-hidden="true"><Bot /></span>
          <span className="chat-title"><strong>Nena</strong><small className="muted">RentIO assistant</small></span>
          <button className="btn sm" onClick={() => setChatting(false)}>Close</button>
        </header>
        <Chat greeting={hint} active={chatting} />
      </section>

      <div className="fab-wrap" ref={ref}>
        <div id="quick-actions" className={`fab-actions ${open ? 'open' : ''}`} inert={!open}>
          {items.map(([label, run]) => <button key={label} className="fab-action" onClick={run}>{label}</button>)}
        </div>
        {showBubble && (
          <div className="speech">
            <button className="speech-text" onClick={chat}>{hint}</button>
            <button className="speech-close" aria-label="Dismiss message" onClick={() => setDismissed(hint)}>×</button>
          </div>
        )}
        <button
          className={`fab ${open ? 'open' : ''}`}
          aria-label={open ? 'Close quick actions' : 'Nena, RentIO assistant, and quick actions'}
          aria-expanded={open}
          aria-controls="quick-actions"
          onClick={() => { setChatting(false); setOpen(!open); }}
        >
          <span className="fab-bot" aria-hidden="true"><Bot /></span>
          <span className="fab-x" aria-hidden="true" />
        </button>
      </div>

      {notice && <p className="toast" role="status">{notice}</p>}
      {adding && (
        <Doc title={`Add ${resources[adding].singular}`} onClose={() => setAdding(null)} printable={false}>
          <RecordForm name={adding} row={{}} onDone={done} />
        </Doc>
      )}
    </>
  );
}

function Bot() {
  return (
    <svg viewBox="3.5 0 25 27" width="100%" height="100%">
      <line x1="16" y1="3" x2="16" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="3" r="2" fill="currentColor" />
      <rect x="5" y="8" width="22" height="18" rx="7" fill="currentColor" />
      <g className="bot-eyes">
        <circle cx="12" cy="16" r="2.2" fill="var(--bot-eye)" />
        <circle cx="20" cy="16" r="2.2" fill="var(--bot-eye)" />
      </g>
      <path d="M12.5 21 q3.5 2.2 7 0" stroke="var(--bot-eye)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
