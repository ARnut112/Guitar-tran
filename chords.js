const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
const ROOTS = [
  { name: 'C', pc: 0 }, { name: 'C♯', pc: 1 }, { name: 'D', pc: 2 },
  { name: 'E♭', pc: 3 }, { name: 'E', pc: 4 }, { name: 'F', pc: 5 },
  { name: 'F♯', pc: 6 }, { name: 'G', pc: 7 }, { name: 'A♭', pc: 8 },
  { name: 'A', pc: 9 }, { name: 'B♭', pc: 10 }, { name: 'B', pc: 11 }
];
const FAMILIES = [
  { id: 'major', suffix: '', name: 'เมเจอร์', feeling: 'สว่าง มั่นคง', intervals: [0, 4, 7], degrees: [0, 2, 4], formula: '1 · 3 · 5' },
  { id: 'minor', suffix: 'm', name: 'ไมเนอร์', feeling: 'นุ่ม ลึก เศร้า', intervals: [0, 3, 7], degrees: [0, 2, 4], formula: '1 · ♭3 · 5' },
  { id: '7', suffix: '7', name: 'โดมิแนนต์ 7', feeling: 'ชวนให้คลี่คลายไปคอร์ดถัดไป', intervals: [0, 4, 7, 10], degrees: [0, 2, 4, 6], formula: '1 · 3 · 5 · ♭7' },
  { id: 'maj7', suffix: 'maj7', name: 'เมเจอร์ 7', feeling: 'ละมุน โปร่ง มีสีสัน', intervals: [0, 4, 7, 11], degrees: [0, 2, 4, 6], formula: '1 · 3 · 5 · 7' },
  { id: 'm7', suffix: 'm7', name: 'ไมเนอร์ 7', feeling: 'อบอุ่น นุ่มนวล', intervals: [0, 3, 7, 10], degrees: [0, 2, 4, 6], formula: '1 · ♭3 · 5 · ♭7' },
  { id: 'sus2', suffix: 'sus2', name: 'ซัส 2', feeling: 'โปร่ง ใช้โน้ต 2 แทนโน้ต 3', intervals: [0, 2, 7], degrees: [0, 1, 4], formula: '1 · 2 · 5' },
  { id: 'sus4', suffix: 'sus4', name: 'ซัส 4', feeling: 'ค้างรอ ใช้โน้ต 4 แทนโน้ต 3', intervals: [0, 5, 7], degrees: [0, 3, 4], formula: '1 · 4 · 5' }
];
const NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SHARPS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

function spelling(root, family) {
  const firstLetter = LETTERS.indexOf(root.name[0]);
  return family.intervals.map((interval, index) => {
    const letter = LETTERS[(firstLetter + family.degrees[index]) % 7];
    const pc = (root.pc + interval) % 12;
    const difference = ((pc - NATURAL_PC[letter] + 18) % 12) - 6;
    return { pc, name: letter + (difference > 0 ? '♯'.repeat(difference) : '♭'.repeat(-difference)) };
  });
}

