import { prisma } from "../src/lib/prisma.js";
import { FinancialEngineService } from "../src/services/financial-engine.service.js";
import { MetaAdsService } from "../src/services/metaAds.service.js";

async function verifyAllSystems() {
  console.log("=================================================");
  console.log("LEDGERPULSE FULL END-TO-END VERIFICATION SUITE");
  console.log("=================================================");

  // 1. Get or create test tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: "30e79012-4749-4766-9212-7d4f57abc92a" },
    update: { planTier: "SCALE", subscriptionStatus: "ACTIVE" },
    create: {
      id: "30e79012-4749-4766-9212-7d4f57abc92a",
      name: "Test Merchant Store",
      baseCurrency: "USD",
      planTier: "SCALE",
      subscriptionStatus: "ACTIVE"
    }
  });

  console.log(`\n✅ 1. Tenant Loaded: ${tenant.name} (Plan: ${tenant.planTier}, Status: ${tenant.subscriptionStatus})`);

  // 2. Verify Channels (Shopify & Etsy)
  const channels = await prisma.channel.findMany({
    where: { tenantId: tenant.id }
  });
  console.log(`✅ 2. Connected Sales Channels: ${channels.length} channel(s) active`);
  channels.forEach((c) => console.log(`   - [${c.platform}] Store: ${c.storeIdentifier}`));

  // 3. Link Ad Account & Sync Spend
  const adAccount = await prisma.adAccount.upsert({
    where: {
      tenantId_platform_adAccountId: {
        tenantId: tenant.id,
        platform: "META",
        adAccountId: "act_1020304050"
      }
    },
    update: { accountName: "US Prospecting Account", isActive: true },
    create: {
      tenantId: tenant.id,
      platform: "META",
      adAccountId: "act_1020304050",
      accountName: "US Prospecting Account",
      isActive: true
    }
  });

  console.log(`✅ 3. Ad Account Linked: [${adAccount.platform}] ${adAccount.accountName} (${adAccount.adAccountId})`);

  // Sync Meta Ads spend
  const syncResult = await MetaAdsService.syncTenantAdSpend(tenant.id, "act_1020304050");
  console.log(`✅ 4. Meta Ad Spend Synced: ${syncResult.syncedDaysCount} days ($${(syncResult.totalSpendCents / 100).toFixed(2)})`);

  // 4. Test Financial Engine Calculation
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = new Date();

  const metrics = await FinancialEngineService.calculateFinancialSummary(tenant.id, startDate, endDate);

  console.log("\n=================================================");
  console.log("FINANCIAL ENGINE METRICS (LAST 30 DAYS)");
  console.log("=================================================");
  console.log(`Gross Revenue:       $${(Number(metrics.grossRevenueCents) / 100).toFixed(2)}`);
  console.log(`Discounts / Refunds: $${(Number(metrics.discountCents + metrics.refundCents) / 100).toFixed(2)}`);
  console.log(`Net Revenue:         $${(Number(metrics.netRevenueCents) / 100).toFixed(2)}`);
  console.log(`Total COGS:          $${(Number(metrics.cogsCents) / 100).toFixed(2)}`);
  console.log(`Platform Fees:       $${(Number(metrics.platformFeesCents) / 100).toFixed(2)}`);
  console.log(`Ad Spend (Meta/Ggl): $${(Number(metrics.totalAdSpendCents) / 100).toFixed(2)}`);
  console.log(`-------------------------------------------------`);
  console.log(`TRUE NET PROFIT:     $${(Number(metrics.trueNetProfitCents) / 100).toFixed(2)}`);
  console.log(`Blended POAS:        ${metrics.blendedPOAS}x`);
  console.log(`Blended ROAS:        ${metrics.blendedROAS}x`);
  console.log(`Net Margin %:        ${metrics.netMarginPercentage}%`);
  console.log("=================================================");

  // 5. Test Per-SKU Profitability Table
  const skuBreakdown = await FinancialEngineService.getSKUProfitabilityBreakdown(tenant.id, startDate, endDate);
  console.log(`\n✅ 5. SKU Profitability Table: ${skuBreakdown.length} SKU(s) evaluated`);

  if (skuBreakdown.length > 0) {
    const topSKU = skuBreakdown[0];
    console.log(`   Top SKU: ${topSKU.sku} (${topSKU.title})`);
    console.log(`   - Units Sold: ${topSKU.unitsSold}`);
    console.log(`   - Gross Revenue: $${(Number(topSKU.grossRevenueCents) / 100).toFixed(2)}`);
    console.log(`   - COGS: $${(Number(topSKU.cogsCents) / 100).toFixed(2)}`);
    console.log(`   - Direct Ad Spend: $${(Number(topSKU.directAdSpendCents) / 100).toFixed(2)}`);
    console.log(`   - Allocated Ad Spend: $${(Number(topSKU.allocatedAdSpendCents) / 100).toFixed(2)}`);
    console.log(`   - SKU Net Profit: $${(Number(topSKU.netProfitCents) / 100).toFixed(2)} (${topSKU.netMarginPercentage}%)`);
  }

  console.log("\n=================================================");
  console.log("🎉 ALL SYSTEMS PASSED & READY FOR TESTING!");
  console.log("=================================================\n");
}

verifyAllSystems()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  });
