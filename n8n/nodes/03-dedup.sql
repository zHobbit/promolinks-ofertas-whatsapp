-- Nó "Postgres" (Execute Query) — DEDUP + ROTEAMENTO
-- Query Parameters: {{ [$json.payload] }}  (um único parâmetro $1 = array JSON de ofertas)
--
-- Insere as ofertas; ON CONFLICT (hash_dedup) DO NOTHING garante que nada se repete
-- (hash = produto+nicho). RETURNING só traz as NOVAS. O JOIN com `nichos` já anexa
-- o grupo de WhatsApp (e canal de Telegram, se houver) de destino.
WITH ins AS (
  INSERT INTO ofertas
    (hash_dedup, fonte, id_externo, nicho_id, titulo, url_original, imagem_url,
     categoria_loja, preco_atual, preco_de, desconto_pct, raw)
  SELECT x.hash_dedup, x.fonte, x.id_externo,
         (SELECT id FROM nichos WHERE slug = x.nicho),
         x.titulo, x.url_original, x.imagem_url, x.categoria_loja,
         x.preco_atual, x.preco_de, x.desconto_pct, x.raw
  FROM jsonb_to_recordset($1::jsonb) AS x(
    hash_dedup text, fonte text, id_externo text, nicho text, titulo text,
    url_original text, imagem_url text, categoria_loja text,
    preco_atual numeric, preco_de numeric, desconto_pct numeric, raw jsonb)
  ON CONFLICT (hash_dedup) DO NOTHING
  RETURNING raw, nicho_id
)
SELECT ins.raw || jsonb_build_object(
  'wpp_group', n.whatsapp_group_id,
  'tg_chat', n.telegram_chat_id
) AS item
FROM ins JOIN nichos n ON n.id = ins.nicho_id;
