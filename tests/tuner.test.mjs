import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTuner } from '../tuner.js';

function element(dataset={}) {
  let html='';
  const classes=new Set();
  return {
    dataset,style:{},onclick:null,
    get innerHTML(){return html;},set innerHTML(value){html=String(value);},
    get textContent(){return html.replace(/<[^>]*>/g,'');},set textContent(value){html=String(value);},
    classList:{remove(name){classes.delete(name);},toggle(name,force){if(force===undefined)force=!classes.has(name);if(force)classes.add(name);else classes.delete(name);},contains(name){return classes.has(name);}},
    closest(selector){return selector==='[data-tuning-midi]'&&dataset.tuningMidi?this:null;},
  };
}

async function withTuner(run) {
  const original=Object.getOwnPropertyDescriptor(globalThis,'document');
  const listeners=new Set();
  const document={hidden:false,addEventListener(type,callback){if(type==='visibilitychange')listeners.add(callback);},removeEventListener(type,callback){if(type==='visibilitychange')listeners.delete(callback);}};
  const nodes=Object.fromEntries(['tuner-note','tuner-hz','tuner-state','tuner-needle','tuner-mic','tuner-strings'].map(id=>[id,element()]));
  const strings=[40,45,50,55,59,64].map(midi=>element({tuningMidi:String(midi)}));
  let queries=0,hooks=0,cleanup;
  const container={innerHTML:'',querySelector(selector){queries++;return nodes[selector.slice(1)];},querySelectorAll(){queries++;return strings;}};
  const audio={
    listening:false,stops:0,silences:0,requests:[],played:[],
    stopMic(){this.listening=false;this.stops++;},stopAll(){this.silences++;},
    playNote(midi,duration){this.played.push({midi,duration});return Promise.resolve(true);},
    startMic(pitch,error){return new Promise(resolve=>this.requests.push({pitch,error,resolve}));},
  };
  try{
    Object.defineProperty(globalThis,'document',{configurable:true,value:document});
    cleanup=renderTuner(container,{audio,onMicStart(){hooks++;}});
    await run({audio,nodes,strings,cleanup,document,container,listeners,get hooks(){return hooks;},get queries(){return queries;},hide(){document.hidden=true;for(const listener of [...listeners])listener();}});
  }finally{
    cleanup?.();
    if(original)Object.defineProperty(globalThis,'document',original);
    else delete globalThis.document;
  }
}

test('cancelled microphone requests cannot overwrite a newer request or stop its stream',async()=>{
  await withTuner(async context=>{
    const {audio,nodes}=context;
    const first=nodes['tuner-mic'].onclick();
    await nodes['tuner-mic'].onclick();
    assert.equal(audio.stops,1);
    const second=nodes['tuner-mic'].onclick();
    assert.equal(audio.requests.length,2);
    assert.equal(context.hooks,2);
    const waiting=nodes['tuner-mic'].textContent;
    audio.requests[0].resolve(true);
    await first;
    assert.equal(nodes['tuner-mic'].textContent,waiting);
    assert.equal(audio.stops,1);
    audio.listening=true;
    audio.requests[1].resolve(true);
    await second;
    assert.match(nodes['tuner-mic'].textContent,/หยุดฟัง/);
    audio.requests[0].error('Stale permission error');
    assert.doesNotMatch(nodes['tuner-state'].textContent,/Stale/);
  });
});

test('visibility cancellation resets the tuner and ignores delayed permission completion',async()=>{
  await withTuner(async context=>{
    const {audio,nodes}=context;
    const opening=nodes['tuner-mic'].onclick();
    context.hide();
    assert.match(nodes['tuner-mic'].textContent,/เปิดไมโครโฟน/);
    assert.equal(nodes['tuner-needle'].style.left,'50%');
    const hiddenMessage=nodes['tuner-state'].textContent;
    audio.requests[0].pitch({name:'E',octave:2,midi:40,frequency:82.4,cents:0});
    audio.requests[0].resolve(true);
    await opening;
    assert.equal(nodes['tuner-state'].textContent,hiddenMessage);
    assert.match(nodes['tuner-note'].textContent,/—/);
    assert.equal(audio.stops,1);
  });
});

test('route cleanup is idempotent and late mic callbacks never query detached UI',async()=>{
  await withTuner(async context=>{
    const {audio,nodes,cleanup}=context;
    const opening=nodes['tuner-mic'].onclick();
    cleanup();
    const queries=context.queries;
    const stops=audio.stops;
    audio.requests[0].pitch({name:'E',octave:2,midi:40,frequency:82.4,cents:0});
    audio.requests[0].error('Late error');
    audio.requests[0].resolve(true);
    await opening;
    cleanup();
    assert.equal(context.queries,queries);
    assert.equal(audio.stops,stops);
    assert.equal(context.listeners.size,0);
  });
});

test('reference tones cancel pending mic work and keep their reference display',async()=>{
  await withTuner(async({audio,nodes,strings})=>{
    const opening=nodes['tuner-mic'].onclick();
    nodes['tuner-strings'].onclick({target:strings[0]});
    assert.deepEqual(audio.played,[{midi:40,duration:2}]);
    assert.match(nodes['tuner-hz'].textContent,/82\.4 Hz/);
    assert.match(nodes['tuner-hz'].textContent,/เสียงอ้างอิง/);
    audio.requests[0].resolve(true);
    await opening;
    assert.match(nodes['tuner-mic'].textContent,/เปิดไมโครโฟน/);
    assert.match(nodes['tuner-state'].textContent,/เสียงอ้างอิง E2/);
    assert.equal(strings[0].classList.contains('active'),true);
  });
});

test('live pitch displays readable cents and rejects callbacks after listening is stopped',async()=>{
  await withTuner(async({audio,nodes})=>{
    const opening=nodes['tuner-mic'].onclick();
    audio.listening=true;
    audio.requests[0].resolve(true);
    await opening;
    audio.requests[0].pitch({name:'F#',octave:3,midi:54,frequency:186.45,cents:12.3761907});
    assert.match(nodes['tuner-note'].innerHTML,/F♯/);
    assert.equal(nodes['tuner-hz'].textContent,'186.4 Hz · +12 cents');
    await nodes['tuner-mic'].onclick();
    const lastDisplay=nodes['tuner-hz'].textContent;
    audio.requests[0].pitch({name:'A',octave:4,midi:69,frequency:440,cents:0});
    assert.equal(nodes['tuner-hz'].textContent,lastDisplay);
    assert.match(nodes['tuner-state'].textContent,/หยุดฟัง/);
  });
});
