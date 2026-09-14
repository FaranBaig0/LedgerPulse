# LEDGERPULSE — COMPREHENSIVE TECHNICAL IMPLEMENTATION SPECIFICATION
Target Audience: Autonomous AI Coding Agents / Senior Software Engineers
System Identity: Multi-Tenant Financial Analytics & Real-Time COGS Engine for Shopify & Etsy

---

## 1. ARCHITECTURAL & CODING CONSTRAINTS (HARD GUARDS)

1. Financial Integrity:
   - Currency representation: Store all monetary amounts as INTEGERS in the smallest currency unit (e.g., USD Cents: $10.50 -> 1050) OR PostgreSQL `DECIMAL(12, 4)`. No raw JS floating-point arithmetic allowed for calculations.
   - Idempotency: All incoming webhook events must be verified against an `idempotency_keys` table using `(tenant_id, platform, event_id)`. Duplicates must return HTTP 200 immediately without reprocessing.
   - Historical COGS Immutability: When creating `order_line_items`, always snapshot the current `base_cost` into `cogs_at_order`. Never compute historical profit using the mutable `products.base_cost` directly.

2. Multi-Tenancy:
   - Shared Database, Row-Level Isolation: Every table (except system metadata) must contain `tenant_id UUID`.
   - Data Access Layer: Every Prisma/SQL query MUST pass `where: { tenant_id }`. Add a global runtime middleware or extension to intercept queries lacking `tenant_id`.

3. Webhook Latency:
   - Webhook ingress controllers must simply write the raw payload to Redis via BullMQ and return `HTTP 200 OK` within 500ms. Heavy processing must be completely asynchronous.

---

## 2. DATABASE SCHEMA SPECIFICATION (POSTGRESQL / PRISMA)

Create `prisma/schema.prisma` with the following entities:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum ChannelPlatform {
  SHOPIFY
  ETSY
}

enum FeeType {
  TRANSACTION
  LISTING
  PAYMENT_PROCESSING
  REGULATORY
  OFFSITE_ADS
  SHIPPING_LABEL
}

model Tenant {
  id                String            @id @default(uuid()) @db.Uuid
  name              String
  baseCurrency      String            @default("USD") @db.VarChar(3)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  users             User[]
  channels          Channel[]
  products          Product[]
  orders            Order[]
  dailyMetrics      DailyMetric[]
  idempotencyKeys   IdempotencyKey[]

  @@map("tenants")
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @db.Uuid
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("users")
}

model Channel {
  id                  String          @id @default(uuid()) @db.Uuid
  tenantId            String          @db.Uuid
  platform            ChannelPlatform
  storeIdentifier     String          // shop domain or etsy shop ID
  encryptedToken      String          @db.Text
  encryptedRefreshToken String?       @db.Text
  tokenExpiresAt      DateTime?
  isActive            Boolean         @default(true)
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt
  tenant              Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  orders              Order[]

  @@unique([tenantId, platform, storeIdentifier])
  @@map("channels")
}

model Product {
  id              String           @id @default(uuid()) @db.Uuid
  tenantId        String           @db.Uuid
  sku             String
  title           String
  baseCostCents   Int              @default(0) // COGS in smallest unit
  packagingCents  Int              @default(0)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  tenant          Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  lineItems       OrderLineItem[]

  @@unique([tenantId, sku])
  @@map("products")
}

model Order {
  id                  String          @id @default(uuid()) @db.Uuid
  tenantId            String          @db.Uuid
  channelId           String          @db.Uuid
  platformOrderId     String          
  orderNumber         String
  grossAmountCents    Int
  taxAmountCents      Int              @default(0)
  shippingChargedCents Int             @default(0)
  currency            String          @db.VarChar(3)
  orderDate           DateTime
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  tenant              Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  channel             Channel         @relation(fields: [channelId], references: [id], onDelete: Cascade)
  lineItems           OrderLineItem[]
  fees                OrderFee[]

  @@unique([tenantId, platformOrderId])
  @@index([tenantId, orderDate])
  @@map("orders")
}

