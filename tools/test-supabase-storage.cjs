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
      signInWithOtp: async options => { calls.push(['otp', options]); return { error: null }; },
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
    }
  };

  const api = load(
    { url: 'https://project-ref.supabase.co', publishableKey: 'sb_publishable_test', table: 'practice_documents' },
    (url, key, options) => { calls.push(['createClient', url, key, options]); return client; }
  );
  assert.equal(api.configured(), true);
  const changes = [];
  const initialized = await api.init(change => changes.push(change));
  assert.equal(initialized.user.id, user.id);
  assert.equal(api.user().email, user.email);
  assert.equal((await api.load()).updated_at, remote.updated_at);

  await api.signIn(user.email);
  const otp = calls.find(call => call[0] === 'otp')[1];
  assert.equal(otp.email, user.email);
  assert.equal(otp.options.emailRedirectTo, 'https://khmass-liturgy.github.io/c-repo/');
  assert.equal(otp.options.shouldCreateUser, true);

  const payload = { categories: [{ id: 'classical' }], state: { pieces: {}, collapsed: {} } };
  await api.save(payload);
  const upsert = calls.find(call => call[0] === 'upsert');
  assert.equal(upsert[1].user_id, user.id);
  assert.equal(JSON.stringify(upsert[1].payload), JSON.stringify(payload));
  assert.equal(upsert[2].onConflict, 'user_id');

  authCallback('SIGNED_OUT', null);
  assert.equal(api.user(), null);
  await api.signOut();
  assert.equal(calls.find(call => call[0] === 'signOut')[1].scope, 'local');
  assert.equal(changes.at(-1).event, 'SIGNED_OUT');
  console.log('SUPABASE_STORAGE_TEST_OK');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
