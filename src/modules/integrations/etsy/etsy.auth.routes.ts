import { Router } from "express";
import { EtsyAuthController } from "./etsy.auth.controller.js";
import { authenticateTenant } from "../../../middlewares/auth.middleware.js";

const router = Router();

router.get("/", authenticateTenant, EtsyAuthController.initOAuth);
router.get("/callback", EtsyAuthController.callback);

export default router;
