import { Router } from "express";
import { AnalyticsController } from "./analytics.controller.js";
import { authenticateTenant } from "../../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticateTenant);

router.get("/dashboard", AnalyticsController.getDashboard);
router.post("/trigger-aggregation", AnalyticsController.triggerAggregation);

export default router;
