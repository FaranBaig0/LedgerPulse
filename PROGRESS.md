# LEDGERPULSE BUILD STATUS

## [x] Architecture & Planning
- [x] Tech stack defined (Node, Next.js, Postgres, Prisma, Redis).
- [x] Database schema designed.

## [x] Phase 1: Authentication & Multi-Tenancy
- [x] Initialize repository with TypeScript & ESLint configs (`package.json`, `tsconfig.json`, `.env.example`, `.env`).
- [x] Prisma schema file setup (`prisma/schema.prisma`) and Prisma client generated.
- [x] Multi-tenant isolation middleware (`src/middlewares/auth.middleware.ts`) and Prisma query extension (`src/lib/prisma.ts`).
- [x] JWT Authentication & Tenant Registration API (`/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/me`).
- [x] Shopify OAuth route & HMAC callback (`/api/v1/auth/shopify`, `/api/v1/auth/shopify/callback`).
- [x] Etsy OAuth v3 PKCE route & token exchange (`/api/v1/auth/etsy`, `/api/v1/auth/etsy/callback`).

## [x] Phase 2: Ingestion Pipeline
- [x] BullMQ connection & Redis queue initialization (`webhook-ingestion-queue`, `historical-backfill-queue`, `financial-calculation-queue`).
- [x] Fast zero-DB webhook ingestion controller & Shopify HMAC signature validation (`/api/v1/webhooks/shopify/:tenantId`).
- [x] Asynchronous idempotent worker processing (`src/workers/orderProcessing.worker.ts`) with `idempotency_keys` checking and historical COGS snapshotting.

## [x] Phase 3: Analytics & Financial Calculation
- [x] Fee calculation parser service (`src/services/feeCalculator.service.ts`) for Etsy (Transaction 6.5%, Listing $0.20, Payment 3%+$0.25) & Shopify (Payment 2.9%+$0.30) using strict integer math in cents.
- [x] Product COGS Management & CSV bulk upload API (`/api/v1/products`, `/api/v1/products/:id/cogs`, `/api/v1/products/bulk-csv`).
- [x] Daily metrics aggregation service (`src/services/aggregation.service.ts`), BullMQ worker (`src/workers/aggregation.worker.ts`), midnight cron scheduler (`src/crons/dailyAggregation.cron.ts`), and pre-aggregated Analytics API (`/api/v1/analytics/dashboard`).

## [x] Phase 4: Frontend & Shopify Billing
- [x] Executive Dashboard layout & Shadcn UI aesthetics (`src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/analytics/page.tsx`).
- [x] Shopify recurring application charge GraphQL service (`src/services/shopifyBilling.service.ts`), Billing API (`/api/v1/billing/plans`, `/api/v1/billing/subscribe`), and Subscription UI (`src/app/(dashboard)/billing/page.tsx`) supporting $29/mo Starter & $59/mo Growth plans with 14-day trials.

## [x] Phase 5: Ad Spend Integration & Unit Economics
- [x] Exact transaction fee extraction services for Shopify REST API transactions (`src/services/shopifyFee.service.ts`) & Etsy payment ledger entries (`src/services/etsyFee.service.ts`) with `GATEWAY_PROCESSING` fee lines and `rawFeeDetails` JSON.
- [x] Asynchronous dedicated BullMQ fee extraction queue & worker (`feeExtraction.worker.ts`) with settlement delay retries and composite unique constraint (`@@unique([orderId, feeType, externalFeeId])`).
- [x] Meta Ads daily spend ingestion service (`src/services/metaAds.service.ts`) supporting rolling 3-day window (`t-1`, `t-2`, `t-3`) attribution adjustments, integer cents storage in `ad_spend_daily`, and token expiration (`NEEDS_REAUTH`) handling.
- [x] Scheduled daily ad spend worker (`src/workers/adSpendSync.worker.ts`) running at 01:00 AM UTC.
- [x] Aggregation Service & BullMQ worker update (`src/services/aggregation.service.ts`, `src/workers/aggregation.worker.ts`) computing True Net Profit = Gross - (COGS + Fees + Daily Ad Spend) and POAS = Gross Profit / Daily Ad Spend stored in `daily_metrics`.