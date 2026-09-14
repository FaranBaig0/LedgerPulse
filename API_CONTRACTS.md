# EXTERNAL API CONTRACTS & WEBHOOK PAYLOADS

## 1. Shopify `orders/create` Payload Mapping
- Order Identifier: `payload.id` (mapped to `platformOrderId`)
- Order Number: `payload.name` (e.g., "#1001")
- Gross Amount: `Math.round(parseFloat(payload.total_price) * 100)`
- Tax: `Math.round(parseFloat(payload.total_tax) * 100)`
- Line Items Array: `payload.line_items`
  - Line Item SKU: `item.sku`
  - Unit Price: `Math.round(parseFloat(item.price) * 100)`
  - Quantity: `item.quantity`

## 2. Etsy `receipts` Payload Mapping
- Order Identifier: `payload.receipt_id`
- Gross Amount: `payload.grandtotal.amount` (Etsy provides raw integer cents)
- Listing Fee: Fixed $0.20 per item quantity sold.
- Etsy Transaction Fee: 6.5% of `(price + shipping_cost)`.

## 3. Internal API Contract: Product COGS Update
- Endpoint: `PUT /api/v1/products/:id/cogs`
- Request Body:
  ```json
  {
    "baseCostCents": 1250,
    "packagingCents": 150
  }
  