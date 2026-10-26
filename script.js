'use strict';
const categories = {lingerie:'Lingerie',pijamas:'Pijamas & camisolas',masculino:'Masculino',meias:'Meias'};
const pieces = [
 [57,'Conjunto lilás com renda','lingerie'],[19,'Pijama rosa com short estampado','pijamas'],[68,'Conjunto vermelho de renda','lingerie'],[62,'Boxers em cores clássicas','masculino'],
 [46,'Sutiã nude com renda','lingerie'],[40,'Pijama azul com short estampado','pijamas'],[26,'Calcinhas com detalhes em renda','lingerie'],[70,'Pijama floral com acabamento rosa','pijamas'],
 [31,'Sutiã básico bege','lingerie'],[47,'Camisola verde com laço','pijamas'],[39,'Top azul nadador','lingerie'],[60,'Boxers em cores variadas','masculino'],
 [18,'Calcinha vinho com renda','lingerie'],[20,'Calcinha azul-marinho','lingerie'],[21,'Camisola vermelha de alças','pijamas'],[22,'Camisolas em tons suaves','pijamas'],[23,'Top verde de alças','lingerie'],[24,'Calcinha lilás','lingerie'],[25,'Calcinhas coloridas','lingerie'],[27,'Meias em cores neutras','meias'],[28,'Top preto nadador','lingerie'],[29,'Calcinha preta básica','lingerie'],[30,'Boxer azul-marinho','masculino'],[32,'Calcinhas com acabamento contrastante','lingerie'],[33,'Calcinha vermelha','lingerie'],[34,'Calcinhas em cores variadas','lingerie'],[35,'Short estampado geométrico','pijamas'],[36,'Boxers estampadas','masculino'],[37,'Camisola vermelha','pijamas'],[38,'Calcinha vinho com detalhe lateral','lingerie'],[41,'Calcinha vermelha com renda','lingerie'],[42,'Boxer azul básica','masculino'],[43,'Calcinha preta','lingerie'],[44,'Calcinhas em tons suaves','lingerie'],[45,'Calcinha amarela com renda','lingerie'],[48,'Calcinha rosé','lingerie'],[49,'Calcinhas de cós largo','lingerie'],[50,'Calcinha preta de cintura alta','lingerie'],[51,'Calcinha rosa com detalhe frontal','lingerie'],[52,'Calcinha vinho','lingerie'],[53,'Calcinha preta com renda','lingerie'],[54,'Camisola preta estampada','pijamas'],[55,'Sutiãs sem alças','lingerie'],[56,'Boxer azul com cós vermelho','masculino'],[58,'Pijama azul estampado','pijamas'],[59,'Boxers com cós contrastante','masculino'],[61,'Boxers em tons sóbrios','masculino'],[63,'Boxers azuis','masculino'],[64,'Top preto de alças','lingerie'],[65,'Sutiã preto','lingerie'],[66,'Meias em cores variadas','meias'],[67,'Boxers com estampas variadas','masculino'],[71,'Boxer cinza','masculino'],[72,'Pijama azul-marinho estampado','pijamas'],[73,'Camisola vermelha com detalhe frontal','pijamas'],[74,'Boxer azul-marinho de cós largo','masculino'],[75,'Boxers vermelhas estampadas','masculino']
].map(([id,name,category])=>({id,name,category,image:`assets/optimized/IMG-20261025-WA${String(id).padStart(4,'0')}.webp`,original:`assets/IMG-20261025-WA${String(id).padStart(4,'0')}.jpg`,ref:`LM${String(id).padStart(3,'0')}`}));
const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
const wa = message => 'https://wa.me/5511948685925?text='+encodeURIComponent(message);
const inquiry = p => wa(`Olá! Vi esta peça na vitrine da Lumière: ${p.name} (referência ${p.ref}, foto IMG-20261025-WA${String(p.id).padStart(4,'0')}). Gostaria de consultar tamanhos, cores e disponibilidade.`);
let selected = new Set();
try { const saved=JSON.parse(localStorage.getItem('lumiere-selection')||'[]'); if(Array.isArray(saved)) selected=new Set(saved.filter(id=>pieces.some(p=>p.id===id))); } catch {}
let filter='all',limit=12;
const grid=document.getElementById('productGrid');
function renderProducts(){
 const filtered=pieces.filter(p=>filter==='all'||p.category===filter);
 grid.innerHTML=filtered.slice(0,limit).map(p=>`<article class="product"><div class="product-image"><button class="photo-button" data-photo="${p.id}" aria-label="Ampliar foto de ${p.name}"><img src="${p.image}" alt="${p.name}" width="600" height="750" loading="lazy" decoding="async"><span class="photo-hint">AMPLIAR FOTO ↗</span></button><button class="favorite" data-favorite="${p.id}" aria-label="${selected.has(p.id)?'Remover':'Salvar'} ${p.name} ${selected.has(p.id)?'da':'na'} seleção" aria-pressed="${selected.has(p.id)}">${heart}</button></div><div class="product-info"><div class="product-meta"><span>${categories[p.category]}</span><span>${p.ref}</span></div><h3>${p.name}</h3><a class="product-contact" href="${inquiry(p)}" target="_blank" rel="noopener noreferrer">Consultar pelo WhatsApp <span aria-hidden="true">↗</span></a></div></article>`).join('');
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
 const items=pieces.filter(p=>selected.has(p.id));
 document.getElementById('selectedItems').innerHTML=items.length?items.map(p=>`<article class="selected-item"><img src="${p.image}" alt="${p.name}" width="65" height="80"><div><h3>${p.name}</h3><p>Referência ${p.ref}</p><button class="remove-item" data-remove="${p.id}" aria-label="Remover ${p.name} da seleção">Remover</button></div></article>`).join(''):'<p class="empty-selection">Sua seleção ainda está vazia. Toque no coração das peças que você gostou para salvá-las aqui.</p>';
 const send=document.getElementById('sendSelection');send.hidden=!items.length;send.href=wa('Olá! Gostei destas peças na vitrine da Lumière:\n\n'+items.map(p=>`• ${p.name} — ${p.ref} (foto WA${String(p.id).padStart(4,'0')})`).join('\n')+'\n\nPode me informar os tamanhos, cores e a disponibilidade?');
 try{localStorage.setItem('lumiere-selection',JSON.stringify([...selected]))}catch{}
}
function syncFavorites(){document.querySelectorAll('[data-favorite]').forEach(b=>{const p=pieces.find(p=>p.id===+b.dataset.favorite),saved=selected.has(p.id);b.setAttribute('aria-pressed',saved);b.setAttribute('aria-label',`${saved?'Remover':'Salvar'} ${p.name} ${saved?'da':'na'} seleção`)})}
function showDialog(id){document.getElementById(id).showModal();document.body.classList.add('modal-open')}
document.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('close',()=>document.body.classList.remove('modal-open'));dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}})});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));
grid.addEventListener('click',e=>{const favorite=e.target.closest('[data-favorite]');if(favorite){const id=+favorite.dataset.favorite;selected.has(id)?selected.delete(id):selected.add(id);updateSelection();syncFavorites();toast(selected.has(id)?'Peça salva na sua seleção':'Peça removida da seleção');return}const photo=e.target.closest('[data-photo]');if(photo){const p=pieces.find(p=>p.id===+photo.dataset.photo);document.getElementById('largePhoto').src=p.original;document.getElementById('largePhoto').alt=p.name;document.getElementById('photoTitle').textContent=p.name;document.getElementById('photoContact').href=inquiry(p);showDialog('photoDialog')}});
document.getElementById('selectedItems').addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;const index=[...document.querySelectorAll('[data-remove]')].indexOf(b);selected.delete(+b.dataset.remove);updateSelection();syncFavorites();const buttons=document.querySelectorAll('[data-remove]');(buttons[Math.min(index,buttons.length-1)]||document.querySelector('[data-close="selectionDialog"]')).focus()});
document.getElementById('selectionButton').addEventListener('click',()=>showDialog('selectionDialog'));
const menu=document.getElementById('menuButton'),navigation=document.getElementById('navigation');
function closeMenu(){navigation.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Abrir menu')}
menu.addEventListener('click',()=>{const open=navigation.classList.toggle('open');menu.setAttribute('aria-expanded',open);menu.setAttribute('aria-label',open?'Fechar menu':'Abrir menu')});
navigation.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&navigation.classList.contains('open')){closeMenu();menu.focus()}});
document.addEventListener('click',e=>{if(!e.target.closest('.header'))closeMenu()});
window.matchMedia('(min-width:801px)').addEventListener('change',closeMenu);
document.getElementById('year').textContent=new Date().getFullYear();renderProducts();updateSelection();
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
