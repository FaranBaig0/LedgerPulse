# LedgerPulse — Multi-Channel E-Commerce Profit & COGS Tracker

> Real-time net margin, true cost-of-goods-sold (COGS), and multi-channel fee reconciliation for independent Shopify and Etsy merchants.

---

## Overview

Most e-commerce merchants track gross revenue while operating in the dark regarding actual net profit. Between platform transaction fees, payment processor cuts, dynamic ad spend, shipping overages, and manufacturing costs, surface-level dashboard metrics often mask loss-making SKUs.

**LedgerPulse** is a lightweight, multi-tenant financial engine that connects directly to Shopify, Etsy, and Meta Ads. It ingests order streams, deducts exact line-item fees and manufacturing costs, and delivers true net margin analytics down to the individual SKU level.

---

## Key Features

* **Multi-Channel Ingestion:** One-click OAuth 2.0 handshake for Shopify and Etsy stores.
* **Granular Fee Engine:** Automated deduction of platform fees (Etsy 6.5% transaction fee, listing fees, payment gateway cuts, and Shopify fees).
* **SKU-Level COGS Management:** Bulk CSV upload or inline dashboard editing to map base unit manufacturing and packaging costs.
* **Marketing Spend Reconciliation:** Direct Meta Ads Insights API sync to compute real Profit on Ad Spend (POAS) rather than deceptive ROAS.
* **Loss Detection Alerts:** Automated flagging of high-volume SKUs operating at negative margins due to ad spend or fee spikes.
* **Weekly P&L Executive Summary:** Automated Monday morning performance dispatch via transactional email.

---

## Architecture
[Shopify Webhooks / REST API]

[Etsy Open API v3]             --> [Redis / BullMQ Buffer] --> [Worker Node (Processing)]
[Meta Ads Insights API]       /                                             │
[PostgreSQL Database]
│
[Aggregation Cron]
│
[Next.js Dashboard]


### Core Stack
* **Frontend:** Next.js (App Router), Tailwind CSS, Shadcn UI, Tremor Charts
* **Backend:** Node.js, Express.js (TypeScript)
* **Database & ORM:** PostgreSQL, Prisma ORM
* **Queue & Background Jobs:** Redis, BullMQ
* **External Integrations:** Shopify REST/GraphQL Admin API, Etsy Open API v3, Meta Graph API, Resend

---

## Database Design

+------------------+       +-------------------+       +-----------------------+
|     tenants      |       |     channels      |       |       products        |
+------------------+       +-------------------+       +-----------------------+
| id (PK)          |<---\  | id (PK)           |       | id (PK)               |
| company_name     |     -+ tenant_id (FK)    |   /-->| tenant_id (FK)        |
| base_currency    |       | platform          |   |   | sku                   |
| subscription_tier|       | access_token (enc)|   |   | title                 |
+------------------+       | refresh_token     |   |   | base_cost (COGS)      |
+-------------------+   |   +-----------------------+
|
+------------------+       +-------------------+   |   +-----------------------+
|      orders      |       | order_line_items  |   |   |         fees          |
+------------------+       +-------------------+   |   +-----------------------+
| id (PK)          |<------| id (PK)           |   |   | id (PK)               |
| tenant_id (FK)   |       | order_id (FK)     |   |   | order_id (FK)         |
| channel_id (FK)  |       | product_id (FK)---/   |   | fee_type              |
| gross_amount     |       | quantity          |   |   | amount                |
| currency         |       | unit_price        |   |   | currency              |
| order_date       |       | cogs_at_order     |   +-----------------------+
+------------------+       +-------------------+


---

## Getting Started

### Prerequisites

* Node.js (v20.x or higher)
* PostgreSQL (v15.x or higher)
* Redis instance (local or hosted via Upstash)
* Shopify Partner Account & Etsy Developer Account

### Environment Setup

Create a `.env` file in the root directory:

```env
# Server
PORT=5000
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:5000

# Database & Cache
DATABASE_URL=postgresql://user:password@localhost:5432/ledgerpulse?schema=public
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your_jwt_secret_key
ENCRYPTION_KEY=32_byte_hex_key_for_oauth_tokens

# Shopify App Credentials
SHOPIFY_API_KEY=your_shopify_app_client_id
SHOPIFY_API_SECRET=your_shopify_app_secret
SHOPIFY_SCOPES=read_orders,read_products

# Etsy API Credentials
ETSY_API_KEY=your_etsy_keystring
ETSY_SHARED_SECRET=your_etsy_secret

# Meta Marketing API
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret

# Notifications
RESEND_API_KEY=your_resend_api_key
Installation
Clone the repository:

Bash
git clone [https://github.com/your-org/ledgerpulse.git](https://github.com/your-org/ledgerpulse.git)
cd ledgerpulse
Install dependencies:

Bash
npm install
Run database migrations:

Bash
npx prisma migrate dev --name init
Seed initial platform fee constants:

Bash
npx prisma db seed
Start development services:

Bash
# Terminal 1: Backend API & Webhook Listeners
npm run dev:server

# Terminal 2: BullMQ Queue Workers
npm run dev:worker

# Terminal 3: Next.js Frontend Dashboard
npm run dev:client
Core API Endpoints
Store & Channel Management
GET /api/v1/channels — Retrieve all connected platforms and sync status.

GET /api/v1/auth/shopify — Trigger Shopify OAuth installation redirection.

GET /api/v1/auth/etsy — Trigger Etsy PKCE OAuth redirection.

Product & COGS Operations
GET /api/v1/products — Paginated list of SKUs with mapped manufacturing costs.

PUT /api/v1/products/:id/cogs — Update individual SKU baseline unit cost.

POST /api/v1/products/cogs/bulk-upload — Upload CSV payload to map inventory costs.

Analytics & Reporting
GET /api/v1/analytics/real-time — High-level metric cards (Gross, Net Profit, Margin %, POAS).

GET /api/v1/analytics/sku-performance — Sortable breakdown of SKUs by contribution margin.

GET /api/v1/analytics/fees-breakdown — Itemized platform fee distribution over selected time range.

Webhook Ingestion
POST /webhooks/shopify/orders-create — Process live incoming Shopify transactions.

POST /webhooks/etsy/receipts — Process live incoming Etsy receipts.

Deployment
Backend Services: Deploy the Node.js API and BullMQ worker container on Railway or Render with zero-downtime rolling deploys.

Frontend: Deploy the Next.js interface to Vercel with automated domain routing and Edge middleware.

Database: Managed PostgreSQL instance via Supabase or Neon with connection pooling enabled (PgBouncer).