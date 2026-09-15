import { Router } from "express";
import { AdSpendController } from "./adspend.controller.js";
import { authenticateTenant } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/meta/sync", authenticateTenant, AdSpendController.syncMetaAds);
router.post("/google/sync", authenticateTenant, AdSpendController.syncGoogleAds);

export default router;
