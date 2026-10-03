// Settings sheet: theme, notifications, export, and erase everything stored on this phone.
import { useEffect, useState } from 'react';
import { api, download } from '../api.js';
import { askNotifyPermission, notifyPermission } from '../notify.js';
import Doc, { Confirm } from './Doc.jsx';
import { I, Icon } from './Icons.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { toast } from './Toasts.jsx';

// Hidden where the device can't show notifications: overdue rent still shows as a badge on Rent.
function Notifications() {
  const [permission, setPermission] = useState(null); // null until we've asked the device
  useEffect(() => { notifyPermission().then(setPermission).catch(() => setPermission('unsupported')); }, []);
  if (!permission || permission === 'unsupported') return null;
  if (permission === 'granted') return <p className="paid small">✓ Notifications are on for overdue rent.</p>;
  if (permission === 'denied') return <p className="muted small">Notifications are blocked. Allow them for RentIO in your device's settings.</p>;
  return (
    <button className="btn block" onClick={() => askNotifyPermission().then(setPermission).catch(() => setPermission('denied'))}>
      <Icon d={I.bell} />Turn on notifications
    </button>
  );
}

export default function Account({ onClose }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await api('/account', { method: 'DELETE' });
      location.hash = ''; // back to a fresh, empty app
      location.reload();
    } catch (err) {
      setConfirming(false);
      setBusy(false);
      toast({ text: err.message, error: true });
    }
  }

  return (
    <>
      <Doc title="Account" onClose={onClose}>
        <div className="form">
          <ThemeToggle labelled />
          <Notifications />
          <button className="btn block" onClick={() => download('tenants', 'tenants.csv').catch((err) => toast({ text: err.message, error: true }))}>
            <Icon d={I.download} />Export tenants (CSV)
          </button>
          <div className="danger-zone">
            <h3>Erase all data</h3>
            <p>Removes your properties, tenants and payment history from this phone for good. This can't be undone.</p>
            <button type="button" className="btn danger" onClick={() => setConfirming(true)}>Erase all data</button>
          </div>
        </div>
      </Doc>
      {confirming && (
        <Confirm
          title="Erase all data?"
          body="Every property, tenant and payment record on this phone goes. This can't be undone."
          confirmLabel="Erase all data"
          cancelLabel="Keep my data"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
