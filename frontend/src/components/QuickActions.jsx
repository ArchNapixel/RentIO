// Nena, floating on every page: a robot that talks through a speech bubble.
// Tap the bubble to chat; tap Nena for quick actions. Guests get a greeting and a sign-up prompt.
import { useEffect, useState } from 'react';
import { useApi } from '../api.js';
import { resources } from '../resources.js';
import Chat from './Chat.jsx';
import { RecordForm } from './Crud.jsx';
import Doc, { pushLayer } from './Doc.jsx';
import { I, Icon } from './Icons.jsx';
import { Robot } from './Robot.jsx';
import { toast } from './Toasts.jsx';

// Idle hop every ~3s (±0.8s jitter), paused while Nena would compete with a task.
function useHop(paused) {
  const [hop, setHop] = useState('');
  const [kick, setKick] = useState(0);
  useEffect(() => {
    if (paused) return;
    let timer;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!document.hidden) { setHop('hop'); setTimeout(() => setHop(''), 650); }
        schedule();
      }, 3000 + (Math.random() * 1.6 - 0.8) * 1000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [paused, kick]);
  const quickHop = () => { if (paused) return; setHop('hop-quick'); setTimeout(() => setHop(''), 500); setKick((k) => k + 1); };
  return [hop, quickHop];
}

// version changes whenever data changes, so the speech bubble is refreshed.
export default function QuickActions({ guest, onSignUp, version, onChanged }) {
  const [insight] = useApi(guest ? null : `/ai/insight?v=${version}`);
  const hint = guest ? "Hi! I'm Nena. Sign up to chat with me and manage your own rentals." : insight?.text ?? null;
  const [open, setOpen] = useState(false); // quick actions menu
  const [chatting, setChatting] = useState(false);
  const [adding, setAdding] = useState(null); // collection name being added
  const [askSignUp, setAskSignUp] = useState(false);
  const [dismissed, setDismissed] = useState(null); // text the owner closed with ×
  const [expired, setExpired] = useState(null); // text that auto-hid after 8s
  const [hop, quickHop] = useHop(open || chatting || Boolean(adding) || askSignUp);

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setExpired(hint), 8000);
    return () => clearTimeout(t);
  }, [hint]);

  // Android's Back button closes these like it closes a sheet.
  useEffect(() => (chatting ? pushLayer(() => setChatting(false), { lock: false }) : undefined), [chatting]);
  useEffect(() => (open ? pushLayer(() => setOpen(false), { lock: false }) : undefined), [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open]);

  const add = (name) => { setOpen(false); setAdding(name); };
  const chat = () => { setOpen(false); if (guest) setAskSignUp(true); else setChatting(true); };
  const done = (saved) => {
    if (saved) { toast(`${saved.name} added as a ${resources[adding].singular}.`); onChanged(); }
    setAdding(null);
  };
  // Nena asked to open a screen: close the chat so the owner sees it.
  const navigate = ({ screen, tenantId, propertyId }) => {
    const param = screen === 'payments' && propertyId ? `property=${propertyId}` : tenantId ? `id=${tenantId}` : propertyId ? `id=${propertyId}` : '';
    setChatting(false);
    location.hash = param ? `${screen}?${param}` : screen;
  };

  // Top to bottom; the bottom pill appears first.
  const items = [
    ['Add tenant', I.userPlus, () => add('tenants')],
    ['Add property', I.buildingPlus, () => add('properties')],
    ['Chat with Nena', I.chat, chat],
    ['Rent tracker', I.rent, () => { setOpen(false); location.hash = 'payments'; }],
  ];
  const showBubble = hint && hint !== dismissed && hint !== expired && !open && !chatting;

  return (
    <>
      {!guest && (
        <section className={`chat-panel ${chatting ? 'open' : ''}`} inert={!chatting} aria-label="Nena, RentIO assistant">
          <Chat greeting={hint} active={chatting} onClose={() => setChatting(false)} onNavigate={navigate} onChanged={onChanged} />
        </section>
      )}

      {open && <div className="fab-scrim" onClick={() => setOpen(false)} />}
      <div className="fab-wrap">
        <div id="quick-actions" className={`fab-actions ${open ? 'open' : ''}`} inert={!open}>
          {items.map(([label, icon, run]) => <button key={label} className="fab-action" onClick={run}><Icon d={icon} />{label}</button>)}
        </div>
        {showBubble && (
          <div className="speech">
            <button className="speech-text" onClick={chat}>{hint}</button>
            <button className="speech-close" aria-label="Dismiss message" onClick={() => setDismissed(hint)}>×</button>
          </div>
        )}
        <button
          className={`fab ${open ? 'open' : ''} ${hop}`}
          aria-label={open ? 'Close menu' : 'Open Nena'}
          aria-expanded={guest ? undefined : open}
          aria-controls={guest ? undefined : 'quick-actions'}
          onPointerEnter={(e) => e.pointerType === 'mouse' && quickHop()}
          onPointerDown={(e) => e.pointerType !== 'mouse' && quickHop()}
          onClick={() => { if (guest) return setAskSignUp(true); setChatting(false); setOpen(!open); }}
        >
          <span className="fab-face"><Robot blinks={!open} /></span>
          <span className="fab-x"><Icon d={I.x} /></span>
        </button>
      </div>

      {askSignUp && (
        <Doc title="Sign up to chat with Nena" onClose={() => setAskSignUp(false)}>
          <div className="form">
            <p style={{ margin: 0 }}>She's your rent helper. Once you have an account, she can:</p>
            <ul className="nena-perks">
              <li><Icon d={I.check} />Tell you who's behind and how much came in</li>
              <li><Icon d={I.check} />Read a GCash, Maya or bank receipt and mark it paid, after you confirm</li>
              <li><Icon d={I.check} />Understand English, Filipino or Taglish, typed or spoken</li>
            </ul>
            <button className="btn primary block" onClick={onSignUp}>Create account</button>
            <button className="btn ghost block" onClick={() => setAskSignUp(false)}>Not now</button>
          </div>
        </Doc>
      )}
      {adding && (
        <Doc title={`Add ${resources[adding].singular}`} onClose={() => setAdding(null)}>
          <RecordForm name={adding} row={{}} onDone={done} />
        </Doc>
      )}
    </>
  );
}
