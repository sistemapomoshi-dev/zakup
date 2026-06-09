# Zakup

AI-приложение для закупщиков: переговоры о скидках с поставщиками.

## Стек

- **Backend:** Bun, Hono, Prisma, PostgreSQL
- **Webapp:** React, Vite, TanStack Query/Router, shadcn/ui
- **Contracts:** Zod (shared schemas)

## Быстрый старт (Windows)

### Prerequisites

- [Bun](https://bun.sh) — `npm install -g bun`
- PostgreSQL 17+ (или Docker Desktop + `docker compose up -d postgres` для PG 18)

### Установка

```powershell
cd "e:\Cursor\Новый проект"
bun install

# backend/.env и webapp/.env уже настроены для localhost:5432
bun run --cwd backend prisma:migrate

# Backend
bun run --cwd backend prisma:generate:raw
bun --cwd backend --watch src/index.ts

# Webapp (другой терминал)
bun run dev:webapp
```

- API: http://localhost:3000
- Webapp: http://localhost:5173
- Поставщики: http://localhost:5173/suppliers
- Настройки почты: http://localhost:5173/settings/mailbox
- Переписка: http://localhost:5173/suppliers/{id}/mail

### Синхронизация почты (cron)

```powershell
bun run --cwd backend start:cron mail:sync-all
```

### Синхронизация МойСклад (cron)

```powershell
bun run --cwd backend start:cron moysklad:sync
```

Укажите `MOYSKLAD_LOGIN` и `MOYSKLAD_PASSWORD` в `backend/.env`. Привяжите поставщика к контрагенту через поле `moyskladCounterpartyId`.

### Розничные цены с маркетплейсов (cron)

```powershell
bun run --cwd backend start:cron retail:sync
```

Автопривязка по штрихкоду/артикулу из МойСклад (WB, Ozon, Яндекс Маркет). В таблице прайса в переписке — медиана розницы, наценка и макс. опт при целевой марже (`RETAIL_TARGET_MARGIN_PERCENT`, по умолчанию 30%).

### AI и черновики (Фаза E)

- При новом входящем письме от привязанного поставщика AI создаёт стратегию и черновик ответа
- Без `YANDEX_GPT_API_KEY` используется dev-mock (для локальной разработки)
- Workflow: `черновик` → `на согласовании` → `одобрен` → `отправлен` (SMTP)
- UI: http://localhost:5173/drafts, стратегия: `/suppliers/{id}/negotiation`

```env
# backend/.env
YANDEX_GPT_API_KEY=""
YANDEX_GPT_FOLDER_ID=""
AI_AUTO_ANALYZE="true"
```

### Роли

- `manager` — ведёт переговоры, создаёт поставщиков
- `approver` — одобряет черновики (фаза E)
- `admin` — полный доступ

## Фазы разработки

- [x] A — Поставщики, роли, базовый UI
- [x] B — IMAP/SMTP почта, синхронизация, переписка по поставщику
- [x] C — Парсинг вложений
- [x] D — МойСклад API
- [x] D2 — Розничные цены с маркетплейсов
- [x] E — YandexGPT + workflow одобрения
- [ ] F — Yandex Cloud deploy
