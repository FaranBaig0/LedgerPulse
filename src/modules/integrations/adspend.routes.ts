import { Router } from "express";
import { AdSpendController } from "./adspend.controller.js";
import { authenticateTenant } from "../../middlewares/auth.middleware.js";

const router = Router();

// Ad Account CRUD
router.get("/accounts", authenticateTenant, AdSpendController.getAdAccounts);
router.post("/accounts", authenticateTenant, AdSpendController.addAdAccount);
router.delete("/accounts/:id", authenticateTenant, AdSpendController.deleteAdAccount);

// Meta OAuth Flow
router.get("/oauth/meta/url", authenticateTenant, AdSpendController.getMetaAuthUrl);
router.get("/oauth/meta/callback", AdSpendController.handleMetaCallback);

// Google Ads OAuth Flow
router.get("/oauth/google/url", authenticateTenant, AdSpendController.getGoogleAuthUrl);
router.get("/oauth/google/callback", AdSpendController.handleGoogleCallback);

// Setup Session Accounts Retrieval
router.get("/setup-session/:sessionId", AdSpendController.getSetupAccounts);

// Manual / On-Demand Sync
router.post("/meta/sync", authenticateTenant, AdSpendController.syncMetaAds);
router.post("/google/sync", authenticateTenant, AdSpendController.syncGoogleAds);

export default router;
