import { orderProcessingWorker } from "./orderProcessing.worker.js";
import { aggregationWorker } from "./aggregation.worker.js";
import { feeExtractionWorker } from "./feeExtraction.worker.js";
import { adSpendSyncWorker, initAdSpendSyncCron } from "./adSpendSync.worker.js";

console.log("[Workers] Initializing background BullMQ workers...");

orderProcessingWorker.on("completed", (job, result) => {
  console.log(`[Worker:OrderProcessing] Job ${job.id} completed successfully:`, result);
});

orderProcessingWorker.on("failed", (job, err) => {
  console.error(`[Worker:OrderProcessing] Job ${job?.id} failed with error:`, err.message);
});

aggregationWorker.on("completed", (job, result) => {
  console.log(`[Worker:Aggregation] Job ${job.id} completed successfully:`, result);
});

aggregationWorker.on("failed", (job, err) => {
  console.error(`[Worker:Aggregation] Job ${job?.id} failed with error:`, err.message);
});

feeExtractionWorker.on("completed", (job, result) => {
  console.log(`[Worker:FeeExtraction] Job ${job.id} completed successfully:`, result);
});

feeExtractionWorker.on("failed", (job, err) => {
  console.warn(`[Worker:FeeExtraction] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
});

adSpendSyncWorker.on("completed", (job, result) => {
  console.log(`[Worker:AdSpendSync] Job ${job.id} completed successfully:`, result);
});

adSpendSyncWorker.on("failed", (job, err) => {
  console.error(`[Worker:AdSpendSync] Job ${job?.id} failed with error:`, err.message);
});

// Initialize 01:00 AM UTC Cron Trigger
initAdSpendSyncCron().catch((err) => {
  console.error("[Workers] Failed to initialize AdSpendSync cron:", err);
});

export async function stopWorkers(): Promise<void> {
  console.log("[Workers] Gracefully shutting down workers...");
  await Promise.all([
    orderProcessingWorker.close(),
    aggregationWorker.close(),
    feeExtractionWorker.close(),
    adSpendSyncWorker.close()
  ]);
}
