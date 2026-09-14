# LEDGERPULSE DATA DICTIONARY

## 1. Table: `products`
- `id` (UUID, PK): Unique internal product identifier.
- `tenantId` (UUID, FK -> tenants.id): The business owner.
- `sku` (VarChar, Unique per tenant): Merchant's item identifier (case-sensitive).
- `baseCostCents` (Int): Manufacturing cost in USD cents ($10.00 = 1000).
- `packagingCents` (Int): Packaging material cost per unit in USD cents.

## 2. Table: `orders`
- `id` (UUID, PK): Internal primary key.
- `platformOrderId` (VarChar): Raw ID from Shopify or Etsy (e.g., "534982394").
- `grossAmountCents` (Int): Subtotal + tax + shipping paid by buyer.
- `taxAmountCents` (Int): Taxes collected (must be excluded from net revenue).
- `shippingChargedCents` (Int): Shipping amount paid by customer.

## 3. Table: `order_line_items`
- `cogsAtOrderCents` (Int): SNAPSHOT of (baseCostCents + packagingCents) at the time order was placed. NEVER recalculate post-order.

## 4. Table: `order_fees`
- `feeType` (Enum): `TRANSACTION`, `LISTING`, `PAYMENT_PROCESSING`, `REGULATORY`.
- `amountCents` (Int): Fee amount deducted by platform.