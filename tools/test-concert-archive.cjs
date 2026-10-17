const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
for (const [, script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(script);
function source(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  const body = html.slice(start);
  const firstLine = body.slice(0, body.indexOf('\n'));
  return firstLine.endsWith('}') ? firstLine : body.slice(0, body.indexOf('\n}') + 2);
}
const container = { innerHTML: '' };
const storage = new Map();
let scheduled = 0;
const context = vm.createContext({
  console, document: { getElementById: id => id === 'concertPlansContainer' ? container : null },
  localStorage: { setItem: (key, value) => storage.set(key, value), getItem: key => storage.get(key) },
  scheduleCloudSave: () => scheduled++, showToast() {}, render() {}, fillDefaultDurations() {}, seedPracticeNotes() {}
});
vm.runInContext(`let state, categories, cloudApplyingRemote=false;\n` + [
  'ensureConcertPlans', 'getPieceMeta', 'practiceEscape', 'parseDurationInput', 'formatDuration',
  'saveAll', 'loadAll', 'safeExternalUrl', 'validPracticePayload', 'applyCloudPayload', 'deletePiece',
  'newConcertPlan', 'getConcertPlan', 'concertSourcePieces', 'concertPieceData', 'concertMusicDuration',
  'concertCommentDuration', 'concertDuration', 'formatConcertDate', 'concertTimeSummary',
  'archiveConcertPlan', 'copyArchivedConcert', 'renderConcertArchives', 'renderConcertPlans'
].map(source).join('\n'), context);
const run = code => vm.runInContext(code, context);
run(`
categories=[{id:'classical',name:'클래식',pieces:[{title:'첫 곡',composer:'작곡가 A'},{title:'둘째 곡',composer:'작곡가 B'}]}];
state={pieces:{'첫 곡':{duration:180,memo:'곡 설명\\n둘째 줄',scoreLink:'https://example.com/score.pdf'},'둘째 곡':{duration:240}},concertPlans:[{
  id:'old',title:'가을 <연주회>',date:'2026-10-18',time:'19:30',venue:'성당 & 강당',comment:'환영합니다\\n감사합니다',
  pieces:['첫 곡',{title:'둘째 곡',comment:'<script>alert(1)</script>',commentDuration:'0:45'}]
}]};
ensureConcertPlans();
`);
assert.equal(run('state.concertArchives.length'), 0, 'Migrate older storage');
assert.equal(run('concertDuration(state.concertPlans[0])'), 465);
run("archiveConcertPlan('old'); archiveConcertPlan('old');");
assert.equal(run('state.concertPlans.length'), 0);
assert.equal(run('state.concertArchives.length'), 1, 'Repeated click cannot duplicate archive');
assert.equal(scheduled, 1, 'Archive schedules existing cloud save');
const archived = JSON.parse(run('JSON.stringify(state.concertArchives[0])'));
assert.equal(archived.pieces[0].savedPiece.memo, '곡 설명\n둘째 줄');
assert.equal(archived.pieces[0].savedPiece.scoreLink, 'https://example.com/score.pdf');
assert.equal(archived.pieces[1].commentDuration, 45);
assert.equal(archived.date, '2026-10-18');
assert.equal(archived.time, '19:30');
assert.equal(archived.venue, '성당 & 강당');
assert.ok(!Number.isNaN(Date.parse(archived.completedAt)));
assert.match(container.innerHTML, /완료된 연주회 · 1개/);
assert.ok(!container.innerHTML.includes('<script>alert(1)</script>'));
assert.ok(container.innerHTML.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
run("state.pieces['첫 곡'].duration=999; categories[0].pieces[0].composer='변경된 작곡가'; deletePiece('둘째 곡');");
assert.equal(run('concertDuration(state.concertArchives[0])'), 465, 'Archive time survives repertoire edit/delete');
assert.equal(run('JSON.stringify(state.concertArchives[0])'), JSON.stringify(archived));
run('state={}; categories=[]; loadAll();');
assert.equal(run('JSON.stringify(state.concertArchives[0])'), JSON.stringify(archived), 'Local reload retains archive');
run(`applyCloudPayload(JSON.parse(localStorage.getItem('guitar_repertory_v4')));`);
assert.equal(run('JSON.stringify(state.concertArchives[0])'), JSON.stringify(archived), 'Cloud payload apply retains archive');
run('copyArchivedConcert(0); ensureConcertPlans();');
assert.equal(run('state.concertPlans[0].pieces.length'), 2, 'Copy retains deleted repertoire song');
assert.equal(run('state.concertPlans[0].date'), '', 'New concert needs its own date');
assert.equal(run('state.concertPlans[0].time'), '');
assert.equal(run('state.concertPlans[0].completedAt'), undefined);
assert.notEqual(run('state.concertPlans[0].id'), archived.id);
assert.equal(run('concertDuration(state.concertPlans[0])'), 1284, 'Copied program uses current repertoire with snapshot fallback');
run("state.concertPlans[0].pieces[0].comment='새 멘트'; deletePiece('첫 곡'); ensureConcertPlans();");
assert.equal(run('state.concertPlans[0].pieces.length'), 2);
assert.equal(run('state.concertArchives[0].pieces[0].comment'), '', 'Copy does not mutate archive');
run('archiveConcertPlan(state.concertPlans[0].id);');
assert.equal(run('state.concertArchives.length'), 2);
assert.equal(run('concertDuration(state.concertArchives[0])'), 465, 'Re-archive survives missing repertoire');
run("state.concertPlans=[newConcertPlan()]; archiveConcertPlan(state.concertPlans[0].id);");
assert.equal(run('concertDuration(state.concertArchives[0])'), 0, 'Empty concert archives safely');
console.log('CONCERT_ARCHIVE_TEST_OK: legacy migration, snapshot isolation, local/cloud reload, rendering, copying');
