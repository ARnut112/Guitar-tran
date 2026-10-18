const OPEN_STRINGS = [64, 59, 55, 50, 45, 40];
const STRINGS = ['e', 'B', 'G', 'D', 'A', 'E'];
const CHORDS = {
  C: { frets: [-1, 3, 2, 0, 1, 0], bass: 5, alt: 4 },
  Am: { frets: [-1, 0, 2, 2, 1, 0], bass: 5, alt: 4 },
  F: { frets: [1, 3, 3, 2, 1, 1], bass: 6, alt: 4 },
  G: { frets: [3, 2, 0, 0, 0, 3], bass: 6, alt: 4 },
  D: { frets: [-1, -1, 0, 2, 3, 2], bass: 4, alt: 3 },
  Em: { frets: [0, 2, 2, 0, 0, 0], bass: 6, alt: 5 },
};
const PROGRESSIONS = [
  { name: 'C → Am → F → G', chords: ['C', 'Am', 'F', 'G'] },
  { name: 'G → D → Em → C', chords: ['G', 'D', 'Em', 'C'] },
];
const PATTERNS = [
  { id: 'arpeggio', name: 'อาร์เพจจิโอ', subtitle: 'แยกเสียงทีละสาย', signature: '4/4', beats: 4, division: 2,
    steps: [['b'], [3], [2], [1], [2], [3], [2], [1]], fingers: ['P', 'I', 'M', 'A', 'M', 'I', 'M', 'A'],
    tip: 'วาง I–M–A บนสาย 3–2–1 ล่วงหน้า ดีดเข้าหาฝ่ามือเบา ๆ และปล่อยให้เสียงแต่ละสายต่อกัน' },
  { id: 'travis', name: 'Travis picking', subtitle: 'เบสสลับ เดินเป็นจังหวะ', signature: '4/4', beats: 4, division: 2,
    steps: [['b'], [2], ['a'], [1], ['b'], [2], ['a'], [1]], fingers: ['P', 'M', 'P', 'A', 'P', 'M', 'P', 'A'],
    tip: 'ให้นิ้วโป้งสลับเบสตรงจังหวะ 1–2–3–4 ก่อน แล้วค่อยเติมสายแหลมในจังหวะยก อย่าให้เบสเร่งตามเมโลดี้' },
  { id: 'six-eight', name: 'ไหลลื่น 6/8', subtitle: 'หนึ่ง-ลา-ลี สอง-ลา-ลี', signature: '6/8', beats: 2, division: 3,
    steps: [['b'], [3], [2], [1], [2], [3]], fingers: ['P', 'I', 'M', 'A', 'M', 'I'],
    tip: 'นับ 1-ลา-ลี 2-ลา-ลี โดยเน้นต้นกลุ่มทั้งสองครั้ง หนึ่งคลิกคือโน้ตดำประจุด และมี 3 เสียงย่อยต่อคลิก' },
  { id: 'pinch', name: 'เบส + เมโลดี้', subtitle: 'ดีดสองสายพร้อมกัน', signature: '4/4', beats: 4, division: 2,
    steps: [['b', 1], [3], [2], [1], ['b', 2], [3], [2], [1]], fingers: ['P+A', 'I', 'M', 'A', 'P+M', 'I', 'M', 'A'],
    tip: 'ดีดเบสกับสายแหลมในช่องแรกให้พร้อมกัน ฟังให้เมโลดี้สายแหลมชัดกว่าเบสเล็กน้อย โดยไม่เกร็งมือขวา' },
];

