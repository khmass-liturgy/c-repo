/* Credentials belong to the browser password manager, never app storage or Gist. */
(function (root) {
  'use strict';
  const CONFIG_KEY = 'guitar_gist_config';
  const PREFIX = 'c-repo-gist:';
  const FILENAME = 'guitar_repertory.json';
  function normalizeId(value) {
    const id = String(value || '').trim().replace(/^c-repo-gist:/, '');
    return /^[a-f0-9]{5,64}$/i.test(id) ? id.toLowerCase() : '';
  }
  function save(config) {
    const safe = { gistId: normalizeId(config.gistId), autofillPaused: !!config.autofillPaused };
    // Remove the old record first so a failed write cannot leave a legacy PAT behind.
    try { root.localStorage.removeItem(CONFIG_KEY); root.localStorage.setItem(CONFIG_KEY, JSON.stringify(safe)); }
    catch (_) { /* Storage may be disabled. The current tab remains usable. */ }
  }
  function load() {
    let value = {};
    try { value = JSON.parse(root.localStorage.getItem(CONFIG_KEY) || '{}') || {}; } catch (_) {}
    const config = { gistId: normalizeId(value.gistId), token: typeof value.token === 'string' ? value.token : '', autofillPaused: !!value.autofillPaused };
    save(config); // Legacy PAT is retained in memory for this tab only, and removed from disk.
    return config;
  }
  function supported() {
    return root.isSecureContext && typeof root.PasswordCredential === 'function' && !!root.navigator.credentials;
  }
  async function restore(silent) {
    if (!supported()) return null;
    try {
      const entry = await root.navigator.credentials.get({ password: true, mediation: silent ? 'silent' : 'required' });
      // Never send another application's saved password to GitHub.
      if (!entry || entry.type !== 'password' || !entry.id.startsWith(PREFIX)) return null;
      const gistId = normalizeId(entry.id);
      return gistId && entry.password ? { gistId, token: entry.password } : null;
    } catch (_) { return null; }
  }
  async function remember(config) {
    if (!supported()) return false;
    try {
      await root.navigator.credentials.store(new root.PasswordCredential({
        id: PREFIX + normalizeId(config.gistId), password: config.token, name: '클래식기타 레퍼토리 Gist'
      }));
      return true;
    } catch (_) { return false; }
  }
  async function pause() {
    try { await root.navigator.credentials?.preventSilentAccess(); } catch (_) {}
  }
  async function request(path, token, options = {}) {
    const res = await root.fetch('https://api.github.com' + path, {
      ...options, credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    });
    // Do not echo response bodies or fetch exceptions that might contain private data.
    if (!res.ok) throw new Error(`GitHub 응답 ${res.status}: 토큰 만료·gist 권한·Gist ID를 확인해주세요.`);
    return res.json();
  }
  async function find(token) {
    const found = new Map();
    for (let page = 1; page <= 20; page++) {
      const list = await request(`/gists?per_page=100&page=${page}`, token);
      if (!Array.isArray(list)) throw new Error('Gist 목록 형식이 올바르지 않습니다.');
      for (const gist of list) {
        const id = normalizeId(gist.id);
        if (id && gist.files?.[FILENAME]) found.set(id, { id, description: gist.description || '기타 레퍼토리', updatedAt: gist.updated_at || '' });
      }
      if (list.length < 100) return [...found.values()];
    }
    throw new Error('Gist가 많아 검색을 완료하지 못했습니다. 사용할 Gist ID를 직접 입력해주세요.');
  }
  function parse(gist) {
    const file = gist.files?.[FILENAME];
    if (!file || file.truncated || typeof file.content !== 'string') throw new Error('레퍼토리 파일이 없거나 너무 큽니다. Gist ID를 확인해주세요.');
    let data;
    try { data = JSON.parse(file.content); } catch (_) { throw new Error('레퍼토리 JSON 형식이 올바르지 않습니다.'); }
    if (!Array.isArray(data?.categories) || !data.state || typeof data.state !== 'object' || Array.isArray(data.state) || !data.state.pieces || typeof data.state.pieces !== 'object' || Array.isArray(data.state.pieces)) {
      throw new Error('레퍼토리 데이터 형식이 올바르지 않습니다.');
    }
    if (!data.categories.every(cat => cat && typeof cat.id === 'string' && typeof cat.name === 'string' && Array.isArray(cat.pieces) && cat.pieces.every(p => p && typeof p.title === 'string')) ||
        !Object.values(data.state.pieces).every(piece => piece && typeof piece === 'object' && !Array.isArray(piece))) {
      throw new Error('레퍼토리 곡 목록 형식이 올바르지 않습니다.');
    }
    if (!data.state.collapsed || typeof data.state.collapsed !== 'object' || Array.isArray(data.state.collapsed)) data.state.collapsed = {};
    return data;
  }
  async function read(token, id) {
    id = normalizeId(id);
    if (!id) throw new Error('Gist ID 형식이 올바르지 않습니다.');
    return parse(await request(`/gists/${id}`, token));
  }
  root.GistAuth = Object.freeze({ normalizeId, load, save, supported, restore, remember, pause, find, read, request, parse });
})(globalThis);
