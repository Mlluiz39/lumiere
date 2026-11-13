'use strict';
// Painel: login, upload assinado pro Cloudinary, edição e remoção.
const $ = (id) => document.getElementById(id);
// Mesmo recorte/fundo da vitrine — a miniatura tem que bater com o site.
const CDN = (cloud, id, w) => {
  const h = Math.round(w * 1.25), ow = Math.round(w * 0.875), oh = Math.round(w * 1.1);
  return `https://res.cloudinary.com/${cloud}/image/upload/w_${w},h_${h},c_fill/l_lumiere:${id},e_background_removal,c_fit,w_${ow},h_${oh}/fl_layer_apply/q_auto/lumiere/plano-fundo-lumiere.webp`;
};
const CATS = { lingerie: 'Lingerie', pijamas: 'Pijamas & camisolas', masculino: 'Masculino', meias: 'Meias' };

let cloudName = '';
let products = [];
let editing = null;

const msg = (el, text, kind = 'err') => { el.textContent = text; el.className = `msg ${kind}`; };

async function api(path, options = {}) {
  const res = await fetch('/api/' + path, { credentials: 'same-origin', ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

// ---------- sessão ----------
async function boot() {
  const { admin, cloudName: cloud } = await api('session');
  if (cloud) cloudName = cloud;
  $('loginView').classList.toggle('hide', admin);
  $('panelView').classList.toggle('hide', !admin);
  if (admin) await load();
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  try {
    await api('login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: $('password').value }),
    });
    $('password').value = '';
    $('loginView').classList.add('hide');
    $('panelView').classList.remove('hide');
    await load();
  } catch (err) {
    msg($('loginMsg'), err.message);
  } finally {
    btn.disabled = false;
  }
});

$('logout').addEventListener('click', async () => {
  await api('logout', { method: 'POST' }).catch(() => {});
  location.reload();
});

// ---------- dados ----------
async function load() {
  products = await api('products');
  render();
}

function nextRef() {
  const max = products.reduce((acc, p) => Math.max(acc, +p.ref.replace(/\D/g, '') || 0), 0);
  return `LM${String(max + 1).padStart(3, '0')}`;
}

const thumb = (p) => (cloudName ? CDN(cloudName, p.publicId.split('/')[1], 200) : '');

function render() {
  $('count').textContent = products.length;
  $('ref').value = nextRef();
  $('items').innerHTML = products
    .map(
      (p) => `<article class="item">
        <img src="${thumb(p)}" alt="" loading="lazy">
        <div>
          <h3>${escape(p.name)}</h3>
          <p class="meta">${CATS[p.category] || p.category} · ${escape(p.ref)}</p>
        </div>
        <div class="acts">
          <button class="btn ghost" data-edit="${p.ref}">Editar</button>
          <button class="btn danger" data-remove="${p.ref}">Remover</button>
        </div>
      </article>`,
    )
    .join('') || '<p class="sub">Nenhuma peça cadastrada.</p>';
}

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function save(next, successMsg, el) {
  try {
    await api('products', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ products: next }),
    });
    products = next;
    render();
    if (successMsg) msg(el, successMsg, 'ok');
    return true;
  } catch (err) {
    msg(el, err.message);
    return false;
  }
}

// ---------- upload ----------
$('file').addEventListener('change', () => {
  const file = $('file').files[0];
  const img = $('preview');
  if (!file) return img.classList.add('hide');
  img.src = URL.createObjectURL(file);
  img.classList.remove('hide');
});

$('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('addBtn');
  const file = $('file').files[0];
  const name = $('name').value.trim();
  const category = $('category').value;
  if (!file || !name) return msg($('addMsg'), 'Escolha a foto e o nome.');

  btn.disabled = true;
  msg($('addMsg'), 'Enviando foto...', 'ok');
  try {
    // Nome de arquivo aleatório: evita colisão e não expõe o nome original.
    const publicId = `lumiere/${crypto.randomUUID()}`;
    const sig = await api('sign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ publicId }),
    });
    cloudName = sig.cloudName;

    const body = new FormData();
    body.append('file', file);
    body.append('api_key', sig.apiKey);
    body.append('timestamp', String(sig.timestamp));
    body.append('public_id', sig.publicId);
    body.append('format', sig.format);
    body.append('signature', sig.signature);
    const up = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: 'POST', body });
    if (!up.ok) throw new Error('Falha no upload da foto.');

    const next = [{ ref: nextRef(), name, category, publicId }, ...products];
    if (!(await save(next, 'Peça publicada.', $('addMsg')))) {
      // Não deixar imagem órfã no Cloudinary se a lista foi rejeitada.
      throw new Error('Foto enviada, mas a peça não foi salva. Avise o suporte.');
    }
    e.target.reset();
    $('preview').classList.add('hide');
  } catch (err) {
    msg($('addMsg'), err.message);
  } finally {
    btn.disabled = false;
  }
});

// ---------- edição e remoção ----------
$('items').addEventListener('click', async (e) => {
  const edit = e.target.closest('[data-edit]');
  const remove = e.target.closest('[data-remove]');

  if (edit) {
    const p = products.find((x) => x.ref === edit.dataset.edit);
    if (!p) return;
    const name = prompt('Nome da peça:', p.name);
    if (name === null) return;
    if (!name.trim()) return alert('O nome não pode ficar vazio.');
    const category = prompt(`Categoria (${Object.keys(CATS).join(', ')}):`, p.category);
    if (category === null) return;
    if (!CATS[category]) return alert('Categoria inválida.');
    await save(products.map((x) => (x.ref === p.ref ? { ...x, name: name.trim(), category } : x)), null, $('addMsg'));
  }

  if (remove) {
    const p = products.find((x) => x.ref === remove.dataset.remove);
    if (!p) return;
    if (!confirm(`Remover "${p.name}" da vitrine?\n\nA peça sai do site. Dá pra reativar depois reenviando.`)) return;
    // Peça vendida some do catálogo. A imagem fica no Cloudinary pra reativar se preciso.
    await save(products.filter((x) => x.ref !== p.ref), null, $('addMsg'));
  }
});

boot().catch(() => {
  $('loginView').classList.remove('hide');
});
