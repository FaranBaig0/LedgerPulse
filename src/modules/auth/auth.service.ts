import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { signToken } from "../../lib/jwt.js";
import { RegisterTenantInput, LoginInput, AuthResponseData } from "./auth.schema.js";

export class AuthService {
  /**
   * Register a new Tenant along with an initial Admin User
   */
  static async registerTenant(input: RegisterTenantInput): Promise<AuthResponseData> {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email }
    });

    if (existingUser) {
      throw new Error("EMAIL_EXISTS");
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);

    const { tenant, user } = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name: input.tenantName,
          baseCurrency: input.baseCurrency.toUpperCase()
        }
      });

      const newUser = await tx.user.create({
        data: {
          tenantId: newTenant.id,
          email: input.email.toLowerCase(),
          passwordHash
        }
      });

      return { tenant: newTenant, user: newUser };
    });

    const token = signToken({
      userId: user.id,
      tenantId: tenant.id,
      email: user.email
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        createdAt: user.createdAt
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        baseCurrency: tenant.baseCurrency
      }
    };
  }

  /**
   * Authenticate user credentials and return JWT token
   */
  static async login(input: LoginInput): Promise<AuthResponseData> {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() }
    });

    if (!user) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId }
    });

    if (!tenant) {
      throw new Error("TENANT_NOT_FOUND");
    }

    const token = signToken({
      userId: user.id,
      tenantId: tenant.id,
      email: user.email
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        createdAt: user.createdAt
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
 baseCurrency: tenant.baseCurrency
      }
    };
  }
}
