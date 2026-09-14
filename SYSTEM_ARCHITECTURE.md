1. High-Level Data Ingestion & Sync Pipeline
Code snippet
flowchart TD
    A[External Platforms] -->|Webhooks / Polling| B[API Ingestion Layer]
    
    subgraph Ingestion & Verification
        B --> C{Verify HMAC / Signature}
        C -->|Invalid| D[HTTP 401: Drop Request]
        C -->|Valid| E[Push to Redis Queue: BullMQ]
        E --> F[HTTP 200: Instant ACK]
    end

    subgraph Async Worker Execution
        E --> G[Worker Service]
        G --> H{Check Idempotency}
        H -->|Event Already Handled| I[Log & Skip Processing]
        H -->|New Event| J[Normalize Payload Schema]
    end

    subgraph Relational Persistence
        J --> K[Persist Orders & Line Items]
        J --> L[Calculate Exact Platform Fees]
        K --> M[(PostgreSQL Core)]
        L --> M
    end

    subgraph Post-Processing
        M --> N[Trigger Aggregation Job]
        N --> O[(Daily Analytics Cache)]
    end
2. The Strict Mathematical Calculation Flow (No Assumptions)
Code snippet
flowchart LR
    subgraph Revenue
        A[Gross Item Price * Quantity]
        B[Customer Shipping Fee Paid]
        REV[Total Gross Revenue = A + B]
    end

    subgraph Direct Costs
        C[SKU Base Manufacturing Cost]
        D[Shipping Label Paid Cost]
        E[Packaging Cost]
        COGS[Total COGS = C + D + E]
    end

    subgraph Non-Negotiable Deductions
        F[Etsy: 6.5% Transaction Fee]
        G[Etsy: $0.20 Listing Fee]
        H[Payment Processing: 2.9% + $0.30]
        I[Ad Spend Allocation: Meta / Google]
        FEES[Total Reductions = F + G + H + I]
    end

    REV --> NET[True Net Profit]
    COGS -->|Subtract| NET
    FEES -->|Subtract| NET

    NET --> METRIC[Margin % = Net Profit / Gross Revenue * 100]
    NET --> POAS[POAS = Gross Profit / Total Ad Spend]
3. Hard Rules for AI (Include in .cursorrules or System Prompt)
Isko text file mein copy karke project root mein rakh lein:

Markdown
# LEDGERPULSE SYSTEM ARCHITECTURE CONSTRAINTS (FOR AI AGENTS)

DO NOT HALLUCINATE SCHEMA OR CALCULATIONS. STRICTLY FOLLOW THESE RULES:

1. IDEMPOTENCY IS MANDATORY:
   - Never insert an incoming webhook directly into the `orders` table without checking `platform_order_id` + `tenant_id`.
   - If an order exists, only execute an UPDATE operation. Never duplicate line items.

2. FINANCIAL PRECISION RULE:
   - NEVER use Floating Point arithmetic for financial data (JavaScript `0.1 + 0.2 != 0.3`).
   - Store all currency amounts as INTEGERS in the smallest currency unit (e.g., Cents: $10.50 -> 1050) OR use `DECIMAL(12, 4)` in PostgreSQL.

3. HISTORICAL COGS IMMUTABILITY:
   - When calculating `order_line_items`, always snapshot `cogs_at_order` from the `products` table at the moment of order creation.
   - If a merchant updates a product's base cost today, past order profit calculations MUST NOT CHANGE.

4. MULTI-TENANCY STRICT ISOLATION:
   - Every SELECT, UPDATE, and DELETE query on `orders`, `products`, `fees`, and `channels` MUST include `WHERE tenant_id = :tenant_id`.
   - Never allow cross-tenant data leakage.

5. ASYNCHRONOUS WEBHOOK RESPONSES:
   - Webhook controller endpoints MUST respond with HTTP 200 within 2 seconds.
   - Processing must ALWAYS be offloaded to BullMQ workers. Do not run aggregation queries inside webhook HTTP handlers.