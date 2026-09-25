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
const elements = Object.fromEntries(['tunerNote','tunerFrequency','tunerNeedle','tunerStatus','tunerReference','tunerTarget'].map(id => [id, element()]));
const strings = ['E2','A2','D3','G3','B3','E4'].map(note => Object.assign(element(), {dataset:{note}}));
const document = {getElementById:id=>elements[id], querySelectorAll:()=>strings};
const saved = new Map();
const localStorage = {getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
const readingSource = html.match(/let tunerReferenceHz=\d+;[\s\S]*?(?=function analyseTunerFrame)/)[0];
function createTuner() {
  return new Function('document','localStorage', `${readingSource}; return {update:updateTunerReading,set:setTunerReference,restore:restoreTunerReference};`)(document,localStorage);
}
const tuner=createTuner();
const update=tuner.update;
tuner.restore();
assert.equal(elements.tunerReference.value,'442');
update(442);
assert.equal(elements.tunerNote.textContent, 'A4');
assert.equal(elements.tunerNeedle.style.left, '50%');
assert.ok(elements.tunerNeedle.classList.contains('in-tune'));
// Reproduce the user's mismatch, then fix it without requiring a new sample.
tuner.set(440);
assert.ok(elements.tunerFrequency.textContent.includes('+7.9 cent'));
assert.ok(!elements.tunerNeedle.classList.contains('in-tune'));
tuner.set(442);
assert.ok(elements.tunerNeedle.classList.contains('in-tune'));
for (const reference of [440,442]) {
  tuner.set(reference);
  for (const cents of [-6, 6]) {
    update(reference * 2 ** (cents / 1200));
    assert.ok(!elements.tunerNeedle.classList.contains('in-tune'));
  }
  for (const [index, midi] of [40,45,50,55,59,64].entries()) {
    const expected=reference * 2 ** ((midi - 69) / 12);
    update(expected);
    assert.equal(elements.tunerNote.textContent, strings[index].dataset.note);
    assert.ok(elements.tunerNeedle.classList.contains('in-tune'));
    assert.ok(strings[index].classList.contains('active'));
    assert.ok(elements.tunerTarget.textContent.includes(expected.toFixed(2)));
  }
}
tuner.set(440);
createTuner().restore();
assert.equal(elements.tunerReference.value,'440');
tuner.set(442);
createTuner().restore();
assert.equal(elements.tunerReference.value,'442');
tuner.set(0);
assert.equal(elements.tunerReference.value,'442');
update(-1);
assert.ok(!elements.tunerNeedle.classList.contains('in-tune'));
console.log('TUNER_CALIBRATION_COLOR_STORAGE_OK');

// Sub-Hz errors can exceed several cents on low strings: assert musical accuracy.
let worstError=0;
for(const rate of [44100,48000,96000]) for(const reference of [440,442]) {
  for(const midi of [40,45,50,55,59,64,69]) for(const offset of [-12,0,12]) {
    const expected=reference * 2 ** ((midi-69)/12+offset/1200);
    const measured=detectPitch(sine(expected,.01,rate),rate);
    const cents=1200*Math.log2(measured/expected);
    assert.ok(Number.isFinite(cents)&&Math.abs(cents)<.5, `Pitch error: ${cents} cents at ${expected} Hz / ${rate}`);
    worstError=Math.max(worstError,Math.abs(cents));
  }
}
console.log(`TUNER_PRECISION_OK max_error=${worstError.toFixed(3)}_cents`);
