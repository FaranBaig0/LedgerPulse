"use client";

import React, { useState, useEffect } from "react";
import {
  Check,
  ShieldCheck,
  Zap,
  Sparkles,
  RefreshCw,
  Layers,
  Percent,
  Clock,
  BarChart3,
  Store,
  CreditCard,
  Lock,
  X,
  AlertCircle,
  Key,
  CheckCircle2,
  ChevronRight
} from "lucide-react";

export type PlanTierKey = "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE";

export interface PlanCardInfo {
  tier: PlanTierKey;
  name: string;
  target: string;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  orderLimit: string;
  channels: string;
  isPopular?: boolean;
  features: string[];
  cogsComplexity: string;
  history: string;
  adSync: string;
}

const PLANS: PlanCardInfo[] = [
  {
    tier: "STARTER",
    name: "Starter",
    target: "Side-hustle / Launching",
    monthlyPrice: 19,
    annualMonthlyPrice: 15,
    orderLimit: "Up to 200 orders / mo",
    channels: "1 Store (Shopify or Etsy)",
    features: [
      "Static Unit COGS Management",
      "Shopify & Etsy Transaction Fee Extraction",
      "30-Day Financial Reporting History",
      "Executive Net Profit Dashboard",
      "14-Day Risk-Free Trial (No Card)"
    ],
    cogsComplexity: "Standard Static Unit Cost",
    history: "30 Days History",
    adSync: "Basic Fee Extraction"
  },
  {
    tier: "GROWTH",
    name: "Growth",
    target: "Scaling DTC / Multi-channel",
    monthlyPrice: 49,
    annualMonthlyPrice: 39,
    orderLimit: "Up to 1,000 orders / mo",
    channels: "Up to 3 Channels (Shopify + Etsy)",
    isPopular: true,
    features: [
      "Everything in Starter Plan",
      "FIFO Dynamic Batch Inventory Depletion",
      "Meta Ad Spend Sync & Blended POAS",
      "1-Year Financial Reporting History",
      "Fair Overage Protection ($10 / 500 orders)"
    ],
    cogsComplexity: "Full FIFO Dynamic Batch Depletion",
    history: "1 Year History",
    adSync: "Automated Meta Ads Spend Sync"
  },
  {
    tier: "SCALE",
    name: "Scale",
    target: "Established Brands",
    monthlyPrice: 99,
    annualMonthlyPrice: 79,
    orderLimit: "Up to 3,000 orders / mo",
    channels: "Up to 6 Channels",
    features: [
      "Everything in Growth Plan",
      "Google Ads (PMax & Shopping SKU Spend)",
      "Multi-Currency / FX Automatic Conversion",
      "Raw Financial Data CSV Export",
      "Priority Redis Ingestion Queue"
    ],
    cogsComplexity: "Advanced FIFO & Overhead Rules",
    history: "Multi-Year Trend Analysis",
    adSync: "Meta & Google Ads SKU Spend"
  },
  {
    tier: "ENTERPRISE",
    name: "Enterprise / Pro",
    target: "7-Figure Operations",
    monthlyPrice: 199,
    annualMonthlyPrice: 159,
    orderLimit: "5,000+ orders / mo",
    channels: "Unlimited Channels",
    features: [
      "Everything in Scale Plan",
      "Custom Batch FIFO Overrides & ERP Sync",
      "Hourly Scheduled Sync Operations",
      "Dedicated Worker Queues & High QPS",
      "24/7 VIP Priority Support & SLA"
    ],
    cogsComplexity: "Custom FIFO Overrides & ERP Sync",
    history: "Unlimited Lifetime History",
    adSync: "Custom Ad Network & Omnichannel Sync"
  }
];

