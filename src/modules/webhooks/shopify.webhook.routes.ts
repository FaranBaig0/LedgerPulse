import { Router } from "express";
import { ShopifyWebhookController } from "./shopify.webhook.controller.js";

const router = Router();

router.post("/:tenantId", ShopifyWebhookController.handleOrderWebhook);

export default router;
