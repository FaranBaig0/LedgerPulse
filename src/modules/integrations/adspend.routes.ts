import { Router } from "express";
import { AdSpendController } from "./adspend.controller.js";
import { authenticateTenant } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/accounts", authenticateTenant, AdSpendController.getAdAccounts);
router.post("/accounts", authenticateTenant, AdSpendController.addAdAccount);
router.delete("/accounts/:id", authenticateTenant, AdSpendController.deleteAdAccount);
router.post("/meta/sync", authenticateTenant, AdSpendController.syncMetaAds);
router.post("/google/sync", authenticateTenant, AdSpendController.syncGoogleAds);

export default router;