/** A self-contained fingerstyle practice studio. All scheduled work belongs to this view. */
export function renderPractice(container, { audio, record = () => {} }) {
  let patternIndex = 0;
  let progressionIndex = 0;
  let bpm = 72;
  let currentChord = 0;
  let activeStep = -1;
  let loop = true;
  let countIn = true;
  let metronome = true;
  let running = false;
  let starting = false;
  let disposed = false;
  let paused = false;
  let nextPosition = 0;
  let countRemaining = 0;
  let nextTime = 0;
  let scheduler = null;
  let generation = 0;
  let completedPhrases = 0;
  let completionQueued = false;
  let taps = [];
  const visualTimers = new Set();
  const listeners = [];

  container.innerHTML = `
    <div class="practice-studio">
      <div class="practice-intro"><div><p class="eyebrow">FINGERSTYLE STUDIO</p><h1>ให้สองมือเล่าเรื่องเดียวกัน</h1><p class="muted">ฟัง แยกนิ้ว แล้วค่อย ๆ เปลี่ยนคอร์ดไปด้วยกัน ฝึกช้าให้ชัดก่อนเพิ่มความเร็ว</p></div><span class="practice-signature" data-signature>4<span>/</span>4</span></div>
      <div class="practice-patterns" role="group" aria-label="เลือกรูปแบบการดีด">${PATTERNS.map((p, i) => `<button type="button" class="practice-pattern${i === 0 ? ' is-selected' : ''}" data-pattern="${i}" aria-pressed="${i === 0}"><span class="practice-pattern-number">0${i + 1}</span><strong>${p.name}</strong><span>${p.subtitle}</span><small>${p.signature}</small></button>`).join('')}</div>
      <div class="practice-layout">
        <section class="panel practice-player" aria-label="เครื่องเล่นและแท็บฝึกกีตาร์">
          <div class="practice-player-heading"><div><p class="eyebrow">PLAY ALONG</p><h3>ทีละสาย ทีละห้อง</h3></div><label class="practice-progression-label"><span>ชุดคอร์ด</span><select class="select" data-progression aria-label="เลือกชุดคอร์ด">${PROGRESSIONS.map((p, i) => `<option value="${i}">${p.name}</option>`).join('')}</select></label></div>
          <div class="practice-chord-track" data-chords aria-label="คอร์ดในวลี"></div>
          <div class="practice-tab-caption"><span><b data-chord-name>C</b> <span class="muted">· เลขคือเฟร็ตที่กด · 0 คือสายเปล่า</span></span><span class="practice-tab-badge" data-tab-signature>4/4 · 1 ห้องต่อคอร์ด</span></div>
          <div class="practice-tab-scroll" tabindex="0" aria-label="แท็บกีตาร์ เลื่อนแนวนอนได้"><table class="practice-tab" data-tab aria-label="แท็บอาร์เพจจิโอคอร์ด C"></table></div>
          <div class="practice-tab-legend"><span><i class="practice-key-note"></i> สายที่ดีด</span><span><i class="practice-key-active"></i> กำลังเล่น</span><span>P = โป้ง · I = ชี้ · M = กลาง · A = นาง</span></div>
          <div class="practice-transport"><button type="button" class="btn btn-primary practice-play" data-play><span aria-hidden="true">▶</span> เริ่มฝึก</button><button type="button" class="btn btn-secondary" data-stop disabled><span aria-hidden="true">■</span> หยุด</button><div class="practice-transport-progress"><span data-bar>ห้อง 1 / 4</span><div class="practice-progress-track" role="progressbar" aria-label="ความคืบหน้าของวลี" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-progress><span></span></div></div></div>
          <p class="practice-status" data-status role="status" aria-live="polite">พร้อมแล้วน้องนัด เริ่มที่ความเร็วสบาย ๆ แล้วฟังให้ครบทั้ง 4 ห้องนะ</p>
        </section>
        <aside class="practice-sidebar">
          <section class="panel practice-tempo-panel" aria-label="ตั้งค่าจังหวะ"><div class="practice-small-heading"><span class="eyebrow">KEEP THE PULSE</span><span class="practice-pulse" data-pulse aria-hidden="true"></span></div><div class="practice-tempo-value"><button type="button" data-slower aria-label="ลดความเร็ว 5 BPM">−</button><div><strong data-bpm>72</strong><span>BPM</span></div><button type="button" data-faster aria-label="เพิ่มความเร็ว 5 BPM">+</button></div><input type="range" min="40" max="160" value="72" data-tempo aria-label="ความเร็ว 40 ถึง 160 BPM"><div class="practice-tempo-scale"><span>40 · ช้า</span><span>160 · เร็ว</span></div><div class="practice-tempo-foot"><span data-beat-unit>1 คลิก = โน้ตดำ</span><button type="button" class="practice-tap" data-tap>แตะตามจังหวะ</button></div><div class="practice-options"><label><input type="checkbox" checked data-loop><span>วนทั้ง 4 ห้อง</span><span aria-hidden="true">↻</span></label><label><input type="checkbox" checked data-click><span>เสียงเมโทรนอม</span><span aria-hidden="true">♩</span></label><label><input type="checkbox" checked data-count><span>นับเข้าก่อนเริ่ม</span><span data-count-beats>4 จังหวะ</span></label></div></section>
          <section class="panel practice-hand"><p class="eyebrow">RIGHT HAND, RELAXED</p><h3>รู้จักนิ้วข้างขวา</h3><div class="practice-finger-grid"><div><b>P</b><strong>นิ้วโป้ง</strong><span>เบสสาย 4–6</span></div><div><b>I</b><strong>นิ้วชี้</strong><span>สาย 3</span></div><div><b>M</b><strong>นิ้วกลาง</strong><span>สาย 2</span></div><div><b>A</b><strong>นิ้วนาง</strong><span>สาย 1</span></div></div><p class="practice-hand-note">วางข้อมือสบาย ๆ ไม่ต้องกดแรง และไม่จำเป็นต้องดีดดังทุกสายเท่ากัน</p></section>
        </aside>
      </div>
      <section class="panel practice-lesson"><div><p class="eyebrow">SMALL STEPS, REAL PROGRESS</p><h3>แผนฝึก 3 รอบของวันนี้</h3><p class="practice-pattern-tip" data-tip></p></div><ol class="practice-exercises"><li><span>01</span><div><strong>ฟังและนับก่อน</strong><p>ฟังหนึ่งวลีโดยยังไม่จับกีตาร์ มองจังหวะกับนิ้วที่ไฮไลต์</p></div></li><li><span>02</span><div><strong>ขวามาก่อน ซ้ายตามมา</strong><p>จับคอร์ด C หรือ G ค้างไว้ ฝึกแพตเทิร์นช้า ๆ ให้เสียงไม่สะดุด</p></div></li><li><span>03</span><div><strong>เชื่อมให้ครบ 4 ห้อง</strong><p>เล่นตามชุดคอร์ด เปลี่ยนคอร์ดตรงต้นห้อง เพิ่มครั้งละ 5 BPM เมื่อพร้อม</p></div></li></ol><div class="practice-session"><span class="practice-session-icon" aria-hidden="true">✓</span><span>เล่นวลีจบในรอบนี้ <b data-completed>0</b> ครั้ง</span><small>นับเมื่อเสียงเล่นครบ 4 ห้อง · ยังไม่ได้ตรวจเสียงจากไมค์</small></div></section>
    </div>`;

  const $ = (selector) => container.querySelector(selector);
  const $$ = (selector) => Array.from(container.querySelectorAll(selector));
  const on = (target, event, handler) => { target.addEventListener(event, handler); listeners.push(() => target.removeEventListener(event, handler)); };
  const pattern = () => PATTERNS[patternIndex];
  const progression = () => PROGRESSIONS[progressionIndex];
  const stepDuration = () => 60 / bpm / pattern().division;
  const totalSteps = () => pattern().steps.length * progression().chords.length;
  const status = (message, error = false) => { $('[data-status]').textContent = message; $('[data-status]').classList.toggle('is-error', error); };
  const resolveStrings = (step, chord) => step.map((s) => s === 'b' ? chord.bass : s === 'a' ? chord.alt : s);
  const notesFor = (step, chord) => resolveStrings(step, chord).map((s) => OPEN_STRINGS[s - 1] + chord.frets[6 - s]);
  const later = (when, fn, token = generation) => {
    const id = setTimeout(() => { visualTimers.delete(id); if (!disposed && token === generation) fn(); }, Math.max(0, when * 1000));
    visualTimers.add(id);
  };
  const clearScheduled = () => {
    generation += 1;
    clearInterval(scheduler);
    scheduler = null;
    visualTimers.forEach(clearTimeout);
    visualTimers.clear();
    try { audio.stopAll?.(); } catch { /* A stopped audio device still allows resetting the controls. */ }
    $('[data-pulse]')?.classList.remove('is-on');
  };
  const renderChords = () => {
    $('[data-chords]').innerHTML = progression().chords.map((name, i) => `<div class="practice-chord${i === currentChord ? ' is-current' : ''}"><span>0${i + 1}</span><strong>${name}</strong><small>1 ห้อง</small></div>`).join('<span class="practice-chord-arrow" aria-hidden="true">→</span>');
    $('[data-chord-name]').textContent = progression().chords[currentChord];
  };
  const highlight = (step) => {
    $$('[data-step]').forEach((cell) => cell.classList.toggle('is-current', Number(cell.dataset.step) === step));
    activeStep = step;
  };
  const renderTab = () => {
    const p = pattern();
    const name = progression().chords[currentChord];
    const chord = CHORDS[name];
    const counts = p.signature === '6/8' ? ['1', 'ลา', 'ลี', '2', 'ลา', 'ลี'] : ['1', '&', '2', '&', '3', '&', '4', '&'];
    $('[data-tab]').innerHTML = `<thead><tr><th scope="col">นับ</th>${counts.map((c, i) => `<th scope="col" data-step="${i}" class="${i % p.division === 0 ? 'practice-downbeat' : ''}">${c}</th>`).join('')}</tr></thead><tbody>${STRINGS.map((name, row) => `<tr><th scope="row"><b>${name}</b><small>${row + 1}</small></th>${p.steps.map((step, i) => { const isNote = resolveStrings(step, chord).includes(row + 1); return `<td data-step="${i}"${i % p.division === 0 ? ' class="practice-downbeat"' : ''}><span class="practice-tab-line"></span>${isNote ? `<b class="practice-tab-note">${chord.frets[5 - row]}</b>` : '<span class="practice-tab-rest" aria-hidden="true"></span>'}</td>`; }).join('')}</tr>`).join('')}</tbody><tfoot><tr><th scope="row">นิ้ว</th>${p.fingers.map((finger, i) => `<td data-step="${i}">${finger}</td>`).join('')}</tr></tfoot>`;
    $('[data-tab]').setAttribute('aria-label', `แท็บ ${p.name} คอร์ด ${name} สายเรียงจากสาย 1 ด้านบนถึงสาย 6 ด้านล่าง`);
    renderChords();
    highlight(activeStep);
  };
  const setProgress = (position) => {
    const value = Math.min(100, Math.max(0, position / totalSteps() * 100));
    $('[data-progress]').setAttribute('aria-valuenow', String(Math.round(value)));
    $('[data-progress] span').style.width = `${value}%`;
    $('[data-bar]').textContent = `ห้อง ${Math.min(4, Math.floor(position / pattern().steps.length) + 1)} / 4`;
  };
  const controls = () => {
    $('[data-play]').innerHTML = starting ? 'กำลังเตรียมเสียง…' : running ? '<span aria-hidden="true">Ⅱ</span> พักก่อน' : paused ? '<span aria-hidden="true">▶</span> ฝึกต่อ' : '<span aria-hidden="true">▶</span> เริ่มฝึก';
    $('[data-play]').disabled = starting;
    $('[data-stop]').disabled = !running && !paused && !starting;
  };
  const stop = (message = 'หยุดแล้ว เริ่มใหม่ได้ตั้งแต่ห้องแรกเลยนะ') => {
    clearScheduled();
    running = false; starting = false; paused = false; completionQueued = false;
    nextPosition = 0; currentChord = 0; activeStep = -1; countRemaining = 0;
    renderTab(); setProgress(0); controls(); status(message);
  };
  const pause = (message = 'พักไว้ตรงนี้แล้ว กดฝึกต่อเพื่อเริ่มใหม่จากต้นห้องปัจจุบัน') => {
    const resumeChord = currentChord;
    clearScheduled();
    running = false; starting = false; paused = true; completionQueued = false;
    nextPosition = resumeChord * pattern().steps.length;
    countRemaining = 0; activeStep = -1;
    highlight(-1); setProgress(nextPosition); controls(); status(message);
  };
  const pulse = (delay) => {
    later(delay, () => $('[data-pulse]').classList.add('is-on'));
    later(delay + .09, () => $('[data-pulse]').classList.remove('is-on'));
  };
  const playSafely = (operation) => {
    const token = generation;
    Promise.resolve(operation()).catch(() => {
      if (disposed || token !== generation || !running) return;
      stop('เสียงเล่นต่อไม่ได้ ลองเริ่มใหม่อีกครั้ง หรือตรวจอุปกรณ์เสียงของเครื่องนะ');
      $('[data-status]').classList.add('is-error');
    });
  };
  const phraseComplete = (loopAtBoundary) => {
    completedPhrases += 1;
    $('[data-completed]').textContent = String(completedPhrases);
    try { record('fingerstyle', true, `${pattern().name} · ${progression().name} · ${bpm} BPM`); } catch { /* The practice player remains usable if progress storage is unavailable. */ }
    if (!loopAtBoundary) {
      running = false; paused = false; completionQueued = false; nextPosition = 0;
      clearInterval(scheduler); scheduler = null;
      highlight(-1); setProgress(totalSteps()); controls();
      status('ครบทั้ง 4 ห้องแล้วน้องนัด! พักมือสักครู่ หรือเริ่มอีกวลีเมื่อพร้อม');
    } else status(`เล่นครบ ${completedPhrases} วลีแล้ว กำลังวนกลับห้องแรก ลองรักษาเสียงให้ต่อเนื่องนะ`);
  };
  const tick = () => {
    if (!running || disposed || completionQueued) return;
    const now = performance.now() / 1000;
    if (now - nextTime > .35) {
      pause('พักจังหวะไว้เพราะหน้าต่างหยุดทำงานชั่วคราว กดฝึกต่อเมื่อพร้อมนะ');
      return;
    }
    let safety = 0;
    try {
      while (nextTime < now + .1 && running && !completionQueued && safety++ < 12) {
        const delay = Math.max(0, nextTime - performance.now() / 1000);
        const p = pattern();
        if (countRemaining > 0) {
          const count = p.beats - countRemaining + 1;
          // The count-in always sounds, even when the continuing metronome is muted.
          playSafely(() => audio.click(count === 1, delay));
          pulse(delay);
          later(delay, () => status(`เตรียมมือ · ${count} / ${p.beats}`));
          countRemaining -= 1;
          nextTime += 60 / bpm;
          continue;
        }
        if (nextPosition >= totalSteps()) {
          const repeat = loop;
          later(delay, () => phraseComplete(repeat));
          if (!repeat) { completionQueued = true; break; }
          nextPosition = 0;
        }
        const position = nextPosition;
        const chordIndex = Math.floor(position / p.steps.length);
        const stepIndex = position % p.steps.length;
        const chord = CHORDS[progression().chords[chordIndex]];
        const duration = Math.min(1.4, Math.max(.28, stepDuration() * 2.7));
        notesFor(p.steps[stepIndex], chord).forEach((midi) => playSafely(() => audio.playNote(midi, duration, delay)));
        if (stepIndex % p.division === 0) {
          if (metronome) playSafely(() => audio.click(stepIndex === 0, delay));
          pulse(delay);
        }
        later(delay, () => {
          if (currentChord !== chordIndex) { currentChord = chordIndex; activeStep = stepIndex; renderTab(); }
          else highlight(stepIndex);
          setProgress(position + 1);
          if (position === 0) status(`กำลังฝึก ${p.name} · เล่นตามนิ้วและเปลี่ยนคอร์ดเมื่อขึ้นห้องใหม่`);
        });
        nextPosition += 1;
        nextTime += stepDuration();
      }
    } catch {
      stop('เสียงเล่นต่อไม่ได้ ลองเริ่มใหม่อีกครั้ง หรือตรวจอุปกรณ์เสียงของเครื่องนะ');
      $('[data-status]').classList.add('is-error');
    }
  };
  const start = async () => {
    if (running) { pause(); return; }
    if (starting || disposed) return;
    starting = true;
    controls();
    const token = generation;
    try {
      await audio.init();
      if (disposed || token !== generation) return;
      starting = false;
      running = true;
      completionQueued = false;
      countRemaining = countIn ? pattern().beats : 0;
      if (!paused) nextPosition = 0;
      paused = false;
      nextTime = performance.now() / 1000 + .07;
      controls();
      tick();
      if (running && !completionQueued) scheduler = setInterval(tick, 25);
    } catch {
      if (disposed || token !== generation) return;
      starting = false; running = false; controls();
      status('เปิดเสียงไม่ได้ ลองกดเริ่มอีกครั้ง และตรวจว่าเบราว์เซอร์อนุญาตให้เล่นเสียงนะ', true);
    }
  };
  const setTempo = (value) => {
    bpm = Math.max(40, Math.min(160, Math.round(Number(value) || 72)));
    $('[data-bpm]').textContent = String(bpm);
    $('[data-tempo]').value = String(bpm);
    $('[data-tempo]').setAttribute('aria-valuetext', `${bpm} จังหวะต่อนาที`);
  };
  const updatePattern = () => {
    const p = pattern();
    $('[data-signature]').innerHTML = `${p.signature[0]}<span>/</span>${p.signature[2]}`;
    $('[data-tab-signature]').textContent = `${p.signature} · 1 ห้องต่อคอร์ด`;
    $('[data-beat-unit]').textContent = `1 คลิก = ${p.signature === '6/8' ? 'โน้ตดำประจุด' : 'โน้ตดำ'}`;
    $('[data-count-beats]').textContent = `${p.beats} จังหวะ`;
    $('[data-tip]').textContent = p.tip;
    $$('[data-pattern]').forEach((button, index) => { button.classList.toggle('is-selected', index === patternIndex); button.setAttribute('aria-pressed', String(index === patternIndex)); });
    stop(`เลือก ${p.name} แล้ว เริ่มจาก ${bpm} BPM และค่อย ๆ ฟังทุกสายให้ชัดนะ`);
  };
  $$('[data-pattern]').forEach((button) => on(button, 'click', () => { patternIndex = Number(button.dataset.pattern); updatePattern(); }));
  on($('[data-progression]'), 'change', (event) => { progressionIndex = Number(event.target.value); stop('เปลี่ยนชุดคอร์ดแล้ว ลองซ้อมจับแต่ละคอร์ดให้คล่องก่อนเริ่มนะ'); });
  on($('[data-play]'), 'click', start);
  on($('[data-stop]'), 'click', () => stop());
  on($('[data-tempo]'), 'input', (event) => setTempo(event.target.value));
  on($('[data-slower]'), 'click', () => setTempo(bpm - 5));
  on($('[data-faster]'), 'click', () => setTempo(bpm + 5));
  on($('[data-loop]'), 'change', (event) => { loop = event.target.checked; });
  on($('[data-click]'), 'change', (event) => { metronome = event.target.checked; });
  on($('[data-count]'), 'change', (event) => { countIn = event.target.checked; });
  on($('[data-tap]'), 'click', () => {
    const now = performance.now();
    if (taps.length && now - taps.at(-1) > 2200) taps = [];
    taps.push(now);
    taps = taps.slice(-6);
    if (taps.length > 1) {
      const intervals = taps.slice(1).map((time, i) => time - taps[i]);
      setTempo(60000 / (intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length));
      $('[data-tap]').textContent = `ตามจังหวะ · ${bpm}`;
    } else $('[data-tap]').textContent = 'แตะอีกครั้ง…';
  });
  on(document, 'visibilitychange', () => { if (document.hidden && (running || starting)) pause('พักอัตโนมัติเมื่อออกจากหน้านี้ กดฝึกต่อเพื่อกลับมาตรงจังหวะนะ'); });
  on(window, 'pagehide', () => { if (running || starting) pause('พักการฝึกไว้แล้ว'); });
  $('[data-tip]').textContent = pattern().tip;
  renderTab(); setTempo(bpm);
  return () => {
    disposed = true;
    clearScheduled();
    running = false;
    listeners.forEach((remove) => remove());
  };
}
