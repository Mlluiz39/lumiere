// Prepara o banco e os segredos.
// Uso: node setup.mjs "minha-senha-forte"
//
// 1. Gera o hash da senha e o salt (PBKDF2-SHA256, 100k iterações, o teto do Workers).
// 2. Extrai as 57 peças do catálogo atual (git HEAD) para products.json.
// 3. Imprime os comandos que faltam.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { randomBytes, pbkdf2Sync } from 'node:crypto';

const password = process.argv[2];
if (!password || password.length < 10) {
  console.error('Uso: node setup.mjs "senha-com-10-ou-mais-caracteres"');
  process.exit(1);
}

const salt = randomBytes(16).toString('base64');
const hash = pbkdf2Sync(password, Buffer.from(salt, 'base64'), 100000, 32, 'sha256').toString('base64');

// Catálogo original ainda está no git (antes da migração pra API).
const original = execSync('git show HEAD:script.js', { encoding: 'utf8' });
const source = original.slice(original.indexOf('const pieces = ['), original.indexOf('].map('));
const rows = [...source.matchAll(/\[(\d+),'([^']+)','(\w+)'\]/g)].map(([, id, name, category]) => ({
  ref: `LM${id.padStart(3, '0')}`,
  name,
  category,
  publicId: `lumiere/IMG-20261025-WA${id.padStart(4, '0')}`,
}));

if (rows.length === 0) {
  console.error('Não consegui ler o catálogo do git HEAD. As peças teriam que ser recadastradas pelo painel.');
  process.exit(1);
}

writeFileSync('products.json', JSON.stringify(rows, null, 1));
console.log(`\nproducts.json criado com ${rows.length} peças (nomes e categorias originais).`);

console.log(`
=== 1. Crie o KV e copie o id para wrangler.toml ===
  npx wrangler kv namespace create PRODUCTS

=== 2. Publique a lista inicial ===
  npx wrangler kv key put --binding PRODUCTS products --path products.json --remote

=== 3. Segredos (cole o valor de cada um quando pedir) ===
  npx wrangler pages secret put ADMIN_PASSWORD_HASH     ${hash}
  npx wrangler pages secret put ADMIN_PASSWORD_SALT     ${salt}
  npx wrangler pages secret put SESSION_SECRET          ${randomBytes(32).toString('base64')}
  npx wrangler pages secret put CLOUDINARY_API_KEY      (do Dashboard)
  npx wrangler pages secret put CLOUDINARY_API_SECRET   (do Dashboard)
  npx wrangler pages secret put CLOUDINARY_CLOUD_NAME   lumiereint

=== 4. Deploy ===
  npx wrangler pages deploy

Depois: acesse /admin.html e entre com a senha que você passou aqui.
`);
