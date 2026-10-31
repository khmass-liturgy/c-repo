const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
for (const [, script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(script);
function source(name) {
  let start = html.indexOf(`async function ${name}(`);
  if (start < 0) start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  const body = html.slice(start);
  const firstLine = body.slice(0, body.indexOf('\n'));
  return firstLine.endsWith('}') ? firstLine : body.slice(0, body.indexOf('\n}') + 2);
}

const stored = new Map();
const toasts = [];
const statuses = [];
let timers = [];
let pickValue = '';
let confirmCallback = null;
const server = { row: null, saves: 0, loads: 0, failSave: false, onLoad: null };
const elements = { cloudBackupSelect: { value: '' } };
const clone = value => JSON.parse(JSON.stringify(value));

const context = vm.createContext({
  console, Date, Map, Set, JSON, Object, Array, Error, Promise,
  localStorage: {
    getItem: key => (stored.has(key) ? stored.get(key) : null),
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: key => stored.delete(key)
  },
  document: { getElementById: id => id.startsWith('concertPiecePick_') ? { value: pickValue } : elements[id] || null },
  setTimeout: fn => { timers.push({ fn, cancelled: false }); return timers.length - 1; },
  clearTimeout: id => { if (timers[id]) timers[id].cancelled = true; },
  CRepoSupabase: {
    configured: () => true,
    async load() {
      server.loads++;
      const row = server.row && clone(server.row);
      if (server.onLoad) await server.onLoad();
      return row;
    },
    async save(payload) {
      if (server.failSave) throw new Error('network down');
      server.saves++;
      server.row = { payload: clone(payload), updated_at: `2026-10-31T00:00:0${server.saves}Z` };
      return { updated_at: server.row.updated_at };
    },
    async signOut() {}
  },
  showToast: message => toasts.push(message),
  setSyncStatus: (status, message) => statuses.push([status, message]),
  updateCloudModal() {}, cloudStatus() {}, render() {}, renderConcertPlans() {}, closeCloudModal() {},
  fillDefaultDurations() {}, seedPracticeNotes() {}, openRequestedScore: async () => {},
  openConfirm: (message, callback) => { confirmCallback = callback; },
  requestedScorePath: '', parseDurationInput: () => null
});
vm.runInContext(`let categories, state, cloudSaveTimer=null, cloudSyncing=false, cloudApplyingRemote=false,
  cloudUser=null, cloudLoadedUserId=null, cloudReadyUserId=null;\n` + [
  'validPracticePayload', 'syncStoreGet', 'syncStoreSet', 'markLocalDirty', 'localMayHaveUnsyncedChanges', 'cloudSnapshot',
  'readSyncBase', 'markCloudSynced', 'syncEqual', 'isSyncObject', 'syncItemKeys', 'mergeSyncArray', 'mergeSyncValue',
  'listLocalBackups', 'backupLocalData', 'planCloudSync', 'pushLocalToCloud', 'syncCloudAccount', 'saveToCloud',
  'scheduleCloudSave', 'handleCloudAuthChange', 'signOutCloud', 'applyCloudPayload', 'ensureScoreLibrary',
  'ensureConcertPlans', 'saveAll', 'newConcertPlan', 'getConcertPlan', 'createConcertPlan', 'updateConcertPlan',
  'addConcertPiece', 'practiceEscape', 'backupLabel', 'renderCloudBackups', 'restoreLocalBackup'
].map(source).join('\n'), context);
const run = code => vm.runInContext(code, context);
const local = () => JSON.parse(run('cloudSnapshot()'));
const plans = () => local().state.concertPlans;
const dirtyFlag = () => stored.get('guitar_local_dirty');
const backups = () => JSON.parse(stored.get('guitar_repertory_backups') || '[]');
async function flushTimers() {
  const pending = timers.filter(timer => !timer.cancelled);
  timers = [];
  for (const timer of pending) await timer.fn();
}

const piece = duration => ({ status: '완성', performances: [], memo: '', lastPlayed: null, duration });
const plan = (id, title, titles = [], extra = {}) => ({
  id, title, date: '', time: '', venue: '', comment: '',
  pieces: titles.map(item => ({ title: item, comment: '', commentDuration: null })), ...extra
});
const payload = (concertPlans = []) => ({
  categories: [{ id: 'classical', name: '클래식', icon: '🎸', pieces: [{ title: 'A곡', composer: 'a' }, { title: 'B곡', composer: 'b' }] }],
  state: { pieces: { 'A곡': piece(180), 'B곡': piece(240) }, collapsed: {}, concertPlans, concertArchives: [], scoreLibrary: { categories: [], files: [] } }
});
function setLocal(data, dirty) {
  context.__data = clone(data);
  run('categories=__data.categories; state=__data.state;');
  if (dirty === undefined) stored.delete('guitar_local_dirty'); else stored.set('guitar_local_dirty', dirty ? '1' : '0');
}
function reset() {
  stored.clear(); toasts.length = 0; statuses.length = 0; timers = [];
  Object.assign(server, { row: null, saves: 0, loads: 0, failSave: false, onLoad: null });
  run('cloudSaveTimer=null; cloudSyncing=false; cloudApplyingRemote=false; cloudUser=null; cloudLoadedUserId=null; cloudReadyUserId=null;');
}
const handleLogin = id => run(`handleCloudAuthChange({event:'SIGNED_IN',user:{id:'${id}',email:'player@example.com'}})`);

async function main() {
  /* ── 병합 규칙 ── */
  const mergeJson = (base, a, b) => JSON.parse(run(`JSON.stringify(mergeSyncValue(${JSON.stringify(base)},${JSON.stringify(a)},${JSON.stringify(b)}))`));
  assert.deepEqual(mergeJson(undefined, { items: [{ id: 'a', v: 1 }] }, { items: [{ id: 'b', v: 2 }] }),
    { items: [{ id: 'a', v: 1 }, { id: 'b', v: 2 }] }, 'Without a base each side keeps what only it has');
  assert.deepEqual(mergeJson({ title: '원본', memo: '' }, { title: '내 제목', memo: '' }, { title: '원본', memo: '서버 메모' }),
    { title: '내 제목', memo: '서버 메모' }, 'Different fields from both sides are both kept');
  assert.deepEqual(mergeJson({ v: 1 }, { v: 2 }, { v: 3 }), { v: 2 }, 'Same field edited on both sides keeps this device');
  const baseList = { list: [{ id: 'a' }, { id: 'b' }, { id: 'c', n: 1 }] };
  assert.deepEqual(mergeJson(baseList, { list: [{ id: 'a' }, { id: 'c', n: 1 }] }, { list: [{ id: 'a' }, { id: 'b' }, { id: 'c', n: 1 }, { id: 'd' }] }),
    { list: [{ id: 'a' }, { id: 'c', n: 1 }, { id: 'd' }] }, 'Local delete stays deleted, remote add is kept');
  assert.deepEqual(mergeJson(baseList, { list: [{ id: 'a' }, { id: 'b' }] }, { list: [{ id: 'a' }, { id: 'b' }, { id: 'c', n: 2 }] }),
    { list: [{ id: 'a' }, { id: 'b' }, { id: 'c', n: 2 }] }, 'Remote edit beats a local delete');
  assert.deepEqual(mergeJson({ performances: [{ date: '1' }] }, { performances: [{ date: '1' }, { date: '2' }] }, { performances: [{ date: '1' }, { date: '3' }] }),
    { performances: [{ date: '1' }, { date: '2' }, { date: '3' }] }, 'Items without id are matched by content');
  assert.equal(run(`syncEqual({a:1,b:{c:[1,2]}},{b:{c:[1,2]},a:1})`), true, 'Key order does not matter (jsonb reorders keys)');
  assert.equal(run(`syncEqual({a:1},{a:1,b:undefined})`), false);

  /* ── 사용자가 겪은 문제: 로그인 전에 입력한 연주회 준비가 로그인하면 사라짐 ── */
  reset();
  server.row = { payload: payload([plan('server_plan', '서버 연주회', ['A곡'])]), updated_at: '2026-10-30T00:00:00Z' };
  setLocal(payload(), false); // 이 기기는 아직 계정에 연결한 적 없음
  run('createConcertPlan();');
  const offlineId = plans()[0].id;
  run(`updateConcertPlan('${offlineId}','title','가을 정기연주회'); updateConcertPlan('${offlineId}','comment','환영합니다');`);
  pickValue = 'B곡';
  run(`addConcertPiece('${offlineId}');`);
  assert.equal(dirtyFlag(), '1', 'Offline edits are flagged as not yet on the server');
  assert.equal(server.saves, 0, 'Nothing is uploaded while signed out');

  await handleLogin('user-1');
  assert.deepEqual(plans().map(item => item.id).sort(), [offlineId, 'server_plan'].sort(), 'Offline plan survives login and server plan is kept');
  const kept = plans().find(item => item.id === offlineId);
  assert.equal(kept.title, '가을 정기연주회');
  assert.equal(kept.comment, '환영합니다');
  assert.deepEqual(kept.pieces.map(item => item.title), ['B곡']);
  assert.deepEqual(server.row.payload.state.concertPlans.map(item => item.id).sort(), [offlineId, 'server_plan'].sort(), 'Merged data is saved to the account');
  assert.equal(dirtyFlag(), '0');
  assert.equal(run('cloudReadyUserId'), 'user-1');
  assert.deepEqual(backups().map(item => item.reason).sort(), ['before-merge', 'remote-before-merge']);
  assert.ok(toasts.some(message => message.includes('합쳤습니다')));
  assert.equal(JSON.parse(stored.get('guitar_supabase_base')).state.concertPlans.length, 2, 'Merged state becomes the next merge base');

  /* ── 로그아웃 후 입력 + 다른 기기 변경: 양쪽 모두 유지, 삭제는 그대로 ── */
  await run('signOutCloud()');
  assert.equal(run('cloudReadyUserId'), null);
  run(`updateConcertPlan('${offlineId}','venue','성당 대성전'); state.concertPlans=state.concertPlans.filter(item=>item.id!=='server_plan'); saveAll();`);
  const remoteNow = clone(server.row.payload);
  remoteNow.state.concertPlans.find(item => item.id === offlineId).date = '2026-11-20'; // 다른 기기에서 날짜 입력
  remoteNow.state.concertPlans.push(plan('phone_plan', '휴대폰에서 만든 연주회', ['A곡']));
  server.row = { payload: remoteNow, updated_at: '2026-10-31T09:00:00Z' };
  await handleLogin('user-1');
  const merged = plans();
  assert.equal(merged.find(item => item.id === offlineId).venue, '성당 대성전', 'This device edit kept');
  assert.equal(merged.find(item => item.id === offlineId).date, '2026-11-20', 'Other device edit kept');
  assert.ok(merged.some(item => item.id === 'phone_plan'), 'Plan created on another device kept');
  assert.ok(!merged.some(item => item.id === 'server_plan'), 'Plan deleted on this device is not resurrected');
  assert.deepEqual(server.row.payload.state.concertPlans.map(item => item.id).sort(), merged.map(item => item.id).sort());

  /* ── 변경 없는 기기는 서버 데이터를 그대로 받는다(삭제한 기본 곡이 되살아나지 않음) ── */
  reset();
  const serverData = payload([plan('p1', '서버 연주회')]);
  delete serverData.state.pieces['B곡'];
  serverData.categories[0].pieces = [{ title: 'A곡', composer: 'a' }];
  server.row = { payload: serverData, updated_at: '2026-10-30T00:00:00Z' };
  setLocal(payload(), false);
  await handleLogin('user-1');
  assert.deepEqual(Object.keys(local().state.pieces), ['A곡'], 'Untouched device adopts the account data as is');
  assert.equal(server.saves, 0, 'Nothing needs to be uploaded');
  assert.equal(backups().length, 0);

  /* ── 이전 버전에서 쓰던 사본(표시 없음)도 보호한다 ── */
  reset();
  server.row = { payload: payload([plan('server_plan', '서버 연주회')]), updated_at: '2026-10-30T00:00:00Z' };
  setLocal(payload([plan('legacy_plan', '이전 버전에서 입력')]), undefined);
  await handleLogin('user-1');
  assert.deepEqual(plans().map(item => item.id).sort(), ['legacy_plan', 'server_plan']);

  /* ── 다른 계정으로 쓰던 사본은 합치지 않고 백업만 남긴다 ── */
  reset();
  server.row = { payload: payload([plan('b_plan', 'B 계정 연주회')]), updated_at: '2026-10-30T00:00:00Z' };
  setLocal(payload([plan('a_plan', 'A 계정의 비공개 연주회')]), true);
  stored.set('guitar_supabase_owner', 'user-A');
  await handleLogin('user-B');
  assert.deepEqual(plans().map(item => item.id), ['b_plan'], 'Another account data is not merged into this account');
  assert.ok(!JSON.stringify(server.row.payload).includes('a_plan'));
  assert.deepEqual(backups().map(item => item.reason), ['before-account-switch']);
  assert.equal(backups()[0].payload.state.concertPlans[0].id, 'a_plan', 'But it stays recoverable');

  /* ── 불러오는 도중(네트워크 대기 중)에 입력한 내용 ── */
  reset();
  server.row = { payload: payload([plan('server_plan', '서버 연주회')]), updated_at: '2026-10-30T00:00:00Z' };
  setLocal(server.row.payload, false);
  server.onLoad = async () => { run('createConcertPlan();'); server.onLoad = null; };
  await handleLogin('user-1');
  assert.equal(plans().length, 2, 'Plan typed while the account data was loading is kept');
  assert.equal(server.row.payload.state.concertPlans.length, 2, 'and uploaded');

  /* ── 저장하는 도중에 입력한 내용은 다음 저장 대상으로 남는다 ── */
  reset();
  server.row = { payload: payload(), updated_at: '2026-10-30T00:00:00Z' };
  setLocal(payload(), false);
  await handleLogin('user-1');
  const originalSave = context.CRepoSupabase.save;
  context.CRepoSupabase.save = async data => {
    const result = await originalSave(data);
    run('createConcertPlan();');
    await flushTimers(); // 저장이 진행 중일 때 저장 타이머가 울려도 입력이 버려지지 않아야 한다
    return result;
  };
  run('createConcertPlan();'); // 첫 입력
  await flushTimers();
  context.CRepoSupabase.save = originalSave;
  assert.equal(dirtyFlag(), '1', 'Edit made during the upload is still marked unsynced');
  await flushTimers();
  assert.equal(server.row.payload.state.concertPlans.length, 2, 'The retry uploads the edit made during the first upload');
  assert.equal(dirtyFlag(), '0');

  /* ── 저장 실패/오프라인: 변경이 미반영으로 남아 다음 로그인 때 합쳐진다 ── */
  reset();
  server.row = { payload: payload(), updated_at: '2026-10-30T00:00:00Z' };
  setLocal(payload(), false);
  await handleLogin('user-1');
  server.failSave = true;
  run('createConcertPlan();');
  await flushTimers();
  assert.equal(dirtyFlag(), '1', 'Failed upload keeps the unsynced mark');
  assert.ok(statuses.some(([status]) => status === 'error'));
  server.failSave = false;
  await run('signOutCloud()');
  await handleLogin('user-1');
  assert.equal(server.row.payload.state.concertPlans.length, 1, 'Offline plan reaches the account on next login');

  /* ── 첫 불러오기에 실패한 뒤에는 서버를 오래된 사본으로 덮어쓰지 않는다 ── */
  reset();
  server.row = { payload: payload([plan('newer_plan', '다른 기기에서 만든 연주회')]), updated_at: '2026-10-30T00:00:00Z' };
  setLocal(payload(), false); // 이 기기는 오래된 사본
  run(`cloudUser={id:'user-1'}; cloudReadyUserId=null;`); // 첫 동기화가 실패해 확인되지 않은 상태
  run('createConcertPlan();');
  const loadsBefore = server.loads;
  await flushTimers();
  assert.ok(server.loads > loadsBefore, 'Saving first checks the account data');
  assert.ok(server.row.payload.state.concertPlans.some(item => item.id === 'newer_plan'), 'Account data is not overwritten by the stale copy');
  assert.equal(server.row.payload.state.concertPlans.length, 2, 'while the new plan is merged in');

  /* ── 백업 보관과 복원 ── */
  reset();
  setLocal(payload([plan('x1', '백업 대상')]), true);
  run(`backupLocalData('before-merge'); backupLocalData('before-merge');`);
  assert.equal(backups().length, 1, 'Identical backups are not duplicated');
  for (let i = 0; i < 8; i++) run(`backupLocalData('before-merge', ${JSON.stringify(payload([plan('n' + i, '연주회 ' + i)]))})`);
  assert.equal(backups().length, 6, 'Only the latest backups are kept');
  assert.equal(backups()[0].payload.state.concertPlans[0].id, 'n7', 'Newest first');

  reset();
  const lost = payload([plan('lost_plan', '복원할 연주회', ['A곡'])]);
  run(`backupLocalData('before-merge', ${JSON.stringify(lost)});`);
  setLocal(payload(), false);
  run('renderCloudBackups();');
  elements.cloudBackupSelect.value = backups()[0].at;
  run('restoreLocalBackup();');
  assert.ok(confirmCallback, 'Restore asks for confirmation first');
  assert.equal(plans().length, 0);
  confirmCallback();
  assert.deepEqual(plans().map(item => item.id), ['lost_plan'], 'Backup is restored');
  assert.equal(dirtyFlag(), '1', 'Restored data is treated as unsynced');
  assert.ok(backups().some(item => item.reason === 'before-restore'), 'Data before the restore is backed up too');
  assert.match(run('backupLabel(listLocalBackups()[0])'), /^복원 직전 데이터 · .+ · 연주회 0개$/, 'Newest backup is the pre-restore copy');
  assert.match(run('backupLabel(listLocalBackups().find(item=>item.reason===\'before-merge\'))'), /^합치기 전 이 기기 데이터 · .+ · 연주회 1개$/);

  console.log('CLOUD_SYNC_TEST_OK: offline edits merge on login, deletions, accounts, races, failures, backups');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
