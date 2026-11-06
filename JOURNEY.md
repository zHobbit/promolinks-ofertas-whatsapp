# The Journey: from zero to a live deals system

This document tells how PROMOLINKS was built **step by step**, with the real problems that came up and how each one was solved. It is more of a logbook than a manual: the idea is to keep the roadblocks (and the fixes) on record.

---

## 1. Planning

Decisions that guided everything:
- **Low-code (n8n)**, self-hosted with **Docker**, running on my PC.
- **Postgres** next to n8n (dedup + routing).
- **Telegram first** (no ban risk) to validate the flow; **WhatsApp later**.
- **Start with Mercado Livre only**; the discount criteria evolved from a fixed percentage to prioritizing the biggest discounts.
- Niche segmentation, one group or channel per niche.

**Lesson:** validating the flow on the "cheap" platform (Telegram) before tackling the risky one (WhatsApp) saved a lot of pain.

---

## 2. The infrastructure battle (the longest one!)

Installing Docker on Windows turned into a saga of layers:

1. **Docker not installed** → download Docker Desktop.
2. **WSL2 not installed** → `wsl --install` (needs admin + reboot).
3. **"Virtualization not detected"** → the *Virtual Machine Platform* feature was missing, plus `hypervisorlaunchtype auto` (bcdedit) + reboot.
4. **Still would not start** → the **Event Log (ID 44)** revealed the root cause: **"No Execute (NX) is not enabled in the BIOS"**. NX (Execute Disable) was turned off in the BIOS (AMD Ryzen CPU). Enabling it brought the hypervisor up.
5. **Engine stuck / "Inference manager"** → orphaned sockets in the `Docker/run` folder plus the AI feature; cleaned them up and disabled it.
6. **The `docker-desktop` distro would not register** → removed the old distro; with the hypervisor working, it registered.

**Lessons:**
- On Windows, Docker = WSL2 = **hypervisor** = you need **virtualization AND NX** enabled in the BIOS.
- The **Windows Event Viewer** (Event ID 44) is gold for diagnosing hypervisor failures.
- Diagnosing with data (`HyperVisorPresent`, `bcdedit`, event log) >>> guessing.

---

## 3. Telegram (the validation phase)

- Bot created with **@BotFather**; each channel's `chat_id` found via `getUpdates` (after posting a message).
- The first formatted (HTML) message worked.
- **Roadblock:** on Windows, `curl -d` with emoji broke ("must be encoded in UTF-8"). Fix: save the JSON to a UTF-8 file and use `--data-binary @file`.

**Lesson:** the Windows shell, emoji and curl do not get along; a UTF-8 file solves it.

---

## 4. The Mercado Livre API

Important findings (testing endpoint by endpoint):
- **`/sites/MLB/search` has been BLOCKED (403)** since 2024, so no search.
- **What works:** `/highlights/MLB/category/{id}` (best sellers per category), `/products/{id}` (name/image), `/products/{id}/items` (price, `original_price`, shipping), `/categories/{id}` (subcategories).
- **OAuth requires PKCE** (`code_challenge`/`code_verifier`); without it you get `code_verifier is a required parameter`.
- **A localhost redirect is rejected** by OAuth → I used `https://httpbin.org/anything` (it echoes the `code` on screen).
- The **token expires in 6h**, but the `refresh_token` renews it automatically (the flow does this on every run).

**Classic roadblock:** n8n's `$env` was **empty**. The `ML_*` variables had to be in the `environment` block of the n8n service in `docker-compose.yml`, **not only in `.env`**.

---

## 5. Mercado Livre affiliate links (no official API)

- **There is no public API** for generating affiliate links.
- Solution: replicate the **internal endpoint** of the Linkbuilder panel
  (`POST /affiliate-program/api/v2/affiliates/createLink`), using **session cookies + CSRF**
  captured from DevTools ("Copy as cURL").
- **Key improvement:** instead of hard-coding the CSRF token (it rotates fast and broke everything),
  the flow now **fetches a fresh CSRF token** from the Linkbuilder page on every run
  (the `ssid` cookie lasts much longer). The cookie only needs to be captured again from time to time,
  and the flow **sends a WhatsApp alert** when that happens.

**Lesson:** when there is no API, an internal endpoint + cookies works, but it is fragile.
Isolating the part that expires (CSRF) and renewing it automatically makes it much more robust.

---

## 6. WhatsApp via Evolution API (the second boss)

- **"Invisible" QR code:** I had set `QRCODE_COLOR` to black on a dark background, so the QR disappeared. (Also: the QR is not returned by REST, only by the panel/websocket.)
- **Handshake "Timed Out" / QR never generated:** outdated WhatsApp Web version in Baileys.
  Fix: set `CONFIG_SESSION_PHONE_VERSION` to the current version (available in the Baileys repository).
