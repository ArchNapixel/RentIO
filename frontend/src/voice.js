// Microphone recording as a 16 kHz mono WAV data URL (a format Gemini accepts; WebM is not).
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1); // ponytail: deprecated but universal; AudioWorklet if it's ever removed
  const chunks = [];
  node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(node);
  node.connect(ctx.destination);

  return async function stop() {
    node.disconnect();
    source.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    const rate = ctx.sampleRate;
    await ctx.close();
    return toWavDataUrl(chunks, rate, 16000);
  };
}

function toWavDataUrl(chunks, inRate, outRate) {
  const input = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) { input.set(c, offset); offset += c.length; }
  const step = inRate / outRate;
  const pcm = new Int16Array(Math.floor(input.length / step));
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, input[Math.floor(i * step)]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const text = (at, s) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
  text(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  text(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  new Int16Array(buf, 44).set(pcm);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(new Blob([buf], { type: 'audio/wav' }));
  });
}

// Photos are shrunk before upload: receipts stay readable, uploads stay small.
export async function shrinkPhoto(file, maxSide = 1600) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
