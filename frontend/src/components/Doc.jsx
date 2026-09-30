// Bottom sheet on phones, centred dialog on desktop: title, ×, scrolling body.
// Escape or tapping the scrim closes it; focus stays inside and returns to the opener afterwards.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { I, Icon } from './Icons.jsx';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Everything open on top of the page, innermost last. Android's Back button closes the top one.
const layers = [];
let locks = 0;
export function pushLayer(close, { lock = true } = {}) {
  layers.push(close);
  if (lock && ++locks === 1) document.body.style.overflow = 'hidden'; // the page behind a sheet shouldn't scroll
  return () => {
    const at = layers.lastIndexOf(close);
    if (at >= 0) layers.splice(at, 1);
    if (lock && --locks === 0) document.body.style.overflow = '';
  };
}
export function closeTopLayer() {
  const close = layers.at(-1);
  close?.();
  return Boolean(close);
}

export function useFocusTrap(ref, onClose) {
  useEffect(() => {
    const opener = document.activeElement;
    const box = ref.current;
    const release = pushLayer(onClose);
    (box.querySelector('[autofocus]') ?? box.querySelector(FOCUSABLE))?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key !== 'Tab') return;
      const items = [...box.querySelectorAll(FOCUSABLE)];
      const first = items[0], last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    box.addEventListener('keydown', onKey);
    return () => { box.removeEventListener('keydown', onKey); release(); opener?.focus?.(); };
  }, []);
}

export default function Doc({ title, onClose, children, printable = false }) {
  const ref = useRef(null);
  useFocusTrap(ref, onClose);
  return createPortal(
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="sheet-head">
          <h2>{title}</h2>
          {printable && <button className="icon-btn" aria-label="Print or save as PDF" title="Print or save as PDF" onClick={() => window.print()}><Icon d={I.printer} /></button>}
          <button className="icon-btn" aria-label="Close" onClick={onClose}><Icon d={I.x} /></button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

// Named confirmation for destructive actions ("Delete Juan dela Cruz?").
export function Confirm({ title, body, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel, busy }) {
  const ref = useRef(null);
  useFocusTrap(ref, onCancel);
  return createPortal(
    <div className="scrim center" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2>{title}</h2>
        <p>{body}</p>
        <button className="btn danger filled" onClick={onConfirm} disabled={busy}>{busy ? 'Deleting…' : confirmLabel}</button>
        <button className="btn" onClick={onCancel} autoFocus>{cancelLabel}</button>
      </div>
    </div>,
    document.body,
  );
}
