-- ==========================================================
--  Schema da automação de descontos
--  Roda automaticamente na PRIMEIRA subida do Postgres.
--  Banco: app  (mesmo do n8n, mas n8n fica no schema "n8n")
-- ==========================================================

-- Schema dedicado pro n8n (n8n cria as tabelas dele aqui sozinho)
CREATE SCHEMA IF NOT EXISTS n8n;

-- Nossa aplicação usa o schema public (padrão)

-- ----------------------------------------------------------
--  NICHOS  — cada nicho vira um canal/grupo de destino
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS nichos (
    id                SERIAL PRIMARY KEY,
    slug              TEXT UNIQUE NOT NULL,         -- ex: 'tech', 'auto', 'fit'
    nome              TEXT NOT NULL,                -- ex: 'Tech/Eletrônicos/Games'
    telegram_chat_id  TEXT,                         -- preenchido na Fase 1
    whatsapp_group_id TEXT,                         -- preenchido na Fase 2
    desconto_minimo   NUMERIC(5,2) NOT NULL DEFAULT 20.00,  -- % mínimo pra postar
    max_msgs_dia      INT NOT NULL DEFAULT 15,
    ativo             BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
--  KEYWORDS  — palavras que ajudam a classificar o nicho
--  (usado como fallback quando a categoria da loja não basta)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS keywords_nicho (
    id        SERIAL PRIMARY KEY,
    nicho_id  INT NOT NULL REFERENCES nichos(id) ON DELETE CASCADE,
    palavra   TEXT NOT NULL,                        -- minúscula, sem acento
    peso      INT NOT NULL DEFAULT 1,
    UNIQUE (nicho_id, palavra)
);
CREATE INDEX IF NOT EXISTS idx_keywords_palavra ON keywords_nicho (palavra);

-- ----------------------------------------------------------
--  OFERTAS  — toda oferta detectada (fonte da verdade + dedup)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS ofertas (
    id                 BIGSERIAL PRIMARY KEY,
    fonte              TEXT NOT NULL,               -- 'mercadolivre', 'promobit', 'amazon'...
    id_externo         TEXT,                        -- id do produto na origem (ex: MLB123)
    titulo             TEXT NOT NULL,
    url_original       TEXT NOT NULL,
    url_afiliada       TEXT,                        -- preenchida na etapa de geração de link
    imagem_url         TEXT,
    categoria_loja     TEXT,                        -- categoria que veio da fonte
    preco_atual        NUMERIC(12,2),
    preco_de           NUMERIC(12,2),               -- preço "de" / cheio
    desconto_pct       NUMERIC(5,2),
    nicho_id           INT REFERENCES nichos(id),   -- definido pelo classificador
    -- dedup: hash estável da oferta (ex: fonte+id_externo, ou hash do título+url)
    hash_dedup         TEXT UNIQUE NOT NULL,
    -- controle de fluxo
    status             TEXT NOT NULL DEFAULT 'detectada',
                       -- detectada -> classificada -> com_link -> enviada / descartada
    detectado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    enviado_em         TIMESTAMPTZ,
    raw                JSONB                        -- payload bruto da fonte, pra debug
);
CREATE INDEX IF NOT EXISTS idx_ofertas_status     ON ofertas (status);
CREATE INDEX IF NOT EXISTS idx_ofertas_nicho      ON ofertas (nicho_id);
CREATE INDEX IF NOT EXISTS idx_ofertas_detectado  ON ofertas (detectado_em);

-- ----------------------------------------------------------
--  ENVIOS  — log de cada postagem (idempotência + rate limit)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS envios (
    id          BIGSERIAL PRIMARY KEY,
    oferta_id   BIGINT NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
    nicho_id    INT NOT NULL REFERENCES nichos(id),
    canal       TEXT NOT NULL,                      -- 'telegram' | 'whatsapp'
    destino     TEXT NOT NULL,                      -- chat_id / group_id usado
    sucesso     BOOLEAN NOT NULL DEFAULT FALSE,
    erro        TEXT,
    enviado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_envios_nicho_data ON envios (nicho_id, enviado_em);

-- View auxiliar: quantas mensagens cada nicho já enviou hoje (pra rate limit)
CREATE OR REPLACE VIEW v_envios_hoje AS
SELECT nicho_id,
       canal,
       count(*) FILTER (WHERE sucesso) AS enviados_hoje
FROM envios
WHERE enviado_em >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')
GROUP BY nicho_id, canal;
