import { Router } from "express";
import { BillingController } from "./billing.controller.js";
import { authenticateTenant } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/plans", BillingController.getPlans);
router.get("/subscription", authenticateTenant, BillingController.getTenantSubscription);
router.post("/subscribe", authenticateTenant, BillingController.subscribe);
router.post("/paddle/checkout", authenticateTenant, BillingController.createPaddleCheckout);
router.post("/paddle/webhook", BillingController.handlePaddleWebhook);

export default router;
