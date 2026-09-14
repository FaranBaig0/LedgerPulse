import { Request } from "express";

export interface RequestContext {
  tenantId: string;
  userId: string;
}

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
      rawBody?: Buffer;
    }
  }
}
