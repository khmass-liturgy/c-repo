const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const match = html.match(/function detectPitch\(buffer,sampleRate\) \{[\s\S]*?\n\}\nfunction updateTunerReading/);
if (!match) throw new Error('detectPitch function not found');

const source = match[0].replace(/\nfunction updateTunerReading$/, '');
const detectPitch = new Function(`${source}; return detectPitch;`)();

function sine(frequency, sampleRate = 48000, size = 2048) {
  return Array.from({ length: size }, (_, index) => 0.4 * Math.sin(2 * Math.PI * frequency * index / sampleRate));
}

for (const expected of [82.41, 110, 146.83, 196, 246.94, 329.63, 440]) {
  const actual = detectPitch(sine(expected), 48000);
  if (actual < 0 || Math.abs(actual - expected) > 3) {
    throw new Error(`Pitch detection failed: expected ${expected}, got ${actual}`);
  }
}

if (detectPitch(Array(2048).fill(0), 48000) !== -1) {
  throw new Error('Silence should not be detected as a note');
}

console.log('TUNER_PITCH_TEST_OK');
