// Chat with the Gemini assistant. Stays mounted while hidden so the conversation survives closing the panel.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const suggestions = ['Who is overdue on rent?', 'Which leases expire in the next 60 days?', 'How much did we collect this month?', 'Which properties have vacancies?'];

export default function Chat({ greeting, active }) {
  const [messages, setMessages] = useState([]); // { role: 'user' | 'model', text }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, busy]);
  useEffect(() => { if (active) inputRef.current?.focus(); }, [active]);

  async function send(text) {
    text = text.trim();
    if (!text || busy) return;
    const next = [...messages, { role: 'user', text }];
    setMessages(next);
    setInput('');
    setError('');
    setBusy(true);
    try {
      const { reply } = await api('/ai/chat', { method: 'POST', body: { messages: next } });
      setMessages([...next, { role: 'model', text: reply }]);
    } catch (err) {
      setError(err.message);
      setMessages(messages); // roll back so the question can be re-sent
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat">
      <div className="chat-log" aria-live="polite">
        {greeting && <p className="bubble model">{greeting}</p>}
        {!messages.length && (
          <div className="chat-suggestions">
            {suggestions.map((s) => <button key={s} className="btn sm" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
        {messages.map((m, i) => <p key={i} className={`bubble ${m.role}`}>{m.text}</p>)}
        {busy && <p className="bubble model typing" aria-label="Nena is typing"><span /><span /><span /></p>}
        <div ref={endRef} />
      </div>
      {error && <p className="error small" role="alert">{error}</p>}
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <label className="sr-only" htmlFor="chat-q">Message Nena</label>
        <textarea
          id="chat-q"
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="e.g. Sino ang may utang ngayong buwan?"
          maxLength={4000}
        />
        <button className="btn primary" disabled={busy || !input.trim()}>Send</button>
      </form>
    </div>
  );
}
