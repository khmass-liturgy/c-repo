const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const match = html.match(/function detectPitch\(buffer,sampleRate\) \{[\s\S]*?\n\}/);
if (!match) throw new Error('detectPitch function not found');

const source = match[0];
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

const assert = require('node:assert/strict');
function element() {
  const classes = new Set();
  return {textContent:'', style:{}, classList:{
    remove: name => classes.delete(name),
    toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
    contains: name => classes.has(name)
  }};
}
const elements = Object.fromEntries(['tunerNote','tunerFrequency','tunerNeedle','tunerStatus'].map(id => [id, element()]));
const strings = ['E2','A2','D3','G3','B3','E4'].map(note => Object.assign(element(), {dataset:{note}}));
const document = {getElementById:id=>elements[id], querySelectorAll:()=>strings};
const readingSource = html.match(/const TUNER_REFERENCE_HZ=\d+;[\s\S]*?(?=function analyseTunerFrame)/)[0];
const update = new Function('document', `${readingSource}; return updateTunerReading;`)(document);
update(440);
assert.equal(elements.tunerNote.textContent, 'A4');
assert.equal(elements.tunerNeedle.style.left, '50%');
assert.ok(elements.tunerNeedle.classList.contains('in-tune'));
for (const cents of [-6, 6]) {
  update(440 * 2 ** (cents / 1200));
  assert.ok(!elements.tunerNeedle.classList.contains('in-tune'));
}
update(442);
assert.ok(!elements.tunerNeedle.classList.contains('in-tune'));
for (const [index, midi] of [40,45,50,55,59,64].entries()) {
  update(440 * 2 ** ((midi - 69) / 12));
  assert.equal(elements.tunerNote.textContent, strings[index].dataset.note);
  assert.ok(elements.tunerNeedle.classList.contains('in-tune'));
  assert.ok(strings[index].classList.contains('active'));
}
update(-1);
assert.ok(!elements.tunerNeedle.classList.contains('in-tune'));
console.log('TUNER_440_COLOR_STATE_OK');
