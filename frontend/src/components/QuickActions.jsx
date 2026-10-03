// Nena, floating on every page: a robot that talks through a speech bubble. Tap her for quick actions.
import { useEffect, useState } from 'react';
import { useApi } from '../api.js';
import { resources } from '../resources.js';
import { RecordForm } from './Crud.jsx';
import Doc, { pushLayer } from './Doc.jsx';
import { quickHint } from '../../../backend/reports.js';
import { I, Icon } from './Icons.jsx';
import { Robot } from './Robot.jsx';
import { toast } from './Toasts.jsx';

// A quick hop when the pointer meets Nena. No idle looping: she shouldn't compete with the rent.
function useHop(paused) {
  const [hop, setHop] = useState('');
  const quickHop = () => { if (paused) return; setHop('hop-quick'); setTimeout(() => setHop(''), 500); };
  return [hop, quickHop];
}

const SPOKE_KEY = 'rentio-nena-spoke'; // the speech bubble shows once per session

// version changes whenever data changes, so the speech bubble is refreshed.
export default function QuickActions({ version, onChanged }) {
  const [summary] = useApi(`/reports/dashboard?v=${version}`);
  const hint = summary ? quickHint(summary) : null;
  const [open, setOpen] = useState(false); // quick actions menu
  const [adding, setAdding] = useState(null); // collection name being added
  const [spent, setSpent] = useState(() => { try { return Boolean(sessionStorage.getItem(SPOKE_KEY)); } catch { return false; } }); // bubble already shown, closed or timed out
  const hush = () => { setSpent(true); try { sessionStorage.setItem(SPOKE_KEY, '1'); } catch { /* storage blocked */ } };
  const [hop, quickHop] = useHop(open || Boolean(adding));

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(hush, 8000);
    return () => clearTimeout(t);
  }, [hint]);

  // Android's Back button closes these like it closes a sheet.
  useEffect(() => (open ? pushLayer(() => setOpen(false), { lock: false }) : undefined), [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open]);

  const add = (name) => { setOpen(false); setAdding(name); };
  const done = (saved) => {
    if (saved) { toast(`${saved.name} added as a ${resources[adding].singular}.`); onChanged(); }
    setAdding(null);
  };
  // Top to bottom; the bottom pill appears first.
  const items = [
    ['Add tenant', I.userPlus, () => add('tenants')],
    ['Add property', I.buildingPlus, () => add('properties')],
  ];
  const showBubble = hint && !spent && !open;

  return (
    <>
      {open && <div className="fab-scrim" onClick={() => setOpen(false)} />}
      <div className="fab-wrap">
        <div id="quick-actions" className={`fab-actions ${open ? 'open' : ''}`} inert={!open}>
          {items.map(([label, icon, run]) => <button key={label} className="fab-action" onClick={run}><Icon d={icon} />{label}</button>)}
        </div>
        {showBubble && (
          <div className="speech">
            <span className="speech-text">{hint}</span>
            <button className="speech-close" aria-label="Dismiss message" onClick={hush}>×</button>
          </div>
        )}
        <button
          className={`fab ${open ? 'open' : ''} ${hop}`}
          aria-label={open ? 'Close menu' : 'Open Nena'}
          aria-expanded={open}
          aria-controls="quick-actions"
          onPointerEnter={(e) => e.pointerType === 'mouse' && quickHop()}
          onPointerDown={(e) => e.pointerType !== 'mouse' && quickHop()}
          onClick={() => setOpen(!open)}
        >
          <span className="fab-face"><Robot blinks={!open} /></span>
          <span className="fab-x"><Icon d={I.x} /></span>
        </button>
      </div>

      {adding && (
        <Doc title={`Add ${resources[adding].singular}`} onClose={() => setAdding(null)}>
          <RecordForm name={adding} row={{}} onDone={done} />
        </Doc>
      )}
    </>
  );
}
