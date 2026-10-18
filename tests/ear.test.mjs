import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEar } from '../ear.js';
import { NOTES } from '../music.js';

class Element {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.disabled = false;
    this.checked = false;
    this.className = '';
    this.textContent = '';
    this.buttons = [];
    this.events = new Map();
    this.classList = { toggle() {}, add() {}, remove() {} };
  }
  set innerHTML(value) {
    this.html = value;
    this.buttons = [...value.matchAll(/<button\b([^>]*)>/g)].map(([, attributes]) => {
      const dataset = {};
      for (const [, key, data] of attributes.matchAll(/data-([a-z-]+)="([^"]*)"/g)) {
        dataset[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = data;
      }
      const button = new Element(dataset);
      button.disabled = /\bdisabled\b/.test(attributes);
      return button;
    });
  }
  get innerHTML() { return this.html || ''; }
  querySelectorAll(selector) { return selector === 'button' ? this.buttons : []; }
  closest(selector) {
    const key = selector.match(/^\[data-([a-z-]+)\]$/)?.[1]?.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    return key && key in this.dataset ? this : null;
  }
  addEventListener(name, handler) {
    if (!this.events.has(name)) this.events.set(name, new Set());
    this.events.get(name).add(handler);
  }
  removeEventListener(name, handler) { this.events.get(name)?.delete(handler); }
  dispatch(name) { this.events.get(name)?.forEach(handler => handler()); }
}

async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(t) {
  const originals = Object.fromEntries(['document', 'window', 'setTimeout', 'clearTimeout'].map(key => [key, globalThis[key]]));
  let now = 0;
  let serial = 0;
  const timers = new Map();
  globalThis.setTimeout = (fn, ms) => { const id = ++serial; timers.set(id, { fn, at: now + ms }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  const elements = new Map();
  const q = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const modes = [new Element({ earMode: 'notes' }), new Element({ earMode: 'intervals' })];
  const container = {
    querySelector: selector => q(selector.slice(1)),
    querySelectorAll: selector => selector === '[data-ear-mode]' ? modes : [],
  };
  const document = new Element();
  document.hidden = false;
  document.getElementById = q;
  const window = new Element();
  globalThis.document = document;
  globalThis.window = window;
  const notes = [], records = [];
  let stops = 0;
  const audio = {
    init: async () => {},
    playNote: async (...args) => { notes.push(args); return true; },
    stopAll: () => { stops += 1; },
  };
  const cleanup = renderEar(container, { audio, record: (...entry) => records.push(entry) });
  t.after(() => {
    cleanup();
    Object.entries(originals).forEach(([key, value]) => {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    });
  });
  return {
    audio, notes, records, q, modes, cleanup, document, window, timers,
    get stops() { return stops; },
    answers: () => q('ear-answers').buttons,
    answer(button) { q('ear-answers').onclick({ target: button }); },
    reference(button = q('ear-reference').buttons[0]) { return q('ear-reference').onclick({ target: button }); },
    async advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
        await flush();
      }
      now = end;
      await flush();
    },
  };
}

test('note answers unlock only after the full note and score only once', async t => {
  const f = fixture(t);
  const playback = f.q('ear-play').onclick();
  await flush();
  assert.equal(f.notes.length, 1);
  assert.ok(f.answers().every(button => button.disabled));
  f.answer(f.answers()[0]);
  assert.equal(f.records.length, 0);
  await f.advance(1149);
  assert.ok(f.answers().every(button => button.disabled));
  await f.advance(1);
  await playback;
  assert.ok(f.answers().every(button => !button.disabled));
  const name = NOTES[f.notes[0][0] % 12];
  const answer = f.answers().find(button => button.dataset.earAnswer === name);
  f.answer(answer);
  f.answer(answer);
  assert.equal(f.records.length, 1);
  assert.deepEqual(f.records[0], ['ear', true, `ฟังโน้ต ${name}4`]);
  assert.equal(f.timers.size, 0);
});

