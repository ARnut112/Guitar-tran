import test from 'node:test';
import assert from 'node:assert/strict';
import { CHORD_LIBRARY, renderChordDiagram } from '../chords.js';

const tuning = [40, 45, 50, 55, 59, 64];

test('all 84 chord names have valid voicings and no foreign chord tones', () => {
  assert.equal(CHORD_LIBRARY.length, 84);
  assert.equal(new Set(CHORD_LIBRARY.map(chord => chord.name)).size, 84);
  for (const chord of CHORD_LIBRARY) {
    const expected = chord.family.intervals.map(interval => (chord.root.pc + interval) % 12).sort((a, b) => a - b);
    assert.deepEqual(chord.notes.map(note => note.pc).sort((a, b) => a - b), expected, `${chord.name}: spelling`);
    assert.ok(chord.shapes.length >= 2, `${chord.name}: alternative shapes`);
    for (const shape of chord.shapes) {
      assert.equal(shape.frets.length, 6);
      assert.equal(shape.fingers.length, 6);
      const actual = [...new Set(shape.frets.flatMap((fret, string) => fret >= 0 ? [(tuning[string] + fret) % 12] : []))].sort((a, b) => a - b);
      const optionalFifth = chord.family.intervals.length === 4 ? (chord.root.pc + 7) % 12 : null;
      assert.ok(actual.every(pc => expected.includes(pc)), `${chord.name} ${shape.id}: no foreign tones`);
      assert.ok(expected.filter(pc => pc !== optionalFifth).every(pc => actual.includes(pc)), `${chord.name} ${shape.id}: all defining tones present`);
      shape.frets.forEach((fret, string) => {
        assert.ok(Number.isInteger(fret) && fret >= -1 && fret <= 16);
        if (fret > 0) assert.ok(shape.fingers[string] >= 1 && shape.fingers[string] <= 4, `${chord.name}: finger on string ${6 - string}`);
      });
      for (const barre of shape.barres) {
        assert.ok(barre.from >= 0 && barre.to <= 5 && barre.from < barre.to);
        for (let string = barre.from; string <= barre.to; string++) assert.ok(shape.frets[string] >= barre.fret, `${chord.name}: barre cannot cross an open or muted string`);
      }
      const positives = shape.frets.filter(fret => fret > 0);
      assert.ok(Math.max(...positives) - Math.min(...positives) <= 4, `${chord.name}: fits diagram`);
    }
  }
});

test('music spelling keeps diatonic chord names across sharp and flat roots', () => {
  const names = name => CHORD_LIBRARY.find(chord => chord.name === name).notes.map(note => note.name);
  assert.deepEqual(names('C♯'), ['C♯', 'E♯', 'G♯']);
  assert.deepEqual(names('A♭m'), ['A♭', 'C♭', 'E♭']);
  assert.deepEqual(names('F♯maj7'), ['F♯', 'A♯', 'C♯', 'E♯']);
  assert.deepEqual(names('B♭7'), ['B♭', 'D', 'F', 'A♭']);
  assert.deepEqual(names('Dsus4'), ['D', 'G', 'A']);
});

test('SVG diagrams preserve low E on the left and communicate frets and fingering', () => {
  const c = CHORD_LIBRARY.find(chord => chord.name === 'C');
  const open = c.shapes.find(shape => shape.kind === 'open');
  const svg = renderChordDiagram(c, open);
  assert.match(svg, /<title>C: -?X 3 2 0 1 0<\/title>/);
  const labels = [...svg.matchAll(/<text x="(\d+)" y="272"[^>]*>(.*?)<\/text>/g)];
  assert.deepEqual(labels.map(match => match[2]), ['E', 'A', 'D', 'G', 'B', 'e']);
  assert.deepEqual(labels.map(match => Number(match[1])), [42, 80, 118, 156, 194, 232]);
  const high = renderChordDiagram(c, c.shapes.find(shape => shape.id === 'barre-E'));
  assert.match(high, /x="20" y="83"[^>]*>8<\/text>/);
});
