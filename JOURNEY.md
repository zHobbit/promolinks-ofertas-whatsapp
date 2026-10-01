# A Jornada — do zero a um sistema de ofertas no ar

Este documento conta a construção do PROMOLINKS **passo a passo**, com os problemas reais
que apareceram e como cada um foi resolvido. É mais um diário de bordo do que um manual —
a ideia é que os perrengues (e as soluções) fiquem registrados.

---

## 1. Planejamento

Decisões que guiaram tudo:
- **Low-code (n8n)** self-hosted via **Docker**, rodando no PC.
- **Postgres** junto do n8n (dedup + roteamento).
- **Telegram primeiro** (sem risco de ban) para validar o fluxo; **WhatsApp depois**.
- **Começar só com Mercado Livre**; critério de desconto evoluindo (de % fixo até priorizar as maiores).
- Nichos segmentados, um grupo/canal por nicho.

**Aprendizado:** validar o fluxo na plataforma mais "barata" (Telegram) antes de encarar a arriscada (WhatsApp) economizou muita dor.

---

## 2. A batalha da infraestrutura (a mais longa!)

Instalar o Docker no Windows virou uma saga de camadas:

1. **Docker não instalado** → baixar Docker Desktop.
2. **WSL2 não instalado** → `wsl --install` (precisa admin + reboot).
3. **"Virtualization not detected"** → faltava a *Plataforma de Máquina Virtual* + `hypervisorlaunchtype auto` (bcdedit) + reboot.
4. **Ainda não subia** → o **Event Log (ID 44)** revelou a causa raiz: **"recurso Sem Execução (NX) não está habilitado no BIOS"**. O NX (Execute Disable) estava desligado na BIOS (CPU AMD Ryzen). Ativar na BIOS → hypervisor subiu.
5. **Engine travado / "Inference manager"** → sockets órfãos na pasta `Docker/run` + recurso de IA; limpamos e desativamos.
6. **Distro `docker-desktop` não registrava** → limpamos a distro antiga; com o hypervisor OK, registrou.

**Aprendizados:**
- No Windows, Docker = WSL2 = **hypervisor** = precisa de **virtualização E NX** habilitados na BIOS.
- O **Visualizador de Eventos do Windows** (Event ID 44) é ouro para diagnosticar falha de hypervisor.
- Diagnosticar com dados (`HyperVisorPresent`, `bcdedit`, event log) >>> tentar no chute.

---

## 3. Telegram (a fase de validação)

- Bot criado no **@BotFather**; `chat_id` de cada canal descoberto via `getUpdates` (postando uma msg).
- Primeiro envio formatado (HTML) funcionou.
- **Perrengue:** no Windows, `curl -d` com emoji quebrava ("must be encoded in UTF-8"). Solução: salvar o JSON num arquivo UTF-8 e usar `--data-binary @arquivo`.

**Aprendizado:** o shell do Windows + emojis + curl não se dão bem; arquivo UTF-8 resolve.

---

## 4. API do Mercado Livre

Descobertas importantes (testando endpoint por endpoint):
- **`/sites/MLB/search` está BLOQUEADO (403)** desde 2024 — nada de busca.
- **Funcionam:** `/highlights/MLB/category/{id}` (mais vendidos por categoria), `/products/{id}` (nome/imagem), `/products/{id}/items` (preço, `original_price`, frete), `/categories/{id}` (subcategorias).
- **OAuth exige PKCE** (`code_challenge`/`code_verifier`) — sem isso dá `code_verifier is a required parameter`.
- **Redirect localhost é rejeitado** no OAuth → usamos `https://httpbin.org/anything` (ecoa o `code` na tela).
- O **token expira em 6h**, mas o `refresh_token` renova sozinho (o fluxo faz isso a cada run).

**Perrengue clássico:** o `$env` do n8n vinha **vazio** — as variáveis `ML_*` precisavam estar no bloco `environment` do serviço n8n no `docker-compose.yml`, **não só no `.env`**.

---

## 5. Link de afiliado do Mercado Livre (sem API oficial)

- **Não existe API pública** de geração de link de afiliado.
- Solução: replicar o **endpoint interno** do painel Linkbuilder
  (`POST /affiliate-program/api/v2/affiliates/createLink`), usando **cookies de sessão + CSRF**
  capturados via DevTools ("Copy as cURL").
- **Evolução importante:** em vez de fixar o CSRF (que rotaciona rápido e derrubava tudo),
  o fluxo passou a **buscar o CSRF fresco** da página do Linkbuilder a cada execução
  (o cookie `ssid` dura bem mais). Só precisa recapturar o cookie de tempos em tempos —
  e o fluxo **avisa no WhatsApp** quando isso acontece.

**Aprendizado:** quando não há API, o endpoint interno + cookies funciona, mas é frágil;
isolar a parte que expira (CSRF) e renovar automaticamente deixa muito mais robusto.

---

## 6. WhatsApp via Evolution API (o segundo boss)

- **QR "invisível":** configuramos `QRCODE_COLOR` preto num fundo escuro → QR sumia. (Também: o QR não vem pela REST, só pelo painel/websocket.)
- **Handshake "Timed Out" / QR não gerava:** versão do WhatsApp Web desatualizada no Baileys.
  Fix: `CONFIG_SESSION_PHONE_VERSION` com a versão atual (pegável do repositório do Baileys).
- **"SessionError: No sessions" ao enviar pra GRUPO:** bug do novo esquema **LID** do WhatsApp
  na imagem `atendai/evolution-api:2.2.3`. **Fix: trocar para `evoapicloud/evolution-api:v2.3.7`**
  (reconectou sem re-scan e resolveu). Envio 1:1 funcionava; só grupo falhava.

