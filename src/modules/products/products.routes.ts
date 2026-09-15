import { Router } from "express";
import { ProductsController } from "./products.controller.js";
import { authenticateTenant } from "../../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticateTenant);

router.get("/", ProductsController.getProducts);
router.post("/", ProductsController.createProduct);
router.put("/:id/cogs", ProductsController.updateCogs);
router.post("/bulk-csv", ProductsController.bulkUploadCsv);
router.post("/sync-shopify", ProductsController.syncShopify);

export default router;
