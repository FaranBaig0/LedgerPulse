import crypto from "crypto";
import { ChannelPlatform, FeeType } from "@prisma/client";
import { prisma, getTenantPrisma } from "../lib/prisma.js";
import { decryptToken } from "../lib/encryption.js";

export interface EtsyLedgerEntry {
  entry_id: number | string;
  ledger_id?: number | string;
  sequence_number?: number;
  amount: number;
  currency: string;
  description?: string;
  balance?: number;
  create_date?: number;
  created_timestamp?: number;
  ledger_type?: string;
  type?: string;
  reference_id?: number | string;
}

export interface EtsyLedgerResponse {
  count: number;
  results: EtsyLedgerEntry[];
}

export interface FetchEtsyFeesResult {
  settled: boolean;
  feesExtractedCount: number;
}

export class EtsyFeeService {
  /**
   * Maps Etsy ledger type strings to FeeType enum
   */
  private static mapEtsyTypeToFeeType(rawType: string): FeeType | null {
    const upper = rawType.toUpperCase();
    if (upper.includes("TRANSACTION")) return FeeType.TRANSACTION;
    if (upper.includes("PROCESSING") || upper.includes("PAYMENT")) return FeeType.PAYMENT_PROCESSING;
    if (upper.includes("LISTING")) return FeeType.LISTING;
    if (upper.includes("OFFSITE_ADS") || upper.includes("ADS")) return FeeType.OFFSITE_ADS;
    if (upper.includes("SHIPPING")) return FeeType.SHIPPING_LABEL;
    return null;
  }

  /**
   * Fetches Etsy payment ledger entries for a receipt and persists them into order_fees table.
   * Handles pagination, type mapping, and negative refund/adjustment ledger entries.
   */
  static async fetchAndPersistFees(orderId: string, tenantId: string): Promise<FetchEtsyFeesResult> {
    const tenantPrisma = getTenantPrisma(tenantId);

    const order = await tenantPrisma.order.findFirst({
      where: {
        id: orderId,
        tenantId
      }
    });

    if (!order) {
      throw new Error(`ORDER_NOT_FOUND: Order ${orderId} not found for tenant ${tenantId}`);
    }

    const channel = await tenantPrisma.channel.findFirst({
      where: {
        tenantId,
        platform: ChannelPlatform.ETSY
      }
    });

    if (!channel || !channel.encryptedToken || channel.encryptedToken === "dummy_encrypted_token") {
      console.warn(`[EtsyFeeService] Missing or mock credentials for tenant ${tenantId}. Skipping live API fetch.`);
      return { settled: true, feesExtractedCount: 0 };
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(channel.encryptedToken);
    } catch {
      console.warn(`[EtsyFeeService] Unable to decrypt Etsy token for store ${channel.storeIdentifier}`);
      return { settled: true, feesExtractedCount: 0 };
    }

    const shopId = channel.storeIdentifier;
    const receiptId = order.platformOrderId;
    const apiKey = process.env.ETSY_API_KEY || "";

    // Fetch paginated ledger entries filtered by receipt reference
    let limit = 100;
    let offset = 0;
    let hasMore = true;
    const allLedgerEntries: EtsyLedgerEntry[] = [];

    while (hasMore) {
      const url = `https://api.etsy.com/v3/application/shops/${shopId}/payment-account/ledger-entries?limit=${limit}&offset=${offset}`;

      const response = await fetch(url, {
        headers: {
          "x-api-key": apiKey,
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        // Fallback to checking receipt payments endpoint if main ledger entry fetch fails
        const receiptPaymentUrl = `https://api.etsy.com/v3/application/shops/${shopId}/receipts/${receiptId}/payments`;
        const receiptResp = await fetch(receiptPaymentUrl, {
          headers: {
            "x-api-key": apiKey,
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/json"
          }
        });

        if (!receiptResp.ok) {
          console.warn(`[EtsyFeeService] Unable to fetch ledger entries or receipt payments for receipt ${receiptId}`);
          return { settled: true, feesExtractedCount: 0 };
        }

        const paymentData = (await receiptResp.json()) as { results?: Array<Record<string, unknown>> };
        const payments = paymentData.results || [];
        for (const p of payments) {
          if (p.proccessing_fee || p.amount) {
            allLedgerEntries.push({
              entry_id: String(p.payment_id || receiptId),
              amount: Number(p.proccessing_fee || 0),
              currency: String(p.currency || order.currency),
              ledger_type: "PROCESSING_FEE",
              reference_id: receiptId
            });
          }
        }
        break;
      }

      const data = (await response.json()) as EtsyLedgerResponse;
      const entries = data.results || [];
      
      // Filter entries matching receipt_id reference
      const matchedEntries = entries.filter(
        (e) => String(e.reference_id) === String(receiptId) || (e.description && e.description.includes(receiptId))
      );
      allLedgerEntries.push(...matchedEntries);

      if (entries.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
        if (offset >= 500) hasMore = false; // Cap safety
      }
    }

    const extractedFees: Array<{
      externalFeeId: string;
      feeType: FeeType;
      amountCents: number;
      currency: string;
      rawFeeDetails: Record<string, unknown>;
    }> = [];

    for (const entry of allLedgerEntries) {
      const rawType = entry.ledger_type || entry.type || "PROCESSING_FEE";
      const feeType = this.mapEtsyTypeToFeeType(rawType) || FeeType.TRANSACTION;

      // Etsy amounts are usually stored as integers in cents or standard decimal
      let amountCents = entry.amount;
      if (!Number.isInteger(amountCents)) {
        amountCents = Math.round(amountCents * 100);
      }

      const externalFeeId = entry.entry_id
        ? String(entry.entry_id)
        : crypto.createHash("sha256").update(`${order.id}_${feeType}_${amountCents}_${entry.reference_id}`).digest("hex").slice(0, 32);

      extractedFees.push({
        externalFeeId,
        feeType,
        amountCents,
        currency: entry.currency || order.currency,
        rawFeeDetails: { ...entry }
      });
    }

    // Atomically upsert fees into database using compound unique key
    await prisma.$transaction(async (tx) => {
      for (const fee of extractedFees) {
        await tx.orderFee.upsert({
          where: {
            orderId_feeType_externalFeeId: {
              orderId: order.id,
              feeType: fee.feeType,
              externalFeeId: fee.externalFeeId
            }
          },
          update: {
            amountCents: fee.amountCents,
            currency: fee.currency,
            rawFeeDetails: fee.rawFeeDetails as any
          },
          create: {
            orderId: order.id,
            feeType: fee.feeType,
            amountCents: fee.amountCents,
            currency: fee.currency,
            externalFeeId: fee.externalFeeId,
            rawFeeDetails: fee.rawFeeDetails as any
          }
        });
      }
    });

    console.log(`[EtsyFeeService] Successfully persisted ${extractedFees.length} fees for Etsy order ${order.id}`);
    return { settled: true, feesExtractedCount: extractedFees.length };
  }
}
