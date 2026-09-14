import { Worker, Job } from "bullmq";
import { redisConnectionOptions } from "../queues/queue.config.js";
import { QUEUE_NAMES, AdSpendSyncJobData, adSpendSyncQueue } from "../queues/queue.server.js";
import { prisma } from "../lib/prisma.js";
import { MetaAdsService } from "../services/metaAds.service.js";
import { AggregationService } from "../services/aggregation.service.js";

/**
 * Daily scheduled worker (01:00 AM UTC) syncing rolling 3-day ad spend for Meta Ads
 * and re-aggregating True Net Profit & POAS daily metrics.
 */
export const adSpendSyncWorker = new Worker<AdSpendSyncJobData>(
  QUEUE_NAMES.AD_SPEND_SYNC,
  async (job: Job<AdSpendSyncJobData>) => {
    const refDate = job.data.referenceDate ? new Date(job.data.referenceDate) : new Date();
    console.log(`[AdSpendSyncWorker] Executing daily rolling 3-day ad spend sync (Ref Date: ${refDate.toISOString()})`);

    const tenants = job.data.tenantId
      ? await prisma.tenant.findMany({ where: { id: job.data.tenantId }, select: { id: true } })
      : await prisma.tenant.findMany({ select: { id: true } });

    let totalSyncedAccounts = 0;

    for (const tenant of tenants) {
      try {
        const syncResult = await MetaAdsService.syncTenantAdSpend(tenant.id, "act_default_123", undefined, refDate);

        if (syncResult.status === "NEEDS_REAUTH") {
          console.warn(`[AdSpendSyncWorker] Tenant ${tenant.id} ad account requires re-authentication.`);
        } else {
          totalSyncedAccounts++;
        }

        // Re-aggregate daily metrics for each of the rolling 3 days (t-1, t-2, t-3)
        for (let i = 1; i <= 3; i++) {
          const targetDay = new Date(refDate);
          targetDay.setUTCDate(targetDay.getUTCDate() - i);
          await AggregationService.aggregateTenantDailyMetrics(tenant.id, targetDay);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[AdSpendSyncWorker] Failed syncing ad spend for tenant ${tenant.id}: ${errorMsg}`);
      }
    }

    return {
      status: "completed",
      tenantsProcessed: tenants.length,
      syncedAccounts: totalSyncedAccounts
    };
  },
  {
    connection: redisConnectionOptions,
    concurrency: 2
  }
);

/**
 * Initializes daily 01:00 AM UTC cron trigger for ad spend synchronization
 */
export async function initAdSpendSyncCron(): Promise<void> {
  await adSpendSyncQueue.add(
    "daily-01am-ad-spend-sync-trigger",
    {},
    {
      repeat: {
        pattern: "0 1 * * *" // 01:00 AM UTC daily
      }
    }
  );
  console.log("[AdSpendSyncWorker] Initialized 01:00 AM UTC daily ad spend sync cron scheduler.");
}
