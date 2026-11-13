// Testa a lógica do Worker com KV em memória. Sem deploy, sem rede.
// node --test worker.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

// O Worker usa WebCrypto; o Node tem globalmente. Só garantimos que exista.
assert.ok(globalThis.crypto?.subtle, 'WebCrypto necessário');

const SALT = randomBytes(16).toString('base64');
const PASSWORD = 'senha-de-teste-12345';
const HASH = pbkdf2Sync(PASSWORD, Buffer.from(SALT, 'base64'), 150000, 32, 'sha256').toString('base64');

// KV mínimo: get/put/delete com TTL ignorado (não é o que testamos).
function makeKV() {
  const store = new Map();
  return {
    async get(key, type) {
      const v = store.get(key);
      if (v === undefined) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
    _store: store,
  };
}

const env = {
  PRODUCTS: makeKV(),
  ADMIN_PASSWORD_HASH: HASH,
  ADMIN_PASSWORD_SALT: SALT,
  SESSION_SECRET: randomBytes(32).toString('base64'),
  CLOUDINARY_API_KEY: '123456789',
  CLOUDINARY_API_SECRET: 'segredo',
  CLOUDINARY_CLOUD_NAME: 'lumiereint',
};

// caches.default não existe no Node: o Worker usa pra cachear a lista pública.
globalThis.caches = {
  default: { async match() { return undefined; }, async put() {}, async delete() {} },
};

const { onRequest } = await import('./functions/api/[[path]].js');

const call = (path, init = {}) =>
  onRequest({ request: new Request('https://x.dev/api/' + path, init), env });

const jsonInit = (body) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

test('login recusa senha errada', async () => {
  const res = await call('login', jsonInit({ password: 'errada' }));
  assert.equal(res.status, 401);
});

test('login aceita senha certa e emite cookie HttpOnly', async () => {
  const res = await call('login', jsonInit({ password: PASSWORD }));
  assert.equal(res.status, 200);
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
});

test('PUT products sem sessão é rejeitado', async () => {
  const res = await call('products', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ products: [] }),
  });
  assert.equal(res.status, 401);
});

test('cookie forjado é rejeitado', async () => {
  const forged = `lumiere_admin=${encodeURIComponent(`${Date.now() + 1e6}.assinaturaFalsa`)}`;
  const res = await call('products', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie: forged },
    body: JSON.stringify({ products: [] }),
  });
  assert.equal(res.status, 401);
});

test('sessão válida cria e lista produto', async () => {
  const login = await call('login', jsonInit({ password: PASSWORD }));
  const cookie = login.headers.get('set-cookie').split(';')[0];

  const product = { ref: 'LM999', name: 'Teste', category: 'lingerie', publicId: 'lumiere/abc-123' };
  const put = await call('products', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ products: [product] }),
  });
  assert.equal(put.status, 200);

  const list = await call('products');
  const body = await list.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].ref, 'LM999');
});

test('PUT rejeita categoria inválida e ref duplicada', async () => {
  const login = await call('login', jsonInit({ password: PASSWORD }));
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const put = (products) =>
    call('products', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ products }),
    });

  const bad = await put([{ ref: 'LM001', name: 'x', category: 'inexistente', publicId: 'lumiere/a' }]);
  assert.equal(bad.status, 400);

  const dup = await put([
    { ref: 'LM001', name: 'a', category: 'lingerie', publicId: 'lumiere/a' },
    { ref: 'LM001', name: 'b', category: 'lingerie', publicId: 'lumiere/b' },
  ]);
  assert.equal(dup.status, 400);
});

test('sign exige sessão e nunca devolve o secret', async () => {
  const anon = await call('sign', jsonInit({ publicId: 'lumiere/x' }));
  assert.equal(anon.status, 401);

  const login = await call('login', jsonInit({ password: PASSWORD }));
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const res = await call('sign', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ publicId: 'lumiere/abc-123' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.signature);
  assert.equal(body.cloudName, 'lumiereint');
  assert.equal(JSON.stringify(body).includes('segredo'), false);
});

test('freio de força bruta bloqueia após 10 tentativas', async () => {
  env.PRODUCTS._store.clear();
  for (let i = 0; i < 10; i++) await call('login', jsonInit({ password: 'errada' }));
  const res = await call('login', jsonInit({ password: 'errada' }));
  assert.equal(res.status, 429);
});

test('session não vaza cloudName para anônimo e informa quando logado', async () => {
  env.PRODUCTS._store.clear(); // o teste de força bruta acima deixa o IP bloqueado
  const anon = await (await call('session')).json();
  assert.equal(anon.admin, false);
  assert.equal(anon.cloudName, null);

  const login = await call('login', jsonInit({ password: PASSWORD }));
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const me = await (await call('session', { headers: { cookie } })).json();
  assert.equal(me.admin, true);
  assert.equal(me.cloudName, 'lumiereint');
});

test('logout invalida o cookie', async () => {
  const res = await call('logout', { method: 'POST' });
  assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
});
