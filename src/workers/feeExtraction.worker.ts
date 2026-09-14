import { Worker, Job } from "bullmq";
import { redisConnectionOptions } from "../queues/queue.config.js";
import { QUEUE_NAMES, FeeExtractionJobData } from "../queues/queue.server.js";
import { ShopifyFeeService } from "../services/shopifyFee.service.js";
import { EtsyFeeService } from "../services/etsyFee.service.js";
import { FeeCalculatorService } from "../services/feeCalculator.service.js";

/**
 * Dedicated BullMQ worker processing transaction fee extraction asynchronously with exponential backoff retries.
 */
export const feeExtractionWorker = new Worker<FeeExtractionJobData>(
  QUEUE_NAMES.FEE_EXTRACTION,
  async (job: Job<FeeExtractionJobData>) => {
    const { orderId, tenantId, platform } = job.data;
    console.log(`[FeeExtractionWorker] Processing fee extraction job for order ${orderId} (${platform}) under tenant ${tenantId}`);

    let extractionResult = { settled: true, feesExtractedCount: 0 };

    if (platform === "SHOPIFY") {
      extractionResult = await ShopifyFeeService.fetchAndPersistFees(orderId, tenantId);
    } else if (platform === "ETSY") {
      extractionResult = await EtsyFeeService.fetchAndPersistFees(orderId, tenantId);
    }

    // If Shopify Payments fees have not settled yet, throw error to trigger BullMQ delayed exponential backoff retry
    if (!extractionResult.settled) {
      console.warn(`[FeeExtractionWorker] Fees not settled yet for order ${orderId}. Triggering BullMQ retry.`);
      throw new Error(`FEES_NOT_SETTLED_YET: Shopify transaction fee_lines pending settlement for order ${orderId}`);
    }

    // Fallback: If 0 live API fees were extracted (e.g. mock tokens or offline dev), calculate standard estimated fees
    if (extractionResult.feesExtractedCount === 0) {
      console.log(`[FeeExtractionWorker] 0 live fees extracted for order ${orderId}. Running fallback FeeCalculatorService.`);
      await FeeCalculatorService.calculateAndPersistOrderFees(
        orderId,
        tenantId,
        platform === "SHOPIFY" ? "SHOPIFY" : "ETSY"
      );
    }

    return {
      status: "success",
      orderId,
      feesExtractedCount: extractionResult.feesExtractedCount
    };
  },
  {
    connection: redisConnectionOptions,
    concurrency: 5
  }
);
