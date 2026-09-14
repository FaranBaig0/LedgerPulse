import { z } from "zod";

export const RegisterTenantSchema = z.object({
  tenantName: z.string().min(2, "Tenant name must be at least 2 characters"),
  baseCurrency: z.string().length(3, "Currency must be 3-character ISO code (e.g. USD)").default("USD"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long")
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
});

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    tenantId: z.string().uuid(),
    createdAt: z.date()
  }),
  tenant: z.object({
    id: z.string().uuid(),
    name: z.string(),
    baseCurrency: z.string()
  })
});

export type RegisterTenantInput = z.infer<typeof RegisterTenantSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type AuthResponseData = z.infer<typeof AuthResponseSchema>;
