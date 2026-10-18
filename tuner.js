import {STRINGS,frequencyForMidi} from './music.js';
import {heading,icon,soundError,escapeHTML} from './ui.js';
export function renderTuner(container,{audio,onMicStart=()=>{}}){
  let alive=true,pending=false,lastSignal=0,micRequest=0;
  container.innerHTML=heading('05 / TUNE BEFORE YOU PLAY','เสียงที่ตรง คือจุดเริ่มต้นที่ดี','ตั้งสายมาตรฐาน E A D G B E ด้วยไมโครโฟน หรือฟังเสียงอ้างอิงทีละสาย')+`<section class="panel tuner-panel"><span class="eyebrow">CHROMATIC TUNER · A4 = 440 HZ</span><div class="tuner-note" id="tuner-note">—<small></small></div><div class="tuner-hz" id="tuner-hz">พร้อมรับฟังเสียงกีตาร์</div><div class="tuner-meter" aria-label="มาตรวัดความเพี้ยนเป็นเซนต์"><span class="tuner-needle" id="tuner-needle"></span>${Array.from({length:11},()=>'<i></i>').join('')}</div><div class="meter-labels"><span>−50¢ · ต่ำไป</span><span>ตรง</span><span>สูงไป · +50¢</span></div><div class="tuner-state" id="tuner-state" role="status" aria-live="polite">เปิดไมค์ แล้วดีดสายเปล่าทีละสายค่ะ</div><button class="btn btn-primary" id="tuner-mic">${icon('mic')} เปิดไมโครโฟน</button><div class="tuner-strings" id="tuner-strings" role="group" aria-label="เสียงสายเปิด">${[...STRINGS].reverse().map(s=>`<button data-tuning-midi="${s.midi}" aria-label="ฟังสาย ${s.number} โน้ต ${s.name}${s.octave}">${s.name}<small>สาย ${s.number} · ${s.octave}</small></button>`).join('')}</div><p class="meter-note">ปุ่ม E A D G B E ใช้ฟังเสียงอ้างอิง เมื่อฟังตัวอย่าง ไมค์จะหยุดเพื่อไม่ให้รับเสียงจากลำโพงค่ะ<br>ขณะตั้งสายให้ดีดเบา ๆ ทีละสาย รอเสียงนิ่ง แล้วหมุนลูกบิดทีละนิด</p><p class="meter-note">ประมวลผลเสียงภายในเบราว์เซอร์ ไม่มีการบันทึกหรืออัปโหลดเสียง<br>ไมค์ต้องใช้ผ่าน localhost หรือ HTTPS และต้องอนุญาตในเบราว์เซอร์ค่ะ</p></section>`;
  const q=id=>container.querySelector('#'+id);
  function state(message,color=''){
    q('tuner-state').textContent=message;
    q('tuner-state').style.color=color;
  }
  function resetMeter(){
    q('tuner-note').innerHTML='—<small></small>';
    q('tuner-hz').textContent='รอฟังเสียง…';
    q('tuner-needle').style.left='50%';
    container.querySelectorAll('[data-tuning-midi]').forEach(b=>b.classList.remove('active'));
  }
  function stop(){
    micRequest++;
    pending=false;
    audio.stopMic();
    q('tuner-mic').innerHTML=`${icon('mic')} เปิดไมโครโฟน`;
  }
  q('tuner-mic').onclick=async()=>{
    if(!alive)return;
    if(audio.listening||pending){stop();state('หยุดฟังแล้วค่ะ');return;}
    const request=++micRequest;
    pending=true;
    lastSignal=performance.now();
    resetMeter();
    audio.stopAll();
    q('tuner-mic').textContent='กำลังขอใช้ไมค์…';
    state('อนุญาตไมโครโฟน แล้วดีดสายเปล่าทีละสายค่ะ');
    try{
      onMicStart();
      const ok=await audio.startMic(result=>{
        if(!alive||request!==micRequest||document.hidden)return;
        if(!result){
          if(performance.now()-lastSignal>1200){resetMeter();state('ดีดสายเปล่าทีละสาย ใกล้ไมโครโฟนค่ะ');}
          return;
        }
        if(typeof result.name!=='string'||!Number.isFinite(result.frequency)||!Number.isFinite(result.cents)||!Number.isInteger(result.octave))return;
        lastSignal=performance.now();
        const cents=Math.round(result.cents),inTune=Math.abs(result.cents)<=5;
        q('tuner-note').innerHTML=`${escapeHTML(result.name.replace('#','♯'))}<small>${result.octave}</small>`;
        q('tuner-hz').textContent=`${result.frequency.toFixed(1)} Hz · ${cents>0?'+':''}${cents} cents`;
        q('tuner-needle').style.left=`${Math.max(2,Math.min(98,50+result.cents*.96))}%`;
        state(inTune?'✓ ตรงแล้วค่ะ ค่อย ๆ เปลี่ยนไปสายถัดไป':result.cents<0?'เสียงต่ำไป · ค่อย ๆ ขันให้เสียงสูงขึ้น':'เสียงสูงไป · ค่อย ๆ คลายให้เสียงต่ำลง',inTune?'#c7e1af':'#c7b58f');
        container.querySelectorAll('[data-tuning-midi]').forEach(b=>b.classList.toggle('active',Number(b.dataset.tuningMidi)===result.midi));
      },message=>{
        if(!alive||request!==micRequest)return;
        micRequest++;
        pending=false;
        q('tuner-mic').innerHTML=`${icon('mic')} เปิดไมโครโฟน`;
        state(message);
      });
      if(!alive||request!==micRequest)return;
      if(document.hidden){stop();resetMeter();return;}
      pending=false;
      q('tuner-mic').innerHTML=`${icon('mic')} ${ok?'หยุดฟัง':'เปิดไมโครโฟน'}`;
      if(ok)state('พร้อมแล้วค่ะ ดีดสายเปล่าทีละสาย ใกล้ไมโครโฟน');
      else state('ยังไม่ได้เริ่มฟัง กดเปิดไมโครโฟนเพื่อลองอีกครั้งค่ะ');
    }catch(error){
      if(!alive||request!==micRequest)return;
      stop();
      state(error?.message||'เปิดไมโครโฟนไม่สำเร็จ กดลองอีกครั้งนะคะ');
    }
  };
  q('tuner-strings').onclick=e=>{
    if(!alive)return;
    const b=e.target.closest('[data-tuning-midi]');
    if(!b)return;
    const selected=Number(b.dataset.tuningMidi),s=STRINGS.find(x=>x.midi===selected);
    if(!s)return;
    stop();
    const request=micRequest;
    container.querySelectorAll('[data-tuning-midi]').forEach(x=>x.classList.toggle('active',x===b));
    q('tuner-note').innerHTML=`${s.name}<small>${s.octave}</small>`;
    q('tuner-hz').textContent=`${frequencyForMidi(s.midi).toFixed(1)} Hz · เสียงอ้างอิง`;
    q('tuner-needle').style.left='50%';
    state(`เสียงอ้างอิง ${s.name}${s.octave} · สาย ${s.number} เปิดไมค์เมื่อต้องการตรวจเสียงค่ะ`);
    audio.stopAll();
    audio.playNote(selected,2).catch(error=>{if(alive&&request===micRequest)soundError(error);});
  };
  function visibility(){
    if(!alive||!document.hidden)return;
    stop();
    audio.stopAll();
    resetMeter();
    state('พักการฟังเมื่อสลับหน้าต่าง กดเปิดไมโครโฟนอีกครั้งเมื่อพร้อมค่ะ');
  }
  document.addEventListener('visibilitychange',visibility);
  return()=>{
    if(!alive)return;
    alive=false;
    micRequest++;
    pending=false;
    document.removeEventListener('visibilitychange',visibility);
    audio.stopMic();
    audio.stopAll();
    q('tuner-mic').onclick=null;
    q('tuner-strings').onclick=null;
  };
}