const OPEN_SHAPES = {
  C: { major: [[-1, 3, 2, 0, 1, 0], [null, 3, 2, 0, 1, 0]], '7': [[-1, 3, 2, 3, 1, 0], [null, 3, 2, 4, 1, 0]], maj7: [[-1, 3, 2, 0, 0, 0], [null, 3, 2, 0, 0, 0]], sus2: [[-1, 3, 0, 0, 3, 3], [null, 1, 0, 0, 3, 4]], sus4: [[-1, 3, 3, 0, 1, 1], [null, 3, 4, 0, 1, 1], [{ fret: 1, from: 4, to: 5, finger: 1 }]] },
  D: { major: [[-1, -1, 0, 2, 3, 2], [null, null, 0, 1, 3, 2]], minor: [[-1, -1, 0, 2, 3, 1], [null, null, 0, 2, 3, 1]], '7': [[-1, -1, 0, 2, 1, 2], [null, null, 0, 2, 1, 3]], maj7: [[-1, -1, 0, 2, 2, 2], [null, null, 0, 1, 1, 1], [{ fret: 2, from: 3, to: 5, finger: 1 }]], m7: [[-1, -1, 0, 2, 1, 1], [null, null, 0, 2, 1, 1], [{ fret: 1, from: 4, to: 5, finger: 1 }]], sus2: [[-1, -1, 0, 2, 3, 0], [null, null, 0, 1, 3, 0]], sus4: [[-1, -1, 0, 2, 3, 3], [null, null, 0, 1, 3, 4]] },
  E: { major: [[0, 2, 2, 1, 0, 0], [0, 2, 3, 1, 0, 0]], minor: [[0, 2, 2, 0, 0, 0], [0, 2, 3, 0, 0, 0]], '7': [[0, 2, 0, 1, 0, 0], [0, 2, 0, 1, 0, 0]], maj7: [[0, 2, 1, 1, 0, 0], [0, 3, 1, 2, 0, 0]], m7: [[0, 2, 0, 0, 0, 0], [0, 2, 0, 0, 0, 0]], sus2: [[0, 2, 4, 4, 0, 0], [0, 1, 3, 4, 0, 0]], sus4: [[0, 2, 2, 2, 0, 0], [0, 1, 2, 3, 0, 0]] },
  F: { maj7: [[-1, -1, 3, 2, 1, 0], [null, null, 3, 2, 1, 0]] },
  G: { major: [[3, 2, 0, 0, 0, 3], [2, 1, 0, 0, 0, 3]], '7': [[3, 2, 0, 0, 0, 1], [3, 2, 0, 0, 0, 1]], maj7: [[3, 2, 0, 0, 0, 2], [3, 1, 0, 0, 0, 2]], sus2: [[3, 0, 0, 0, 3, 3], [1, 0, 0, 0, 3, 4]], sus4: [[3, 3, 0, 0, 1, 3], [2, 3, 0, 0, 1, 4]] },
  A: { major: [[-1, 0, 2, 2, 2, 0], [null, 0, 1, 2, 3, 0]], minor: [[-1, 0, 2, 2, 1, 0], [null, 0, 2, 3, 1, 0]], '7': [[-1, 0, 2, 0, 2, 0], [null, 0, 1, 0, 2, 0]], maj7: [[-1, 0, 2, 1, 2, 0], [null, 0, 2, 1, 3, 0]], m7: [[-1, 0, 2, 0, 1, 0], [null, 0, 2, 0, 1, 0]], sus2: [[-1, 0, 2, 2, 0, 0], [null, 0, 1, 2, 0, 0]], sus4: [[-1, 0, 2, 2, 3, 0], [null, 0, 1, 2, 3, 0]] },
  B: { '7': [[-1, 2, 1, 2, 0, 2], [null, 2, 1, 3, 0, 4]], m7: [[-1, 2, 0, 2, 0, 2], [null, 1, 0, 2, 0, 3]] }
};

const E_SHAPES = {
  major: [[0, 2, 2, 1, 0, 0], [1, 3, 4, 2, 1, 1]],
  minor: [[0, 2, 2, 0, 0, 0], [1, 3, 4, 1, 1, 1]],
  '7': [[0, 2, 0, 1, 0, 0], [1, 3, 1, 2, 1, 1]],
  maj7: [[0, 2, 1, 1, 0, 0], [1, 4, 2, 3, 1, 1]],
  m7: [[0, 2, 0, 0, 0, 0], [1, 3, 1, 1, 1, 1]],
  sus2: [[0, 2, 4, 4, 0, 0], [1, 2, 3, 4, 1, 1]],
  sus4: [[0, 2, 2, 2, 0, 0], [1, 2, 3, 4, 1, 1]]
};
const A_SHAPES = {
  major: [[-1, 0, 2, 2, 2, 0], [null, 1, 3, 3, 3, 1]],
  minor: [[-1, 0, 2, 2, 1, 0], [null, 1, 3, 4, 2, 1]],
  '7': [[-1, 0, 2, 0, 2, 0], [null, 1, 3, 1, 4, 1]],
  maj7: [[-1, 0, 2, 1, 2, 0], [null, 1, 3, 2, 4, 1]],
  m7: [[-1, 0, 2, 0, 1, 0], [null, 1, 3, 1, 2, 1]],
  sus2: [[-1, 0, 2, 2, 0, 0], [null, 1, 3, 4, 1, 1]],
  sus4: [[-1, 0, 2, 2, 3, 0], [null, 1, 2, 3, 4, 1]]
};

