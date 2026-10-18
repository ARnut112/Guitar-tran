import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Browser-native .js modules are tested without requiring a package.json.
const musicSource = await readFile(new URL('../music.js', import.meta.url), 'utf8');
const musicURL = `data:text/javascript;base64,${Buffer.from(musicSource).toString('base64')}`;
const { NOTES, STRINGS, noteAt, midiToNote, frequencyToNote, frequencyForMidi, detectPitch } = await import(musicURL);

async function withAudioGlobals(overrides, run) {
  const original = new Map(Object.keys(overrides).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    for (const [key, value] of Object.entries(overrides)) Object.defineProperty(globalThis, key, { configurable: true, value });
    const audioSource = (await readFile(new URL('../audio.js', import.meta.url), 'utf8')).replace("'./music.js'", JSON.stringify(musicURL));
    const { audio } = await import(`data:text/javascript;base64,${Buffer.from(audioSource).toString('base64')}#${Math.random()}`);
    await run(audio);
  } finally {
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

const fakeParam = () => ({ value: 0 });
const fakeNode = () => ({ connect() {}, disconnect() {}, gain: fakeParam(), threshold: fakeParam(), knee: fakeParam(), ratio: fakeParam(), attack: fakeParam(), release: fakeParam() });
class FakeAudioContext {
  state = 'running';
  destination = {};
  sampleRate = 48000;
  currentTime = 0;
  createGain = fakeNode;
  createDynamicsCompressor = fakeNode;
}

function signal(frequency, sampleRate = 48000, harmonics = [1], noise = 0, phase = 0.3) {
  let seed = 28351;
  return Float32Array.from({ length: 4096 }, (_, i) => {
    let value = 0;
    for (let harmonic = 0; harmonic < harmonics.length; harmonic++) {
      value += harmonics[harmonic] * Math.sin(2 * Math.PI * frequency * (harmonic + 1) * i / sampleRate + phase);
    }
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return 0.15 * value + noise * (seed / 4294967296 - 0.5);
  });
}

function assertPitch(samples, expected, sampleRate = 48000, toleranceCents = 5) {
  const detected = detectPitch(samples, sampleRate);
  assert.ok(detected > 0, `Expected ${expected.toFixed(2)} Hz, received no pitch`);
  const cents = 1200 * Math.log2(detected / expected);
  assert.ok(Math.abs(cents) < toleranceCents, `Expected ${expected.toFixed(2)} Hz, got ${detected.toFixed(2)} Hz (${cents.toFixed(2)} cents)`);
}

test('scientific note names, concert A, and all six open strings', () => {
  assert.equal(NOTES.length, 12);
  assert.equal(frequencyForMidi(69), 440);
  assert.deepEqual(midiToNote(60), { name: 'C', octave: 4, midi: 60, frequency: frequencyForMidi(60) });
  assert.deepEqual(STRINGS.map(string => string.midi), [64, 59, 55, 50, 45, 40]);
  assert.equal(noteAt(5, 0).name, 'E');
  assert.equal(noteAt(5, 0).octave, 2);
  assert.equal(noteAt(0, 12).midi, 76);
  assert.equal(noteAt(5, 8).name, 'C');
  assert.equal(noteAt(2, 1).name, 'G#');
});

test('frequency conversion preserves measured frequency and signed tuning error', () => {
  for (const cents of [-37, 0, 28]) {
    const frequency = 440 * 2 ** (cents / 1200);
    const note = frequencyToNote(frequency);
    assert.equal(note.midi, 69);
    assert.equal(note.name, 'A');
    assert.ok(Math.abs(note.cents - cents) < 1e-8);
    assert.equal(note.frequency, frequency);
  }
  assert.equal(frequencyToNote(0), null);
  assert.equal(frequencyToNote(NaN), null);
  assert.throws(() => noteAt(6, 0), RangeError);
  assert.throws(() => noteAt(1, -1), RangeError);
});

test('pitch detection identifies every open guitar string at common sample rates', () => {
  for (const sampleRate of [44100, 48000]) {
    for (const string of STRINGS) {
      const frequency = frequencyForMidi(string.midi);
      assertPitch(signal(frequency, sampleRate), frequency, sampleRate);
    }
  }
});

test('pitch detection tracks high frets and slightly detuned notes', () => {
  for (const midi of [40.29, 45.8, 64.18, 76, 88]) {
    const frequency = frequencyForMidi(midi);
    assertPitch(signal(frequency, 48000, [1, 0.4, 0.2]), frequency);
  }
});

test('strong second harmonics do not turn low guitar notes into octave errors', () => {
  for (const midi of [40, 45, 50, 55]) {
    const frequency = frequencyForMidi(midi);
    assertPitch(signal(frequency, 48000, [0.2, 1, 0.13, 0.3], 0.003), frequency);
  }
});

test('quiet, DC-offset, noisy, nonfinite, and too-short frames do not invent notes', () => {
  assert.equal(detectPitch(new Float32Array(4096), 48000), -1);
  assert.equal(detectPitch(new Float32Array(4096).fill(0.5), 48000), -1);
  assert.equal(detectPitch(signal(110).map(sample => sample * 0.001), 48000), -1);
  assert.equal(detectPitch(signal(0, 48000, [0], 0.2), 48000), -1);
  assert.equal(detectPitch(new Float32Array(100), 48000), -1);
  assert.equal(detectPitch(new Float32Array(4096).fill(NaN), 48000), -1);
});

test('pitch detection tolerates microphone DC offset and moderate background noise', () => {
  const frequency = frequencyForMidi(40);
  assertPitch(signal(frequency, 48000, [1, 0.4, 0.2], 0.025).map(sample => sample + 0.2), frequency, 48000, 7);
});

test('decaying plucked guitar harmonics retain the fundamental', () => {
  for (const midi of [40, 50, 64, 76]) {
    const frequency = frequencyForMidi(midi);
    const samples = signal(frequency, 48000, [0.6, 1, 0.4, 0.2]);
    for (let i = 0; i < samples.length; i++) samples[i] *= Math.exp(-i / 7000);
    assertPitch(samples, frequency, 48000, 7);
  }
});

test('microphone permission cancellation releases a late stream and never reports stale pitch', async () => {
  const original = new Map(['AudioContext', 'isSecureContext', 'navigator', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let resolvePermission;
  let requested = false;
  let stopped = 0;
  let callbacks = 0;
  const param = () => ({ value: 0 });
  const node = () => ({ connect() {}, disconnect() {}, gain: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() });
  class FakeAudioContext {
    state = 'running';
    destination = {};
    createGain = node;
    createDynamicsCompressor = node;
  }
  try {
    Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: FakeAudioContext });
    Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia() { requested = true; return new Promise(resolve => { resolvePermission = resolve; }); } } } });
    const audioSource = (await readFile(new URL('../audio.js', import.meta.url), 'utf8')).replace("'./music.js'", JSON.stringify(musicURL));
    const { audio } = await import(`data:text/javascript;base64,${Buffer.from(audioSource).toString('base64')}#cancel-test`);
    const opening = audio.startMic(() => callbacks++, () => callbacks++);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(requested, true);
    audio.stopMic();
    resolvePermission({ getTracks: () => [{ stop() { stopped++; } }] });
    assert.equal(await opening, false);
    assert.equal(stopped, 1);
    assert.equal(audio.listening, false);
    assert.equal(callbacks, 0);
  } finally {
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('microphone can retry after unsupported context and denied permissions', async () => {
  const messages = [];
  let requests = 0;
  await withAudioGlobals({
    AudioContext: FakeAudioContext,
    isSecureContext: false,
    navigator: { mediaDevices: { async getUserMedia() { requests++; throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }); } } },
  }, async audio => {
    assert.equal(await audio.startMic(null, message => messages.push(message)), false);
    assert.equal(requests, 0);
    Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: true });
    assert.equal(await audio.startMic(null, message => messages.push(message)), false);
    assert.equal(requests, 1);
    assert.equal(messages.length, 2);
    assert.match(messages[0], /HTTPS/);
    assert.match(messages[1], /อนุญาต/);
    assert.equal(audio.listening, false);
  });
});