- **"SessionError: No sessions" when sending to a GROUP:** a bug with WhatsApp's new **LID** scheme
  in the `atendai/evolution-api:2.2.3` image. **Fix: switch to `evoapicloud/evolution-api:v2.3.7`**
  (it reconnected without a new scan and solved it). Direct messages worked; only groups failed.

**Lesson:** unofficial WhatsApp (Baileys) is version-sensitive. When "everything works except groups",
suspect the **image/protocol version (LID)**.

---

## 7. Dedup: from fragile to robust

- The first version used n8n's `staticData`. Problem: **manual executions do not persist** staticData,
  so deals repeated during testing.
- Solution: **dedup in Postgres** (`INSERT ... ON CONFLICT (hash_dedup) DO NOTHING RETURNING`),
  which is atomic and always persists. Hash = `source:id:niche`.

**Lesson:** state that must survive between runs belongs in the **database**, not in staticData.

---

## 8. Volume and the rotating cursor (the key insight)

- Symptom: "few new deals". Cause: `highlights` always returns the **same ~20 best sellers**
  per category (it caps at ~20 and ignores a higher `limit`). Every run started from the same point, so dedup blocked everything.
- Solution: a **rotating cursor**. Map ALL subcategories (cached), and on each run scan a different
  **window**, advancing a cursor. That way the whole catalog gets explored over time.

**Lesson:** when the source is a fixed list, the key is not "digging deeper" at once,
but **paginating/rotating** the starting point between runs.

---

## 9. Niche classification (the "product that doesn't fit" problem)

- Mapping a **top-level category** and scanning ALL of its children brought off-topic items:
  - **Health → Fit** brought shower chairs and gloves (medical supplies). Fix: map only the
    **Supplements** subcategory (and the fitness ones), not all of Health.
  - **Parties → Stationery** brought cutlery, glasses and costume hats. Fix: Parties moved to **Home**
    (table settings fit there), and Stationery kept only stationery/books/media.
- **Subtle cache bug:** after editing the niche map, the **category cache (7 days) did not update**.
  Fix: the cache now stores a **signature** of the map and **invalidates itself** when the map changes.

**Lesson:** broad categories are heterogeneous; sometimes the right move is to map at the **subcategory** level.
And every cache needs an **invalidation** strategy.

---

## 10. Multi-niche

Business rule: a deal can belong to **more than one group** (for example, a phone at 65% off goes to the
Tech group **and** to Unmissable). Implemented by emitting the deal once per niche, with a hash per `id:niche`.

---

## 11. Consolidating niches (25 → 11)

I started with one niche per Mercado Livre category (~25). Many were redundant (same products) or empty.
Looking at the real deals landing in each group, I merged them:
`tech` (electronics+phones+computers+games+cameras), `casa` (+appliances+food+parties),
`ferramentas` (+construction+agro), `fit` (fitness+supplements), `beleza` (+jewelry+fashion), `bebes` (+toys),
`papelaria` (+books+media). Result: **11 lean niches**.

**Lesson:** let **real data** drive the taxonomy; too much granularity dilutes the audience.

---

## 12. Visual identity

- Logos generated with **Pillow** inside a Python container (no local dependencies).
- A capybara mascot → later a **set of themed icons** per niche (cut from one image and **centered** by detecting the non-white content).
- Pictures applied to the groups (Evolution) and channels through the API.

---

## 13. Anti-ban / WhatsApp best practices

- Personal number = **ban risk**. Mitigations: **admin-only posting** (announcement mode) in the groups,
  a **30s throttle** between messages (bursts are the worst spam signal), and messages that expire after **90 days** (native feature).
- Strong recommendation for scale: a **dedicated SIM**.

**Lesson:** what burns a number fastest is **bursts** and **daily volume**; spacing and limiting are essential.

---

## 14. Removing Telegram

After validation, the focus became 100% WhatsApp. I removed the Telegram nodes and **moved the alerts**
(expired cookie) to a message on the admin's **own WhatsApp** (via Evolution), with zero dependency on Telegram.

---

## 15. Shopee (paused)

I became a Shopee affiliate, but the **Affiliate Open API requires approved access** (not granted yet).
Without it, there is no reliable way to get deals or generate links (scraping is blocked). It stays
paused until approval, and then the integration is clean (the official API already returns the affiliate link).

---

## 16. General lessons

- **Diagnose with data** (logs, event viewer, API responses) before acting.
- **Validate the cheap path first** (Telegram before WhatsApp).
- **Durable state → database**, not a volatile cache; and **every cache needs invalidation**.
- APIs change and get blocked: have a **plan B** (internal endpoint, image version, rotation).
- In messaging automation, **anti-flood and anti-ban** are requirements, not extras.
- **Let data drive the product** (niche taxonomy, discount threshold).

---

*Built with a lot of patience, a lot of reboots and a bit of capybara.*
