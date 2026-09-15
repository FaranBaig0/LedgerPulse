import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./modules/auth/auth.routes.js";
import shopifyAuthRoutes from "./modules/integrations/shopify/shopify.auth.routes.js";
import etsyAuthRoutes from "./modules/integrations/etsy/etsy.auth.routes.js";
import shopifyWebhookRoutes from "./modules/webhooks/shopify.webhook.routes.js";
import productRoutes from "./modules/products/products.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import billingRoutes from "./modules/billing/billing.routes.js";
import adspendRoutes from "./modules/integrations/adspend.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app: Express = express();

app.use(helmet());
app.use(cors());

// Parse JSON body and capture rawBody Buffer for webhook HMAC verification
app.use(
  express.json({
    verify: (req: Request, _res: Response, buf: Buffer) => {
      req.rawBody = buf;
    }
  })
);

// Support raw text CSV body parsing for /bulk-csv
app.use(express.text({ type: ["text/csv", "text/plain"] }));

// Health Check Endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// API v1 Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/auth/shopify", shopifyAuthRoutes);
app.use("/api/v1/auth/etsy", etsyAuthRoutes);
app.use("/api/v1/webhooks/shopify", shopifyWebhookRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/billing", billingRoutes);
app.use("/api/v1/adspend", adspendRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;
