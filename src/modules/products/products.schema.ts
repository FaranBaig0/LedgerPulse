import { z } from "zod";

export const CreateProductSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  title: z.string().min(1, "Product title is required"),
  baseCostCents: z.number().int().nonnegative("baseCostCents must be a non-negative integer"),
  packagingCents: z.number().int().nonnegative("packagingCents must be a non-negative integer").default(0)
});

export const UpdateCogsSchema = z.object({
  baseCostCents: z.number().int().nonnegative("baseCostCents must be a non-negative integer"),
  packagingCents: z.number().int().nonnegative("packagingCents must be a non-negative integer").default(0)
});

export const CsvRowSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  title: z.string().optional().default(""),
  baseCost: z.union([z.string(), z.number()]),
  packagingCost: z.union([z.string(), z.number()]).optional().default(0)
});

export const BulkCsvBodySchema = z.object({
  csvContent: z.string().min(1, "csvContent is required")
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateCogsInput = z.infer<typeof UpdateCogsSchema>;
export type CsvRowInput = z.infer<typeof CsvRowSchema>;
export type BulkCsvBodyInput = z.infer<typeof BulkCsvBodySchema>;
