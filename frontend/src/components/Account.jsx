// Account sheet: who you're signed in as, settings (theme, notifications, export), log out, and delete the account (app stores require the option).
import { useEffect, useState } from 'react';
import { api, download } from '../api.js';
import { askNotifyPermission, notifyPermission } from '../notify.js';
import { supabase } from '../supabase.js';
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

export default function Account({ email, onClose }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await api('/account', { method: 'DELETE' });
      await supabase.auth.signOut(); // the app returns to the login screen
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
          {email && <p className="muted small">Signed in as {email}</p>}
          <ThemeToggle labelled />
          <Notifications />
          <button className="btn block" onClick={() => download('/export/tenants', 'tenants.csv').catch((err) => toast({ text: err.message, error: true }))}>
            <Icon d={I.download} />Export tenants (CSV)
          </button>
          <button className="btn block" onClick={() => supabase.auth.signOut()}>Log out</button>
          <div className="danger-zone">
            <h3>Delete account</h3>
            <p>Removes your properties, tenants and payment history for good. This can't be undone.</p>
            <button type="button" className="btn danger" onClick={() => setConfirming(true)}>Delete my account</button>
          </div>
        </div>
      </Doc>
      {confirming && (
        <Confirm
          title="Delete your account?"
          body="Everything in it goes: every property, tenant and payment record. This can't be undone."
          confirmLabel="Delete my account"
          cancelLabel="Keep my account"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