test('stopping during AudioContext resume prevents stale playback', async () => {
  let resume;
  let oscillators = 0;
  class SuspendedContext extends FakeAudioContext {
    state = 'suspended';
    resume() { return new Promise(resolve => { resume = resolve; }); }
    createOscillator() { oscillators++; throw new Error('Cancelled playback must never create an oscillator'); }
  }
  await withAudioGlobals({ AudioContext: SuspendedContext }, async audio => {
    const playback = audio.playNote(64);
    audio.stopAll();
    resume();
    assert.equal(await playback, false);
    assert.equal(oscillators, 0);
  });
});

test('active microphone disconnects analysis, animation and tracks when stopped', async () => {
  let disconnected = 0;
  let tracksStopped = 0;
  let frameId = 0;
  let canceledFrame = 0;
  let frameCallback;
  let readings = 0;
  const track = { stop() { tracksStopped++; }, addEventListener() {} };
  class MicContext extends FakeAudioContext {
    createMediaStreamSource() { return { connect() {}, disconnect() { disconnected++; } }; }
    createAnalyser() { return { disconnect() { disconnected++; }, getFloatTimeDomainData(buffer) { buffer.fill(0); } }; }
  }
  await withAudioGlobals({
    AudioContext: MicContext,
    isSecureContext: true,
    navigator: { mediaDevices: { async getUserMedia() { return { getTracks: () => [track], getAudioTracks: () => [track] }; } } },
    requestAnimationFrame(callback) { frameCallback = callback; return ++frameId; },
    cancelAnimationFrame(id) { canceledFrame = id; },
  }, async audio => {
    assert.equal(await audio.startMic(note => { assert.equal(note, null); readings++; }), true);
    assert.equal(audio.listening, true);
    frameCallback(0);
    assert.equal(readings, 1);
    audio.stopMic();
    assert.equal(audio.listening, false);
    assert.equal(disconnected, 2);
    assert.equal(tracksStopped, 1);
    assert.equal(canceledFrame, frameId);
    audio.stopMic();
    assert.equal(tracksStopped, 1);
  });
});