function createLibrary() {
  return ROOTS.flatMap(root => FAMILIES.map(family => {
    const chord = { id: `${root.pc}-${family.id}`, root, family, name: root.name + family.suffix, notes: spelling(root, family), shapes: [] };
    const open = OPEN_SHAPES[root.name]?.[family.id];
    if (open) chord.shapes.push({ id: 'open', label: 'ตำแหน่งเปิด', kind: 'open', frets: open[0], fingers: open[1], barres: open[2] || [], description: 'ใช้สายเปิดช่วยให้เสียงกังวาน วางนิ้วชิดด้านหลังเฟรต แล้วดีดเฉพาะสายที่ไม่มีกากบาท' + (root.name === 'C' && family.id === '7' ? ' รูป C7 นี้ละโน้ต G (ตัว 5) โดยยังคงโน้ตหลักและสีสันของคอร์ดครบ' : '') });
    for (const [form, basePc, patterns, from] of [['E', 4, E_SHAPES, 0], ['A', 9, A_SHAPES, 1]]) {
      const offset = ((root.pc - basePc + 12) % 12) || 12;
      const [frets, fingers] = patterns[family.id];
      const barres = [{ fret: offset, from, to: 5, finger: 1 }];
      if (form === 'A' && family.id === 'major') barres.push({ fret: offset + 2, from: 2, to: 4, finger: 3 });
      chord.shapes.push({ id: `barre-${form}`, label: `ทาบรูป ${form} · เฟรต ${offset}`, kind: 'barre', frets: frets.map(fret => fret < 0 ? -1 : fret + offset), fingers, barres, description: `ย้ายรูป ${form} มาที่เฟรต ${offset} ใช้นิ้วชี้ทาบ${form === 'E' ? 'สาย 6–1' : 'สาย 5–1 และเว้นสาย 6'}${form === 'A' && family.id === 'major' ? ' ใช้นิ้วนางทาบสาย 4–2 โดยระวังไม่ให้โดนสาย 1' : ''}${family.id === 'sus2' && form === 'E' ? ' รูปนี้กางนิ้วมาก ค่อย ๆ ฝึกโดยไม่ฝืนมือ หรือเลือกรูป A ที่จับสบายกว่า' : ' ออกแรงพอดีและผ่อนมือเมื่อเริ่มเกร็ง'}` });
    }
    if (root.name === 'F' && family.id === 'major') chord.shapes.unshift({ id: 'small-f', label: 'F แบบย่อ · 4 สาย', kind: 'barre', frets: [-1, -1, 3, 2, 1, 1], fingers: [null, null, 3, 2, 1, 1], barres: [{ fret: 1, from: 4, to: 5, finger: 1 }], description: 'เริ่มจากทาบสั้นด้วยนิ้วชี้ที่สาย 2–1 เฟรต 1 แล้วเติมนิ้วกลางและนิ้วนาง ดีดเฉพาะสาย 4–1' });
    return chord;
  }));
}
const LIBRARY = createLibrary();
const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const normalize = value => String(value).toLowerCase().replaceAll('♯', '#').replaceAll('♭', 'b').replace(/\s/g, '');
function midiFor(shape) { return shape.frets.flatMap((fret, index) => fret >= 0 ? [OPEN_MIDI[index] + fret] : []); }
function noteName(midi, chord, octave = false) {
  const pc = midi % 12;
  const name = chord.notes.find(note => note.pc === pc)?.name || (chord.root.name.includes('♭') ? FLATS : SHARPS)[pc];
  if (!octave) return name;
  const accidental = [...name.slice(1)].reduce((sum, value) => sum + (value === '♯' ? 1 : -1), 0);
  return name + ((midi - NATURAL_PC[name[0]] - accidental) / 12 - 1);
}

