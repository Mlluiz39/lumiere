// Verifica a migração pra CDN e a estrutura de deploy.
// node check.mjs
import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

const home = readFileSync('public/index.html', 'utf8');
const site = readFileSync('public/script.js', 'utf8');
const admin = readFileSync('public/admin.js', 'utf8');
const worker = readFileSync('functions/api/[[path]].js', 'utf8');

// 1. Nada de imagem local sobrando no que é servido.
for (const [name, src] of [['index.html', home], ['script.js', site]]) {
  assert.ok(!/src="assets\//.test(src), `${name} ainda referencia assets/ local`);
}

// 2. O secret do Cloudinary nunca pode aparecer no frontend.
for (const [name, src] of [['script.js', site], ['admin.js', admin]]) {
  assert.ok(!/CLOUDINARY_API_SECRET|api_secret/i.test(src), `${name} expõe o secret do Cloudinary`);
}

// 3. O painel não pode ter senha embutida — quem valida é o Worker.
assert.ok(!/ADMIN_PASSWORD|senha\s*[:=]\s*['"][^'"]+['"]/i.test(admin), 'admin.js parece conter senha');
assert.ok(/api\('login'/.test(admin), 'admin.js não chama a API de login');

// 4. Toda URL de produto passa pelo recorte 4:5 + fundo fixo. Sem isso entrega o original.
for (const [name, src] of [['script.js', site], ['admin.js', admin]]) {
  assert.ok(/w_\$\{w\},h_\$\{h\},c_fill/.test(src), `${name}: recorte 4:5 ausente`);
  assert.ok(/e_background_removal/.test(src), `${name}: remoção de fundo ausente`);
  assert.ok(/plano-fundo-lumiere/.test(src), `${name}: fundo fixo ausente`);
}
// No Worker, só a assinatura; nenhuma URL montada.
assert.ok(!/res\.cloudinary\.com\/.*\/upload\/q_auto/.test(worker), 'Worker não deve montar URL de imagem');

// 5. Sem upscale: originais têm no máximo 800px.
for (const [, w] of (site + admin + home).matchAll(/(?:c_limit,)?w_(\d+)/g)) {
  assert.ok(+w <= 800, `w_${w} upscala (máximo nativo: 800px)`);
}

// 6. srcset: descritor bate com a largura da URL.
for (const [pair] of home.matchAll(/c_limit,w_\d+\/[^"'\s]+ \d+w/g)) {
  const [, w, d] = pair.match(/w_(\d+)\/[^"'\s]+ (\d+)w/);
  assert.equal(w, d, `descritor ≠ largura: ${pair}`);
}

// 7. Estrutura de deploy.
assert.ok(existsSync('wrangler.toml'), 'wrangler.toml ausente');
assert.ok(!existsSync('public/.env'), '.env dentro de public/ seria publicado!');
const toml = readFileSync('wrangler.toml', 'utf8');
assert.ok(/pages_build_output_dir\s*=\s*"public"/.test(toml), 'wrangler.toml não aponta pra public/');
assert.ok(!/CLOUDINARY_API_SECRET\s*=/.test(toml), 'secret do Cloudinary não pode estar no wrangler.toml');

const templates = [...(site + admin).matchAll(/\/fl_layer_apply\/q_auto\/\$\{FABRIC\}|\/fl_layer_apply\/q_auto\/lumiere\/plano-fundo/g)].length;
assert.ok(templates >= 2, 'templates de URL da CDN ausentes em script.js e admin.js');

console.log(`ok — ${templates} templates com fundo fixo, sem referências locais, painel sem senha embutida`);
