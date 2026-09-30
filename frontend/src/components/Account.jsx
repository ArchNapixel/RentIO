// Account sheet: who you're signed in as, log out, and delete the account (app stores require the option).
import { useState } from 'react';
import { api } from '../api.js';
import { supabase } from '../supabase.js';
import Doc, { Confirm } from './Doc.jsx';
import { toast } from './Toasts.jsx';

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
