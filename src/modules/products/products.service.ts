import { prisma, getTenantPrisma } from "../../lib/prisma.js";
import { decryptToken } from "../../lib/encryption.js";
import { CreateProductInput, UpdateCogsInput } from "./products.schema.js";

export interface BulkUploadSummary {
  processed: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ line: number; sku?: string; error: string }>;
}

export class ProductsService {
  /**
   * List products isolated by tenantId
   */
  static async getProducts(tenantId: string) {
    const tenantPrisma = getTenantPrisma(tenantId);
    return tenantPrisma.product.findMany({
      orderBy: { sku: "asc" }
    });
  }

  /**
   * Create product for tenantId
   */
  static async createProduct(tenantId: string, input: CreateProductInput) {
    return prisma.product.create({
      data: {
        tenantId,
        sku: input.sku,
        title: input.title,
        baseCostCents: input.baseCostCents,
        packagingCents: input.packagingCents
      }
    });
  }

  /**
   * Updates baseCostCents and packagingCents for a single product by ID.
   * STRICT CONSTRAINT: Never updates historical order_line_items.cogsAtOrderCents!
   */
  static async updateProductCogs(tenantId: string, productId: string, input: UpdateCogsInput) {
    const tenantPrisma = getTenantPrisma(tenantId);

    const existingProduct = await tenantPrisma.product.findFirst({
      where: { id: productId, tenantId }
    });

    if (!existingProduct) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    return prisma.product.update({
      where: { id: productId },
      data: {
        baseCostCents: input.baseCostCents,
        packagingCents: input.packagingCents,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Parses CSV content and bulk upserts product COGS values isolated to tenantId.
   * Format headers: SKU, BaseCost, PackagingCost (or Title)
   */
  static async bulkUploadCogsFromCsv(tenantId: string, rawCsvContent: string): Promise<BulkUploadSummary> {
    // Unescape literal \n or \r\n characters if passed as string literals from cURL/HTTP
    const csvContent = rawCsvContent.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");

    const lines = csvContent
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      throw new Error("EMPTY_CSV");
    }

    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(",").map(h => h.trim().replace(/^["']|["']$/g, ""));

    const skuIdx = headers.findIndex(h => h === "sku");
    const baseCostIdx = headers.findIndex(h => h === "basecost" || h === "base_cost" || h === "cost");
    const packagingCostIdx = headers.findIndex(h => h === "packagingcost" || h === "packaging_cost" || h === "packaging");
    const titleIdx = headers.findIndex(h => h === "title" || h === "name");

    if (skuIdx === -1 || baseCostIdx === -1) {
      throw new Error("INVALID_CSV_HEADERS: Headers must include 'SKU' and 'BaseCost'");
    }

    const summary: BulkUploadSummary = {
      processed: 0,
      successCount: 0,
      errorCount: 0,
      errors: []
    };

    const parsedProducts: Array<{ sku: string; title: string; baseCostCents: number; packagingCents: number }> = [];

    for (let i = 1; i < lines.length; i++) {
      summary.processed++;
      const line = lines[i];
      const cols = line.split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));

      const sku = cols[skuIdx];
      const rawBaseCost = cols[baseCostIdx];
      const rawPackagingCost = packagingCostIdx !== -1 ? cols[packagingCostIdx] : "0";
      const title = titleIdx !== -1 && cols[titleIdx] ? cols[titleIdx] : sku;

      if (!sku) {
        summary.errorCount++;
        summary.errors.push({ line: i + 1, error: "Missing SKU" });
        continue;
      }

      const cleanBaseCostStr = rawBaseCost ? rawBaseCost.replace(/[^0-9.]/g, "") : "0";
      const cleanPackagingCostStr = rawPackagingCost ? rawPackagingCost.replace(/[^0-9.]/g, "") : "0";

      const baseCostCents = Math.round(parseFloat(cleanBaseCostStr || "0") * 100);
      const packagingCents = Math.round(parseFloat(cleanPackagingCostStr || "0") * 100);

      if (isNaN(baseCostCents) || isNaN(packagingCents)) {
        summary.errorCount++;
        summary.errors.push({ line: i + 1, sku, error: "Invalid numeric monetary amount" });
        continue;
      }

      parsedProducts.push({ sku, title, baseCostCents, packagingCents });
    }

    // Upsert products in bulk inside a transaction
    await prisma.$transaction(async (tx) => {
      for (const p of parsedProducts) {
        await tx.product.upsert({
          where: {
            tenantId_sku: {
              tenantId,
              sku: p.sku
            }
          },
          update: {
            baseCostCents: p.baseCostCents,
            packagingCents: p.packagingCents,
            title: p.title || undefined,
            updatedAt: new Date()
          },
          create: {
            tenantId,
            sku: p.sku,
            title: p.title || p.sku,
            baseCostCents: p.baseCostCents,
            packagingCents: p.packagingCents
          }
        });
        summary.successCount++;
      }
    });

    return summary;
  }

  /**
   * Sync products directly from active connected Shopify store
   */
  static async syncShopifyProducts(tenantId: string) {
    const channel = await prisma.channel.findFirst({
      where: {
        tenantId,
        platform: "SHOPIFY",
        isActive: true
      }
    });

    if (!channel) {
      throw new Error("NO_SHOPIFY_CHANNEL");
    }

    const token = decryptToken(channel.encryptedToken);
    const shop = channel.storeIdentifier;

    const response = await fetch(`https://${shop}/admin/api/2024-01/products.json`, {
      headers: {
        "X-Shopify-Access-Token": token
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`SHOPIFY_API_ERROR: ${errText}`);
    }

    const data = (await response.json()) as {
      products?: Array<{
        id: number;
        title: string;
        image?: { src: string } | null;
        images?: Array<{ src: string }>;
        variants?: Array<{
          id: number;
          title: string;
          sku: string | null;
          price: string;
        }>;
      }>;
    };

    const products = data.products || [];
    let syncedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const p of products) {
        const imageUrl = p.images?.[0]?.src || p.image?.src || null;

        for (const v of (p.variants || [])) {
          const sku = v.sku && v.sku.trim().length > 0 ? v.sku.trim() : `SKU-${v.id}`;
          const title = v.title && v.title !== "Default Title" ? `${p.title} (${v.title})` : p.title;
          const sellingPriceCents = Math.round(parseFloat(v.price || "0") * 100);

          await tx.product.upsert({
            where: {
              tenantId_sku: {
                tenantId,
                sku
              }
            },
            update: {
              title,
              sellingPriceCents,
              imageUrl,
              channel: "SHOPIFY",
              updatedAt: new Date()
            },
            create: {
              tenantId,
              sku,
              title,
              sellingPriceCents,
              imageUrl,
              channel: "SHOPIFY",
              baseCostCents: 0,
              packagingCents: 0
            }
          });
          syncedCount++;
        }
      }
    });

    return { syncedCount, totalProducts: products.length };
  }
}
