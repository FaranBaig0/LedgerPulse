import { PrismaClient } from "@prisma/client";

// Global Prisma Client singleton
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

const TENANT_SCOPED_MODELS = [
  "User",
  "Channel",
  "Product",
  "Order",
  "DailyMetric",
  "IdempotencyKey"
] as const;

/**
 * Creates a tenant-scoped Prisma client extension that automatically appends
 * `tenantId` to query where-clauses to enforce strict row-level multi-tenant isolation.
 */
export function getTenantPrisma(tenantId: string) {
  if (!tenantId) {
    throw new Error("Tenant isolation failure: tenantId is required for tenant-scoped operations.");
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model as typeof TENANT_SCOPED_MODELS[number])) {
            args.where = { ...args.where, tenantId } as typeof args.where;
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model as typeof TENANT_SCOPED_MODELS[number])) {
            args.where = { ...args.where, tenantId } as typeof args.where;
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model as typeof TENANT_SCOPED_MODELS[number])) {
            args.where = { ...args.where, tenantId } as typeof args.where;
          }
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model as typeof TENANT_SCOPED_MODELS[number])) {
            args.where = { ...args.where, tenantId } as typeof args.where;
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model as typeof TENANT_SCOPED_MODELS[number])) {
            args.where = { ...args.where, tenantId } as typeof args.where;
          }
          return query(args);
        }
      }
    }
  });
}

export type TenantPrismaClient = ReturnType<typeof getTenantPrisma>;
