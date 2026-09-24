const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const match = html.match(/function detectPitch\(buffer,sampleRate\) \{[\s\S]*?\n\}\nfunction updateTunerReading/);
if (!match) throw new Error('detectPitch function not found');

const source = match[0].replace(/\nfunction updateTunerReading$/, '');
const detectPitch = new Function(`${source}; return detectPitch;`)();

function sine(frequency, amplitude = 0.4, sampleRate = 48000, size = 4096) {
  return Array.from({ length: size }, (_, index) => amplitude * Math.sin(2 * Math.PI * frequency * index / sampleRate));
}

for (const expected of [82.41, 110, 146.83, 196, 246.94, 329.63, 440]) {
  const actual = detectPitch(sine(expected), 48000);
  if (actual < 0 || Math.abs(actual - expected) > 3) {
    throw new Error(`Pitch detection failed: expected ${expected}, got ${actual}`);
  }
}

for (const expected of [82.41, 110, 329.63]) {
  const actual = detectPitch(sine(expected, 0.002), 48000);
  if (actual < 0 || Math.abs(actual - expected) > 3) {
    throw new Error(`Quiet pitch detection failed: expected ${expected}, got ${actual}`);
  }
}

if (detectPitch(Array(2048).fill(0), 48000) !== -1) {
  throw new Error('Silence should not be detected as a note');
}

let seed = 123456789;
const quietNoise = Array.from({ length: 4096 }, () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return ((seed / 0xffffffff) * 2 - 1) * 0.002;
});
if (detectPitch(quietNoise, 48000) !== -1) {
  throw new Error('Quiet background noise should not be detected as a note');
}

console.log('TUNER_PITCH_TEST_OK');
