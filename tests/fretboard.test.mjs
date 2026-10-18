import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFretboard } from '../fretboard.js';
import { STRINGS, noteAt, midiToNote } from '../music.js';

class Element {
  constructor(registry, dataset = {}, isRoot = false) {
    this.registry = registry; this.dataset = dataset; this.isRoot = isRoot;
    this.children = new Map(); this.buttons = []; this.attributes = {}; this.disabled = false;
    this.style = { setProperty() {} }; this.classes = new Set();
    this.classList = {
      contains: name => this.classes.has(name),
      remove: name => this.classes.delete(name),
      toggle: (name, force = !this.classes.has(name)) => { if (force) this.classes.add(name); else this.classes.delete(name); },
    };
  }
  set innerHTML(value) {
    this.html = String(value); this.children = new Map(); this.buttons = [];
    for (const [, id] of this.html.matchAll(/\bid="([^"]+)"/g)) {
      const child = new Element(this.registry); this.children.set(id, child); this.registry.set(id, child);
    }
    for (const [, attrs] of this.html.matchAll(/<button\b([^>]*)>/g)) {
      const data = {};
      for (const [, key, value] of attrs.matchAll(/data-([a-z-]+)="([^"]*)"/g)) data[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      const button = new Element(this.registry, data);
      button.disabled = /\bdisabled\b/.test(attrs);
      button.attributes = Object.fromEntries([...attrs.matchAll(/([a-z-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
      button.classes = new Set((button.attributes.class || '').split(/\s+/));
      this.buttons.push(button);
      if (button.attributes.id) { this.children.set(button.attributes.id, button); this.registry.set(button.attributes.id, button); }
    }
    if (this.isRoot) this.registry.get('note-scale').buttons = this.buttons.filter(button => 'highlight' in button.dataset);
  }
  get innerHTML() { return this.html || ''; }
  set textContent(value) { this.html = String(value); }
  get textContent() { return this.innerHTML.replace(/<[^>]*>/g, ''); }
  set className(value) { this.classes = new Set(value.split(/\s+/)); }
  querySelector(selector) {
    queryCount += 1;
    return (this.isRoot ? this.registry : this.children).get(selector.slice(1)) || null;
  }
  querySelectorAll(selector) {
    queryCount += 1;
    if (selector === 'button') return this.buttons;
    if (selector.startsWith('.')) return this.buttons.filter(button => button.classes.has(selector.slice(1)));
    const key = selector.match(/^\[data-([a-z-]+)\]$/)?.[1]?.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return key ? this.buttons.filter(button => key in button.dataset) : [];
  }
  closest(selector) {
    const key = selector.match(/^\[data-([a-z-]+)\]$/)?.[1]?.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return key && key in this.dataset ? this : null;
  }
}

let queryCount = 0;
function fixture(t, preferences = {}, initialRandom = .9999) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalRandom = Math.random;
  const listeners = new Set();
  const document = { hidden: false, addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  let randomValue = initialRandom;
  Math.random = () => randomValue;
  const registry = new Map();
  const container = new Element(registry, {}, true);
  const q = id => registry.get(id);
  const records = [], preferencesSaved = [];
  const audio = {
    listening: false, stops: 0, silences: 0, requests: [], played: [],
    stopAll() { this.silences += 1; },
    stopMic() { this.listening = false; this.stops += 1; },
    playNote(midi) { this.played.push(midi); return Promise.resolve(true); },
    startMic(pitch, error) { return new Promise((resolve, reject) => this.requests.push({ pitch, error, resolve, reject })); },
  };
  const store = { data: { preferences: { range: 5, strings: 'all', notes: 'natural', ...preferences } }, preference: (...args) => preferencesSaved.push(args) };
  let micStarts = 0;
  const cleanup = renderFretboard(container, { audio, store, record: (...args) => records.push(args), onMicStart: () => { micStarts += 1; } });
  t.after(() => { cleanup(); Math.random = originalRandom; if (descriptor) Object.defineProperty(globalThis, 'document', descriptor); else delete globalThis.document; });
  return {
    audio, records, preferencesSaved, q, container, cleanup, listeners, document,
    get queries() { return queryCount; }, get micStarts() { return micStarts; },
    random(value) { randomValue = value; },
    mode(name) { container.querySelectorAll('[data-mode]').find(button => button.dataset.mode === name).onclick(); },
    filter(id, value) { q(id).value = String(value); q(id).onchange({ target: q(id) }); },
    cell(si, fret) { return q('fretboard').buttons.find(button => Number(button.dataset.string) === si && Number(button.dataset.fret) === fret); },
    click(si, fret) { q('fretboard').onclick({ target: this.cell(si, fret) }); },
    target() {
      q('reference-note').onclick();
      const si = Number(q('challenge').innerHTML.match(/class="challenge-prompt">สาย (\d)/)[1]) - 1;
      const midi = audio.played.at(-1);
      return { si, fret: midi - STRINGS[si].midi, ...midiToNote(midi) };
    },
    hide(rootStopsFirst = false) { document.hidden = true; if (rootStopsFirst) audio.stopMic(); for (const listener of [...listeners]) listener(); },
  };
}

test('find mode rejects the same pitch on a different string and records only once', t => {
  const f = fixture(t, { range: 12 });
  f.random(0); f.mode('find');
  const target = f.target();
  assert.deepEqual([target.si, target.fret, target.midi], [0, 0, 64]);
  assert.equal(noteAt(1, 5).midi, target.midi);
  f.click(1, 5);
  f.click(target.si, target.fret);
  assert.equal(f.records.length, 1);
  assert.equal(f.records[0][1], false);
  assert.equal(f.records[0][3], '0:0');
  assert.match(f.q('fret-feedback').textContent, /E4 สาย 1 เฟรต 0/);
  f.q('next-question').onclick();
  const next = f.target();
  f.click(next.si, next.fret);
  assert.equal(f.records.length, 2);
  assert.equal(f.records[1][1], true);
});

test('find mode distinguishes octave-equivalent frets on the same string', t => {
  const f = fixture(t, { range: 12, strings: '0' }, 0);
  f.random(.9999); f.mode('find');
  const target = f.target();
  assert.deepEqual([target.si, target.fret, target.name, target.octave], [0, 12, 'E', 5]);
  f.click(0, 0);
  assert.equal(f.records[0][1], false);
  assert.match(f.records[0][2], /E5/);
});

test('name mode hides the answer before submission and locks a scored question', t => {
  const f = fixture(t);
  f.random(0); f.mode('name');
  const marker = f.q('fretboard').buttons.find(button => button.classes.has('quiz-marker'));
  const answer = noteAt(Number(marker.dataset.string), Number(marker.dataset.fret)).name;
  assert.doesNotMatch(marker.attributes['aria-label'], /โน้ต/);
  assert.match(f.q('challenge').innerHTML, /class="target-note">\?/);
  const button = f.q('challenge').querySelectorAll('[data-answer]').find(button => button.dataset.answer === answer);
  button.onclick();
  button.onclick();
  assert.equal(f.records.length, 1);
  assert.equal(f.records[0][1], true);
  assert.ok(f.q('challenge').querySelectorAll('[data-answer]').every(button => button.disabled));
  assert.equal(f.q('fretboard').buttons.filter(button => button.classes.has('quiz-marker')).length, 0);
});

test('range, string and natural-note filters constrain the quiz and persist preferences', t => {
  const f = fixture(t);
  f.mode('find');
  f.filter('fret-range', 3); f.filter('string-filter', 4); f.filter('note-filter', 'natural');
  for (const value of [0, .1, .3, .5, .7, .9999]) {
    f.random(value); f.q('next-question').onclick();
    const target = f.target();
    assert.equal(target.si, 4);
    assert.ok(target.fret >= 0 && target.fret <= 3);
    assert.ok(!target.name.includes('#'));
  }
  assert.ok(f.q('fretboard').buttons.every(button => Number(button.dataset.fret) <= 3));
  assert.ok(f.q('fretboard').buttons.filter(button => Number(button.dataset.string) !== 4).every(button => button.disabled));
  assert.deepEqual(f.preferencesSaved, [['range', '3'], ['strings', '4'], ['notes', 'natural']]);
  f.filter('note-filter', 'all'); f.random(.25); f.q('next-question').onclick();
  assert.ok(f.target().name.includes('#'));
});

test('a cancelled mic request cannot overwrite a newer request or score its stale pitch', async t => {
  const f = fixture(t); f.random(0); f.mode('find');
  const target = f.target();
  const first = f.q('fret-mic').onclick();
  await f.q('fret-mic').onclick();
  const second = f.q('fret-mic').onclick();
  const waiting = f.q('fret-mic').textContent;
  f.audio.requests[0].resolve(true); await first;
  assert.equal(f.q('fret-mic').textContent, waiting);
  for (let i = 0; i < 5; i++) f.audio.requests[0].pitch({ ...target, cents: 0 });
  assert.equal(f.records.length, 0);
  f.audio.listening = true; f.audio.requests[1].resolve(true); await second;
  assert.match(f.q('fret-mic').textContent, /ปิดไมค์/);
  assert.equal(f.micStarts, 2);
  for (let i = 0; i < 4; i++) f.audio.requests[1].pitch({ ...target, midi: target.midi + 12, cents: 0 });
  assert.equal(f.records.length, 0);
  for (let i = 0; i < 5; i++) f.audio.requests[1].pitch({ ...target, cents: 12.37619 });
  assert.equal(f.records.length, 1);
  assert.equal(f.records[0][1], true);
  assert.match(f.q('fret-mic-result').textContent, /\+12¢/);
});

test('reference playback cancels pending microphone work and cannot self-score', async t => {
  const f = fixture(t); f.random(0); f.mode('find'); const target = f.target();
  const opening = f.q('fret-mic').onclick();
  const stops = f.audio.stops;
  f.q('reference-note').onclick();
  assert.equal(f.audio.stops, stops + 1);
  assert.match(f.q('fret-feedback').textContent, /ปิดไมค์แล้ว/);
  for (let i = 0; i < 5; i++) f.audio.requests[0].pitch({ ...target, cents: 0 });
  f.audio.requests[0].resolve(true); await opening;
  assert.equal(f.records.length, 0);
  assert.match(f.q('fret-mic').textContent, /เล่นผ่านไมค์/);
});

test('visibility resets an active microphone even if the app stopped audio first', async t => {
  const f = fixture(t); f.random(0); f.mode('find'); const target = f.target();
  const opening = f.q('fret-mic').onclick();
  f.audio.listening = true; f.audio.requests[0].resolve(true); await opening;
  f.hide(true);
  assert.match(f.q('fret-mic').textContent, /เล่นผ่านไมค์/);
  assert.match(f.q('fret-feedback').textContent, /พักไมค์แล้ว/);
  for (let i = 0; i < 5; i++) f.audio.requests[0].pitch({ ...target, cents: 0 });
  assert.equal(f.records.length, 0);
});

test('cleanup is idempotent and stale mic callbacks never query detached content', async t => {
  const f = fixture(t); f.mode('find'); const target = f.target();
  const opening = f.q('fret-mic').onclick();
  f.cleanup(); const queries = f.queries, stops = f.audio.stops;
  for (let i = 0; i < 5; i++) f.audio.requests[0].pitch({ ...target, cents: 0 });
  f.audio.requests[0].error('Late failure'); f.audio.requests[0].resolve(true); await opening;
  f.cleanup();
  assert.equal(f.queries, queries);
  assert.equal(f.audio.stops, stops);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.records.length, 0);
});

test('a rejected microphone start restores a usable retry button', async t => {
  const f = fixture(t); f.mode('find');
  const opening = f.q('fret-mic').onclick();
  f.audio.requests[0].reject(new Error('device unavailable')); await opening;
  assert.match(f.q('fret-feedback').textContent, /device unavailable/);
  assert.match(f.q('fret-mic').textContent, /เล่นผ่านไมค์/);
  const retry = f.q('fret-mic').onclick();
  assert.equal(f.audio.requests.length, 2);
  f.audio.requests[1].resolve(false); await retry;
});
