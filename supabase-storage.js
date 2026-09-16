(function (root) {
  'use strict';

  const config = root.C_REPO_SUPABASE || {};
  let client = null;
  let currentUser = null;
  let authSubscription = null;

  function configured() {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(String(config.url || '').trim())
      && /^(?:sb_publishable_|eyJ)/.test(String(config.publishableKey || '').trim())
      && typeof root.supabase?.createClient === 'function';
  }

  function getClient() {
    if (!configured()) return null;
    if (!client) {
      client = root.supabase.createClient(config.url, config.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
    return client;
  }

  function user() {
    return currentUser;
  }

  async function init(onChange) {
    const supabaseClient = getClient();
    if (!supabaseClient) {
      onChange?.({ event: 'UNCONFIGURED', user: null });
      return { configured: false, user: null };
    }

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    currentUser = data.session?.user || null;
    onChange?.({ event: 'INITIAL_SESSION', user: currentUser });

    const result = supabaseClient.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user || null;
      onChange?.({ event, user: currentUser });
    });
    authSubscription = result.data.subscription;
    return { configured: true, user: currentUser };
  }

  async function signIn(email) {
    const supabaseClient = getClient();
    if (!supabaseClient) throw new Error('Supabase 프로젝트 설정이 필요합니다.');
    const redirectTo = root.location.origin + root.location.pathname;
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true }
    });
    if (error) throw error;
  }

  async function signOut() {
    const supabaseClient = getClient();
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }

  async function load() {
    const supabaseClient = getClient();
    if (!supabaseClient || !currentUser) return null;
    const { data, error } = await supabaseClient
      .from(config.table || 'practice_documents')
      .select('payload, updated_at')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function save(payload) {
    const supabaseClient = getClient();
    if (!supabaseClient || !currentUser) return null;
    const { data, error } = await supabaseClient
      .from(config.table || 'practice_documents')
      .upsert({ user_id: currentUser.id, payload }, { onConflict: 'user_id' })
      .select('updated_at')
      .single();
    if (error) throw error;
    return data;
  }

  function dispose() {
    authSubscription?.unsubscribe();
    authSubscription = null;
  }

  root.CRepoSupabase = Object.freeze({ configured, init, user, signIn, signOut, load, save, dispose });
})(window);
