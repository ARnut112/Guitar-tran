import { NOTES } from './music.js';
import { icon, heading, soundError } from './ui.js';

const intervals = [
  { name: 'm2', label: 'ไมเนอร์ 2', n: 1 },
  { name: 'M2', label: 'เมเจอร์ 2', n: 2 },
  { name: 'm3', label: 'ไมเนอร์ 3', n: 3 },
  { name: 'M3', label: 'เมเจอร์ 3', n: 4 },
  { name: 'P4', label: 'เพอร์เฟกต์ 4', n: 5 },
  { name: 'P5', label: 'เพอร์เฟกต์ 5', n: 7 },
  { name: 'P8', label: 'อ็อกเทฟ', n: 12 },
];

export function renderEar(container, { audio, record = () => {} }) {
  let mode = 'notes';
  let chromatic = false;
  let target = null;
  let locked = false;
  let played = false;
  let playing = false;
  let correct = 0;
  let total = 0;
  let alive = true;
  let token = 0;
  const playbackTimers = new Map();

  container.innerHTML = heading('03 / EAR TRAINING', 'ฝึกหูให้จำเสียงได้', 'ฟังอย่างตั้งใจ เทียบกับเสียงอ้างอิง แล้วค่อย ๆ รู้จักระยะห่างระหว่างโน้ต') + `<div class="toolbar"><div class="tabs" role="group" aria-label="โหมดฝึกฟัง"><button data-ear-mode="notes" class="active">ทายชื่อโน้ต</button><button data-ear-mode="intervals">ทายระยะคู่เสียง</button></div><label class="field" id="chromatic-label"><input type="checkbox" id="chromatic"> รวมชาร์ป / แฟลต</label></div><div class="ear-stage"><section class="panel ear-listen"><span class="eyebrow" id="ear-eyebrow">LISTEN. FEEL. REMEMBER.</span><div class="sound-orb" aria-hidden="true">${icon('ear')}</div><h2 id="ear-question">เสียงนี้คือโน้ตอะไร?</h2><p class="muted small" id="ear-instruction">ฟังโน้ต แล้วลองเลือกคำตอบด้านล่างค่ะ</p><button class="btn btn-primary" id="ear-play">${icon('volume')} ฟังโจทย์</button><div class="answer-keys" id="ear-answers"></div><div class="feedback" id="ear-feedback" role="status">กดฟังโจทย์ก่อนเริ่มตอบค่ะ</div><button class="btn btn-secondary" id="ear-next">ข้อถัดไป ${icon('arrow')}</button><div class="mini-stats" style="justify-content:center" id="ear-stats"></div></section><aside><section class="panel"><span class="eyebrow">YOUR SOUND REFERENCE</span><h3>ฟังก่อน จำทีละเสียง</h3><p class="muted small">ใช้เสียง C4 เป็นจุดตั้งต้น แล้วเทียบเสียงอื่น ๆ ค่ะ</p><div class="ear-reference" id="ear-reference"></div><p class="muted small" style="margin:17px 0 0">C4 = โดกลาง · A4 = 440 Hz<br>ชื่อโด เร มี เป็นการเทียบแบบ fixed-do</p></section><div class="coach-note">${icon('book')}<div><h3>หูดนตรีฝึกได้ค่ะ</h3><p>การทายชื่อโน้ตโดยไม่มีเสียงอ้างอิงเป็นทักษะที่ยาก ลองฟัง C4 ก่อนทุกข้อ แล้วฝึกเทียบระยะเสียง จะนำไปใช้แกะเพลงได้ดีค่ะ</p></div></div></aside></div>`;
  const q = id => container.querySelector('#' + id);
  const answerButtons = () => q('ear-answers').querySelectorAll('button');
  const choices = () => mode === 'notes' ? NOTES.filter(n => chromatic || !n.includes('#')) : intervals.map(i => i.name);
  const current = run => alive && run === token;

  function cancelPlayback() {
    token += 1;
    for (const [id, resolve] of playbackTimers) {
      clearTimeout(id);
      resolve(false);
    }
    playbackTimers.clear();
    audio.stopAll();
    return token;
  }

  // Audio methods resolve when they schedule a sound, rather than when it ends.
  // Resolve cancellation too, so no suspended listen() task survives its view.
  function waitForPlayback(milliseconds, run) {
    if (!current(run)) return Promise.resolve(false);
    return new Promise(resolve => {
      const id = setTimeout(() => {
        playbackTimers.delete(id);
        resolve(current(run));
      }, milliseconds);
      playbackTimers.set(id, resolve);
    });
  }

  function drawStats() {
    q('ear-stats').innerHTML = `<span><b>${correct}</b>ถูก</span><span><b>${total}</b>ข้อ</span><span><b>${total ? Math.round(correct / total * 100) : 0}%</b>แม่นยำ</span>`;
  }

  function draw() {
    q('ear-question').textContent = mode === 'notes' ? 'เสียงนี้คือโน้ตอะไร?' : 'สองเสียงนี้ห่างกันเท่าไร?';
    q('ear-instruction').textContent = mode === 'notes' ? 'โน้ตโจทย์อยู่ในช่วง C4–B4 ค่ะ' : 'ฟังโน้ตต่ำ ตามด้วยโน้ตสูง แล้วเลือกคู่เสียงค่ะ';
    q('ear-answers').innerHTML = choices().map(n => `<button data-ear-answer="${n}" disabled>${n.replace('#', '♯')}</button>`).join('');
    q('ear-play').innerHTML = `${icon('volume')} ฟังโจทย์`;
    q('ear-play').disabled = false;
    q('ear-feedback').className = 'feedback';
    q('ear-feedback').textContent = 'กดฟังโจทย์ก่อนเริ่มตอบค่ะ';
    drawStats();
  }

  function next() {
    cancelPlayback();
    const old = target;
    if (mode === 'notes') {
      const list = choices();
      let name = list[Math.floor(Math.random() * list.length)];
      if (name === old?.name) name = list[(list.indexOf(name) + 1) % list.length];
      target = { name, midi: 60 + NOTES.indexOf(name) };
    } else {
      const pick = intervals[Math.floor(Math.random() * intervals.length)];
      target = { ...pick, midi: 48 + Math.floor(Math.random() * 12) };
    }
    played = false;
    playing = false;
    locked = false;
    draw();
  }

  function interruptQuestion(message) {
    cancelPlayback();
    playing = false;
    played = false;
    q('ear-play').disabled = false;
    q('ear-play').innerHTML = `${icon('volume')} ฟังโจทย์`;
    answerButtons().forEach(button => { button.disabled = true; });
    if (!locked) {
      q('ear-feedback').className = 'feedback';
      q('ear-feedback').textContent = message;
    }
  }

  async function listen() {
    if (!alive || playing) return;
    const run = cancelPlayback();
    const questionMode = mode;
    const question = { ...target };
    playing = true;
    played = false;
    q('ear-play').disabled = true;
    q('ear-play').textContent = 'กำลังเล่นโจทย์…';
    answerButtons().forEach(button => { button.disabled = true; });
    if (!locked) q('ear-feedback').textContent = 'ฟังให้จบก่อน แล้วค่อยเลือกคำตอบนะคะ';
    try {
      await audio.init();
      if (!current(run)) return;
      const first = await audio.playNote(question.midi, questionMode === 'notes' ? 1.1 : .7);
      if (!current(run)) return;
      if (first === false) {
        q('ear-feedback').textContent = 'เสียงถูกหยุดก่อนจบ กดฟังโจทย์อีกครั้งค่ะ';
        return;
      }
      let duration = 1150;
      if (questionMode === 'intervals') {
        const second = await audio.playNote(question.midi + question.n, .9, .8);
        if (!current(run)) return;
        if (second === false) {
          audio.stopAll();
          q('ear-feedback').textContent = 'เสียงถูกหยุดก่อนจบ กดฟังโจทย์อีกครั้งค่ะ';
          return;
        }
        duration = 1750;
      }
      if (!await waitForPlayback(duration, run) || !current(run)) return;
      played = true;
      q('ear-play').innerHTML = `${icon('volume')} ฟังอีกครั้ง`;
      answerButtons().forEach(button => { button.disabled = locked; });
      if (!locked) q('ear-feedback').textContent = 'ฟังแล้วลองเลือกคำตอบค่ะ';
    } catch (error) {
      if (!current(run)) return;
      audio.stopAll();
      q('ear-feedback').textContent = 'เปิดเสียงไม่สำเร็จ กดฟังโจทย์เพื่อลองอีกครั้งนะคะ';
      soundError(error);
    } finally {
      if (current(run)) {
        playing = false;
        q('ear-play').disabled = false;
        if (!played) q('ear-play').innerHTML = `${icon('volume')} ฟังโจทย์`;
      }
    }
  }

  async function reference(midi) {
    if (!alive) return;
    if (playing) interruptQuestion('หยุดโจทย์ไว้แล้ว ฟังเสียงอ้างอิงก่อน แล้วกดฟังโจทย์อีกครั้งค่ะ');
    else cancelPlayback();
    const run = token;
    try {
      await audio.init();
      if (!current(run)) return;
      await audio.playNote(midi, 1.1);
    } catch (error) {
      if (current(run)) soundError(error);
    }
  }

  q('ear-play').onclick = listen;
  q('ear-next').onclick = next;
  q('ear-answers').onclick = event => {
    const button = event.target.closest('[data-ear-answer]');
    if (!button || button.disabled || !played || playing || locked || !alive) return;
    locked = true;
    const ok = button.dataset.earAnswer === target.name;
    total += 1;
    if (ok) correct += 1;
    record('ear', ok, mode === 'notes' ? `ฟังโน้ต ${target.name}4` : `คู่เสียง ${target.name} · ${target.label}`);
    q('ear-feedback').textContent = ok ? `ถูกต้องค่ะ! ${target.name}${mode === 'notes' ? '4' : ` · ${target.label}`}` : `คำตอบคือ ${target.name}${mode === 'notes' ? '4' : ` · ${target.label} (${target.n} ครึ่งเสียง)`} ลองฟังเทียบอีกครั้งนะคะ`;
    q('ear-feedback').className = 'feedback ' + (ok ? 'correct' : 'wrong');
    answerButtons().forEach(answer => { answer.disabled = true; });
    drawStats();
  };

  const solfege = ['โด', 'เร', 'มี', 'ฟา', 'ซอล', 'ลา', 'ที'];
  q('ear-reference').innerHTML = NOTES.filter(n => !n.includes('#')).map((n, i) => `<button data-ref="${60 + NOTES.indexOf(n)}">${n}4<small>${solfege[i]}</small></button>`).join('');
  q('ear-reference').onclick = event => {
    const button = event.target.closest('[data-ref]');
    if (button) return reference(Number(button.dataset.ref));
  };
  container.querySelectorAll('[data-ear-mode]').forEach(button => {
    button.onclick = () => {
      mode = button.dataset.earMode;
      container.querySelectorAll('[data-ear-mode]').forEach(other => other.classList.toggle('active', other === button));
      q('chromatic-label').hidden = mode !== 'notes';
      next();
    };
  });
  q('chromatic').onchange = event => { chromatic = event.target.checked; next(); };
  const visibilityChange = () => {
    if (document.hidden && playing) interruptQuestion('พักเสียงเมื่อออกจากหน้านี้ กลับมาแล้วกดฟังโจทย์อีกครั้งค่ะ');
  };
  const pageHide = () => { if (playing) interruptQuestion('พักเสียงไว้แล้ว กดฟังโจทย์เมื่อพร้อมค่ะ'); };
  document.addEventListener('visibilitychange', visibilityChange);
  window.addEventListener('pagehide', pageHide);
  next();
  return () => {
    alive = false;
    cancelPlayback();
    playing = false;
    document.removeEventListener('visibilitychange', visibilityChange);
    window.removeEventListener('pagehide', pageHide);
  };
}
