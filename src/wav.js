// Minimal WAV writer: a 44-byte header followed by 16-bit mono samples.
export function encodeWav(samples, sampleRate) {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // bytes per second
  buf.writeUInt16LE(2, 32); // bytes per frame
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

// A soft two-note chime, used as stand-in speech in mock mode.
export function chime(sampleRate = 16000) {
  const notes = [660, 880];
  const noteLen = Math.floor(sampleRate * 0.18);
  const samples = new Float32Array(noteLen * notes.length);
  notes.forEach((freq, n) => {
    for (let i = 0; i < noteLen; i++) {
      const fade = Math.min(1, i / 200, (noteLen - i) / 400);
      samples[n * noteLen + i] = 0.3 * fade * Math.sin((2 * Math.PI * freq * i) / sampleRate);
    }
  });
  return encodeWav(samples, sampleRate);
}

export function silence(seconds, sampleRate = 16000) {
  return encodeWav(new Float32Array(Math.floor(seconds * sampleRate)), sampleRate);
}
