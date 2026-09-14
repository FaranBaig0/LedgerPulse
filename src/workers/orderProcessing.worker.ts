import { Worker, Job } from "bullmq";
import { redisConnectionOptions } from "../queues/queue.config.js";
import { QUEUE_NAMES, WebhookIngestionJobData, feeExtractionQueue } from "../queues/queue.server.js";
import { prisma, getTenantPrisma } from "../lib/prisma.js";
import { ShopifyOrderWebhookPayloadSchema } from "../modules/webhooks/shopify.webhook.schema.js";

/**
 * Worker logic processing incoming webhook jobs asynchronously and idempotently.
 */
export const orderProcessingWorker = new Worker<WebhookIngestionJobData>(
  QUEUE_NAMES.WEBHOOK_INGESTION,
  async (job: Job<WebhookIngestionJobData>) => {
    const { tenantId, platform, eventId, payload } = job.data;
    const idempotencyKeyStr = `${platform.toLowerCase()}_${eventId}`;

    const tenantPrisma = getTenantPrisma(tenantId);

    // 1. Idempotency Check: Query idempotency_keys table with tenantId isolation
    const existingKey = await tenantPrisma.idempotencyKey.findFirst({
      where: {
        tenantId,
        key: idempotencyKeyStr
      }
    });

    if (existingKey) {
      console.log(`[Worker] Duplicate webhook event ignored: ${idempotencyKeyStr} for tenant ${tenantId}`);
      return { status: "skipped_duplicate", eventId };
    }

    // 2. Parse payload according to platform
    if (platform === "SHOPIFY") {
      const orderData = ShopifyOrderWebhookPayloadSchema.parse(payload);

      // Find connected channel for this tenant
      let channel = await tenantPrisma.channel.findFirst({
        where: {
          tenantId,
          platform: "SHOPIFY"
        }
      });

      // Fallback/Auto-create default channel if none exists yet
      if (!channel) {
        channel = await prisma.channel.create({
          data: {
            tenantId,
            platform: "SHOPIFY",
            storeIdentifier: "default.myshopify.com",
            encryptedToken: "dummy_encrypted_token",
            isActive: true
          }
        });
      }

      const platformOrderId = String(orderData.id);
      const grossAmountCents = Math.round(parseFloat(orderData.total_price) * 100);
      const taxAmountCents = Math.round(parseFloat(orderData.total_tax) * 100);
      const shippingChargedCents = Math.round(
        parseFloat(orderData.total_shipping_price_set?.shop_money?.amount || "0.00") * 100
      );

      let createdOrderId = "";

      // 3. Process inside a Prisma Transaction
      await prisma.$transaction(async (tx) => {
        // Record idempotency key
        await tx.idempotencyKey.create({
          data: {
            tenantId,
            key: idempotencyKeyStr
          }
        });

        // Upsert Order record with tenantId
        const order = await tx.order.upsert({
          where: {
            tenantId_platformOrderId: {
              tenantId,
              platformOrderId
            }
          },
          update: {
            grossAmountCents,
            taxAmountCents,
            shippingChargedCents,
            currency: orderData.currency,
            orderDate: new Date(orderData.created_at),
            updatedAt: new Date()
          },
          create: {
            tenantId,
            channelId: channel.id,
            platformOrderId,
            orderNumber: String(orderData.order_number),
            grossAmountCents,
            taxAmountCents,
            shippingChargedCents,
            currency: orderData.currency,
            orderDate: new Date(orderData.created_at)
          }
        });

        createdOrderId = order.id;

        // Delete existing line items for clean idempotent re-processing if needed
        await tx.orderLineItem.deleteMany({
          where: { orderId: order.id }
        });

        // Create line items with historical COGS snapshot
        for (const item of orderData.line_items) {
          const itemSku = item.sku || `NOSKU-${item.id}`;
          const unitPriceCents = Math.round(parseFloat(item.price) * 100);

          // Lookup current product base cost under this tenant
          const product = await tx.product.findUnique({
            where: {
              tenantId_sku: {
                tenantId,
                sku: itemSku
              }
            }
          });

          // Snapshot current COGS at the time of order placement
          const cogsAtOrderCents = product ? product.baseCostCents + product.packagingCents : 0;

          await tx.orderLineItem.create({
            data: {
              orderId: order.id,
              productId: product?.id || null,
              sku: itemSku,
              title: item.title,
              quantity: item.quantity,
              unitPriceCents,
              cogsAtOrderCents
            }
          });
        }
      });

      // 4. Enqueue fee extraction job on feeExtractionQueue with retry backoff
      if (createdOrderId) {
        await feeExtractionQueue.add(
          `extract-fees-${createdOrderId}`,
          {
            orderId: createdOrderId,
            tenantId,
            platform: "SHOPIFY"
          },
          {
            attempts: 5,
            backoff: {
              type: "exponential",
              delay: 30000
            },
            removeOnComplete: 100,
            removeOnFail: 500
          }
        );
      }

      console.log(`[Worker] Successfully processed Shopify order #${orderData.order_number} for tenant ${tenantId}`);
      return { status: "processed", orderId: platformOrderId };
    }

    return { status: "unsupported_platform", platform };
  },
  {
    connection: redisConnectionOptions,
    concurrency: 5
  }
);
