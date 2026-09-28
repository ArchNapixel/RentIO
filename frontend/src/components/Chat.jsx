// Chat with Nena. Stays mounted while hidden so the conversation survives closing the panel.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { shrinkPhoto, startRecording } from '../voice.js';

const suggestions = ['Who is behind on rent?', "Who hasn't paid this month?", 'Give me a month recap', 'Open the rent tracker'];
const canRecord = Boolean(navigator.mediaDevices?.getUserMedia);
const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const CLIP = 'M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9';
const MIC = 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3';

// What Gemini sees: the text, the outcome of any proposed changes, and only the newest photo.
const toHistory = (messages) => messages.map((m, i) => ({
  role: m.role,
  text: m.text + (m.proposals ?? []).map((p) => `\n[${p.status === 'done' ? 'Owner confirmed; saved' : p.status === 'cancelled' ? 'Owner cancelled' : 'Not confirmed yet'}: ${p.summary}]`).join(''),
  ...(i === messages.length - 1 && m.image ? { image: m.image } : {}),
}));

export default function Chat({ greeting, active, onNavigate, onChanged }) {
  const [messages, setMessages] = useState([]); // { role: 'user' | 'model', text, image?, proposals? }
  const [input, setInput] = useState('');
  const [photo, setPhoto] = useState(null); // data URL waiting to be sent
  const [busy, setBusy] = useState(false);
  const [stopRecording, setStopRecording] = useState(null); // set while the mic is on
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, busy]);
  useEffect(() => { if (active) inputRef.current?.focus(); }, [active]);
  useEffect(() => { // recordings stop by themselves after a minute
    if (!stopRecording) return;
    const t = setTimeout(toggleMic, 60_000);
    return () => clearTimeout(t);
  }, [stopRecording]);

  async function send(text) {
    text = text.trim();
    if ((!text && !photo) || busy) return;
    const next = [...messages, { role: 'user', text: text || 'Here is a payment receipt.', image: photo }];
    setMessages(next);
    setInput('');
    setPhoto(null);
    setError('');
    setBusy(true);
    try {
      const res = await api('/ai/chat', { method: 'POST', body: { messages: toHistory(next) } });
      setMessages([...next, { role: 'model', text: res.reply, proposals: res.proposals.map((p) => ({ ...p, status: 'pending' })) }]);
      if (res.navigate) onNavigate(res.navigate);
    } catch (err) {
      setError(err.message);
      setMessages(messages); // roll back so the question can be re-sent
      setInput(text);
      setPhoto(next.at(-1).image);
    } finally {
      setBusy(false);
    }
  }

  const patchProposal = (index, id, patch) =>
    setMessages((ms) => ms.map((m, i) => (i !== index ? m : { ...m, proposals: m.proposals.map((p) => (p.id === id ? { ...p, ...patch } : p)) })));

  async function confirm(index, p) {
    patchProposal(index, p.id, { status: 'saving', error: '' });
    try {
      await api('/ai/execute', { method: 'POST', body: { tool: p.tool, args: p.args } });
      patchProposal(index, p.id, { status: 'done' });
      onChanged();
    } catch (err) {
      patchProposal(index, p.id, { status: 'pending', error: err.message });
    }
  }

  async function attach(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setPhoto(await shrinkPhoto(file)); } catch { setError("Couldn't open that photo. Try another one."); }
  }

  async function toggleMic() {
    setError('');
    if (!stopRecording) {
      try { const stop = await startRecording(); setStopRecording(() => stop); } catch { setError('The microphone is not available. Allow microphone access and try again.'); }
      return;
    }
    const stop = stopRecording;
    setStopRecording(null);
    setTranscribing(true);
    try {
      const { text } = await api('/ai/transcribe', { method: 'POST', body: { audio: await stop() } });
      if (text) setInput((v) => (v ? `${v} ${text}` : text));
      else setError("I didn't catch that. Try again.");
    } catch (err) {
      setError(err.message);
    } finally {
      setTranscribing(false);
      inputRef.current?.focus();
    }
  }

  const status = stopRecording ? 'Listening… tap the mic to stop' : transcribing ? 'Writing down what you said…' : '';

  return (
    <div className="chat">
      <div className="chat-log" aria-live="polite">
        {greeting && <p className="bubble model">{greeting}</p>}
        {!messages.length && (
          <div className="chat-suggestions">
            {suggestions.map((s) => <button key={s} className="btn sm" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.image && <img className="chat-photo" src={m.image} alt="Photo you sent" />}
            <p className={`bubble ${m.role}`}>{m.text}</p>
            {m.proposals?.map((p) => (
              <div key={p.id} className={`proposal ${p.status}`}>
                <strong>{p.title}</strong>
                <p>{p.summary}</p>
                {p.error && <p className="error small" role="alert">{p.error}</p>}
                {p.status === 'done' && <span className="good">Saved ✓</span>}
                {p.status === 'cancelled' && <span className="muted">Cancelled</span>}
                {(p.status === 'pending' || p.status === 'saving') && (
                  <div className="row-actions">
                    <button className="btn sm primary" disabled={p.status === 'saving'} onClick={() => confirm(i, p)}>{p.status === 'saving' ? 'Saving…' : 'Confirm'}</button>
                    <button className="btn sm" disabled={p.status === 'saving'} onClick={() => patchProposal(i, p.id, { status: 'cancelled' })}>Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
        {busy && <p className="bubble model typing" aria-label="Nena is typing"><span /><span /><span /></p>}
        <div ref={endRef} />
      </div>
      {error && <p className="error small" role="alert">{error}</p>}
      {status && <p className="muted small" role="status">{status}</p>}
      {photo && (
        <div className="attach-preview">
          <img src={photo} alt="Photo to send" />
          <button className="speech-close" aria-label="Remove photo" onClick={() => setPhoto(null)}>×</button>
        </div>
      )}
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={attach} />
        <button type="button" className="icon-btn" aria-label="Attach a receipt photo" title="Attach a receipt photo" onClick={() => fileRef.current.click()} disabled={busy}>
          <Icon d={CLIP} />
        </button>
        {canRecord && (
          <button type="button" className={`icon-btn ${stopRecording ? 'recording' : ''}`} aria-label={stopRecording ? 'Stop recording' : 'Speak'} title={stopRecording ? 'Stop recording' : 'Speak'} onClick={toggleMic} disabled={busy || transcribing}>
            <Icon d={MIC} />
          </button>
        )}
        <label className="sr-only" htmlFor="chat-q">Message Nena</label>
        <textarea
          id="chat-q"
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="e.g. Nagbayad na si Juan para sa October"
          maxLength={4000}
        />
        <button className="btn primary" disabled={busy || Boolean(stopRecording) || (!input.trim() && !photo)}>Send</button>
      </form>
    </div>
  );
}
