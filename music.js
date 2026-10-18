/** Shared music theory and microphone pitch analysis. No browser dependencies. */
export const NOTES = Object.freeze(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);

// String indices follow a chord diagram: the thin, high E string comes first.
export const STRINGS = Object.freeze([
  { name: 'E', octave: 4, midi: 64, number: 1 },
  { name: 'B', octave: 3, midi: 59, number: 2 },
  { name: 'G', octave: 3, midi: 55, number: 3 },
  { name: 'D', octave: 3, midi: 50, number: 4 },
  { name: 'A', octave: 2, midi: 45, number: 5 },
  { name: 'E', octave: 2, midi: 40, number: 6 },
].map(Object.freeze));

export function frequencyForMidi(midi) {
  if (!Number.isFinite(midi)) throw new TypeError('MIDI note must be a finite number');
  return 440 * 2 ** ((midi - 69) / 12);
}

export function midiToNote(midi) {
  if (!Number.isFinite(midi)) throw new TypeError('MIDI note must be a finite number');
  const rounded = Math.round(midi);
  return {
    name: NOTES[((rounded % 12) + 12) % 12],
    octave: Math.floor(rounded / 12) - 1,
    midi: rounded,
    frequency: frequencyForMidi(rounded),
  };
}

export function noteAt(stringIndex, fret) {
  if (!Number.isInteger(stringIndex) || stringIndex < 0 || stringIndex >= STRINGS.length) {
    throw new RangeError('String index must be between 0 and 5');
  }
  if (!Number.isInteger(fret) || fret < 0) throw new RangeError('Fret must be a non-negative integer');
  return midiToNote(STRINGS[stringIndex].midi + fret);
}

export function frequencyToNote(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  const exactMidi = 69 + 12 * Math.log2(frequency / 440);
  const note = midiToNote(exactMidi);
  return { ...note, cents: (exactMidi - note.midi) * 100, frequency };
}

/**
 * YIN-style cumulative normalized difference, with sub-sample interpolation.
 * Guitar range: 65–1600 Hz. Returns -1 for quiet, noisy, or insufficient input.
 * A 4096-sample analyser frame works well at both 44.1 and 48 kHz.
 */
export function detectPitch(samples, sampleRate) {
  if (!samples || samples.length < 512 || !Number.isFinite(sampleRate) || sampleRate <= 0) return -1;
  const length = samples.length;
  let mean = 0;
  for (let i = 0; i < length; i++) {
    if (!Number.isFinite(samples[i])) return -1;
    mean += samples[i];
  }
  mean /= length;
  let energy = 0;
  for (let i = 0; i < length; i++) energy += (samples[i] - mean) ** 2;
  if (Math.sqrt(energy / length) < 0.0025) return -1;

  const window = Math.floor(length / 2);
  const minLag = Math.max(2, Math.floor(sampleRate / 1600));
  const maxLag = Math.min(window - 2, Math.ceil(sampleRate / 65));
  if (maxLag <= minLag + 2) return -1;
  const difference = new Float64Array(maxLag + 1);
  let accumulated = 0;
  difference[0] = 1;
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < window; i++) {
      const delta = samples[i] - samples[i + lag];
      sum += delta * delta;
    }
    accumulated += sum;
    difference[lag] = accumulated > 0 ? sum * lag / accumulated : 1;
  }

  let candidate = -1;
  for (let lag = minLag; lag < maxLag; lag++) {
    if (difference[lag] < 0.16) {
      while (lag + 1 <= maxLag && difference[lag + 1] < difference[lag]) lag++;
      candidate = lag;
      break;
    }
  }
  if (candidate < 0) return -1;

  // A very prominent second/third harmonic can create an early local minimum.
  // Prefer a multiple only when it explains substantially more of the signal;
  // this avoids choosing subharmonics of clean sine-wave reference tones.
  const originalLag = candidate;
  if (difference[candidate] > 0.025) {
    for (let multiple = 2; multiple <= 4; multiple++) {
      const center = originalLag * multiple;
      if (center > maxLag) break;
      const radius = Math.max(2, Math.round(multiple * 1.5));
      let better = center;
      for (let lag = Math.max(minLag, center - radius); lag <= Math.min(maxLag, center + radius); lag++) {
        if (difference[lag] < difference[better]) better = lag;
      }
      if (difference[better] < difference[candidate] * 0.4 && difference[candidate] - difference[better] > 0.02) {
        candidate = better;
      }
    }
  }

  let refinedLag = candidate;
  if (candidate > 1 && candidate < maxLag) {
    const left = difference[candidate - 1];
    const center = difference[candidate];
    const right = difference[candidate + 1];
    const denominator = left - 2 * center + right;
    if (Math.abs(denominator) > 1e-12) {
      refinedLag += Math.max(-1, Math.min(1, (left - right) / (2 * denominator)));
    }
  }
  const frequency = sampleRate / refinedLag;
  return frequency >= 65 && frequency <= 1600 ? frequency : -1;
}
