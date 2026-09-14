import { financialCalculationQueue } from "../queues/queue.server.js";
import { prisma } from "../lib/prisma.js";

/**
 * Enqueues midnight aggregation jobs for all tenants
 */
export async function scheduleDailyAggregationJobs(): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split("T")[0];

  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  for (const tenant of tenants) {
    await financialCalculationQueue.add(
      `aggregate-${tenant.id}-${dateStr}`,
      { tenantId: tenant.id, date: dateStr },
      {
        jobId: `midnight-agg-${tenant.id}-${dateStr}`,
        removeOnComplete: 30,
        removeOnFail: 100
      }
    );
  }

  console.log(`[Cron] Scheduled midnight aggregation jobs for ${tenants.length} tenants on ${dateStr}`);
}

/**
 * Initializes repeating midnight cron job on BullMQ queue
 */
export async function initDailyAggregationCron(): Promise<void> {
  // Add repeatable job to run every midnight (00:00 UTC)
  await financialCalculationQueue.add(
    "midnight-aggregation-cron-trigger",
    { tenantId: "SYSTEM", date: new Date().toISOString().split("T")[0] },
    {
      repeat: {
        pattern: "0 0 * * *" // Midnight every day
      }
    }
  );
  console.log("[Cron] Initialized midnight financial calculation cron scheduler.");
}
