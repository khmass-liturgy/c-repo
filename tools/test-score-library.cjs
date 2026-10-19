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
  scoreLibraryUploadStatus: { textContent: '' }
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
  state: { pieces: {}, concertPlans: [], concertArchives: [] },
  categories: [], scoreLibrarySelectedCategoryId: 'all', editingScoreLibraryCategoryId: null
});
vm.runInContext([
  'practiceEscape', 'ensureScoreLibrary', 'newScoreObjectId', 'saveAll', 'formatScoreFileSize',
  'renderScoreLibrary', 'openScoreLibraryCategoryModal', 'closeScoreLibraryCategoryModal',
  'saveScoreLibraryCategory', 'deleteScoreLibraryCategory', 'moveScoreLibraryFile',
  'handleScoreLibraryUpload', 'deleteScoreLibraryFile'
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

  const pdf = { name: 'BWV 1006.pdf', type: 'application/pdf', size: 1024 * 1024 };
  const event = { target: { files: [pdf], value: 'selected' } };
  run(`scoreLibrarySelectedCategoryId='${firstCategoryId}'`);
  await run('handleScoreLibraryUpload(uploadEvent)', context.uploadEvent = event);
  assert.equal(event.target.value, '', 'File selection resets after upload');
  assert.equal(uploaded.length, 1);
  assert.ok(uploaded[0].path.startsWith('user-123/library/'));
  assert.equal(run('state.scoreLibrary.files.length'), 1);
  assert.equal(run('state.scoreLibrary.files[0].categoryId'), firstCategoryId);
  assert.equal(run('state.scoreLibrary.files[0].title'), 'BWV 1006');
  assert.ok(container.innerHTML.includes('BWV 1006'));

  const fileId = run('state.scoreLibrary.files[0].id');
  run(`moveScoreLibraryFile('${fileId}','${secondCategoryId}')`);
  assert.equal(run('state.scoreLibrary.files[0].categoryId'), secondCategoryId);

  run(`deleteScoreLibraryCategory('${secondCategoryId}')`);
  assert.equal(confirmCallback, null, 'Categories with files cannot be deleted');
  assert.ok(messages.at(-1).includes('다른 카테고리'));

  run(`deleteScoreLibraryFile('${fileId}')`);
  await confirmCallback();
  assert.equal(deleted.length, 1);
  assert.equal(run('state.scoreLibrary.files.length'), 0);
  run(`deleteScoreLibraryCategory('${secondCategoryId}')`);
  await confirmCallback();
  assert.equal(run('state.scoreLibrary.categories.length'), 1);
  assert.ok(JSON.parse(stored.get('guitar_repertory_v4')).state.scoreLibrary);

  loggedIn = null;
  run(`scoreLibrarySelectedCategoryId='${firstCategoryId}'`);
  await run('handleScoreLibraryUpload(uploadEvent)', context.uploadEvent = { target: { files: [pdf], value: '' } });
  assert.equal(uploaded.length, 1, 'Unauthenticated uploads are blocked');
  console.log('SCORE_LIBRARY_TEST_OK: category CRUD, upload, organization, authentication, and persistence');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
