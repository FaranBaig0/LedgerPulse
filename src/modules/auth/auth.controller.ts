import { Request, Response, NextFunction } from "express";
import { RegisterTenantSchema, LoginSchema } from "./auth.schema.js";
import { AuthService } from "./auth.service.js";
import { getTenantPrisma } from "../../lib/prisma.js";

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = RegisterTenantSchema.parse(req.body);
      const result = await AuthService.registerTenant(parsedBody);
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "EMAIL_EXISTS") {
        res.status(409).json({
          error: "CONFLICT",
          message: "A user with this email address already exists"
        });
        return;
      }
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = LoginSchema.parse(req.body);
      const result = await AuthService.login(parsedBody);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
        res.status(401).json({
          error: "UNAUTHORIZED",
          message: "Invalid email or password"
        });
        return;
      }
      next(error);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const tenantPrisma = getTenantPrisma(req.context.tenantId);
      const user = await tenantPrisma.user.findFirst({
        where: { id: req.context.userId },
        select: {
          id: true,
          email: true,
          tenantId: true,
          createdAt: true,
          tenant: {
            select: {
              id: true,
              name: true,
              baseCurrency: true,
              createdAt: true
            }
          }
        }
      });

      if (!user) {
        res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
        return;
      }

      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  static async getChannels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const tenantPrisma = getTenantPrisma(req.context.tenantId);
      const channels = await tenantPrisma.channel.findMany({
        where: { tenantId: req.context.tenantId, isActive: true },
        select: {
          id: true,
          platform: true,
          storeIdentifier: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      res.status(200).json({
        success: true,
        data: channels
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateChannel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }
      const { id } = req.params;
      const { storeIdentifier, isActive } = req.body;

      const tenantPrisma = getTenantPrisma(req.context.tenantId);
      const updated = await tenantPrisma.channel.update({
        where: { id, tenantId: req.context.tenantId },
        data: {
          ...(storeIdentifier ? { storeIdentifier } : {}),
          ...(typeof isActive === "boolean" ? { isActive } : {})
        },
        select: {
          id: true,
          platform: true,
          storeIdentifier: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      res.status(200).json({
        success: true,
        message: "Channel updated successfully",
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteChannel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }
      const { id } = req.params;

      const tenantPrisma = getTenantPrisma(req.context.tenantId);
      await tenantPrisma.channel.delete({
        where: { id, tenantId: req.context.tenantId }
      });

      res.status(200).json({
        success: true,
        message: "Channel disconnected successfully"
      });
    } catch (error) {
      next(error);
    }
  }
}

