import { detectPitch, frequencyForMidi, frequencyToNote } from './music.js';

const clamp = (value, minimum, maximum, fallback) => Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;

class GuitarAudio {
  constructor() {
    this._context = null;
    this._master = null;
    this._voices = new Set();
    this._playbackGeneration = 0;
    this._mic = null;
    this._micGeneration = 0;
    this._micPromise = null;
    this._pitchHandler = null;
    this._errorHandler = null;
  }

  async init() {
    if (!this._context || this._context.state === 'closed') {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) throw new Error('เบราว์เซอร์นี้ยังไม่รองรับเสียง ลองเปิดด้วย Chrome, Edge หรือ Safari รุ่นปัจจุบัน');
      const context = new Context();
      const master = context.createGain();
      master.gain.value = 0.38;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -15;
      compressor.knee.value = 16;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.15;
      master.connect(compressor);
      compressor.connect(context.destination);
      this._context = context;
      this._master = master;
      this._wave = null;
    }
    if (this._context.state === 'suspended') await this._context.resume();
    return this._context;
  }

  _voice(source, gain, extraNodes = []) {
    if (this._voices.size >= 48) this._releaseVoice(this._voices.values().next().value);
    const voice = { source, gain, nodes: [source, gain, ...extraNodes] };
    this._voices.add(voice);
    source.onended = () => {
      for (const node of voice.nodes) node.disconnect();
      this._voices.delete(voice);
    };
    return voice;
  }

  _releaseVoice(voice) {
    if (!voice || !this._context) return;
    const now = this._context.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0.0001, now, 0.008);
      voice.source.stop(now + 0.035);
    } catch {
      // A naturally ended voice may already have been released by the browser.
    }
  }

  /** Cancel sounding and scheduled notes/clicks without changing mic state. */
  stopAll() {
    this._playbackGeneration++;
    for (const voice of this._voices) this._releaseVoice(voice);
  }

  /** `when` is a delay in seconds from the current audio clock. */
  async playNote(midi, duration = 0.9, when = 0) {
    if (!Number.isFinite(midi) || midi < 0 || midi > 127) return false;
    const generation = this._playbackGeneration;
    const context = await this.init();
    if (generation !== this._playbackGeneration) return false;
    const start = context.currentTime + clamp(when, 0, 60, 0);
    const length = clamp(duration, 0.08, 8, 0.9);
    const frequency = frequencyForMidi(midi);
    if (!this._wave) {
      const real = new Float32Array(9);
      const imaginary = new Float32Array([0, 1, 0.5, 0.25, 0.14, 0.085, 0.045, 0.023, 0.012]);
      this._wave = context.createPeriodicWave(real, imaginary);
    }
    const source = context.createOscillator();
    source.setPeriodicWave(this._wave);
    source.frequency.setValueAtTime(frequency, start);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.5;
    filter.frequency.setValueAtTime(Math.min(context.sampleRate * 0.45, frequency * 9 + 1800), start);
    filter.frequency.exponentialRampToValueAtTime(Math.min(context.sampleRate * 0.4, frequency * 2 + 550), start + length);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.22, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.065, start + Math.min(0.14, length * 0.35));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this._master);
    this._voice(source, gain, [filter]);
    source.start(start);
    source.stop(start + length + 0.03);
    return true;
  }

  async playChord(midis, { strum = 0.06, duration = 1.6 } = {}) {
    if (!Array.isArray(midis)) return false;
    const generation = this._playbackGeneration;
    await this.init();
    if (generation !== this._playbackGeneration) return false;
    const spacing = clamp(strum, 0, 0.5, 0.06);
    const notes = midis.filter(midi => Number.isFinite(midi) && midi >= 0 && midi <= 127).slice(0, 12);
    await Promise.all(notes.map((midi, index) => this.playNote(midi, duration, index * spacing)));
    return notes.length > 0;
  }

  async click(accent = false, when = 0) {
    const generation = this._playbackGeneration;
    const context = await this.init();
    if (generation !== this._playbackGeneration) return false;
    const start = context.currentTime + clamp(when, 0, 60, 0);
    const source = context.createOscillator();
    source.type = 'sine';
    source.frequency.setValueAtTime(accent ? 1320 : 880, start);
    source.frequency.exponentialRampToValueAtTime(accent ? 990 : 660, start + 0.04);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(accent ? 0.2 : 0.14, start + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.045);
    source.connect(gain);
    gain.connect(this._master);
    this._voice(source, gain);
    source.start(start);
    source.stop(start + 0.055);
    return true;
  }

  get listening() {
    return Boolean(this._mic);
  }

  async startMic(onPitch, onError) {
    this._pitchHandler = typeof onPitch === 'function' ? onPitch : null;
    this._errorHandler = typeof onError === 'function' ? onError : null;
    if (this._mic) return true;
    if (this._micPromise) return this._micPromise;
    const generation = ++this._micGeneration;
    const opening = Promise.resolve().then(() => this._openMic(generation));
    this._micPromise = opening;
    try {
      return await opening;
    } finally {
      if (this._micPromise === opening) this._micPromise = null;
    }
  }

  async _openMic(generation) {
    let stream = null;
    let source = null;
    let analyser = null;
    try {
      if (generation !== this._micGeneration) return false;
      if (!globalThis.isSecureContext || !globalThis.navigator?.mediaDevices?.getUserMedia) {
        throw new Error('MIC_UNAVAILABLE');
      }
      // Resume during the user's tap; no note is played and no stream exists yet.
      const context = await this.init();
      if (generation !== this._micGeneration) return false;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      if (generation !== this._micGeneration) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }
      source = context.createMediaStreamSource(stream);
      analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      // The analyser is deliberately never connected to speakers.
      const mic = { stream, source, analyser, frame: 0, lastFrame: -Infinity, buffer: new Float32Array(analyser.fftSize) };
      this._mic = mic;
      const tick = timestamp => {
        if (generation !== this._micGeneration || this._mic !== mic) return;
        if (timestamp - mic.lastFrame >= 70) {
          mic.lastFrame = timestamp;
          analyser.getFloatTimeDomainData(mic.buffer);
          let energy = 0;
          let sum = 0;
          for (const sample of mic.buffer) { energy += sample * sample; sum += sample; }
          const mean = sum / mic.buffer.length;
          const level = Math.sqrt(Math.max(0, energy / mic.buffer.length - mean * mean));
          const frequency = detectPitch(mic.buffer, context.sampleRate);
          const note = frequency > 0 ? frequencyToNote(frequency) : null;
          try { this._pitchHandler?.(note ? { ...note, level } : null); } catch (error) { console.error(error); }
        }
        if (generation === this._micGeneration && this._mic === mic) mic.frame = requestAnimationFrame(tick);
      };
      mic.frame = requestAnimationFrame(tick);
      for (const track of stream.getAudioTracks()) {
        track.addEventListener('ended', () => {
          if (this._mic === mic) {
            const notify = this._errorHandler;
            this.stopMic();
            try { notify?.('ไมโครโฟนหยุดทำงาน กดเปิดไมโครโฟนเพื่อลองอีกครั้งนะ'); } catch (error) { console.error(error); }
          }
        }, { once: true });
      }
      return true;
    } catch (error) {
      source?.disconnect();
      analyser?.disconnect();
      stream?.getTracks().forEach(track => track.stop());
      if (generation === this._micGeneration) {
        this._mic = null;
        const messages = {
          NotAllowedError: 'ยังไม่ได้รับอนุญาตให้ใช้ไมโครโฟน เปิดสิทธิ์ไมโครโฟนในเบราว์เซอร์ แล้วลองอีกครั้งนะ',
          SecurityError: 'เบราว์เซอร์บล็อกไมโครโฟน กรุณาเปิดเว็บไซต์ผ่าน HTTPS หรือ localhost แล้วอนุญาตไมโครโฟน',
          NotFoundError: 'ไม่พบไมโครโฟน ลองเชื่อมต่อหรือเลือกไมโครโฟนในเบราว์เซอร์ก่อนนะ',
          NotReadableError: 'เปิดไมโครโฟนไม่ได้ ลองปิดแอปอื่นที่ใช้ไมโครโฟน แล้วกดเปิดอีกครั้งนะ',
        };
        const message = error.message === 'MIC_UNAVAILABLE'
          ? 'ไมโครโฟนต้องเปิดผ่าน HTTPS หรือ localhost และใช้เบราว์เซอร์ที่รองรับการบันทึกเสียง'
          : messages[error.name] || 'เปิดไมโครโฟนไม่สำเร็จ ลองตรวจสอบอุปกรณ์และสิทธิ์ไมโครโฟน แล้วกดเปิดอีกครั้งนะ';
        try { this._errorHandler?.(message); } catch (callbackError) { console.error(callbackError); }
      }
      return false;
    }
  }

  stopMic() {
    this._micGeneration++;
    this._micPromise = null;
    const mic = this._mic;
    this._mic = null;
    this._pitchHandler = null;
    this._errorHandler = null;
    if (!mic) return;
    cancelAnimationFrame(mic.frame);
    mic.source.disconnect();
    mic.analyser.disconnect();
    mic.stream.getTracks().forEach(track => track.stop());
  }
}

// Nothing is initialized until an explicit playback or microphone action.
export const audio = new GuitarAudio();
