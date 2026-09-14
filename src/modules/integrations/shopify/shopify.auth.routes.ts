import { Router } from "express";
import { ShopifyAuthController } from "./shopify.auth.controller.js";
import { authenticateTenant } from "../../../middlewares/auth.middleware.js";

const router = Router();

router.get("/", authenticateTenant, ShopifyAuthController.initOAuth);
router.get("/callback", ShopifyAuthController.callback);

export default router;