**Aprendizado:** WhatsApp não-oficial (Baileys) é sensível a versão. Quando "quase tudo funciona
menos grupo", suspeite de **versão da imagem/protocolo (LID)**.

---

## 7. Dedup — de frágil a robusto

- Primeira versão usava `staticData` do n8n. Problema: **execução manual não persiste** o staticData,
  então em testes as ofertas se repetiam.
- Solução: **dedup no Postgres** (`INSERT ... ON CONFLICT (hash_dedup) DO NOTHING RETURNING`),
  que é atômico e persiste sempre. Hash = `fonte:id:nicho`.

**Aprendizado:** estado que precisa sobreviver entre execuções deve ir pro **banco**, não pro staticData.

---

## 8. Volume e o cursor rotativo (o insight-chave)

- Sintoma: "poucas ofertas novas". Causa: o `highlights` devolve sempre os **mesmos ~20 mais vendidos**
  por categoria (é capado em ~20, ignora `limit` maior). Toda run começava do mesmo ponto → dedup barrava tudo.
- Solução: **cursor rotativo** — mapear TODAS as subcategorias (cacheado), e a cada run varrer uma
  **janela** diferente, avançando um cursor. Assim o catálogo inteiro é explorado ao longo do tempo.

**Aprendizado:** quando a fonte é uma lista fixa, a chave não é "buscar mais fundo" de uma vez,
e sim **paginar/rotacionar** o ponto de partida entre execuções.

---

## 9. Classificação de nichos (o problema do "produto que não combina")

- Mapear uma **categoria-topo** e varrer TODAS as filhas trazia itens fora do tema:
  - **Saúde → Fit** trouxe cadeira de banho e luvas (material médico). Fix: mapear só a subcategoria
    **Suplementos** (e as de fitness), não a Saúde inteira.
  - **Festas → Papelaria** trouxe talheres, taças e chapéus de fantasia. Fix: Festas foi pra **Casa**
    (mesa posta combina), e Papelaria ficou só com papelaria/livros/mídia.
- **Bug sutil do cache:** ao editar o mapa de nichos, o **cache de categorias (7 dias) não atualizava**.
  Fix: o cache agora guarda uma **assinatura** do mapa e se **invalida sozinho** quando o mapa muda.

**Aprendizado:** categorias amplas são heterogêneas — às vezes o certo é mapear no nível de **subcategoria**.
E todo cache precisa de uma estratégia de **invalidação**.

---

## 10. Multi-nicho

Regra de negócio: uma oferta pode pertencer a **mais de um grupo** (ex.: um celular 65% OFF vai pro
grupo Tech **e** pro Imperdíveis). Implementado emitindo a oferta uma vez por nicho, com hash por `id:nicho`.

---

## 11. Consolidação de nichos (25 → 11)

Começamos com 1 nicho por categoria do ML (~25). Muitos eram redundantes (mesmos produtos) ou vazios.
Analisando as ofertas reais que caíam em cada grupo, fundimos:
`tech` (eletrônicos+celulares+informática+games+câmeras), `casa` (+eletrodomésticos+alimentos+festas),
`ferramentas` (+construção+agro), `fit` (fitness+suplementos), `beleza` (+joias+moda), `bebes` (+brinquedos),
`papelaria` (+livros+mídia). Resultado: **11 nichos** enxutos.

**Aprendizado:** deixe os **dados reais** guiarem a taxonomia; granularidade demais dilui a audiência.

---

## 12. Identidade visual

- Logos gerados com **Pillow** em container Python (sem depender de nada instalado).
- Mascote capivara → depois um **jogo de ícones temáticos** por nicho (recortados de uma imagem e **centralizados** detectando o conteúdo não-branco).
- Fotos aplicadas nos grupos (Evolution) e canais via API.

---

## 13. Anti-ban / boas práticas de WhatsApp

- Número pessoal = **risco de ban**. Mitigações: **"só admin posta"** (announcement) nos grupos,
  **throttle de 30s** entre envios (evita rajada — o pior sinal de spam), mensagens expirando em **90 dias** (nativo).
- Recomendação forte para escala: **chip dedicado**.

**Aprendizado:** o que mais queima número é **rajada** e **volume diário**; espaçar + limitar é essencial.

---

## 14. Remoção do Telegram

Depois de validar, o foco virou 100% WhatsApp. Removemos os nós do Telegram e **migramos os alertas**
(cookie expirado) para uma mensagem no **próprio WhatsApp** do admin (via Evolution) — zero dependência do Telegram.

---

## 15. Shopee (pausado)

Virou afiliado Shopee, mas a **Open API dos Afiliados exige acesso aprovado** (não liberado ainda).
Sem ela: não dá pra pegar ofertas nem gerar links de forma confiável (scraping é bloqueado). Fica
pausado até aprovar — e aí a integração é limpa (a API oficial já devolve o link de afiliado pronto).

---

## 16. Lições gerais

- **Diagnostique com dados** (logs, event viewer, respostas da API) antes de agir.
- **Valide o caminho barato primeiro** (Telegram antes do WhatsApp).
- **Estado durável → banco**, não cache volátil; e **todo cache precisa invalidar**.
- APIs mudam/bloqueiam: tenha **plano B** (endpoint interno, versão de imagem, rotação).
- Em automação de mensagens, **anti-flood e anti-ban** são requisito, não enfeite.
- **Deixe os dados guiarem o produto** (taxonomia de nichos, threshold de desconto).

---

*Construído com muita paciência, muitos reboots e um pouco de capivara.*
