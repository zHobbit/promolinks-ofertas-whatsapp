// Nó "Code" (Run Once for All Items) — DETECÇÃO DE OFERTAS
// Varre o catálogo do Mercado Livre via cursor rotativo e devolve as ofertas
// com maior desconto por nicho. Lê credenciais do ambiente ($env).

const CLIENT_ID = $env.ML_CLIENT_ID, CLIENT_SECRET = $env.ML_CLIENT_SECRET;

// Mapa categoria/subcategoria do ML -> nicho (destino)
const CAT_NICHO = {
  // TECH / Eletrônicos
  'MLB1000':'tech','MLB1051':'tech','MLB1648':'tech','MLB1144':'tech','MLB1039':'tech',
  // CASA & Eletrodomésticos (+ Alimentos + Festas/Mesa Posta)
  'MLB1574':'casa','MLB5726':'casa','MLB1403':'casa','MLB12404':'casa',
  // FERRAMENTAS & Construção (+ Agro)
  'MLB263532':'ferramentas','MLB1500':'ferramentas','MLB271599':'ferramentas',
  // FIT (subcategorias precisas — fitness + suplementos, sem material médico)
  'MLB1338':'fit','MLB438178':'fit','MLB264201':'fit','MLB1339':'fit','MLB278252':'fit',
  // BEBÊS & Brinquedos
  'MLB1384':'bebes','MLB1132':'bebes',
  // ARTE & PAPELARIA (+ Livros + Música/Filmes)
  'MLB1368':'papelaria','MLB1196':'papelaria','MLB1168':'papelaria',
  // BELEZA & Joias (+ Moda/Calçados/Roupas)
  'MLB1246':'beleza','MLB3937':'beleza','MLB1430':'beleza',
  // PET / AUTO / INSTRUMENTOS
  'MLB1071':'pet','MLB5672':'auto','MLB1182':'instrumentos',
};
const WINDOW = 50, HL_LIMIT = 10, MIN = 20, IMPERDIVEL = 60, PER_NICHE = 8, BATCH = 8;
const CACHE_TTL = 7*24*3600*1000;

const sd = $getWorkflowStaticData('global');
let refreshToken = sd.ml_refresh_token || $env.ML_REFRESH_TOKEN;
let tk = await this.helpers.httpRequest({ method:'POST', url:'https://api.mercadolibre.com/oauth/token',
  headers:{'content-type':'application/x-www-form-urlencoded','accept':'application/json'},
  body:`grant_type=refresh_token&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&refresh_token=${refreshToken}` });
if (typeof tk === 'string') tk = JSON.parse(tk);
const token = tk.access_token;
if (tk.refresh_token) sd.ml_refresh_token = tk.refresh_token;

const auth = { Authorization: 'Bearer ' + token };
const GET = async (url) => { try { return await this.helpers.httpRequest({ method:'GET', url, headers:auth, json:true }); } catch(e){ return null; } };
const batches = async (arr, fn) => { const out=[]; for (let i=0;i<arr.length;i+=BATCH){ out.push(...await Promise.all(arr.slice(i,i+BATCH).map(fn))); } return out; };

// 1) lista COMPLETA de (sub)categorias — cache invalida sozinho se CAT_NICHO mudar
const catSig = Object.entries(CAT_NICHO).map(([k,v]) => k+':'+v).sort().join('|');
let allCats = sd.all_cats;
if (!allCats || sd.all_cats_sig !== catSig || !sd.all_cats_ts || (Date.now()-sd.all_cats_ts) > CACHE_TTL) {
  allCats = [];
  await batches(Object.entries(CAT_NICHO), async ([cat, nicho]) => {
    allCats.push({ cat, nicho });
    const c = await GET(`https://api.mercadolibre.com/categories/${cat}`);
    (c && c.children_categories ? c.children_categories : []).forEach(k => allCats.push({ cat:k.id, nicho }));
  });
  sd.all_cats = allCats; sd.all_cats_ts = Date.now(); sd.all_cats_sig = catSig;
}

// 2) janela rotativa (continua de onde parou — não re-escaneia o topo toda vez)
let cur = sd.cat_cursor || 0;
if (cur >= allCats.length) cur = 0;
const slice = [];
for (let i=0;i<Math.min(WINDOW, allCats.length);i++) slice.push(allCats[(cur+i)%allCats.length]);
sd.cat_cursor = (cur + WINDOW) % allCats.length;

// 3) highlights (mais vendidos) da fatia -> produtos únicos
const prodNicho = {};
await batches(slice, async ({cat, nicho}) => {
  const hl = await GET(`https://api.mercadolibre.com/highlights/MLB/category/${cat}?limit=${HL_LIMIT}`);
  (hl && hl.content ? hl.content : []).forEach(c => { if (c.type==='PRODUCT' && !prodNicho[c.id]) prodNicho[c.id]=nicho; });
});

// 4) preço/desconto de cada produto
const found = [];
await batches(Object.keys(prodNicho), async (pid) => {
  const it = await GET(`https://api.mercadolibre.com/products/${pid}/items?limit=1`);
  const r = it && it.results && it.results[0];
  if (!r || !r.price || !r.original_price || r.original_price <= r.price) return;
  const desc = Math.round((r.original_price - r.price)/r.original_price*1000)/10;
  if (desc < MIN) return;
  found.push({ pid, r, desc, nicho: prodNicho[pid] });
});

// 5) multi-nicho (categoria + "imperdíveis" se >=60%) e top por nicho
const entries = [];
for (const f of found) {
  const niches = [f.nicho];
  if (f.desc >= IMPERDIVEL) niches.push('imperdiveis');
  for (const n of niches) entries.push({ ...f, nicho: n });
}
const byNicho = {};
for (const e of entries) (byNicho[e.nicho] = byNicho[e.nicho] || []).push(e);
const top = [];
for (const n of Object.keys(byNicho)) { byNicho[n].sort((a,b)=>b.desc-a.desc); top.push(...byNicho[n].slice(0, PER_NICHE)); }

// 6) detalhes (nome + imagem) e monta as ofertas
const deals = [];
await batches(top, async ({pid, r, desc, nicho}) => {
  const prod = await GET(`https://api.mercadolibre.com/products/${pid}`);
  if (!prod) return;
  deals.push({ json: {
    fonte:'mercadolivre', id_externo: pid, titulo: prod.name || 'Oferta',
    url_original: `https://www.mercadolivre.com.br/p/${pid}`,
    imagem_url: (prod.pictures && prod.pictures[0] && prod.pictures[0].url) || '',
    categoria_loja: r.category_id || '', preco_atual: r.price, preco_de: r.original_price,
    desconto_pct: desc, nicho,
    free_shipping: !!(r.shipping && r.shipping.free_shipping),
    hash_dedup: `mercadolivre:${pid}:${nicho}`,
  }});
});
return deals;
