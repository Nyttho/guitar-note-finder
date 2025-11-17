// Petit module de détection de hauteur (pitch) basé sur l'autocorrélation
// Fournit : createPitchDetector(sampleRate) -> (bufferFloat32) => frequency|null

function autoCorrelate(buffer, sampleRate) {
  const SIZE = buffer.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null; // signal trop faible

  const correlations = new Array(SIZE).fill(0);
  for (let tau = 0; tau < SIZE; tau++) {
    let sum = 0;
    for (let i = 0; i < SIZE - tau; i++) {
      sum += buffer[i] * buffer[i + tau];
    }
    correlations[tau] = sum;
  }

  let d = 0;
  while (d < SIZE - 1 && correlations[d] > correlations[d + 1]) d++;

  let maxPos = -1;
  let maxVal = -Infinity;
  for (let i = d; i < SIZE; i++) {
    if (correlations[i] > maxVal) {
      maxVal = correlations[i];
      maxPos = i;
    }
  }

  if (maxVal <= 0) return null;
  const T0 = maxPos;
  if (!T0) return null;

  // Parabola interpolation
  const x1 = correlations[T0 - 1] || 0;
  const x2 = correlations[T0];
  const x3 = correlations[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  let shift = 0;
  if (a !== 0) shift = -b / (2 * a);

  const realT0 = T0 + shift;
  const frequency = sampleRate / realT0;
  if (!isFinite(frequency) || frequency > 5000 || frequency < 20) return null;

  return frequency;
}

function createPitchDetector(sampleRate) {
  return function detect(buffer) {
    return autoCorrelate(buffer, sampleRate);
  };
}

const ENHARMONICS = {
  C: ["C"],
  "C#": ["C#", "Db"],
  Db: ["C#", "Db"],
  D: ["D"],
  "D#": ["D#", "Eb"],
  Eb: ["D#", "Eb"],
  E: ["E"],
  F: ["F"],
  "F#": ["F#", "Gb"],
  Gb: ["F#", "Gb"],
  G: ["G"],
  "G#": ["G#", "Ab"],
  Ab: ["G#", "Ab"],
  A: ["A"],
  "A#": ["A#", "Bb"],
  Bb: ["A#", "Bb"],
  B: ["B"],
};

function freqToNoteData(frequency, referenceA = 440) {
  const noteNum = 12 * Math.log2(frequency / referenceA) + 69;
  const rounded = Math.round(noteNum);
  const cents = Math.round((noteNum - rounded) * 100);
  const noteIndex = (rounded + 120) % 12; // sécurité
  const octave = Math.floor(rounded / 12) - 1;

  const sharpNotes = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];

  return {
    name: `${sharpNotes[noteIndex]}${octave}`,
    simpleName: sharpNotes[noteIndex],
    enharmonics: ENHARMONICS[sharpNotes[noteIndex]] || [sharpNotes[noteIndex]],
    octave,
    cents,
    midi: rounded,
  };
}

function areNotesEquivalent(note1, note2) {
  // normalize: remove octave digits
  const n1 = note1.replace(/\d+/g, "");
  const n2 = note2.replace(/\d+/g, "");

  for (const key in ENHARMONICS) {
    if (ENHARMONICS[key].includes(n1) && ENHARMONICS[key].includes(n2))
      return true;
  }
  return false;
}

function getEnharmonicNames(simple) {
  // return array of enharmonic names for given simple name
  return ENHARMONICS[simple]
    ? Array.from(new Set(ENHARMONICS[simple]))
    : [simple];
}

export {
  createPitchDetector,
  freqToNoteData,
  areNotesEquivalent,
  getEnharmonicNames,
};