function diagram(chord, shape) {
  const pressed = shape.frets.filter(fret => fret > 0);
  const minimum = Math.min(...pressed);
  const maximum = Math.max(...pressed);
  const start = minimum <= 3 && maximum <= 5 ? 1 : minimum;
  const x = string => 42 + string * 38;
  const y = fret => 58 + (fret - start + 0.5) * 38;
  let output = `<svg class="chord-diagram" viewBox="0 0 275 292" role="img" aria-label="${escapeHTML(chord.name)} ${escapeHTML(shape.label)} เรียงสาย 6 ทางซ้ายไปสาย 1 ทางขวา"><title>${escapeHTML(chord.name)}: ${shape.frets.map(fret => fret < 0 ? 'X' : fret).join(' ')}</title>`;
  for (let fret = 0; fret <= 5; fret++) output += `<line x1="42" x2="232" y1="${58 + fret * 38}" y2="${58 + fret * 38}" stroke="${fret === 0 && start === 1 ? '#e7eadf' : '#546054'}" stroke-width="${fret === 0 && start === 1 ? 5 : 1.4}"/>`;
  for (let string = 0; string < 6; string++) {
    output += `<line x1="${x(string)}" x2="${x(string)}" y1="58" y2="248" stroke="#7a8478" stroke-width="${2.3 - string * .23}"/>`;
    if (shape.frets[string] <= 0) output += `<text x="${x(string)}" y="38" text-anchor="middle" fill="${shape.frets[string] < 0 ? '#899286' : '#b5d4a0'}" font-size="20" font-family="system-ui">${shape.frets[string] < 0 ? '×' : '○'}</text>`;
    output += `<text x="${x(string)}" y="272" text-anchor="middle" fill="#a4aaa3" font-size="13" font-family="system-ui">${STRING_NAMES[string]}</text>`;
  }
  if (start > 1) output += `<text x="20" y="83" text-anchor="middle" fill="#d6dfcc" font-size="14" font-family="system-ui">${start}</text>`;
  shape.barres.forEach(barre => { output += `<line x1="${x(barre.from)}" x2="${x(barre.to)}" y1="${y(barre.fret)}" y2="${y(barre.fret)}" stroke="#b5d4a0" stroke-width="25" stroke-linecap="round"/>`; });
  shape.frets.forEach((fret, string) => {
    if (fret > 0) output += `<circle cx="${x(string)}" cy="${y(fret)}" r="13" fill="#b5d4a0"/><text x="${x(string)}" y="${y(fret) + 4.5}" text-anchor="middle" fill="#182116" font-size="12" font-weight="750" font-family="system-ui">${shape.fingers[string] || ''}</text>`;
  });
  return output + '</svg>';
}

