// API da vitrine. Um arquivo só, rotas em /api/*.
// Produtos ficam no KV (binding PRODUCTS). Escrita exige cookie de sessão.
const COOKIE = 'lumiere_admin';
const SESSION_HOURS = 12;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// PBKDF2-SHA256, 150k iterações. Custo proposital: encarece força bruta.
async function hashPassword(password, saltB64) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: 150000, hash: 'SHA-256' },
    key,
    256,
  );
  return b64(bits);
}

// Comparação em tempo constante — senão o tempo de resposta vaza o prefixo correto.
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sessionToken(secret, exp) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`admin:${exp}`)));
}

async function isAdmin(request, env) {
  const cookie = request.headers.get('cookie') || '';
  const raw = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [exp, sig] = decodeURIComponent(raw.slice(COOKIE.length + 1)).split('.');
  if (!exp || !sig || Date.now() > +exp) return false;
  return safeEqual(sig, await sessionToken(env.SESSION_SECRET, exp));
}

function cookieFor(token, exp) {
  const secure = '; Secure';
  return `${COOKIE}=${encodeURIComponent(`${exp}.${token}`)}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
}

async function readProducts(env) {
  return (await env.PRODUCTS.get('products', 'json')) || [];
}

// GET público: cache na borda. Sem isso cada visita lê o KV, e o plano free tem teto de leitura.
async function listProducts(request, env) {
  const cache = caches.default;
  const key = new Request(new URL('/api/products', request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = json(await readProducts(env), 200, { 'cache-control': 'public, max-age=60, stale-while-revalidate=86400' });
  await cache.put(key, res.clone());
  return res;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const method = request.method;

  try {
    if (route === 'login' && method === 'POST') {
      const { password } = await request.json().catch(() => ({}));
      if (typeof password !== 'string' || !password) return json({ error: 'Senha obrigatória.' }, 400);

      // Freio de força bruta: 10 tentativas por IP a cada 15 min.
      const ip = request.headers.get('cf-connecting-ip') || 'local';
      const key = `attempts:${ip}`;
      const attempts = (await env.PRODUCTS.get(key, 'json')) || { count: 0, until: 0 };
      if (attempts.until > Date.now()) return json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, 429);

      const hash = await hashPassword(password, env.ADMIN_PASSWORD_SALT);
      if (!safeEqual(hash, env.ADMIN_PASSWORD_HASH)) {
        const count = attempts.count + 1;
        const reset = count >= 10;
        await env.PRODUCTS.put(key, JSON.stringify({ count: reset ? 0 : count, until: reset ? Date.now() + 900000 : 0 }), { expirationTtl: 900 });
        return json({ error: 'Senha incorreta.' }, 401);
      }

      await env.PRODUCTS.delete(key);
      const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
      return json({ ok: true }, 200, { 'set-cookie': cookieFor(await sessionToken(env.SESSION_SECRET, exp), exp) });
    }

    if (route === 'logout' && method === 'POST') {
      return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
    }

    if (route === 'session' && method === 'GET') {
      const admin = await isAdmin(request, env);
      // cloudName é público (aparece em toda URL de imagem); o secret nunca sai daqui.
      return json({ admin, cloudName: admin ? env.CLOUDINARY_CLOUD_NAME : null });
    }

    if (route === 'products' && method === 'GET') return listProducts(request, env);

    if (route === 'products' && method === 'PUT') {
      if (!(await isAdmin(request, env))) return json({ error: 'Não autorizado.' }, 401);
      const { products } = await request.json().catch(() => ({}));
      if (!Array.isArray(products)) return json({ error: 'Formato inválido.' }, 400);
      // Validação na fronteira: o cliente não é confiável, mesmo autenticado.
      for (const p of products) {
        if (!p || typeof p.ref !== 'string' || !/^LM\d{3,}$/.test(p.ref)) return json({ error: `Referência inválida: ${p?.ref}` }, 400);
        if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80) return json({ error: `Nome inválido em ${p.ref}` }, 400);
        if (!['lingerie', 'pijamas', 'masculino', 'meias'].includes(p.category)) return json({ error: `Categoria inválida em ${p.ref}` }, 400);
        if (typeof p.publicId !== 'string' || !/^lumiere\/[\w-]+$/.test(p.publicId)) return json({ error: `publicId inválido em ${p.ref}` }, 400);
      }
      if (new Set(products.map((p) => p.ref)).size !== products.length) return json({ error: 'Referências duplicadas.' }, 400);
      await env.PRODUCTS.put('products', JSON.stringify(products));
      await caches.default.delete(new Request(new URL('/api/products', request.url).toString()));
      return json({ ok: true, count: products.length });
    }

    // Assinatura pra upload direto do browser pro Cloudinary.
    // O secret nunca sai do servidor; o browser só recebe a assinatura de uma transform permitida.
    if (route === 'sign' && method === 'POST') {
      if (!(await isAdmin(request, env))) return json({ error: 'Não autorizado.' }, 401);
      const { publicId } = await request.json().catch(() => ({}));
      if (typeof publicId !== 'string' || !/^lumiere\/[\w-]+$/.test(publicId)) return json({ error: 'publicId inválido.' }, 400);

      const timestamp = Math.floor(Date.now() / 1000);
      const params = { public_id: publicId, timestamp, format: 'webp' };
      const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&') + env.CLOUDINARY_API_SECRET;
      const signature = [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(toSign)))]
        .map((b) => b.toString(16).padStart(2, '0')).join('');

      return json({ signature, timestamp, apiKey: env.CLOUDINARY_API_KEY, cloudName: env.CLOUDINARY_CLOUD_NAME, publicId, format: 'webp' });
    }

    return json({ error: 'Rota não encontrada.' }, 404);
  } catch (e) {
    return json({ error: 'Erro interno.' }, 500);
  }
}
