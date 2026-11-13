'use strict';
const categories = {lingerie:'Lingerie',pijamas:'Pijamas & camisolas',masculino:'Masculino',meias:'Meias'};
// ponytail: Cloudinary free plan é pra desenvolvimento. Se virar produção, plano pago ou imagens locais.
const CDN = 'https://res.cloudinary.com/lumiereint/image/upload';
// Todo produto é recortado 4:5 num c_fill e desenhado por cima da renda fixa.
// A renda é a BASE (b_ só aceita cor, e e_replace_background não existe neste plano):
// o produto vira camada l_ com o fundo original removido. Vale retroativo, sem reenvio.
// Tamanhos do overlay = 87,5% da largura / 88% da altura, para a moldura de renda aparecer.
// Sem f_auto de propósito: a fonte já é WebP e f_auto devolvia JPEG intermitente
// nestas imagens (testado 2026-11-13). Se um dia trocar a fonte para PNG/JPEG
// grande, aí sim f_auto passa a valer.
const FABRIC = 'lumiere/plano-fundo-lumiere';
const img = (publicId, w) => {
  const h = Math.round(w * 1.25), ow = Math.round(w * 0.875), oh = Math.round(w * 1.1);
  return `${CDN}/w_${w},h_${h},c_fill/l_${publicId.replace('/', ':')},e_background_removal,c_fit,w_${ow},h_${oh}/fl_layer_apply/q_auto/${FABRIC}.webp`;
};
// Catálogo vem da API (KV do Worker), populado pelo painel em /admin.html.
let pieces = [];
const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
const wa = message => 'https://wa.me/5511948685925?text='+encodeURIComponent(message);
const inquiry = p => wa(`Olá! Vi esta peça na vitrine da Lumière: ${p.name} (referência ${p.ref}). Gostaria de consultar tamanhos, cores e disponibilidade.`);
let selected = new Set();
try { const saved=JSON.parse(localStorage.getItem('lumiere-selection')||'[]'); if(Array.isArray(saved)) selected=new Set(saved); } catch {}
let filter='all',limit=12;
const grid=document.getElementById('productGrid');
function renderProducts(){
 const filtered=pieces.filter(p=>filter==='all'||p.category===filter);
 grid.innerHTML=filtered.slice(0,limit).map(p=>`<article class="product"><div class="product-image"><button class="photo-button" data-photo="${p.ref}" aria-label="Ampliar foto de ${p.name}"><img src="${img(p.publicId,400)}" srcset="${img(p.publicId,400)} 400w, ${img(p.publicId,800)} 800w" sizes="(max-width:600px) 50vw, 300px" alt="${p.name}" width="600" height="750" loading="lazy" decoding="async"><span class="photo-hint">AMPLIAR FOTO ↗</span></button><button class="favorite" data-favorite="${p.ref}" aria-label="${selected.has(p.ref)?'Remover':'Salvar'} ${p.name} ${selected.has(p.ref)?'da':'na'} seleção" aria-pressed="${selected.has(p.ref)}">${heart}</button></div><div class="product-info"><div class="product-meta"><span>${categories[p.category]}</span><span>${p.ref}</span></div><h3>${p.name}</h3><a class="product-contact" href="${inquiry(p)}" target="_blank" rel="noopener noreferrer">Consultar pelo WhatsApp <span aria-hidden="true">↗</span></a></div></article>`).join('');
 document.getElementById('resultCount').textContent=`${Math.min(limit,filtered.length)} de ${filtered.length} peças`;
 document.getElementById('loadMore').hidden=limit>=filtered.length;
}
function setFilter(value){filter=value;limit=12;document.querySelectorAll('[data-filter]').forEach(b=>{const active=b.dataset.filter===value;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active)});renderProducts()}
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.filter)));
document.querySelectorAll('[data-category]').forEach(a=>a.addEventListener('click',()=>setFilter(a.dataset.category)));
document.getElementById('loadMore').addEventListener('click',()=>{const before=grid.children.length;limit+=12;renderProducts();grid.children[before]?.querySelector('button').focus({preventScroll:true})});
function toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),2500)}
function updateSelection(){
 document.getElementById('selectionCount').textContent=selected.size;
 document.getElementById('selectionButton').setAttribute('aria-label',`Abrir minha seleção, ${selected.size} peças`);
 const items=pieces.filter(p=>selected.has(p.ref));
 document.getElementById('selectedItems').innerHTML=items.length?items.map(p=>`<article class="selected-item"><img src="${img(p.publicId,200)}" alt="${p.name}" width="65" height="80" loading="lazy"><div><h3>${p.name}</h3><p>Referência ${p.ref}</p><button class="remove-item" data-remove="${p.ref}" aria-label="Remover ${p.name} da seleção">Remover</button></div></article>`).join(''):'<p class="empty-selection">Sua seleção ainda está vazia. Toque no coração das peças que você gostou para salvá-las aqui.</p>';
 const send=document.getElementById('sendSelection');send.hidden=!items.length;send.href=wa('Olá! Gostei destas peças na vitrine da Lumière:\n\n'+items.map(p=>`• ${p.name} — ${p.ref}`).join('\n')+'\n\nPode me informar os tamanhos, cores e a disponibilidade?');
 try{localStorage.setItem('lumiere-selection',JSON.stringify([...selected]))}catch{}
}
function syncFavorites(){document.querySelectorAll('[data-favorite]').forEach(b=>{const p=pieces.find(p=>p.ref===b.dataset.favorite),saved=selected.has(p.ref);b.setAttribute('aria-pressed',saved);b.setAttribute('aria-label',`${saved?'Remover':'Salvar'} ${p.name} ${saved?'da':'na'} seleção`)})}
function showDialog(id){document.getElementById(id).showModal();document.body.classList.add('modal-open')}
document.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('close',()=>document.body.classList.remove('modal-open'));dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}})});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));
grid.addEventListener('click',e=>{const favorite=e.target.closest('[data-favorite]');if(favorite){const ref=favorite.dataset.favorite;selected.has(ref)?selected.delete(ref):selected.add(ref);updateSelection();syncFavorites();toast(selected.has(ref)?'Peça salva na sua seleção':'Peça removida da seleção');return}const photo=e.target.closest('[data-photo]');if(photo){const p=pieces.find(p=>p.ref===photo.dataset.photo);if(!p)return;document.getElementById('largePhoto').src=img(p.publicId,800);document.getElementById('largePhoto').alt=p.name;document.getElementById('photoTitle').textContent=p.name;document.getElementById('photoContact').href=inquiry(p);showDialog('photoDialog')}});
document.getElementById('selectedItems').addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;const index=[...document.querySelectorAll('[data-remove]')].indexOf(b);selected.delete(b.dataset.remove);updateSelection();syncFavorites();const buttons=document.querySelectorAll('[data-remove]');(buttons[Math.min(index,buttons.length-1)]||document.querySelector('[data-close="selectionDialog"]')).focus()});
document.getElementById('selectionButton').addEventListener('click',()=>showDialog('selectionDialog'));
const menu=document.getElementById('menuButton'),navigation=document.getElementById('navigation');
function closeMenu(){navigation.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Abrir menu')}
menu.addEventListener('click',()=>{const open=navigation.classList.toggle('open');menu.setAttribute('aria-expanded',open);menu.setAttribute('aria-label',open?'Fechar menu':'Abrir menu')});
navigation.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&navigation.classList.contains('open')){closeMenu();menu.focus()}});
document.addEventListener('click',e=>{if(!e.target.closest('.header'))closeMenu()});
window.matchMedia('(min-width:801px)').addEventListener('change',closeMenu);
document.getElementById('year').textContent=new Date().getFullYear();
// Preenche hero, categorias e "sobre" com peças reais — some se a peça for removida.
function fillShowcase(){
 const first=(cat)=>pieces.find(p=>p.category===cat)||pieces[0];
 const set=(sel,p,w,sizes)=>{
  const el=document.querySelector(sel); if(!el||!p) return;
  el.src=img(p.publicId,w);
  el.srcset=`${img(p.publicId,400)} 400w, ${img(p.publicId,800)} 800w`;
  if(sizes) el.sizes=sizes;
 };
 const hero=pieces[0];
 if(hero){ document.querySelector('.hero-image').src=img(hero.publicId,800); document.querySelector('.hero-image').alt=hero.name; }
 const inset=pieces[1];
 if(inset){ const i=document.querySelector('.hero-inset img'); i.src=img(inset.publicId,300); i.alt=inset.name; }
 document.querySelectorAll('[data-category]').forEach(a=>{
  const p=first(a.dataset.category);
  if(!p) return;
  const i=a.querySelector('img'); i.src=img(p.publicId,400); i.srcset=`${img(p.publicId,400)} 400w, ${img(p.publicId,800)} 800w`; i.sizes='(max-width:700px) 100vw, (max-width:1000px) 50vw, 33vw'; i.alt=p.name;
 });
 set('[data-about]',pieces[2],800,'(max-width:900px) 100vw, 560px');
}
// Catálogo vem da API. Sem isso, a vitrine renderiza vazia até o fetch chegar.
fetch('/api/products').then(r=>r.ok?r.json():[]).then(data=>{
 pieces=Array.isArray(data)?data:[];
 selected=new Set([...selected].filter(ref=>pieces.some(p=>p.ref===ref)));
 fillShowcase();renderProducts();updateSelection();
}).catch(()=>{grid.innerHTML='<p class="catalog-note">Não foi possível carregar as peças agora. Recarregue a página.</p>'});
updateSelection();
// Brand sparkles: subtle rosé and champagne particles, isolated from navigation.
(()=>{
 const canvas=document.getElementById('sparkles'),ctx=canvas.getContext('2d');if(!ctx)return;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');let width=0,height=0,particles=[],frame=0,visible=false,last=0;
 function resize(){const box=canvas.getBoundingClientRect();width=box.width;height=box.height;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);particles=Array.from({length:width<400?65:120},()=>({x:Math.random()*width,y:Math.random()*height,r:.3+Math.random()*1.1,phase:Math.random()*Math.PI*2,speed:.12+Math.random()*.3,color:Math.random()>.5?'246,213,172':'227,165,185'}));draw(0)}
 function draw(time){ctx.clearRect(0,0,width,height);for(const p of particles){const opacity=.2+(.5+.5*Math.sin(time*.0014+p.phase))*.7;ctx.fillStyle=`rgba(${p.color},${opacity})`;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()}}
 function animate(time){frame=0;if(!visible||document.hidden||reduced.matches)return;const delta=Math.min((time-last)/16.67,3);last=time;for(const p of particles){p.y=(p.y+p.speed*delta)%height;p.x=(p.x+Math.sin(p.phase)*.12*delta+width)%width}draw(time);frame=requestAnimationFrame(animate)}
 function sync(){cancelAnimationFrame(frame);frame=0;if(visible&&!document.hidden&&!reduced.matches){last=performance.now();frame=requestAnimationFrame(animate)}else draw(0)}
 new ResizeObserver(resize).observe(canvas);new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync()},{threshold:.05}).observe(canvas);document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);resize();
})();
