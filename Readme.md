# LedgerPulse — Multi-Channel E-Commerce Profit Intelligence

> Real-time net margin, true cost-of-goods-sold (COGS), and granular fee reconciliation for independent Shopify and Etsy merchants.

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?logo=node.js)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?logo=postgresql)](https://www.postgresql.org)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io)
[![Redis](https://img.shields.io/badge/Redis-BullMQ-red?logo=redis)](https://redis.io)
[![Paddle](https://img.shields.io/badge/Paddle-Billing-355BE2?logo=paddle)](https://paddle.com)
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
| **Live Catalog Sync** | Automatic background and on-demand manual product catalog sync for Shopify & Etsy |
| **Granular Fee Engine** | Automated deduction: Etsy 6.5% transaction, $0.20 listing, 3%+$0.25 gateway; Shopify payment fees parsed from live transaction ledger |
| **Real Ad Spend Sync** | Meta Ads Insights API — rolling 3-day attribution window, integer-cent storage, NEEDS_REAUTH handling |
| **True Net Profit & POAS** | Net Profit = Gross − (COGS + Platform Fees + Daily Ad Spend); POAS = Gross Profit / Ad Spend |
| **SKU-Level COGS & Overhead** | Inline dashboard editing, landed overhead calculation, and bulk CSV mapping for base unit costs |
| **Idempotent Webhook Processing** | BullMQ workers with `idempotency_keys`, settlement-delay retries for Shopify fee lines |
| **Multi-Tenancy** | Row-level tenant isolation via Prisma query extension; AES-256-GCM encrypted OAuth tokens |
| **4-Tier Billing & Paddle Gateway** | **Paddle Merchant of Record** integration supporting 4 Tiers (**Starter** $19/mo, **Growth** $49/mo, **Scale** $99/mo, **Enterprise** $199/mo), 20% annual billing discounts, and 14-day free trials |

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
│  Next.js 14 (App Router) + Tailwind CSS + Lucide Icons           │
│  ├─ Executive Analytics Dashboard                                │
│  ├─ Products & Unit COGS Management                              │
│  ├─ Integrations & OAuth Connections                             │
│  └─ 4-Tier Subscription Matrix & Paddle Checkout Modal           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), Tailwind CSS, Framer Motion, Lucide Icons |
| **Backend** | Node.js 20, Express.js, TypeScript |
| **Database** | PostgreSQL 15, Prisma ORM |
| **Queue & Jobs** | Redis, BullMQ (order processing, fee extraction, ad spend sync, aggregation) |
| **Payments** | Paddle Merchant of Record (Sandbox & Production API) |
| **Integrations** | Shopify REST/GraphQL Admin API, Etsy Open API v3, Meta Graph API v19.0, Resend |
| **Security** | JWT, AES-256-GCM token encryption, Shopify HMAC validation, Etsy PKCE S256 |

---

## Database Schema Design

All monetary values are stored as **integer cents** — zero floating-point rounding error.

```
tenants ──< channels        (one tenant, many platform connections)
tenants ──< products        (one tenant, many SKUs with COGS & packaging overhead)
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
- Redis instance (local Docker or [Upstash](https://upstash.com))
- Shopify Partner Account (optional in dev — sandbox mode available)
- Etsy Developer Account (optional in dev — sandbox mode available)
- Paddle Vendor Account (Sandbox or Production)

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
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ledgerpulse?schema=public
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your_jwt_secret_key_min_32_chars
ENCRYPTION_KEY=64_char_hex_string_for_aes256gcm

# Shopify App Credentials
SHOPIFY_API_KEY=your_shopify_app_client_id
SHOPIFY_API_SECRET=your_shopify_app_secret
SHOPIFY_APP_URL=http://localhost:4000

# Etsy API Credentials
ETSY_API_KEY=your_etsy_keystring
ETSY_SHARED_SECRET=your_etsy_secret

# Paddle Billing Gateway (Sandbox / Production)
PADDLE_ENV=sandbox
PADDLE_CLIENT_TOKEN=test_ee7a8e9532d018d599c7df8e492
PADDLE_API_KEY=pdl_sdbx_apikey_01m2jacwn06fb097...
PADDLE_WEBHOOK_SECRET=pdl_sdbx_whsec_...

# Meta Marketing API
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_ACCESS_TOKEN=your_system_user_access_token

# Email Notifications
RESEND_API_KEY=your_resend_api_key
```

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

### Shopify & Etsy Integration

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/auth/shopify?shop=<domain>` | Initiate Shopify OAuth redirect |
| `GET` | `/api/v1/auth/shopify/callback` | Shopify OAuth callback handler |
| `GET` | `/api/v1/auth/etsy` | Initiate Etsy PKCE OAuth redirect |
| `GET` | `/api/v1/auth/etsy/callback` | Etsy OAuth token exchange callback |
| `POST` | `/api/v1/webhooks/shopify/:tenantId` | Receive Shopify order webhooks (HMAC-validated) |

### Products & Catalog

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/products` | Paginated SKU list with Unit COGS and overhead breakdown |
| `POST` | `/api/v1/products/sync-shopify` | Trigger live Shopify catalog product sync |
| `PUT` | `/api/v1/products/:id/cogs` | Update individual SKU base unit cost and packaging overhead |
| `POST` | `/api/v1/products/bulk-csv` | Bulk upload COGS via CSV |

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/analytics/dashboard` | Pre-aggregated daily metrics (Net Profit, POAS, Margin %) |
| `GET` | `/api/v1/analytics/sku-performance` | SKU-level contribution margin breakdown |
| `GET` | `/api/v1/analytics/fees-breakdown` | Itemized platform fee distribution |

### Paddle Billing Gateway

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/billing/plans` | List 4-tier subscription matrix and pricing details |
| `POST` | `/api/v1/billing/paddle/checkout` | Generate Paddle Sandbox / Live checkout session |

---

## Subscription Matrix

LedgerPulse features a 4-tier pricing model backed by Paddle Merchant of Record:

| Plan Tier | Monthly Price | Annual Price (Save 20%) | Monthly Order Limit | Channels Limit | Key Features |
|---|---|---|---|---|---|
| **Starter** | $19 / mo | **$180 / yr** ($15/mo) | Up to 200 orders | 1 Channel | Static Unit COGS, Shopify/Etsy Fee Extraction, 30-Day History |
| **Growth** | $49 / mo | **$468 / yr** ($39/mo) | Up to 1,000 orders | Up to 3 Channels | Dynamic FIFO Inventory Depletion, Meta Ads Sync, 1-Year History |
| **Scale** | $99 / mo | **$948 / yr** ($79/mo) | Up to 3,000 orders | Up to 6 Channels | Google Ads Spend, Multi-Currency Conversion, CSV Exports |
| **Enterprise** | $199 / mo | **$1,908 / yr** ($159/mo) | 5,000+ orders | Unlimited | ERP Sync, Custom FIFO Overrides, 24/7 Dedicated Support SLA |

---

## Financial Formulas

```
Landed Unit Cost = Base Unit Cost + Packaging Overhead
Unit Margin %    = ((Selling Price - Landed Unit Cost) / Selling Price) * 100
Net Profit       = Gross Revenue - (COGS + Platform Fees + Daily Ad Spend)
POAS             = Gross Profit / Daily Ad Spend
Net Margin %     = (Net Profit / Gross Revenue) * 100
```

---

## License

MIT © LedgerPulse Contributors