export default function BillingPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [activePlan, setActivePlan] = useState<PlanCardInfo>(PLANS[1]); // Default Growth Plan
  const [paddleModalPlan, setPaddleModalPlan] = useState<PlanCardInfo | null>(null);

  // Paddle Sandbox Checkout State
  const [cardNumber, setCardNumber] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [country, setCountry] = useState("US");
  const [zipCode, setZipCode] = useState("10001");
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;
      try {
        const res = await fetch("http://localhost:4000/api/v1/billing/subscription", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          const dbTier = json.data?.planTier;
          if (dbTier) {
            const found = PLANS.find((p) => p.tier === dbTier);
            if (found) {
              setActivePlan(found);
              localStorage.setItem("activePlanTier", dbTier);
            }
          }
        }
      } catch {
        console.warn("Could not fetch tenant subscription from DB");
      }
    };
    fetchSubscription();
  }, []);

  const openPaddleCheckout = (plan: PlanCardInfo) => {
    setPaddleModalPlan(plan);
    setCardNumber("");
    setCardExp("");
    setCardCvc("");
    setSuccessMessage(null);
  };

  const autofillTestCard = () => {
    setCardNumber("4242  4242  4242  4242");
    setCardExp("12/28");
    setCardCvc("123");
  };

  const handlePaddleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paddleModalPlan) return;

    setIsProcessing(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:4000/api/v1/billing/paddle/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          planTier: paddleModalPlan.tier,
          annual: isAnnual
        })
      });

      if (response.ok) {
        setSuccessMessage(`Paddle Sandbox Authorization Successful! 14-Day Free Trial activated for ${paddleModalPlan.name}.`);
        setActivePlan(paddleModalPlan);
        localStorage.setItem("activePlanTier", paddleModalPlan.tier);
        setTimeout(() => {
          setPaddleModalPlan(null);
          setIsProcessing(false);
        }, 1500);
      } else {
        alert("Failed to initialize Paddle Checkout.");
        setIsProcessing(false);
      }
    } catch {
      alert("Error contacting Paddle Checkout endpoint.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      {/* Page Header */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          <span>Paddle Billing Gateway (Sandbox Mode Integrated)</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Transparent 4-Tier Subscription Matrix
        </h1>
        <p className="text-sm text-slate-400">
          Instant net profit clarity in 60 seconds. Powered by Paddle Merchant of Record & 14-day risk-free trials.
        </p>

        {/* Monthly vs Annual Billing Toggle Switch */}
        <div className="pt-4 flex items-center justify-center gap-4">
          <span className={`text-xs font-semibold ${!isAnnual ? "text-white" : "text-slate-400"}`}>
            Monthly Billing
          </span>

          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 focus:outline-none ${
              isAnnual ? "bg-emerald-500" : "bg-slate-800 border border-slate-700"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                isAnnual ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>

          <span className={`text-xs font-semibold flex items-center gap-1.5 ${isAnnual ? "text-white" : "text-slate-400"}`}>
            <span>Annual Billing</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              SAVE 20% OFF
            </span>
          </span>
        </div>
      </div>

      {/* Active Plan Banner */}
      <div className="glass-card p-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-sm font-extrabold text-white block">
              Active Subscription: {activePlan.name} ({isAnnual ? `$${activePlan.annualMonthlyPrice * 12}/yr ($${activePlan.annualMonthlyPrice}/mo)` : `$${activePlan.monthlyPrice}/mo`})
            </span>
            <span className="text-xs text-slate-400">
              14-Day Risk-Free Trial active • Next billing cycle in 14 days • Merchant of Record: Paddle Billing
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>14-Day Free Trial Active</span>
          </span>
        </div>
      </div>

      {/* 4-Tier Subscription Matrix Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANS.map((plan) => {
          const displayPrice = isAnnual ? plan.annualMonthlyPrice : plan.monthlyPrice;
          const isCurrentActive = activePlan.tier === plan.tier;

          return (
            <div
              key={plan.tier}
              className={`glass-card glass-card-hover p-6 rounded-3xl flex flex-col justify-between relative overflow-hidden transition-all ${
                plan.isPopular
                  ? "border-2 border-indigo-500 bg-indigo-950/20 shadow-2xl shadow-indigo-500/20 scale-[1.02]"
                  : "border border-slate-800"
              }`}
            >
              {plan.isPopular && (
                <div className="absolute top-3 right-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md">
                    RECOMMENDED
                  </span>
                </div>
              )}

              <div className="space-y-5">
                {/* Header */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block">
                    {plan.target}
                  </span>
                  <h3 className="text-xl font-black text-white mt-0.5">{plan.name}</h3>
                </div>

                {/* Pricing */}
                <div className="border-y border-slate-800/80 py-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">${displayPrice}</span>
                    <span className="text-xs text-slate-400 font-medium">/ month</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 font-mono">
                    {isAnnual ? `Billed annually ($${displayPrice * 12}/yr)` : "Billed monthly"}
                  </div>
                </div>

                {/* Capacity Badges */}
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 font-medium text-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Order Limit:</span>
                    <span className="font-semibold text-indigo-300">{plan.orderLimit}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 font-medium text-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Channels:</span>
                    <span className="font-semibold text-emerald-300">{plan.channels}</span>
                  </div>
                </div>

                {/* Capability Bullet List */}
                <div className="space-y-2.5 pt-2">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                      <div className="h-4 w-4 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="leading-snug">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-8">
                <button
                  onClick={() => openPaddleCheckout(plan)}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                    isCurrentActive
                      ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40"
                      : plan.isPopular
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700"
                  }`}
                >
                  <CreditCard className="h-3.5 w-3.5 text-indigo-300" />
                  <span>{isCurrentActive ? "Active Plan (Change)" : "Start Paddle 14-Day Trial"}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Monetization Mechanics & Growth Drivers */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Layers className="h-5 w-5 text-indigo-400" />
          Key Monetization & Merchant Protection Mechanics
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">14-Day Free Trial</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No credit card required upfront. Merchants connect Shopify/Etsy and see actual net profit within 60 seconds.
            </p>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 w-fit">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">Fair Overages</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Order syncing never pauses during Black Friday spikes. Overages billed at a fair rate of $10 per 500 extra orders.
            </p>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 w-fit">
              <Percent className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">20% Annual Discount</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Save up to $960/year with annual plans. Locks in merchant cash flow upfront and reduces seasonal churn.
            </p>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 w-fit">
              <Store className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">Multi-Store Add-ons</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Operate multiple regional storefronts under one tenant for an incremental $15/month per active connection.
            </p>
          </div>
        </div>
      </div>

      {/* Value Metrics Comparison Matrix Table */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-400" />
            Full Feature & Value Metric Gating Matrix
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Core calculation engine remains accessible across all plans, with operational depth unlocked per tier.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Feature / Dimension</th>
                <th className="py-3 px-4 text-indigo-400">Starter ($19/mo)</th>
                <th className="py-3 px-4 text-purple-400">Growth ($49/mo)</th>
                <th className="py-3 px-4 text-emerald-400">Scale ($99/mo)</th>
                <th className="py-3 px-4 text-amber-400">Enterprise ($199/mo)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-xs">
              <tr>
                <td className="py-3.5 px-4 font-semibold text-white">Monthly Order Limit</td>
                <td className="py-3.5 px-4 text-slate-300">Up to 200 orders</td>
                <td className="py-3.5 px-4 text-slate-300 font-semibold text-indigo-300">Up to 1,000 orders</td>
                <td className="py-3.5 px-4 text-slate-300">Up to 3,000 orders</td>
                <td className="py-3.5 px-4 text-slate-300 font-semibold text-amber-300">5,000+ orders</td>
              </tr>

              <tr>
                <td className="py-3.5 px-4 font-semibold text-white">Connected Store Channels</td>
                <td className="py-3.5 px-4 text-slate-400">1 Store (Shopify/Etsy)</td>
                <td className="py-3.5 px-4 text-slate-300">Up to 3 Channels</td>
                <td className="py-3.5 px-4 text-slate-300">Up to 6 Channels</td>
                <td className="py-3.5 px-4 text-slate-300 font-semibold text-emerald-400">Unlimited Channels</td>
              </tr>

              <tr>
                <td className="py-3.5 px-4 font-semibold text-white">COGS Complexity Engine</td>
                <td className="py-3.5 px-4 text-slate-400">Standard Static Unit Cost</td>
                <td className="py-3.5 px-4 text-indigo-300 font-semibold">Full FIFO Batch Depletion</td>
                <td className="py-3.5 px-4 text-slate-300">Advanced Multi-location FIFO</td>
                <td className="py-3.5 px-4 text-slate-300 font-semibold">Custom FIFO & ERP Sync</td>
              </tr>

              <tr>
                <td className="py-3.5 px-4 font-semibold text-white">Historical Reporting Data</td>
                <td className="py-3.5 px-4 text-slate-400">30-Day History</td>
                <td className="py-3.5 px-4 text-purple-300 font-semibold">1-Year History</td>
                <td className="py-3.5 px-4 text-slate-300">Multi-Year Analysis</td>
                <td className="py-3.5 px-4 text-slate-300 font-semibold">Unlimited Lifetime Access</td>
              </tr>

              <tr>
                <td className="py-3.5 px-4 font-semibold text-white">Ad Spend Sync Integrations</td>
                <td className="py-3.5 px-4 text-slate-400">Transaction Fee Extraction</td>
                <td className="py-3.5 px-4 text-indigo-300 font-semibold">Meta Ads Sync & POAS</td>
                <td className="py-3.5 px-4 text-slate-300">Meta + Google Ads SKU Spend</td>
                <td className="py-3.5 px-4 text-slate-300 font-semibold">Custom Omnichannel Ad Sync</td>
              </tr>

              <tr>
                <td className="py-3.5 px-4 font-semibold text-white">Fair Overages Rate</td>
                <td className="py-3.5 px-4 text-slate-300">$10 / 500 orders</td>
                <td className="py-3.5 px-4 text-slate-300">$10 / 500 orders</td>
                <td className="py-3.5 px-4 text-slate-300">$10 / 500 orders</td>
                <td className="py-3.5 px-4 text-slate-300 font-semibold">Custom Overages</td>
              </tr>

              <tr>
                <td className="py-3.5 px-4 font-semibold text-white">Support Level</td>
                <td className="py-3.5 px-4 text-slate-400">Standard Email Support</td>
                <td className="py-3.5 px-4 text-slate-300">Priority Email Support</td>
                <td className="py-3.5 px-4 text-slate-300">Live Chat & Priority Support</td>
                <td className="py-3.5 px-4 text-amber-300 font-semibold">24/7 Dedicated VIP SLA</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* PADDLE BILLING SANDBOX CHECKOUT OVERLAY MODAL */}
      {paddleModalPlan && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 max-w-lg w-full space-y-6 relative overflow-hidden shadow-2xl">
            {/* Modal Header Bar */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    Paddle Checkout
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                      Sandbox Mode
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Merchant of Record: Paddle.com Market Limited</p>
                </div>
              </div>

              <button
                onClick={() => setPaddleModalPlan(null)}
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Success Message Banner */}
            {successMessage && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Selected Plan Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{paddleModalPlan.name} ({isAnnual ? "Annual Plan - 20% OFF" : "Monthly Plan"})</span>
                <span className="text-xs font-mono font-bold text-indigo-400">
                  ${isAnnual ? paddleModalPlan.annualMonthlyPrice * 12 : paddleModalPlan.monthlyPrice} / {isAnnual ? "year" : "month"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
                <span>Due Today (14-Day Free Trial):</span>
                <span className="text-emerald-400 font-bold">$0.00 USD</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                First recurring charge of ${isAnnual ? paddleModalPlan.annualMonthlyPrice * 12 : paddleModalPlan.monthlyPrice}.00 USD will occur 14 days from today unless cancelled during the trial period.
              </p>
            </div>

            {/* Test Card Quick Autofill Banner */}
            <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs flex items-center justify-between">
              <span className="text-indigo-300 font-medium">Test Sandbox Card: <code className="font-mono text-white">4242...4242</code></span>
              <button
                type="button"
                onClick={autofillTestCard}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] transition-all"
              >
                Autofill Test Card
              </button>
            </div>

            {/* Payment Inputs Form */}
            <form onSubmit={handlePaddleCheckoutSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Card Number (Sandbox)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="4242 4242 4242 4242"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:border-indigo-500 focus:outline-none"
                    required
                  />
                  <CreditCard className="h-4 w-4 text-slate-500 absolute left-3.5 top-3" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Expires (MM/YY)</label>
                  <input
                    type="text"
                    value={cardExp}
                    onChange={(e) => setCardExp(e.target.value)}
                    placeholder="12/28"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">CVC / Security Code</label>
                  <input
                    type="text"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    placeholder="123"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Country</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="US">United States (US)</option>
                    <option value="GB">United Kingdom (GB)</option>
                    <option value="CA">Canada (CA)</option>
                    <option value="AU">Australia (AU)</option>
                    <option value="PK">Pakistan (PK)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Postal / Zip Code</label>
                  <input
                    type="text"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <>
                      <Lock className="h-4 w-4 text-white" />
                      <span>Start 14-Day Free Trial ($0.00 Today)</span>
                      <ChevronRight className="h-4 w-4 text-emerald-200" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Developer Keys Guidance Box */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300 block flex items-center gap-1">
                <Key className="h-3 w-3 text-amber-400" />
                Live Paddle Keys Config Guide:
              </span>
              <p>
                To switch to your live Paddle account, set <code className="text-indigo-300">PADDLE_CLIENT_TOKEN</code> and <code className="text-indigo-300">PADDLE_API_KEY</code> from <a href="https://sandbox.paddle.com" target="_blank" rel="noreferrer" className="underline text-indigo-400">sandbox.paddle.com</a> in your <code className="text-slate-300">.env</code> file.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
