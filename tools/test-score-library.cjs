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
const messages = [];
const container = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
const categoryName = { value: '', focus() {} };
const categoryModalClasses = new Set();
const categoryModal = { classList: {
  add: name => categoryModalClasses.add(name),
  remove: name => categoryModalClasses.delete(name),
  contains: name => categoryModalClasses.has(name)
} };
const elements = {
  scoreLibraryContainer: container,
  scoreLibraryCategoryName: categoryName,
  scoreLibraryCategoryModal: categoryModal,
  scoreLibraryCategoryModalTitle: { textContent: '' },
  scoreLibraryUploadStatus: { textContent: '' },
  scoreFileOpenBtn: { style: {} },
  scoreFileDeleteBtn: { style: {}, disabled: false },
  scoreFileMeta: { textContent: '' },
  pieceScoreLibrarySelect: { innerHTML: '', value: '', disabled: false, onchange: null },
  newPieceScoreLibrarySelect: { innerHTML: '', value: '', disabled: false, onchange: null },
  newPieceTitle: { value: '', classList: { add() {}, remove() {} } },
  newPieceComposer: { value: '' }, newPieceCat: { value: 'repertoire' }, newPieceStatus: { value: '암보' },
  addPieceModal: { classList: { add() {}, remove() {} } }
};
let idCounter = 0;
let loggedIn = { id: 'user-123' };
let confirmCallback = null;
const uploaded = [];
const deleted = [];
const context = vm.createContext({
  console, Date, Map, Set, Uint8Array,
  crypto: { randomUUID: () => `uuid-${++idCounter}` },
  document: { getElementById: id => elements[id] || null },
  CRepoSupabase: {
    user: () => loggedIn,
    uploadScore: async (path, file) => { uploaded.push({ path, file }); return { path }; },
    deleteScore: async path => { deleted.push(path); }
  },
  localStorage: { setItem: (key, value) => stored.set(key, value), getItem: key => stored.get(key) },
  scheduleCloudSave() {},
  showToast: message => messages.push(message),
  render() {},
  openConfirm: (message, callback) => { confirmCallback = callback; },
  state: { pieces: {}, concertPlans: [], concertArchives: [] }, editingPiece: null,
  categories: [], scoreLibrarySelectedCategoryId: 'all', editingScoreLibraryCategoryId: null,
  khcgScorePickerMode: false,
  PIECE_PRACTICE_NOTES: {}, DEFAULT_DURATIONS: {}, currentCatTab: 'all',
  getCatById: id => context.categories.find(category => category.id === id),
  closeAddModal() {}, render() {}
});
vm.runInContext([
  'practiceEscape', 'ensureScoreLibrary', 'newScoreObjectId', 'newScoreObjectPath', 'syncStoreSet', 'markLocalDirty', 'saveAll', 'formatScoreFileSize',
  'renderScoreLibrary', 'openScoreLibraryCategoryModal', 'closeScoreLibraryCategoryModal',
  'saveScoreLibraryCategory', 'deleteScoreLibraryCategory', 'moveScoreLibraryFile',
  'handleScoreLibraryUpload', 'deleteScoreLibraryFile', 'getPieceData', 'setScoreEditorState',
  'populateScoreLibraryPicker', 'scorePathIsArchived', 'scorePathIsReferenced',
  'attachLibraryScoreToPiece', 'removeEditingScore', 'populateNewPieceScorePicker', 'saveNewPiece'
].map(source).join('\n'), context);
const run = code => vm.runInContext(code, context);

