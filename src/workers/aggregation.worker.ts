import { Worker, Job } from "bullmq";
import { redisConnectionOptions } from "../queues/queue.config.js";
import { QUEUE_NAMES, FinancialCalculationJobData } from "../queues/queue.server.js";
import { AggregationService } from "../services/aggregation.service.js";

/**
 * BullMQ Worker processing daily financial aggregation jobs
 */
export const aggregationWorker = new Worker<FinancialCalculationJobData>(
  QUEUE_NAMES.FINANCIAL_CALCULATION,
  async (job: Job<FinancialCalculationJobData>) => {
    const { tenantId, date } = job.data;
    console.log(`[AggregationWorker] Running daily aggregation for tenant ${tenantId} on date ${date}`);

    const result = await AggregationService.aggregateTenantDailyMetrics(tenantId, date);
    
    return {
      status: "completed",
      tenantId: result.tenantId,
      date: result.date,
      grossRevenueCents: result.grossRevenueCents.toString(),
      netProfitCents: result.netProfitCents.toString()
    };
  },
  {
    connection: redisConnectionOptions,
    concurrency: 3
  }
);