/** Mount the chord library and practice tools. Call the returned function on navigation. */
export function renderChords(container, { audio, record = () => {} } = {}) {
  let selected = LIBRARY[0];
  let selectedShape = selected.shapes[0];
  let progression = preset('pop-c');
  let tempo = 72;
  let playing = false;
  let activeChord = -1;
  let activeBeat = -1;
  let beatTimer = null;
  let gripTimer = null;
  let gripStarted = 0;
  let disposed = false;
  let playGeneration = 0;
  const uid = `chord-${Math.random().toString(36).slice(2, 8)}`;
  const filters = { search: '', family: '', root: '', kind: '' };

  container.innerHTML = `<div class="chord-page">
    <section class="chord-intro"><div><p class="eyebrow">CHORD LIBRARY</p><h1>ทุกคอร์ด มีทางจับที่เข้ามือ</h1><p class="muted">ฟังให้คุ้น จับให้ชัด แล้วเชื่อมคอร์ดให้เป็นเพลง เริ่มจากรูปเปิดและค่อยขยับไปคอร์ดทาบ</p></div><span class="chord-count-tag">84 คอร์ด · หลายตำแหน่ง</span></section>
    <div class="chord-workspace">
      <section class="panel chord-catalog" aria-label="ค้นหาคอร์ด">
        <label class="chord-search-label" for="${uid}-search">ค้นหาคอร์ด</label><div class="chord-search-wrap"><span aria-hidden="true">⌕</span><input id="${uid}-search" class="chord-search" type="search" placeholder="ลอง C, Am, F# หรือ maj7" autocomplete="off" data-filter="search"/></div>
        <div class="chord-filters">
          <label>โน้ตหลัก<select class="select" data-filter="root"><option value="">ทุกโน้ต</option>${ROOTS.map(root => `<option value="${root.pc}">${root.name}</option>`).join('')}</select></label>
          <label>ชนิดคอร์ด<select class="select" data-filter="family"><option value="">ทุกชนิด</option>${FAMILIES.map(family => `<option value="${family.id}">${family.suffix || 'Major'} · ${family.name}</option>`).join('')}</select></label>
          <label class="chord-position-filter">รูปแบบ<select class="select" data-filter="kind"><option value="">ทุกตำแหน่ง</option><option value="open">ใช้สายเปิด</option><option value="barre">คอร์ดทาบ</option></select></label>
        </div>
        <div class="chord-results-heading"><span data-result-count></span><button type="button" class="chord-text-button" data-action="reset">ล้างตัวกรอง</button></div>
        <div class="chord-results" data-results aria-label="รายชื่อคอร์ด"></div>
      </section>
      <section class="panel chord-detail" data-detail aria-label="รายละเอียดคอร์ด"></section>
    </div>
    <section class="panel chord-progression" aria-labelledby="${uid}-progression-title">
      <div class="chord-progression-heading"><div><p class="eyebrow">MAKE IT FLOW</p><h3 id="${uid}-progression-title">ต่อคอร์ดให้เป็นเพลง</h3><p class="muted">คอร์ดละ 4 จังหวะ ลองวางนิ้วเตรียมคอร์ดถัดไปก่อนถึงจังหวะหนึ่ง</p></div><div class="chord-presets"><button type="button" class="btn btn-secondary" data-preset="pop-c">C · Am · F · G</button><button type="button" class="btn btn-secondary" data-preset="pop-g">G · D · Em · C</button></div></div>
      <div class="chord-sequence" data-sequence aria-label="ลำดับคอร์ดสำหรับฝึก"></div>
      <div class="chord-progression-controls"><button type="button" class="btn btn-primary" data-action="play-progression">▶ เริ่มฝึกวงคอร์ด</button><label class="chord-tempo" for="${uid}-tempo"><span>ความเร็ว <strong data-tempo-label>72</strong> BPM</span><input id="${uid}-tempo" type="range" min="40" max="160" step="1" value="72" data-tempo/></label><label class="chord-loop"><input type="checkbox" data-loop/> เล่นวน</label><div class="chord-beats" aria-label="จังหวะ" data-beats>${[1, 2, 3, 4].map(beat => `<span>${beat}</span>`).join('')}</div></div>
      <p class="chord-status" role="status" aria-live="polite" data-progression-status>เลือกวงคอร์ดตัวอย่าง หรือเพิ่มคอร์ดที่กำลังดูเข้ามาเองได้</p>
    </section>
    <section class="chord-tip"><span class="chord-tip-icon" aria-hidden="true">✦</span><div><strong>เคล็ดลับสำหรับฟิงเกอร์สไตล์</strong><p>ให้หัวแม่มือเล่นโน้ตเบส แล้วใช้นิ้วชี้–กลาง–นางแยกสายเสียงสูง คอร์ดที่เสียงใสทุกสายช่วยให้เมโลดี้กับเบสฟังแยกกันชัดขึ้น</p></div></section>
  </div>`;
  const find = selector => container.querySelector(selector);

  function preset(id) {
    const names = id === 'pop-g' ? ['G', 'D', 'Em', 'C'] : ['C', 'Am', 'F', 'G'];
    return names.map(name => {
      const chord = LIBRARY.find(item => item.name === name);
      return { chord, shape: name === 'F' ? chord.shapes.find(shape => shape.id === 'barre-E') : chord.shapes[0] };
    });
  }
  function announce(message, target = '[data-detail-status]') { if (!disposed && find(target)) find(target).textContent = message; }
  function save(label) { try { record('chords', true, label); } catch { /* Progress storage must not interrupt practice. */ } }
  function availableShapes(chord) { return chord.shapes.filter(shape => !filters.kind || shape.kind === filters.kind); }
  function renderResults() {
    const query = normalize(filters.search);
    const aliases = { 'c#': 'db', 'eb': 'd#', 'f#': 'gb', 'ab': 'g#', 'bb': 'a#' };
    const result = LIBRARY.filter(chord => {
      const name = normalize(chord.name);
      const root = normalize(chord.root.name);
      const alternative = aliases[root] ? aliases[root] + chord.family.suffix : '';
      return (!filters.family || chord.family.id === filters.family) && (filters.root === '' || chord.root.pc === Number(filters.root)) && availableShapes(chord).length && (!query || name.includes(query) || alternative.includes(query) || normalize(chord.family.name).includes(query));
    });
    if (result.length && !result.includes(selected)) {
      selected = result[0];
      selectedShape = availableShapes(selected)[0];
      stopGrip();
      renderDetail();
    } else if (!availableShapes(selected).includes(selectedShape) && availableShapes(selected).length) {
      selectedShape = availableShapes(selected)[0];
      stopGrip();
      renderDetail();
    }
    find('[data-result-count]').textContent = `${result.length} คอร์ด`;
    find('[data-results]').innerHTML = result.length ? result.map(chord => `<button type="button" class="chord-result${chord.id === selected.id ? ' is-selected' : ''}" data-chord="${chord.id}" aria-pressed="${chord.id === selected.id}"><strong>${chord.name}</strong><span>${chord.family.name}</span></button>`).join('') : '<div class="chord-no-results"><strong>ยังไม่เจอคอร์ดนี้</strong><p>ลองชื่อสั้น ๆ เช่น Am หรือเปลี่ยนตัวกรอง</p><button type="button" class="btn btn-secondary" data-action="reset">แสดงทุกคอร์ด</button></div>';
  }
  function renderDetail() {
    const shapes = availableShapes(selected).length ? availableShapes(selected) : selected.shapes;
    const notes = selected.notes.map(note => `<span>${note.name}</span>`).join('');
    find('[data-detail]').innerHTML = `<div class="chord-detail-heading"><div><p class="eyebrow">${selected.family.name}</p><h3>${selected.name}</h3><p class="muted">${selected.family.feeling}</p></div><span class="chord-shape-count">${selected.shapes.length} รูปจับ</span></div>
      <div class="chord-shape-tabs" role="group" aria-label="เลือกรูปจับคอร์ด">${shapes.map(shape => `<button type="button" class="chord-shape-tab${shape.id === selectedShape.id ? ' is-selected' : ''}" data-shape="${shape.id}" aria-pressed="${shape.id === selectedShape.id}">${shape.label}</button>`).join('')}</div>
      <div class="chord-detail-body"><div class="chord-diagram-wrap">${diagram(selected, selectedShape)}<p class="chord-diagram-key">× ไม่ดีด &nbsp; ○ สายเปิด &nbsp; 1–4 นิ้วชี้ถึงนิ้วก้อย</p></div><div class="chord-voicing-info"><p class="chord-info-label">โน้ตในคอร์ด</p><div class="chord-note-chips">${notes}</div><p class="chord-formula">${selected.family.formula}</p><p class="chord-shape-description">${selectedShape.description}</p><div class="chord-sound-actions"><button type="button" class="btn btn-primary" data-action="strum">♫ ฟังเสียงคอร์ด</button><button type="button" class="btn btn-secondary" data-action="arpeggio">แยกเสียงทีละสาย</button></div><button type="button" class="chord-add-button" data-action="add">+ เพิ่ม ${selected.name} ในวงคอร์ด</button></div></div>
      <div class="chord-string-samples" role="group" aria-label="ฟังเสียงแต่ละสาย">${selectedShape.frets.map((fret, index) => `<button type="button" data-string="${index}" class="chord-string-button" ${fret < 0 ? 'disabled' : ''} aria-label="${fret < 0 ? `สาย ${6 - index} ไม่ดีด` : `ฟังสาย ${6 - index} โน้ต ${noteName(OPEN_MIDI[index] + fret, selected, true)}`} "><span>สาย ${6 - index}</span><strong>${fret < 0 ? '×' : noteName(OPEN_MIDI[index] + fret, selected, true)}</strong><small>${fret < 0 ? 'ไม่ดีด' : fret === 0 ? 'สายเปิด' : `เฟรต ${fret}`}</small></button>`).join('')}</div>
      <div class="chord-grip-practice"><div><strong>ให้มือค่อย ๆ จำรูปคอร์ด</strong><span>จับ → ดีดทีละสาย → ผ่อนมือ แล้วทำซ้ำ 30 วินาที</span></div><button type="button" class="btn btn-secondary" data-action="practice">เริ่มฝึก 30 วินาที</button></div><p class="chord-status" role="status" aria-live="polite" data-detail-status>แตะชื่อโน้ตด้านล่างแผนภาพเพื่อฟังแต่ละสาย</p>`;
  }
  function renderSequence() {
    find('[data-sequence]').innerHTML = progression.length ? progression.map((entry, index) => `<div class="chord-sequence-item${playing && activeChord === index ? ' is-playing' : ''}"><span class="chord-sequence-index">${String(index + 1).padStart(2, '0')}</span><button class="chord-sequence-chord" type="button" data-view-step="${index}" aria-label="ดูรูปจับ ${entry.chord.name}"><strong>${entry.chord.name}</strong><span>${entry.shape.label}</span></button><button class="chord-remove" type="button" data-remove="${index}" aria-label="นำ ${entry.chord.name} ลำดับ ${index + 1} ออกจากวงคอร์ด">×</button></div>`).join('') : '<div class="chord-sequence-empty">วงคอร์ดยังว่าง เลือกคอร์ดที่ชอบแล้วกด “เพิ่มในวงคอร์ด”</div>';
  }
  async function sound(shape, strum = .065) {
    try {
      await audio?.init?.();
      if (disposed) return;
      if (!audio?.playChord) return announce('เครื่องเสียงยังไม่พร้อม ลองเปิดหน้านี้อีกครั้ง');
      await audio.playChord(midiFor(shape), { strum, duration: strum > .1 ? 1.1 : 1.7 });
    } catch { announce('ยังเริ่มเสียงไม่ได้ ลองแตะปุ่มเสียงอีกครั้ง'); }
  }
  function stopGrip(message) {
    clearInterval(gripTimer);
    gripTimer = null;
    gripStarted = 0;
    const button = find('[data-action="practice"]');
    if (button) button.textContent = 'เริ่มฝึก 30 วินาที';
    if (message) announce(message);
  }
  function startGrip() {
    if (gripTimer) return stopGrip('พักมือได้เลย พร้อมแล้วค่อยเริ่มใหม่');
    const label = `${selected.name} · ${selectedShape.label}`;
    gripStarted = Date.now();
    const update = () => {
      const remaining = Math.max(0, Math.ceil((30000 - (Date.now() - gripStarted)) / 1000));
      const button = find('[data-action="practice"]');
      if (button) button.textContent = `หยุดฝึก · ${remaining} วินาที`;
      if (!remaining) { stopGrip(); save(`ฝึกจับ ${label}`); announce(`ครบ 30 วินาทีแล้ว บันทึกการฝึก ${label} ให้แล้ว`); }
    };
    announce('ค่อย ๆ วางนิ้ว ดีดทีละสาย แล้วผ่อนมือ ไม่ต้องรีบ');
    update();
    gripTimer = setInterval(update, 250);
  }
  function refreshPlayback() {
    const button = find('[data-action="play-progression"]');
    if (button) button.textContent = playing ? '■ หยุดฝึก' : '▶ เริ่มฝึกวงคอร์ด';
    container.querySelectorAll('[data-beats] span').forEach((element, index) => element.classList.toggle('is-active', playing && index === activeBeat));
    container.querySelectorAll('.chord-sequence-item').forEach((element, index) => element.classList.toggle('is-playing', playing && index === activeChord));
  }
  function stopProgression(message = '') {
    ++playGeneration;
    clearTimeout(beatTimer);
    beatTimer = null;
    playing = false;
    activeChord = -1;
    activeBeat = -1;
    audio?.stopAll?.();
    refreshPlayback();
    if (message) announce(message, '[data-progression-status]');
  }
  async function startProgression() {
    if (playing) return stopProgression('หยุดวงคอร์ดแล้ว พักมือแล้วกลับมาฝึกต่อได้');
    if (!progression.length) return announce('เพิ่มคอร์ดอย่างน้อย 1 คอร์ดก่อนเริ่มฝึก', '[data-progression-status]');
    const generation = ++playGeneration;
    try { await audio?.init?.(); } catch { return announce('ยังเริ่มเสียงไม่ได้ ลองแตะเริ่มฝึกอีกครั้ง', '[data-progression-status]'); }
    if (disposed || generation !== playGeneration) return;
    playing = true;
    let tick = 0;
    const next = () => {
      if (!playing || disposed || generation !== playGeneration) return;
      if (tick === progression.length * 4) {
        save(`ฝึกวงคอร์ด ${progression.map(entry => entry.chord.name).join(' → ')}`);
        if (!find('[data-loop]').checked) return stopProgression('เล่นครบหนึ่งรอบแล้ว บันทึกการฝึกให้แล้ว ลองอีกรอบให้ลื่นขึ้นได้เลย');
        tick = 0;
        announce('ครบอีกรอบแล้ว เล่นต่ออย่างผ่อนคลาย', '[data-progression-status]');
      }
      activeChord = Math.floor(tick / 4);
      activeBeat = tick % 4;
      if (activeBeat === 0) {
        const entry = progression[activeChord];
        try { Promise.resolve(audio?.playChord?.(midiFor(entry.shape), { strum: .045, duration: Math.min(2.8, 240 / tempo * .88) })).catch(() => {}); } catch { /* Keep the visual practice clock available if audio fails. */ }
        announce(`${entry.chord.name} · คอร์ด ${activeChord + 1} จาก ${progression.length}`, '[data-progression-status]');
      }
      refreshPlayback();
      tick++;
      beatTimer = setTimeout(next, 60000 / tempo);
    };
    next();
  }
  function selectChord(chord, shape) {
    stopGrip();
    selected = chord;
    selectedShape = shape || availableShapes(chord)[0] || chord.shapes[0];
    renderResults();
    renderDetail();
  }
  function resetFilters() {
    Object.keys(filters).forEach(key => { filters[key] = ''; });
    container.querySelectorAll('[data-filter]').forEach(element => { element.value = ''; });
    renderResults();
  }
  function handleInput(event) {
    const filter = event.target.dataset.filter;
    if (filter) { filters[filter] = event.target.value; renderResults(); }
    if (event.target.matches('[data-tempo]')) { tempo = Number(event.target.value); find('[data-tempo-label]').textContent = tempo; }
  }
  function handleClick(event) {
    const button = event.target.closest('button');
    if (!button || !container.contains(button)) return;
    if (button.dataset.chord) { const chord = LIBRARY.find(item => item.id === button.dataset.chord); if (chord) selectChord(chord); return; }
    if (button.dataset.shape) { stopGrip(); selectedShape = selected.shapes.find(shape => shape.id === button.dataset.shape); renderDetail(); return; }
    if (button.dataset.string !== undefined) {
      const index = Number(button.dataset.string);
      const fret = selectedShape.frets[index];
      if (fret >= 0) { const midi = OPEN_MIDI[index] + fret; Promise.resolve(audio?.playNote?.(midi, 1.4)).catch(() => announce('ลองแตะปุ่มเสียงอีกครั้ง')); announce(`สาย ${6 - index} · ${noteName(midi, selected, true)}`); }
      return;
    }
    if (button.dataset.preset) { stopProgression(); progression = preset(button.dataset.preset); renderSequence(); announce('เลือกวงคอร์ดแล้ว กดเริ่มฝึกเมื่อพร้อม', '[data-progression-status]'); return; }
    if (button.dataset.remove !== undefined) { stopProgression(); progression.splice(Number(button.dataset.remove), 1); renderSequence(); announce('นำคอร์ดออกแล้ว', '[data-progression-status]'); return; }
    if (button.dataset.viewStep !== undefined) { const entry = progression[Number(button.dataset.viewStep)]; resetFilters(); selectChord(entry.chord, entry.shape); return; }
    switch (button.dataset.action) {
      case 'reset': resetFilters(); break;
      case 'strum': sound(selectedShape); announce(`ฟัง ${selected.name} จากสายต่ำไปสายสูง`); break;
      case 'arpeggio': sound(selectedShape, .23); announce(`แยกเสียง ${selected.name} ทีละสาย ลองฟังว่าเสียงใดซ้ำกัน`); break;
      case 'practice': startGrip(); break;
      case 'add':
        if (progression.length >= 12) return announce('วงคอร์ดใส่ได้สูงสุด 12 คอร์ด นำคอร์ดเดิมออกก่อนเพิ่มได้เลย');
        stopProgression(); progression.push({ chord: selected, shape: selectedShape }); renderSequence(); announce(`เพิ่ม ${selected.name} ในวงคอร์ดแล้ว`); announce(`มี ${progression.length} คอร์ด พร้อมเริ่มฝึก`, '[data-progression-status]'); break;
      case 'play-progression': startProgression(); break;
    }
  }
  container.addEventListener('click', handleClick);
  container.addEventListener('input', handleInput);
  renderResults();
  renderDetail();
  renderSequence();
  return () => { disposed = true; ++playGeneration; clearTimeout(beatTimer); clearInterval(gripTimer); audio?.stopAll?.(); container.removeEventListener('click', handleClick); container.removeEventListener('input', handleInput); };
}

export { LIBRARY as CHORD_LIBRARY, diagram as renderChordDiagram };
