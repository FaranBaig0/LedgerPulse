import { Request, Response, NextFunction } from "express";
import { CreateProductSchema, UpdateCogsSchema, BulkCsvBodySchema } from "./products.schema.js";
import { ProductsService } from "./products.service.js";

export class ProductsController {
  static async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const products = await ProductsService.getProducts(req.context.tenantId);
      res.status(200).json({
        success: true,
        data: products
      });
    } catch (error) {
      next(error);
    }
  }

  static async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const parsedBody = CreateProductSchema.parse(req.body);
      const product = await ProductsService.createProduct(req.context.tenantId, parsedBody);

      res.status(201).json({
        success: true,
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateCogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const { id } = req.params;
      const parsedBody = UpdateCogsSchema.parse(req.body);

      const updatedProduct = await ProductsService.updateProductCogs(req.context.tenantId, id, parsedBody);

      res.status(200).json({
        success: true,
        message: "Product COGS updated successfully",
        data: updatedProduct
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
        res.status(404).json({ error: "NOT_FOUND", message: "Product not found" });
        return;
      }
      next(error);
    }
  }

  static async bulkUploadCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      let csvText = "";
      if (typeof req.body === "string") {
        csvText = req.body;
      } else if (req.body?.csvContent) {
        const parsed = BulkCsvBodySchema.parse(req.body);
        csvText = parsed.csvContent;
      } else {
        res.status(400).json({ error: "BAD_REQUEST", message: "Request body must contain csvContent or raw CSV text" });
        return;
      }

      const summary = await ProductsService.bulkUploadCogsFromCsv(req.context.tenantId, csvText);

      res.status(200).json({
        success: true,
        message: `Successfully processed ${summary.successCount} product COGS records`,
        data: summary
      });
    } catch (error: unknown) {
      if (error instanceof Error && (error.message === "EMPTY_CSV" || error.message.startsWith("INVALID_CSV_HEADERS"))) {
        res.status(400).json({ error: "BAD_REQUEST", message: error.message });
        return;
      }
      next(error);
    }
  }

  static async syncShopify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const result = await ProductsService.syncShopifyProducts(req.context.tenantId);

      res.status(200).json({
        success: true,
        message: `Successfully synced ${result.syncedCount} product variants from Shopify`,
        data: result
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "NO_SHOPIFY_CHANNEL") {
        res.status(400).json({ error: "BAD_REQUEST", message: "No active Shopify channel connected for this account" });
        return;
      }
      next(error);
    }
  }
}