model OrderLineItem {
  id              String   @id @default(uuid()) @db.Uuid
  orderId         String   @db.Uuid
  productId       String?  @db.Uuid
  sku             String
  title           String
  quantity        Int
  unitPriceCents  Int
  cogsAtOrderCents Int     @default(0) // Snapshot value of (baseCostCents + packagingCents)
  order           Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product         Product? @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@map("order_line_items")
}

model OrderFee {
  id          String   @id @default(uuid()) @db.Uuid
  orderId     String   @db.Uuid
  feeType     FeeType
  amountCents Int
  currency    String   @db.VarChar(3)
  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@map("order_fees")
}

model DailyMetric {
  id                  String   @id @default(uuid()) @db.Uuid
  tenantId            String   @db.Uuid
  date                DateTime @db.Date
  grossRevenueCents   BigInt   @default(0)
  netProfitCents      BigInt   @default(0)
  totalCogsCents      BigInt   @default(0)
  totalFeesCents      BigInt   @default(0)
  totalAdSpendCents   BigInt   @default(0)
  orderCount          Int      @default(0)
  tenant              Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, date])
  @@map("daily_metrics")
}

model IdempotencyKey {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @db.Uuid
  key       String   @unique // Combination: platform + event_id
  createdAt DateTime @default(now())
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("idempotency_keys")
}
3. PHASE-BY-PHASE IMPLEMENTATION BLUEPRINTPHASE 1: Multi-Tenant Authentication & Channel OAuthTask Objectives: Establish project boilerplate, multi-tenant isolation middleware, and end-to-end OAuth flow for Shopify and Etsy.Step 1.1: Multi-Tenancy MiddlewareCreate src/middlewares/auth.middleware.ts: Verify JWT from incoming request. Extract tenantId and attach to req.context = { tenantId, userId }.Create src/lib/prisma.ts: Wrap Prisma queries to automatically append { tenantId: req.context.tenantId } to prevent data leakage.Step 1.2: Shopify Partner OAuth IntegrationFile: src/modules/integrations/shopify/shopify.auth.tsFlow:User navigates to /api/v1/auth/shopify?shop=my-store.myshopify.com.Generate a secure random state nonce and persist in cache.Redirect to https://{shop}/admin/oauth/authorize with scopes: read_orders,read_products.Callback handler /api/v1/auth/shopify/callback: Validate HMAC signature, exchange auth code for permanent offline access token.Encrypt token using AES-256-GCM and store in channels table under current tenantId.Step 1.3: Etsy Open API v3 PKCE IntegrationFile: src/modules/integrations/etsy/etsy.auth.tsFlow:Generate PKCE code_verifier and code_challenge (SHA-256).Redirect to Etsy OAuth URL with scopes: listings_r,transactions_r.Callback handler: Exchange authorization code with the code verifier for access_token and refresh_token.Save encrypted tokens and setup automatic rotation worker for expiring Etsy tokens.PHASE 2: Ingestion Pipelines & Background BullMQ WorkersTask Objectives: Ingest webhook data safely, ensure zero downtime under high order spikes, and prevent duplicated records.Step 2.1: BullMQ Queue InfrastructureFile: src/queues/queue.server.tsInstantiate Redis connection and declare queues:webhook-ingestion-queuehistorical-backfill-queuefinancial-calculation-queueStep 2.2: Fast Ingestion Webhook HandlersFile: src/modules/webhooks/shopify.webhook.controller.tsProcess:TypeScript// Pseudocode logic
export const handleShopifyOrderCreate = async (req, res) => {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const isValid = verifyShopifyHmac(req.rawBody, hmacHeader, process.env.SHOPIFY_API_SECRET);
  if (!isValid) return res.status(401).send("Unauthorized");

  // Dispatch immediately to BullMQ queue
  await webhookQueue.add('process-shopify-order', {
    tenantId: req.params.tenantId,
    payload: req.body,
    eventId: req.headers['x-shopify-webhook-id']
  });

  return res.status(200).json({ received: true });
};
Step 2.3: Idempotent Worker ProcessingFile: src/workers/orderProcessing.worker.tsProcess:Retrieve job from webhook-ingestion-queue.Check idempotency_keys table using key = 'shopify_' + eventId. If exists, abort with success.Insert key inside transaction.Upsert orders and order_line_items records.For each line item: Check products table matching sku. If found, set cogsAtOrderCents = product.baseCostCents + product.packagingCents. Else, default to 0 and mark order as needing attention.PHASE 3: Strict Financial Fee Parsers & CalculationsTask Objectives: Implement real-world deduction rules for platform cuts and calculate exact contribution margins.Step 3.1: Automated Platform Fee CalculatorFile: src/services/feeCalculator.service.tsEtsy Order Fee Calculation Logic:Transaction Fee: $6.5\%$ of (Gross Line Items Amount + Shipping Charged).Listing Fee: Fixed $20\text{ cents}$ ($0.20) per quantity sold.Payment Processing Fee (US benchmark): $3\% + 25\text{ cents}$ on total charged amount.Persist each broken-down value as separate rows in order_fees linked to the order.Shopify Fee Calculation Logic:Extract Gateway Processing fees directly from Shopify transactions.json endpoint or default to standard card processing ($2.9\% + 30\text{ cents}$).Step 3.2: SKU Cost Management APIFile: src/modules/products/products.controller.tsPUT /api/v1/products/:id/cogs: Updates baseCostCents and packagingCents.POST /api/v1/products/bulk-csv: Parse standard CSV containing headers [SKU, BaseCost, PackagingCost]. Run bulk prisma.product.upsert() restricted to authenticated tenantId.Step 3.3: Aggregate Analytics Rollup EngineFile: src/workers/aggregation.worker.tsCron Schedule: Executes every midnight or updates incrementally on order events.Logic:$$\text{NetProfit} = \text{GrossRevenue} - (\text{TotalCOGS} + \text{TotalOrderFees} + \text{TotalAdSpend})$$Upsert result directly into daily_metrics table for instant $O(1)$ dashboard rendering.PHASE 4: Frontend Dashboard & Shopify Billing EngineTask Objectives: High-performance Next.js analytics display and native platform subscription integration.Step 4.1: Executive Metrics DashboardPath: src/app/(dashboard)/analytics/page.tsxData Fetching: Parallel server-side data fetching via Next.js React Server Components.Component Layout:4 Top Metric Cards: Net Profit ($), True Margin (%), Gross Revenue ($), POAS (Profit on Ad Spend).Main Visual: Tremor AreaChart displaying Daily Gross Revenue vs True Net Profit over the last 30 days.Underperforming SKUs Alert Table: SKUs with negative net margins ranked by highest advertising spend.Step 4.2: Shopify Recurring Billing IntegrationFile: src/services/shopifyBilling.service.tsGraphQL Mutation appSubscriptionCreate:Creates recurring application charge for $29 or $59/month tier with a 14-day trial period.Capture and verify confirmationUrl and handle approval webhooks (app_subscriptions/update).4. VERIFICATION CRITERIA & TEST SUITE INSTRUCTIONSWhen instructing the AI to run tests, mandate the following validations:Test Case 1 (Idempotency):Fire the same Shopify order webhook payload 3 times concurrently.Verify orders table only contains 1 entry, and BullMQ processes 1 job and discards 2 gracefully.Test Case 2 (COGS Mutation Isolation):Create an order for SKU SHIRT-BLACK with base cost $10.00.Update SHIRT-BLACK base cost to $15.00 via the API.Verify the historical order line item retains cogsAtOrderCents = 1000.Test Case 3 (Mathematical Precision):Assert that an order of $100.00 does not drift by floating-point decimals:Gross: $100.00 ($10,000 cents)COGS: $30.00 ($3,000 cents)Processing (2.9% + $0.30): $3.20 ($320 cents)Net: Exactly $66.80 ($6,680 cents).