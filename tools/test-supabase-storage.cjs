const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'supabase-storage.js'), 'utf8');

function load(config, createClient) {
  const window = {
    C_REPO_SUPABASE: config,
    supabase: createClient ? { createClient } : undefined,
    location: { origin: 'https://khmass-liturgy.github.io', pathname: '/c-repo/' }
  };
  vm.runInNewContext(source, { window });
  return window.CRepoSupabase;
}

async function main() {
  const disabled = load({ url: '', publishableKey: '' });
  assert.equal(disabled.configured(), false);
  let event;
  const disabledResult = await disabled.init(value => { event = value; });
  assert.equal(disabledResult.configured, false);
  assert.equal(disabledResult.user, null);
  assert.equal(event.event, 'UNCONFIGURED');

  const calls = [];
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'player@example.com' };
  const remote = { payload: { categories: [], state: { pieces: {}, collapsed: {} } }, updated_at: '2026-09-17T00:00:00Z' };
  let authCallback;
  const client = {
    auth: {
      getSession: async () => ({ data: { session: { user } }, error: null }),
      onAuthStateChange: callback => { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithPassword: async credentials => { calls.push(['passwordSignIn', credentials]); return { error: null }; },
      resetPasswordForEmail: async (email, options) => { calls.push(['passwordReset', email, options]); return { error: null }; },
      updateUser: async attributes => { calls.push(['updateUser', attributes]); return { error: null }; },
      signOut: async options => { calls.push(['signOut', options]); return { error: null }; }
    },
    from(table) {
      calls.push(['from', table]);
      return {
        select(columns) {
          calls.push(['select', columns]);
          return { eq(column, value) { calls.push(['eq', column, value]); return { maybeSingle: async () => ({ data: remote, error: null }) }; } };
        },
        upsert(row, options) {
          calls.push(['upsert', row, options]);
          return { select(columns) { calls.push(['upsertSelect', columns]); return { single: async () => ({ data: { updated_at: remote.updated_at }, error: null }) }; } };
        }
      };
    },
    storage: {
      from(bucket) {
        calls.push(['storage', bucket]);
        return {
          upload: async (path, file, options) => { calls.push(['upload', path, file, options]); return { data: { path }, error: null }; },
          createSignedUrl: async (path, expiresIn) => { calls.push(['signedUrl', path, expiresIn]); return { data: { signedUrl: 'https://project-ref.supabase.co/signed-score' }, error: null }; },
          remove: async paths => { calls.push(['remove', paths]); return { error: null }; }
        };
      }
    }
  };

  const api = load(
    { url: 'https://project-ref.supabase.co', publishableKey: 'sb_publishable_test', table: 'practice_documents', scoreBucket: 'scores' },
    (url, key, options) => { calls.push(['createClient', url, key, options]); return client; }
  );
  assert.equal(api.configured(), true);
  const changes = [];
  const initialized = await api.init(change => changes.push(change));
  assert.equal(initialized.user.id, user.id);
  assert.equal(api.user().email, user.email);
  assert.equal((await api.load()).updated_at, remote.updated_at);

  await api.signInWithPassword(user.email, 'correct-horse-battery');
  assert.equal(JSON.stringify(calls.find(call => call[0] === 'passwordSignIn')[1]), JSON.stringify({
    email: user.email, password: 'correct-horse-battery'
  }));
  await api.resetPassword(user.email);
  assert.equal(calls.find(call => call[0] === 'passwordReset')[1], user.email);
  assert.equal(calls.find(call => call[0] === 'passwordReset')[2].redirectTo, 'https://khmass-liturgy.github.io/c-repo/');
  await api.updatePassword('new-strong-password');
  assert.equal(JSON.stringify(calls.find(call => call[0] === 'updateUser')[1]), JSON.stringify({ password: 'new-strong-password' }));

  const payload = { categories: [{ id: 'classical' }], state: { pieces: {}, collapsed: {}, concertPlans: [],
    concertArchives: [{ id: 'concert-test', title: '완료된 연주회', completedAt: '2026-10-18T10:30:00Z',
      pieces: [{ title: '기타곡', comment: '곡 소개', commentDuration: 30, savedPiece: { duration: 180, composer: '작곡가' } }] }] } };
  await api.save(payload);
  const upsert = calls.find(call => call[0] === 'upsert');
  assert.equal(upsert[1].user_id, user.id);
  assert.equal(JSON.stringify(upsert[1].payload), JSON.stringify(payload));
  assert.equal(upsert[2].onConflict, 'user_id');
  remote.payload = JSON.parse(JSON.stringify(upsert[1].payload));
  assert.equal(JSON.stringify((await api.load()).payload), JSON.stringify(payload));

  const scoreFile = { name: '악보.pdf', type: 'application/pdf' };
  const scorePath = `${user.id}/score-id/악보.pdf`;
  assert.equal((await api.uploadScore(scorePath, scoreFile)).path, scorePath);
  assert.equal(await api.createScoreUrl(scorePath), 'https://project-ref.supabase.co/signed-score');
  await api.deleteScore(scorePath);
  assert.equal(JSON.stringify(calls.find(call => call[0] === 'upload').slice(1)), JSON.stringify([scorePath, scoreFile, {
    cacheControl: '3600', contentType: 'application/pdf', upsert: false
  }]));
  assert.equal(JSON.stringify(calls.find(call => call[0] === 'remove')[1]), JSON.stringify([scorePath]));
  assert.ok(calls.filter(call => call[0] === 'storage').every(call => call[1] === 'scores'));
  assert.equal(calls.find(call => call[0] === 'signedUrl')[2], 3600);

  authCallback('SIGNED_OUT', null);
  assert.equal(api.user(), null);
  await api.signOut();
  assert.equal(calls.find(call => call[0] === 'signOut')[1].scope, 'local');
  assert.equal(changes.at(-1).event, 'SIGNED_OUT');
  console.log('SUPABASE_STORAGE_TEST_OK');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
