import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { authenticateTenant } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.get("/me", authenticateTenant, AuthController.getMe);
router.get("/channels", authenticateTenant, AuthController.getChannels);
router.put("/channels/:id", authenticateTenant, AuthController.updateChannel);
router.delete("/channels/:id", authenticateTenant, AuthController.deleteChannel);

export default router;
