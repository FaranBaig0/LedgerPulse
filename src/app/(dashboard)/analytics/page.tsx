"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  ShoppingBag,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  CheckCircle2,
  Package,
  Plus
} from "lucide-react";
import { formatCurrency, SupportedCurrency } from "../../../lib/currency";

interface DailyMetricPoint {
  date: string;
  grossRevenue: number;
  netProfit: number;
  totalCogs: number;
  totalFees: number;
  orderCount: number;
}

interface UnderperformingSkuItem {
  sku: string;
  title: string;
  orders: number;
  revenue: number;
  cogs: number;
  fees: number;
  netProfit: number;
  marginPercent: number;
}

interface DashboardSummary {
  netProfit: number;
  grossRevenue: number;
  totalCogs: number;
  totalFees: number;
  totalAdSpend: number;
  orderCount: number;
  trueMarginPercent: number;
  dailyMetrics: DailyMetricPoint[];
  underperformingSkus: UnderperformingSkuItem[];
}

export default function AnalyticsDashboardPage() {
  const [timeframe, setTimeframe] = useState<"7D" | "30D" | "90D" | "YTD">("30D");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [currency, setCurrency] = useState<SupportedCurrency>("USD");

  const updateCurrencyFromStorage = () => {
    const saved = localStorage.getItem("selectedCurrency") as SupportedCurrency;
    if (saved) setCurrency(saved);
  };

  const fetchLiveMetrics = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const response = await fetch("http://localhost:4000/api/v1/analytics/dashboard", {
        headers: {
          Authorization: token ? `Bearer ${token}` : ""
        }
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          setSummary(json.data);
        }
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    updateCurrencyFromStorage();
    fetchLiveMetrics();

    const handleCurrencyEvent = () => updateCurrencyFromStorage();
    window.addEventListener("currencyChanged", handleCurrencyEvent);
    return () => window.removeEventListener("currencyChanged", handleCurrencyEvent);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const token = localStorage.getItem("token");
      await fetch("http://localhost:4000/api/v1/analytics/trigger-aggregation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        }
      });
      await fetchLiveMetrics();
    } catch {
      // Error
    } finally {
      setIsRefreshing(false);
    }
  };

  const displayNetProfit = summary ? summary.netProfit : 0;
  const displayGrossRevenue = summary ? summary.grossRevenue : 0;
  const displayTrueMargin = summary ? summary.trueMarginPercent : 0;
  const displayCogs = summary ? summary.totalCogs : 0;
  const displayFees = summary ? summary.totalFees : 0;
  const displayOrderCount = summary ? summary.orderCount : 0;

  const chartData = summary && summary.dailyMetrics.length > 0 ? summary.dailyMetrics : [];
  const underperformingSkus = summary?.underperformingSkus || [];

  // SVG Area Chart Calculations
  const maxRevenue = Math.max(...chartData.map((d) => d.grossRevenue), 100);
  const svgWidth = 800;
  const svgHeight = 220;

  const pointsGross = chartData.length > 0
    ? chartData
        .map((d, index) => {
          const x = (index / Math.max(chartData.length - 1, 1)) * svgWidth;
          const y = svgHeight - (d.grossRevenue / maxRevenue) * (svgHeight - 20);
          return `${x},${y}`;
        })
        .join(" ")
    : `0,${svgHeight} ${svgWidth},${svgHeight}`;

  const pointsProfit = chartData.length > 0
    ? chartData
        .map((d, index) => {
          const x = (index / Math.max(chartData.length - 1, 1)) * svgWidth;
          const y = svgHeight - (d.netProfit / maxRevenue) * (svgHeight - 20);
          return `${x},${y}`;
        })
        .join(" ")
    : `0,${svgHeight} ${svgWidth},${svgHeight}`;

  const areaPathGross = `M 0,${svgHeight} L ${pointsGross} L ${svgWidth},${svgHeight} Z`;
  const areaPathProfit = `M 0,${svgHeight} L ${pointsProfit} L ${svgWidth},${svgHeight} Z`;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            Executive Financial Analytics
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {currency} Live Tenant Feed
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time multi-tenant contribution margins, true COGS snapshotting, and platform fee breakdown.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
            {(["7D", "30D", "90D", "YTD"] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  timeframe === tf
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-indigo-400 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh Rollup</span>
          </button>
        </div>
      </div>

      {/* Top 4 Executive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: True Net Profit */}
        <div className="glass-card glass-card-hover p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-emerald-500/10 blur-2xl"></div>
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold tracking-wider uppercase">
            <span>True Net Profit</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black tracking-tight gradient-text-emerald">
              {formatCurrency(displayNetProfit, currency)}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Live Account Data</span>
          </div>
        </div>

        {/* Card 2: True Margin % */}
        <div className="glass-card glass-card-hover p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-indigo-500/10 blur-2xl"></div>
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold tracking-wider uppercase">
            <span>True Profit Margin</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <PieChart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black tracking-tight text-white">{displayTrueMargin.toFixed(2)}%</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-indigo-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Contribution Margin</span>
          </div>
        </div>

        {/* Card 3: Gross Revenue */}
        <div className="glass-card glass-card-hover p-6 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold tracking-wider uppercase">
            <span>Gross Revenue</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black tracking-tight text-white">
              {formatCurrency(displayGrossRevenue, currency)}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <ShoppingBag className="h-3.5 w-3.5 text-purple-400" />
            <span>{displayOrderCount} Account Orders</span>
          </div>
        </div>

        {/* Card 4: Total COGS & Platform Fees */}
        <div className="glass-card glass-card-hover p-6 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold tracking-wider uppercase">
            <span>Total Deductions</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black tracking-tight text-slate-200">
              {formatCurrency(displayCogs + displayFees, currency)}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
            <span>COGS: {formatCurrency(displayCogs, currency)}</span>
            <span className="text-slate-600">•</span>
            <span>Fees: {formatCurrency(displayFees, currency)}</span>
          </div>
        </div>
      </div>

      {/* Main Visual: Daily Revenue vs True Net Profit Timeseries Chart */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800/80 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-5">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Daily Revenue vs True Net Profit ({currency})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuous rollup aggregated at $O(1)$ directly from precomputed daily metrics.
            </p>
          </div>

          <div className="flex items-center gap-5 text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500"></span>
              <span className="text-slate-300">Gross Revenue ({currency})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
              <span className="text-slate-300">True Net Profit ({currency})</span>
            </div>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-3">
            <TrendingUp className="h-10 w-10 text-slate-700 mx-auto" />
            <p className="text-xs font-medium text-slate-400">No daily metrics recorded yet for your account.</p>
            <p className="text-[11px] text-slate-600 max-w-md mx-auto">
              Once you process order webhooks or link your Shopify/Etsy stores, daily profit rollups will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-56 overflow-visible">
              <defs>
                <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              <line x1="0" y1="40" x2={svgWidth} y2="40" stroke="#1e293b" strokeDasharray="4 4" />
              <line x1="0" y1="100" x2={svgWidth} y2="100" stroke="#1e293b" strokeDasharray="4 4" />
              <line x1="0" y1="160" x2={svgWidth} y2="160" stroke="#1e293b" strokeDasharray="4 4" />

              <path d={areaPathGross} fill="url(#grossGradient)" />
              <polyline fill="none" stroke="#6366f1" strokeWidth="3" points={pointsGross} strokeLinecap="round" />

              <path d={areaPathProfit} fill="url(#profitGradient)" />
              <polyline fill="none" stroke="#10b981" strokeWidth="3" points={pointsProfit} strokeLinecap="round" />
            </svg>

            <div className="flex justify-between text-[11px] text-slate-500 font-mono pt-2 border-t border-slate-800/40">
              {chartData.map((d) => (
                <span key={d.date}>{d.date}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Underperforming SKUs Alert Table */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Underperforming SKUs Warning</h2>
              <p className="text-xs text-slate-400">Live SKUs in your account with negative margins or missing COGS</p>
            </div>
          </div>
        </div>

        {underperformingSkus.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-3">
            <Package className="h-9 w-9 text-slate-700 mx-auto" />
            <p className="text-xs font-medium text-slate-300">No underperforming SKUs found for your account!</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              All active SKUs have healthy contribution margins. Add more products or upload COGS to track SKU profitability.
            </p>
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all mt-2"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Products & COGS</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">SKU Code & Product</th>
                  <th className="py-3 px-4">Orders</th>
                  <th className="py-3 px-4">Gross Revenue</th>
                  <th className="py-3 px-4">Base COGS</th>
                  <th className="py-3 px-4">Platform Fees</th>
                  <th className="py-3 px-4">Net Margin %</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-xs">
                {underperformingSkus.map((item) => (
                  <tr key={item.sku} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-200">
                      <span className="font-mono text-indigo-400 block">{item.sku}</span>
                      <span className="text-slate-400 text-[11px]">{item.title}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-mono">{item.orders}</td>
                    <td className="py-3.5 px-4 text-slate-200 font-mono">{formatCurrency(item.revenue, currency)}</td>
                    <td className="py-3.5 px-4 text-slate-300 font-mono">{formatCurrency(item.cogs, currency)}</td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono">{formatCurrency(item.fees, currency)}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-md text-[11px] ${
                          item.marginPercent < 0
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {item.marginPercent < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
                        {item.marginPercent.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href="/products"
                        className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-medium transition-all inline-block"
                      >
                        Update COGS
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
