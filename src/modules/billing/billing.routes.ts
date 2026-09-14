import { Router } from "express";
import { BillingController } from "./billing.controller.js";
import { authenticateTenant } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/plans", BillingController.getPlans);
router.post("/subscribe", authenticateTenant, BillingController.subscribe);

export default router;
