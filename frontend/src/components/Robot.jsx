// Nena's face and the RentIO house mark. Geometry from the design spec (64-unit viewBox).
import { useEffect, useState } from 'react';

// Only the eyes and mouth change between expressions.
const FACES = {
  idle: { eyes: <><circle cx="25" cy="31" r="3.5" /><circle cx="39" cy="31" r="3.5" /></>, mouth: 'M26 39q6 5 12 0' },
  listening: { eyes: <><circle cx="25" cy="31" r="3.5" /><circle cx="39" cy="31" r="3.5" /></>, mouth: 'M29 40a3 3 0 0 0 6 0a3 3 0 0 0-6 0' },
  thinking: { eyes: <><circle cx="25" cy="30" r="3" /><circle cx="39" cy="30" r="3" /></>, mouth: 'M27 40h10' },
  saved: { eyes: <path d="M21 32q4-5 8 0M35 32q4-5 8 0" fill="none" stroke="var(--nena)" strokeWidth="3" strokeLinecap="round" />, mouth: 'M25 38q7 7 14 0' },
  error: { eyes: <><circle cx="25" cy="32" r="3" /><circle cx="39" cy="32" r="3" /></>, mouth: 'M27 42q5-4 10 0' },
};

// Random blinks every 3-6s; one in five is a double blink.
function useBlink(enabled) {
  const [blink, setBlink] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let timer;
    const next = () => {
      timer = setTimeout(() => {
        setBlink(Math.random() < 0.2 ? 'blink2' : 'blink');
        setTimeout(() => setBlink(''), 400);
        next();
      }, 3000 + Math.random() * 3000);
    };
    next();
    return () => clearTimeout(timer);
  }, [enabled]);
  return blink;
}

export function Robot({ expression = 'idle', smile = true, blinks = true }) {
  const blink = useBlink(blinks);
  const face = FACES[expression] ?? FACES.idle;
  return (
    <svg className={`robot ${expression} ${blink}`} viewBox="8 2 48 48" aria-hidden="true">
      <path d="M32 8v8" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle className="ball" cx="32" cy="7" r="4" fill="#fff" />
      <rect x="12" y="16" width="40" height="32" rx="12" fill="#fff" />
      <g className="eyes" fill="var(--nena)">{face.eyes}</g>
      {smile && <path d={face.mouth} stroke="var(--nena)" strokeWidth="3" fill="none" strokeLinecap="round" />}
    </svg>
  );
}

// The RentIO mark: a house whose window is Nena's face.
export function Logo({ size = 32 }) {
  return (
    <span className="logo" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="2.6" r="1.6" fill="#fff" />
        <path d="M12 4.8 20 11v9.2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11z" fill="#fff" />
        <circle cx="9.6" cy="14" r="1.25" fill="var(--nena)" />
        <circle cx="14.4" cy="14" r="1.25" fill="var(--nena)" />
        {size >= 32 && <path d="M9.8 17.2q2.2 1.8 4.4 0" stroke="var(--nena)" strokeWidth="1.3" fill="none" strokeLinecap="round" />}
      </svg>
    </span>
  );
}

export function Wordmark() {
  return <span className="wordmark"><Logo size={36} /><span>Rent<span className="io">IO</span></span></span>;
}
