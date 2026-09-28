// Printable overlay for receipts, invoices, profiles. "Print / Save PDF" uses the browser's print-to-PDF.
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Doc({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="doc-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <article className="doc">
        <div className="doc-actions">
          <button className="btn" onClick={() => window.print()}>Print / Save PDF</button>
          <button className="btn" onClick={onClose} autoFocus>Close</button>
        </div>
        <h2>{title}</h2>
        {children}
      </article>
    </div>,
    document.body,
  );
}
