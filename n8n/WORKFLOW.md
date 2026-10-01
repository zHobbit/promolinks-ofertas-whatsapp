# Workflow n8n — "Ofertas ML → WhatsApp"

Fluxo único, agendado, que detecta descontos no Mercado Livre, gera link de afiliado
e posta nos grupos do WhatsApp segmentados por nicho.

## Diagrama

```
Schedule Trigger (a cada 30 min)
      │
      ▼
Code: Detecção            → varre o catálogo (cursor rotativo) e acha as ofertas  [nodes/01-deteccao.js]
      ▼
Code: Preparar dedup      → junta tudo num payload JSON                            [nodes/02-preparar-dedup.js]
      ▼
Postgres: Dedup           → INSERT ON CONFLICT + JOIN nichos (só as novas)         [nodes/03-dedup.sql]
      ▼
Code: Restaurar           → desembrulha o resultado                               [nodes/04-restaurar.js]
      ▼
Code: Gerar link afiliado → cria o link meli.la (cookies do Linkbuilder)          [nodes/05-gerar-link-afiliado.js]
      ▼
Code: Montar mensagem     → monta a legenda + grupo de destino (do banco)         [nodes/06-montar-mensagem.js]
      ▼
HTTP: Enviar WhatsApp     → POST pro Evolution API (sendMedia), throttle 30s
```

## Nó "Enviar WhatsApp" (HTTP Request)

- **Method:** POST
- **URL:** `http://evolution-api:8080/message/sendMedia/promolinks`
- **Headers:** `apikey: <EVOLUTION_API_KEY>`
- **Body (JSON, Using Fields Below):**
  - `number` = `{{ $json.wpp_group }}`
  - `mediatype` = `image`
  - `media` = `{{ $json.imagem_url }}`
  - `caption` = `{{ $json.caption_wpp }}`
- **Options → Batching:** Items per Batch `1`, Batch Interval `30000` (30s — anti-flood)
- **On Error:** Continue (using error output) — grupo vazio não derruba o fluxo

## Credenciais / ambiente

- **Postgres** (credencial do n8n): host `postgres`, db `app`, user/senha do `.env`
- **Mercado Livre:** `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REFRESH_TOKEN` (OAuth, renova sozinho),
  e `ML_AFF_TAG` + `ML_AFF_COOKIE` (afiliado)
- As variáveis `ML_*`, `TELEGRAM_*`, `EVOLUTION_*` precisam estar no bloco `environment`
  do serviço `n8n` no `docker-compose.yml` (não só no `.env`) para o `$env` enxergá-las.

## Observações de projeto

- **Dedup** é no Postgres (robusto, funciona até em execução manual), hash = `fonte:id:nicho`.
- **Cursor rotativo**: a lista de (sub)categorias é cacheada em `staticData` e o cursor
  avança a cada run, explorando o catálogo todo ao longo do tempo. O cache se invalida
  sozinho quando o `CAT_NICHO` muda (assinatura `catSig`).
- **Multi-nicho**: uma oferta pode cair em mais de um grupo (ex.: categoria + Imperdíveis).
- **Só admin posta** nos grupos (announcement) e as mensagens expiram em 90 dias (nativo).
