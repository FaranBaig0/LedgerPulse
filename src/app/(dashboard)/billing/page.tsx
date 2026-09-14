"use client";

import React, { useState } from "react";
import { Check, ShieldCheck, Zap, Sparkles, ExternalLink, RefreshCw } from "lucide-react";

export default function BillingPage() {
  const [loadingPlan, setLoadingPlan] = useState<"BASIC" | "PRO" | null>(null);

  const handleSubscribe = (planTier: "BASIC" | "PRO") => {
    setLoadingPlan(planTier);
    setTimeout(() => {
      setLoadingPlan(null);
      // Redirect to Shopify confirmation URL or demo confirmation modal
      alert(`Initiated Shopify Recurring Subscription for ${planTier} plan with 14-Day Trial! Redirecting to Shopify approval...`);
    }, 1000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
          14-Day Risk-Free Trial Included
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Flexible Subscription Plans for Growing Merchants
        </h1>
        <p className="text-sm text-slate-400">
          Unlock real-time COGS snapshotting, automated Etsy & Shopify fee deduction calculation, and executive profit metrics.
        </p>
      </div>

      {/* Active Plan Banner */}
      <div className="glass-card p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-bold text-white block">Current Active Plan: Starter Plan ($29/mo)</span>
            <span className="text-xs text-slate-400">14-day free trial active • Next billing cycle begins in 14 days</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Trial Active
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Starter Plan ($29/mo) */}
        <div className="glass-card glass-card-hover p-8 rounded-3xl border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 block">Starter Tier</span>
              <h2 className="text-2xl font-black text-white mt-1">Starter Plan</h2>
              <p className="text-xs text-slate-400 mt-1">Perfect for single-store merchants looking for true net profit clarity.</p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">$29</span>
              <span className="text-sm text-slate-400 font-medium">/ month</span>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800/60">
              {[
                "Shopify & Etsy Automated Integration",
                "Real-Time Webhook Order Processing",
                "Historical COGS Snapshotting",
                "Automated Fee Breakdown Engine",
                "Executive Analytics Dashboard",
                "14-Day Risk-Free Trial"
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs text-slate-300">
                  <div className="h-4 w-4 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                    <Check className="h-3 w-3" />
                  </div>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={() => handleSubscribe("BASIC")}
              disabled={loadingPlan === "BASIC"}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs transition-all flex items-center justify-center gap-2"
            >
              {loadingPlan === "BASIC" ? (
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
              ) : (
                <>
                  <span>Select Starter ($29/mo)</span>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Growth Plan ($59/mo) - Featured */}
        <div className="glass-card glass-card-hover p-8 rounded-3xl border border-indigo-500/40 bg-indigo-950/20 flex flex-col justify-between relative overflow-hidden shadow-2xl shadow-indigo-500/10">
          <div className="absolute top-4 right-4">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md">
              Most Popular
            </span>
          </div>

          <div className="space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400 block">Growth Tier</span>
              <h2 className="text-2xl font-black text-white mt-1">Growth Plan</h2>
              <p className="text-xs text-slate-400 mt-1">Designed for high-volume merchants with multi-channel inventory.</p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">$59</span>
              <span className="text-sm text-slate-400 font-medium">/ month</span>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800/60">
              {[
                "Everything in Starter Plan",
                "Unlimited Order Volume Processing",
                "Multi-Store Channel Aggregation",
                "Bulk CSV Product COGS Management",
                "Priority Redis Ingestion Queue",
                "Hourly Automated Financial Rollup"
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs text-slate-200">
                  <div className="h-4 w-4 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Check className="h-3 w-3" />
                  </div>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={() => handleSubscribe("PRO")}
              disabled={loadingPlan === "PRO"}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
            >
              {loadingPlan === "PRO" ? (
                <RefreshCw className="h-4 w-4 animate-spin text-white" />
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5 text-white" />
                  <span>Start 14-Day Free Trial ($59/mo)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
