import { Request, Response, NextFunction } from "express";
import { ShopifyWebhookService } from "./shopify.webhook.service.js";
import { enqueueWebhookEvent } from "../../queues/queue.server.js";

export class ShopifyWebhookController {
  /**
   * Fast Ingestion Webhook Handler for Shopify
   * POST /api/v1/webhooks/shopify/:tenantId
   * Validates HMAC signature, pushes raw payload to BullMQ queue, and responds 200 OK immediately (< 500ms).
   * STRICT CONSTRAINT: ZERO DATABASE QUERIES PERFORMED IN THIS CONTROLLER.
   */
  static async handleOrderWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hmacHeader = req.headers["x-shopify-hmac-sha256"] as string | undefined;
      const eventId = (req.headers["x-shopify-webhook-id"] as string) || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const topic = (req.headers["x-shopify-topic"] as string) || "orders/create";
      const tenantId = req.params.tenantId;

      if (!tenantId) {
        res.status(400).json({ error: "BAD_REQUEST", message: "Missing tenantId parameter" });
        return;
      }

      // 1. Validate HMAC signature against raw body
      const isValidHmac = ShopifyWebhookService.verifyWebhookHmac(req.rawBody, hmacHeader);
      if (!isValidHmac && process.env.NODE_ENV === "production") {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid Shopify webhook HMAC signature" });
        return;
      }

      // 2. Dispatch payload immediately to BullMQ queue (No DB queries!)
      await enqueueWebhookEvent({
        tenantId,
        platform: "SHOPIFY",
        eventId,
        eventType: topic,
        payload: req.body as Record<string, unknown>
      });

      // 3. Return HTTP 200 OK immediately (< 500ms)
      res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  }
}
