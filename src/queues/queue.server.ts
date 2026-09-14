import { Queue } from "bullmq";
import { redisConnectionOptions } from "./queue.config.js";

export const QUEUE_NAMES = {
  WEBHOOK_INGESTION: "webhook-ingestion-queue",
  HISTORICAL_BACKFILL: "historical-backfill-queue",
  FINANCIAL_CALCULATION: "financial-calculation-queue",
  FEE_EXTRACTION: "fee-extraction-queue",
  AD_SPEND_SYNC: "ad-spend-sync-queue"
} as const;

export interface WebhookIngestionJobData {
  tenantId: string;
  channelId?: string;
  platform: "SHOPIFY" | "ETSY";
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface HistoricalBackfillJobData {
  tenantId: string;
  channelId: string;
  platform: "SHOPIFY" | "ETSY";
  startDate?: string;
  endDate?: string;
}

export interface FinancialCalculationJobData {
  tenantId: string;
  date: string; // YYYY-MM-DD
}

export interface FeeExtractionJobData {
  orderId: string;
  tenantId: string;
  platform: "SHOPIFY" | "ETSY";
}

export interface AdSpendSyncJobData {
  tenantId?: string;
  referenceDate?: string;
}

// Queue Instances
export const webhookIngestionQueue = new Queue<WebhookIngestionJobData>(
  QUEUE_NAMES.WEBHOOK_INGESTION,
  { connection: redisConnectionOptions }
);

export const historicalBackfillQueue = new Queue<HistoricalBackfillJobData>(
  QUEUE_NAMES.HISTORICAL_BACKFILL,
  { connection: redisConnectionOptions }
);

export const financialCalculationQueue = new Queue<FinancialCalculationJobData>(
  QUEUE_NAMES.FINANCIAL_CALCULATION,
  { connection: redisConnectionOptions }
);

export const feeExtractionQueue = new Queue<FeeExtractionJobData>(
  QUEUE_NAMES.FEE_EXTRACTION,
  { connection: redisConnectionOptions }
);

export const adSpendSyncQueue = new Queue<AdSpendSyncJobData>(
  QUEUE_NAMES.AD_SPEND_SYNC,
  { connection: redisConnectionOptions }
);

/**
 * Enqueues a webhook payload for asynchronous, idempotent worker processing.
 */
export async function enqueueWebhookEvent(data: WebhookIngestionJobData): Promise<string> {
  const job = await webhookIngestionQueue.add(`webhook-${data.platform.toLowerCase()}-${data.eventId}`, data, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500
  });

  return job.id || data.eventId;
}
