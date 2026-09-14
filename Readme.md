# LedgerPulse — Multi-Channel E-Commerce Profit Intelligence

> Real-time net margin, true cost-of-goods-sold (COGS), and granular fee reconciliation for independent Shopify and Etsy merchants.

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?logo=node.js)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?logo=postgresql)](https://www.postgresql.org)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io)
[![Redis](https://img.shields.io/badge/Redis-BullMQ-red?logo=redis)](https://redis.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)

---

## The Problem

Most e-commerce merchants track **gross revenue** while operating blind on actual net profit. Between platform transaction fees, payment processor cuts, dynamic ad spend, shipping overages, and manufacturing costs — surface-level dashboard metrics routinely mask loss-making SKUs.

**LedgerPulse** is a production-grade, multi-tenant financial engine that connects directly to Shopify, Etsy, and Meta Ads. It ingests live order streams, deducts exact line-item fees and COGS, and delivers true net-margin analytics down to the individual SKU — in real time.

---

## Key Features

| Feature | Details |
|---|---|
| **Multi-Channel Ingestion** | One-click OAuth 2.0 / PKCE handshake for Shopify and Etsy stores |
| **Granular Fee Engine** | Automated deduction: Etsy 6.5% transaction, $0.20 listing, 3%+$0.25 gateway; Shopify payment fees parsed from live transaction ledger |
| **Real Ad Spend Sync** | Meta Ads Insights API — rolling 3-day attribution window, integer-cent storage, NEEDS_REAUTH handling |
| **True Net Profit & POAS** | Net Profit = Gross − (COGS + Platform Fees + Daily Ad Spend); POAS = Gross Profit / Ad Spend |
| **SKU-Level COGS** | Bulk CSV upload or inline dashboard editing to map per-SKU base + packaging cost |
| **Idempotent Webhook Processing** | BullMQ workers with `idempotency_keys`, settlement-delay retries for Shopify fee lines |
| **Multi-Tenancy** | Row-level tenant isolation via Prisma query extension; AES-256-GCM encrypted OAuth tokens |
| **Shopify App Billing** | Recurring subscription charges via GraphQL — $29/mo Starter & $59/mo Growth with 14-day trials |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Ingestion Layer                              │
│                                                                  │
│  Shopify Webhooks  ──┐                                           │
│  Etsy Open API v3  ──┼──▶  Redis / BullMQ  ──▶  Order Worker    │
│  Meta Ads API      ──┘         Queues             Fee Worker     │
│                                                   Ad Spend Worker│
└──────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Data Layer                                   │
│                                                                  │
│  PostgreSQL (Prisma ORM)                                         │
│  ├─ tenants / channels / products                                │
│  ├─ orders / order_line_items (cogsAtOrderCents snapshot)        │
│  ├─ order_fees (GATEWAY_PROCESSING, LISTING, OFFSITE_ADS, …)     │
│  ├─ ad_spend_daily (META / GOOGLE / TIKTOK in integer cents)     │
│  └─ daily_metrics (Net Profit, POAS pre-aggregated)              │
└──────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Presentation Layer                           │
│                                                                  │
│  Next.js 14 (App Router) + Tailwind CSS + Shadcn UI             │
│  ├─ Executive Analytics Dashboard                                │
│  ├─ Products & COGS Management                                   │
│  ├─ Integrations & OAuth                                         │
│  └─ Billing & Plans                                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), Tailwind CSS, Shadcn UI, Lucide Icons |
| **Backend** | Node.js 20, Express.js, TypeScript |
| **Database** | PostgreSQL 15, Prisma ORM |
| **Queue & Jobs** | Redis, BullMQ (order processing, fee extraction, ad spend sync, aggregation) |
| **Integrations** | Shopify REST/GraphQL Admin API, Etsy Open API v3, Meta Graph API v19.0, Resend |
| **Security** | JWT, AES-256-GCM token encryption, Shopify HMAC validation, Etsy PKCE S256 |

---

## Database Schema Design

All monetary values are stored as **integer cents** — zero floating-point rounding error.

```
tenants ──< channels        (one tenant, many platform connections)
tenants ──< products        (one tenant, many SKUs with COGS)
tenants ──< orders          (one tenant, many orders)
orders  ──< order_line_items (cogsAtOrderCents: immutable snapshot)
orders  ──< order_fees      (GATEWAY_PROCESSING, LISTING, OFFSITE_ADS, …)
tenants ──< ad_spend_daily  (META / GOOGLE / TIKTOK per-day spend)
tenants ──< daily_metrics   (pre-aggregated Net Profit, POAS)
```

**Key schema decisions:**
- `cogsAtOrderCents` is an **immutable snapshot** captured at order creation time, not recalculated on COGS updates
- `order_fees` uses a composite unique key `(orderId, feeType, externalFeeId)` for atomic idempotent upserts
- `NULL` external fee IDs use a deterministic hash fallback to prevent PostgreSQL NULL-uniqueness bypass
- All tables are scoped by `tenantId` with a Prisma query extension enforcing row-level isolation

---

## Getting Started

### Prerequisites

- Node.js v20.x or higher
- PostgreSQL v15.x or higher
- Redis instance (local or [Upstash](https://upstash.com))
- Shopify Partner Account (optional in dev — sandbox mode available)
- Etsy Developer Account (optional in dev — sandbox mode available)
- Meta Business Account with Marketing API app (for ad sync)

### 1. Clone & Install

```bash
git clone https://github.com/FaranBaig0/LedgerPulse.git
cd LedgerPulse
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```env
# Server
PORT=4000
NODE_ENV=development
APP_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000

# Database & Cache
DATABASE_URL=postgresql://user:password@localhost:5432/ledgerpulse?schema=public
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your_jwt_secret_key_min_32_chars
ENCRYPTION_KEY=64_char_hex_string_for_aes256gcm

# Shopify App Credentials (leave as dummy_ prefix for dev sandbox mode)
SHOPIFY_API_KEY=your_shopify_app_client_id
SHOPIFY_API_SECRET=your_shopify_app_secret
SHOPIFY_APP_URL=http://localhost:4000

# Etsy API Credentials (leave as dummy_ prefix for dev sandbox mode)
ETSY_API_KEY=your_etsy_keystring
ETSY_SHARED_SECRET=your_etsy_secret

# Meta Marketing API
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_ACCESS_TOKEN=your_system_user_access_token

# Email Notifications
RESEND_API_KEY=your_resend_api_key
```

> **Development shortcut:** If `SHOPIFY_API_KEY` or `ETSY_API_KEY` starts with `dummy_` or `your_`, the OAuth controllers automatically fall back to sandbox mode — creating a mock channel connection without requiring real credentials.

### 3. Run Database Migrations

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Start Development Services

```bash
# Terminal 1 — Backend Express API & Webhook Listeners (port 4000)
npm run dev:server

# Terminal 2 — BullMQ Background Workers
npm run dev:worker

# Terminal 3 — Next.js Frontend Dashboard (port 3000)
npm run dev:client
```

Navigate to [http://localhost:3000](http://localhost:3000) to access the dashboard.

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Register new tenant account |
| `POST` | `/api/v1/auth/login` | Authenticate and receive JWT |
| `GET` | `/api/v1/auth/me` | Retrieve authenticated tenant profile |
| `GET` | `/api/v1/auth/channels` | List connected sales channels |

### Shopify Integration

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/auth/shopify?shop=<domain>` | Initiate Shopify OAuth redirect |
| `GET` | `/api/v1/auth/shopify/callback` | Shopify OAuth callback handler |
| `POST` | `/api/v1/webhooks/shopify/:tenantId` | Receive Shopify order webhooks (HMAC-validated) |

### Etsy Integration

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/auth/etsy` | Initiate Etsy PKCE OAuth redirect |
| `GET` | `/api/v1/auth/etsy/callback` | Etsy OAuth token exchange callback |

### Products & COGS

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/products` | Paginated SKU list with COGS data |
| `PUT` | `/api/v1/products/:id/cogs` | Update individual SKU base unit cost |
| `POST` | `/api/v1/products/bulk-csv` | Bulk upload COGS via CSV |

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/analytics/dashboard` | Pre-aggregated daily metrics (Net Profit, POAS, Margin %) |
| `GET` | `/api/v1/analytics/sku-performance` | SKU-level contribution margin breakdown |
| `GET` | `/api/v1/analytics/fees-breakdown` | Itemized platform fee distribution |

### Billing

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/billing/plans` | List available subscription plans |
| `POST` | `/api/v1/billing/subscribe` | Create Shopify recurring charge |

---

## Background Workers

| Worker | Queue | Schedule | Purpose |
|---|---|---|---|
| `orderProcessing.worker.ts` | `order-processing-queue` | Event-driven | Idempotent order ingestion, COGS snapshot |
| `feeExtraction.worker.ts` | `fee-extraction-queue` | Event-driven + delayed retry | Shopify/Etsy transaction fee parsing |
| `adSpendSync.worker.ts` | `ad-spend-sync-queue` | Daily at 01:00 UTC | Meta Ads rolling 3-day spend reconciliation |
| `aggregation.worker.ts` | `financial-calculation-queue` | Daily (cron-triggered) | Net Profit & POAS rollup into `daily_metrics` |

### Fee Extraction Detail

**Shopify:** Fetches `/admin/api/2026-04/orders/{id}/transactions.json`, parses `fee_lines` from `SALE` transactions. If `fee_lines` is empty (settlement delay), a delayed BullMQ retry job fires after 10 minutes with exponential backoff.

**Etsy:** Fetches payment ledger entries for a receipt via Etsy Open API v3. Maps `LISTING`, `TRANSACTION`, `PROCESSING_FEE`, and `OFFSITE_ADS` entries to the `order_fees` table using deterministic `externalFeeId` hashing for NULL-safe idempotency.

### Meta Ads Attribution

Runs a **rolling 3-day window** on every sync (`t-1`, `t-2`, `t-3`) to account for Meta's delayed SKAdNetwork attribution reconciliation (up to 72 hours post iOS 14). Each run upserts existing records, ensuring finalized spend figures propagate into historical `daily_metrics`.

---

## Financial Formulas

```
Net Profit  = Gross Revenue - (COGS + Platform Fees + Daily Ad Spend)
POAS        = Gross Profit / Daily Ad Spend
Net Margin% = (Net Profit / Gross Revenue) * 100
```

All computations use **integer arithmetic in cents** to eliminate floating-point rounding errors — a requirement for financial accuracy at scale.

---

## Deployment

| Service | Recommended Platform |
|---|---|
| **Express API + Workers** | [Railway](https://railway.app) or [Render](https://render.com) — separate service instances |
| **Next.js Frontend** | [Vercel](https://vercel.com) with automatic CI/CD |
| **PostgreSQL** | [Supabase](https://supabase.com) or [Neon](https://neon.tech) with PgBouncer connection pooling |
| **Redis** | [Upstash](https://upstash.com) serverless Redis |

---

## Project Structure

```
LedgerPulse/
├── prisma/
│   ├── schema.prisma           # Database schema (all monetary fields in cents)
│   └── migrations/             # Prisma migration history
├── src/
│   ├── app/                    # Next.js App Router (frontend)
│   │   ├── (dashboard)/
│   │   │   ├── analytics/      # Executive metrics dashboard
│   │   │   ├── integrations/   # OAuth connection management
│   │   │   ├── products/       # COGS management UI
│   │   │   └── billing/        # Subscription plans UI
│   │   ├── login/ & register/  # Auth pages
│   │   └── globals.css
│   ├── modules/
│   │   └── integrations/
│   │       ├── shopify/        # Shopify OAuth service, controller, routes
│   │       └── etsy/           # Etsy PKCE OAuth service, controller, routes
│   ├── services/
│   │   ├── shopifyFee.service.ts    # Shopify transaction fee extraction
│   │   ├── etsyFee.service.ts       # Etsy payment ledger fee parsing
│   │   ├── metaAds.service.ts       # Meta Ads Insights API ingestion
│   │   ├── aggregation.service.ts   # Net Profit & POAS aggregation
│   │   └── feeCalculator.service.ts # Rule-based platform fee computation
│   ├── workers/
│   │   ├── orderProcessing.worker.ts
│   │   ├── feeExtraction.worker.ts
│   │   ├── adSpendSync.worker.ts
│   │   └── aggregation.worker.ts
│   ├── crons/                  # Scheduled cron job definitions
│   ├── lib/                    # Shared utilities (Prisma client, encryption, OAuth state)
│   ├── middlewares/            # Auth + tenant isolation middleware
│   └── queues/                 # BullMQ queue definitions
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── next.config.js
```

---

## Build Status

All five phases of the core build are complete:

- ✅ **Phase 1** — Authentication & Multi-Tenancy (JWT, Shopify OAuth, Etsy PKCE)
- ✅ **Phase 2** — Ingestion Pipeline (BullMQ, idempotent order worker, HMAC validation)
- ✅ **Phase 3** — Analytics & Financial Calculation (fee calculator, COGS snapshotting, aggregation)
- ✅ **Phase 4** — Frontend & Shopify Billing (Next.js dashboard, Shadcn UI, recurring charges)
- ✅ **Phase 5** — Ad Spend Integration & Unit Economics (Meta Ads sync, POAS, rolling attribution window)

---

## License

MIT © LedgerPulse Contributors