async function main() {
  assert.equal(run('ensureScoreLibrary()'), true, 'Old records receive an empty library');
  assert.equal(run('state.scoreLibrary.files.length'), 0);

  run("openScoreLibraryCategoryModal(); document.getElementById('scoreLibraryCategoryName').value='바흐'; saveScoreLibraryCategory();");
  assert.equal(run('state.scoreLibrary.categories.length'), 1);
  const firstCategoryId = run('state.scoreLibrary.categories[0].id');
  assert.equal(run('scoreLibrarySelectedCategoryId'), firstCategoryId);

  run("document.getElementById('scoreLibraryCategoryName').value='바흐'; saveScoreLibraryCategory();");
  assert.equal(run('state.scoreLibrary.categories.length'), 1, 'Duplicate category names are rejected');
  assert.ok(messages.at(-1).includes('이미 있습니다'));

  run("openScoreLibraryCategoryModal(); document.getElementById('scoreLibraryCategoryName').value='연주회'; saveScoreLibraryCategory();");
  const secondCategoryId = run('state.scoreLibrary.categories[1].id');
  run(`openScoreLibraryCategoryModal('${firstCategoryId}'); document.getElementById('scoreLibraryCategoryName').value='바로크'; saveScoreLibraryCategory();`);
  assert.equal(run('state.scoreLibrary.categories[0].name'), '바로크');

  const pdf = { name: '바흐_무반주_1006.pdf', type: 'application/pdf', size: 1024 * 1024 };
  const event = { target: { files: [pdf], value: 'selected' } };
  run(`scoreLibrarySelectedCategoryId='${firstCategoryId}'`);
  await run('handleScoreLibraryUpload(uploadEvent)', context.uploadEvent = event);
  assert.equal(event.target.value, '', 'File selection resets after upload');
  assert.equal(uploaded.length, 1);
  assert.ok(uploaded[0].path.startsWith('user-123/library/'));
  assert.ok(!/[가-힣]/u.test(uploaded[0].path), 'Storage paths use ASCII-safe names');
  assert.ok(uploaded[0].path.endsWith('/score.pdf'));
  assert.equal(run('state.scoreLibrary.files.length'), 1);
  assert.equal(run('state.scoreLibrary.files[0].categoryId'), firstCategoryId);
  assert.equal(run('state.scoreLibrary.files[0].title'), '바흐_무반주_1006');
  assert.equal(run('state.scoreLibrary.files[0].fileName'), '바흐_무반주_1006.pdf');
  assert.ok(container.innerHTML.includes('바흐_무반주_1006'));
  assert.equal(run("newScoreObjectPath('user-123','library','image/jpeg')"), 'user-123/library/uuid-5/score.jpg');
  run('renderScoreLibrary()');
  assert.ok(container.innerHTML.includes('카테고리 이동'), 'Each score offers an explicit category move control');
  assert.ok(container.innerHTML.includes(`value="${secondCategoryId}"`), 'Move control lists other categories');

  const fileId = run('state.scoreLibrary.files[0].id');
  context.categories.push({ id: 'repertoire', name: '레파토리', icon: '🎼', pieces: [] });
  run('populateNewPieceScorePicker()');
  assert.ok(elements.newPieceScoreLibrarySelect.innerHTML.includes('바흐_무반주_1006'), 'New repertoire picker lists library scores');
  elements.newPieceScoreLibrarySelect.value = fileId;
  elements.newPieceScoreLibrarySelect.onchange();
  assert.equal(elements.newPieceTitle.value, '바흐_무반주_1006', 'Selecting a library score fills the repertoire title');
  elements.newPieceStatus.value = '연습중';
  run('saveNewPiece()');
  assert.equal(context.categories[0].pieces[0].title, '바흐_무반주_1006');
  assert.equal(run("state.pieces['바흐_무반주_1006'].scoreStoragePath"), uploaded[0].path, 'New repertoire entry reuses the library score path');
  assert.equal(run("state.pieces['바흐_무반주_1006'].scoreLibraryFileId"), fileId);
  delete context.state.pieces['바흐_무반주_1006'];
  context.categories[0].pieces.length = 0;

  run(`moveScoreLibraryFile('${fileId}','${secondCategoryId}')`);
  assert.equal(run('state.scoreLibrary.files[0].categoryId'), secondCategoryId);
  assert.equal(JSON.parse(stored.get('guitar_repertory_v4')).state.scoreLibrary.files[0].categoryId, secondCategoryId,
    'Category move is persisted');

  run(`deleteScoreLibraryCategory('${secondCategoryId}')`);
  assert.equal(confirmCallback, null, 'Categories with files cannot be deleted');
  assert.ok(messages.at(-1).includes('다른 카테고리'));

  run(`deleteScoreLibraryFile('${fileId}')`);
  await confirmCallback();
  assert.equal(deleted.length, 1, 'Deleting an unreferenced library entry removes its file');
  assert.equal(run('state.scoreLibrary.files.length'), 0);
  run(`deleteScoreLibraryCategory('${secondCategoryId}')`);
  await confirmCallback();
  assert.equal(run('state.scoreLibrary.categories.length'), 1);
  assert.ok(JSON.parse(stored.get('guitar_repertory_v4')).state.scoreLibrary);

  loggedIn = null;
  run(`scoreLibrarySelectedCategoryId='${firstCategoryId}'`);
  await run('handleScoreLibraryUpload(uploadEvent)', context.uploadEvent = { target: { files: [pdf], value: '' } });
  assert.equal(uploaded.length, 1, 'Unauthenticated uploads are blocked');
  loggedIn = { id: 'user-123' };
  const batchEvent = { target: { files: [pdf,
    { name: '악보.txt', type: 'text/plain', size: 100 },
    { name: '너무큼.pdf', type: 'application/pdf', size: 21 * 1024 * 1024 },
    { name: '두번째.png', type: 'image/png', size: 2048 }
  ], value: 'selected' } };
  await run('handleScoreLibraryUpload(uploadEvent)', context.uploadEvent = batchEvent);
  assert.equal(batchEvent.target.value, '', 'Multi-file selection resets after upload');
  assert.equal(uploaded.length, 3, 'Valid files upload while unsupported and oversized files are skipped');
  assert.equal(run('state.scoreLibrary.files.length'), 2);
  assert.ok(messages.at(-1).includes('2개 파일 저장 완료, 2개 실패'));

  run("state.pieces['테스트곡']={}; editingPiece='테스트곡'; populateScoreLibraryPicker(state.pieces['테스트곡'])");
  const sharedFileId = run("state.scoreLibrary.files.find(file=>file.fileName==='바흐_무반주_1006.pdf').id");
  assert.ok(elements.pieceScoreLibrarySelect.innerHTML.includes('바흐_무반주_1006.pdf'));
  await run(`attachLibraryScoreToPiece('${sharedFileId}')`);
  const sharedPath = run("state.pieces['테스트곡'].scoreStoragePath");
  assert.equal(sharedPath, run(`state.scoreLibrary.files.find(file=>file.id==='${sharedFileId}').path`));
  assert.equal(run("state.pieces['테스트곡'].scoreFileName"), '바흐_무반주_1006.pdf');
  assert.equal(run("state.pieces['테스트곡'].scoreLibraryFileId"), sharedFileId);
  assert.equal(deleted.length, 1, 'Attaching a library score does not copy or delete the file');

  run(`deleteScoreLibraryFile('${sharedFileId}')`);
  await confirmCallback();
  assert.equal(run('state.scoreLibrary.files.length'), 1);
  assert.equal(run("state.pieces['테스트곡'].scoreStoragePath"), sharedPath,
    'Removing a library listing keeps a score still used by a repertoire piece');
  assert.equal(deleted.length, 1);
  await run('removeEditingScore()');
  assert.equal(run("state.pieces['테스트곡'].scoreStoragePath"), undefined);
  assert.equal(deleted.length, 1, 'Unlinking a library score never deletes the stored file');
  console.log('SCORE_LIBRARY_TEST_OK: category CRUD, upload, organization, authentication, and persistence');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
