// Records the microphone as 16 kHz mono WAV.
// Browsers record WebM/Opus by default, which Gnani's STT doesn't accept, so
// we capture raw samples with the Web Audio API and write the WAV ourselves.
// 16 kHz is plenty for speech and keeps uploads small.
const TARGET_RATE = 16000;
const TAIL_MS = 150; // keep recording briefly after release so the last word isn't clipped

export function createRecorder() {
  let ctx = null;
  let chunks = [];
  let recording = false;
  let startedAt = 0;

  async function ensureMic() {
    if (ctx) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true } });
    ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      if (recording) chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    source.connect(processor);
    processor.connect(ctx.destination); // must be connected for onaudioprocess to fire; output stays silent
  }

  return {
    async start() {
      await ensureMic();
      await ctx.resume();
      chunks = [];
      recording = true;
      startedAt = performance.now();
    },

    // Resolves to a WAV Blob, or null if the press was too short to be speech.
    async stop() {
      await new Promise((r) => setTimeout(r, TAIL_MS));
      recording = false;
      const seconds = (performance.now() - startedAt) / 1000;
      if (!ctx || seconds < 0.6) return null;
      const samples = downsample(merge(chunks), ctx.sampleRate, TARGET_RATE);
      return encodeWav(samples, TARGET_RATE);
    },

    elapsed() {
      return recording ? (performance.now() - startedAt) / 1000 : 0;
    },
  };
}

function merge(chunks) {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

// Average each group of input samples into one output sample.
function downsample(input, fromRate, toRate) {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function encodeWav(samples, sampleRate) {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (offset, s) => [...s].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}
