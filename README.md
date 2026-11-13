# Painel da Lumière

O site lê o catálogo de `/api/products`. Só quem tem a senha entra em `/admin.html`
e pode adicionar, renomear e remover peças.

## Como a segurança funciona

- A senha **não está em nenhum arquivo**. O Worker guarda só um hash PBKDF2-SHA256
  (150k iterações) em variável secreta do Cloudflare.
- Login emite um cookie `HttpOnly; Secure; SameSite=Strict` assinado com HMAC-SHA256.
  O navegador não consegue ler nem forjar o cookie.
- Upload vai direto do navegador pro Cloudinary com uma **assinatura** gerada pelo
  Worker. O `API_SECRET` nunca chega ao navegador.
- 10 senhas erradas por IP = bloqueio de 15 min.

Nada disso funciona se você puser a senha no HTML/JS. Foi de propósito.

## Primeiro deploy

```bash
# 1. Gera products.json com as 57 peças atuais e imprime o hash da senha
node setup.mjs "sua-senha-com-10-ou-mais-caracteres"

# 2. Cria o KV e copie o id para wrangler.toml
npx wrangler kv namespace create PRODUCTS

# 3. Publica a lista inicial no KV
npx wrangler kv key put --binding PRODUCTS products --path products.json --remote

# 4. Segredos (cada comando pede o valor)
npx wrangler pages secret put ADMIN_PASSWORD_HASH
npx wrangler pages secret put ADMIN_PASSWORD_SALT
npx wrangler pages secret put SESSION_SECRET
npx wrangler pages secret put CLOUDINARY_API_KEY
npx wrangler pages secret put CLOUDINARY_API_SECRET
npx wrangler pages secret put CLOUDINARY_CLOUD_NAME   # lumiereint

# 5. Deploy
npx wrangler pages deploy
```

Depois: abra `SEU-SITE.pages.dev/admin.html` e entre com a senha do passo 1.

## Uso diário

- **Vender uma peça** → *Remover*. Sai da vitrine na hora.
- **Repor estoque** → reenvie a foto pelo formulário de adicionar.
- **Corrigir nome ou categoria** → *Editar*.
- O site público atualiza em até 60s (cache da borda).

## Arquivos

| Arquivo | O que é |
|---|---|
| `public/index.html`, `script.js`, `styles.css` | a vitrine |
| `public/admin.html`, `admin.js` | o painel |
| `functions/api/[[path]].js` | a API (auth, catálogo, assinatura de upload) |
| `worker.test.mjs` | testes da API, sem rede |
| `check.mjs` | confere que nada vazou e que o deploy está são |
| `setup.mjs` | gera hash da senha e a lista inicial |

## Testes

```bash
node --test worker.test.mjs
node check.mjs
```

## Fundo das fotos

Toda foto cadastrada sai automaticamente recortada (fundo original removido) sobre
`lumiere/plano-fundo-lumiere` no Cloudinary. Não há nada a fazer no upload: a
transformação vive na URL de entrega, então vale também para as peças antigas e dá
para reverter trocando 2 linhas (`img()` em `script.js`, `CDN()` em `admin.js`).

## Limites do plano grátis

Cloudflare Pages: banda ilimitada, 100k requisições/dia no Worker. KV: 100k leituras/dia.
Cloudinary: 25 créditos/mês — **se estourar, as imagens param de carregar**. Para uma
vitrine pequena dá e sobra; se o tráfego crescer, é o primeiro plano a pagar.
O fundo fixo custa caro: cada foto vira ~26 KB a 400px e ~140 KB a 800px (era 20–40 KB
sem ele). O Cloudinary cobra por transformação, não por byte, mas o visitante baixa mais.
Se apertar, troque `q_auto` por `q_auto:eco` (corta ~22%) ou reduza o `w_` máximo.
