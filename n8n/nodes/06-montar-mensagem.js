// Nó "Code" — MONTAR MENSAGEM
// Monta a legenda (WhatsApp usa *negrito* ~riscado~) e já traz wpp_group/chat_id do banco.
const brl = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
const out = [];
for (const item of $input.all()) {
  const j = item.json;
  const titulo = (j.titulo || 'Oferta').slice(0, 160);
  const frete = j.free_shipping ? '\nFrete grátis' : '';
  // Telegram (HTML) — mantido caso volte a usar
  const caption =
    `<b>${titulo}</b>\n\n<b>${j.desconto_pct}% OFF</b>\n` +
    `De <s>${brl(j.preco_de)}</s> por <b>${brl(j.preco_atual)}</b>${frete}` +
    `\n\n<a href="${j.url_afiliada}">PEGAR OFERTA</a>`;
  // WhatsApp (markdown próprio)
  const caption_wpp =
    `*${titulo}*\n\n*${j.desconto_pct}% OFF*\n` +
    `De ~${brl(j.preco_de)}~ por *${brl(j.preco_atual)}*${frete}` +
    `\n\n${j.url_afiliada}`;
  out.push({ json: { ...j, chat_id: j.tg_chat, caption, wpp_group: j.wpp_group, caption_wpp } });
}
return out;
