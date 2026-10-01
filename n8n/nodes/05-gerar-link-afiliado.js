// Nó "Code" — GERAR LINK DE AFILIADO (Mercado Livre)
// Não há API oficial: usa-se o endpoint interno do painel Linkbuilder com os cookies
// de sessão (ML_AFF_COOKIE). O CSRF é buscado fresco a cada execução (a sessão/ssid
// dura mais que o csrf). Se a sessão morrer, alerta o admin no WhatsApp.
//
// SEGREDOS vêm do ambiente/placeholder — troque antes de usar:
const tag = $env.ML_AFF_TAG;
const cookie = $env.ML_AFF_COOKIE;
const EVOLUTION_KEY = 'YOUR_EVOLUTION_API_KEY';   // mesma chave do Evolution
const ADMIN_NUMBER  = 'YOUR_WHATSAPP_NUMBER';     // seu número p/ receber alertas (só dígitos, ex: 5511999999999)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

const alerta = async (texto) => {
  try { await this.helpers.httpRequest({ method:'POST',
    url:'http://evolution-api:8080/message/sendText/promolinks',
    headers:{ 'apikey':EVOLUTION_KEY, 'content-type':'application/json' },
    body:{ number:ADMIN_NUMBER, text: texto }, json:true }); } catch(e){}
};

// 1) CSRF fresco da página do Linkbuilder
let csrf = null;
try {
  const page = await this.helpers.httpRequest({ method:'GET',
    url:'https://www.mercadolivre.com.br/afiliados/linkbuilder',
    headers:{ 'user-agent':UA, 'cookie':cookie }, json:false });
  const m = String(page).match(/csrf-token"\s+content="([^"]+)"/i);
  if (m) csrf = m[1];
} catch(e){}
if (!csrf) {
  await alerta('PROMOLINKS: a SESSÃO do Mercado Livre expirou (sem CSRF). Recapture os cookies do Linkbuilder e atualize ML_AFF_COOKIE no .env, depois rode "docker compose up -d".');
  return [];
}

const gerar = async (url) => {
  try {
    let resp = await this.helpers.httpRequest({
      method:'POST', url:'https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink',
      headers:{ 'accept':'application/json, text/plain, */*','content-type':'application/json',
        'origin':'https://www.mercadolivre.com.br','referer':'https://www.mercadolivre.com.br/afiliados/linkbuilder',
        'user-agent':UA,'x-csrf-token':csrf,'cookie':cookie },
      body:{ urls:[url], tag }, json:true });
    if (typeof resp === 'string') resp = JSON.parse(resp);
    const u = resp && resp.urls && resp.urls[0];
    return (u && u.short_url) ? u.short_url : null;
  } catch(e){ return null; }
};

const items = $input.all();
const total = items.length;
const out = [];
for (const item of items) {
  let link = await gerar(item.json.url_original);
  if (!link) link = await gerar(item.json.url_original);   // 1 retry p/ falha momentânea
  if (link) { item.json.url_afiliada = link; out.push(item); }
}

// Alerta SÓ quando TUDO falhou (= problema real, não 1 item esporádico)
if (total >= 8 && out.length === 0) {
  await alerta('PROMOLINKS: TODOS os ' + total + ' links de afiliado falharam. Provável sessão/cookie expirado — recapture o cURL do Linkbuilder e atualize ML_AFF_COOKIE no .env.');
}
return out;