test('interval answers stay locked until the delayed upper note finishes', async t => {
  const f = fixture(t);
  f.modes[1].onclick();
  const playback = f.q('ear-play').onclick();
  await flush();
  assert.equal(f.notes.length, 2);
  assert.equal(f.notes[0][1], .7);
  assert.equal(f.notes[1][1], .9);
  assert.equal(f.notes[1][2], .8);
  await f.advance(1749);
  assert.ok(f.answers().every(button => button.disabled));
  assert.equal(f.records.length, 0);
  await f.advance(1);
  await playback;
  const interval = { 1: 'm2', 2: 'M2', 3: 'm3', 4: 'M3', 5: 'P4', 7: 'P5', 12: 'P8' }[f.notes[1][0] - f.notes[0][0]];
  f.answer(f.answers().find(button => button.dataset.earAnswer === interval));
  assert.equal(f.records.length, 1);
  assert.equal(f.records[0][1], true);
});

test('a reference interrupts an incomplete question and requires replay before answering', async t => {
  const f = fixture(t);
  f.modes[1].onclick();
  const playback = f.q('ear-play').onclick();
  await flush();
  await f.advance(400);
  await f.reference();
  await playback;
  assert.equal(f.timers.size, 0);
  assert.match(f.q('ear-feedback').textContent, /กดฟังโจทย์อีกครั้ง/);
  assert.ok(f.answers().every(button => button.disabled));
  await f.advance(3000);
  f.answer(f.answers()[0]);
  assert.equal(f.records.length, 0);
  assert.equal(f.notes.at(-1)[0], 60);
  const replay = f.q('ear-play').onclick();
  await flush();
  await f.advance(1750);
  await replay;
  assert.ok(f.answers().every(button => !button.disabled));
});

test('changing mode while the first note is pending cannot schedule a stale upper note', async t => {
  const f = fixture(t);
  f.modes[1].onclick();
  const first = deferred();
  f.audio.playNote = (...args) => { f.notes.push(args); return first.promise; };
  const playback = f.q('ear-play').onclick();
  await flush();
  assert.equal(f.notes.length, 1);
  f.modes[0].onclick();
  first.resolve(true);
  await playback;
  assert.equal(f.notes.length, 1);
  assert.equal(f.timers.size, 0);
  assert.ok(f.answers().every(button => button.disabled));
  assert.match(f.q('ear-instruction').textContent, /C4–B4/);
});

test('cleanup during audio startup cannot start a note or mutate the new page', async t => {
  const f = fixture(t);
  const opening = deferred();
  f.audio.init = () => opening.promise;
  const playback = f.q('ear-play').onclick();
  f.cleanup();
  const feedback = f.q('ear-feedback').textContent;
  opening.resolve();
  await playback;
  assert.equal(f.notes.length, 0);
  assert.equal(f.records.length, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.q('ear-feedback').textContent, feedback);
});

test('cleanup resolves and removes pending completion timers and event listeners', async t => {
  const f = fixture(t);
  const playback = f.q('ear-play').onclick();
  await flush();
  assert.equal(f.timers.size, 1);
  f.cleanup();
  await playback;
  await f.advance(5000);
  assert.equal(f.timers.size, 0);
  assert.ok(f.answers().every(button => button.disabled));
  assert.equal(f.records.length, 0);
  assert.equal(f.document.events.get('visibilitychange').size, 0);
  assert.equal(f.window.events.get('pagehide').size, 0);
});

test('hiding the page cancels listening rather than unlocking a silent question', async t => {
  const f = fixture(t);
  const playback = f.q('ear-play').onclick();
  await flush();
  f.document.hidden = true;
  f.document.dispatch('visibilitychange');
  await playback;
  await f.advance(2000);
  assert.ok(f.answers().every(button => button.disabled));
  assert.equal(f.q('ear-play').disabled, false);
  assert.match(f.q('ear-feedback').textContent, /กดฟังโจทย์อีกครั้ง/);
  assert.equal(f.records.length, 0);
  assert.equal(f.timers.size, 0);
});

test('failed audio startup keeps answers locked and allows a successful retry', async t => {
  const f = fixture(t);
  f.audio.init = async () => { throw new Error('device unavailable'); };
  await f.q('ear-play').onclick();
  assert.ok(f.answers().every(button => button.disabled));
  assert.equal(f.q('ear-play').disabled, false);
  assert.match(f.q('ear-feedback').textContent, /เปิดเสียงไม่สำเร็จ/);
  assert.equal(f.records.length, 0);
  f.audio.init = async () => {};
  const retry = f.q('ear-play').onclick();
  await flush();
  await f.advance(1150);
  await retry;
  assert.ok(f.answers().every(button => !button.disabled));
});
