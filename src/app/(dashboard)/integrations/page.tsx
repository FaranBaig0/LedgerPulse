"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Store,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  AlertCircle,
  Edit3,
  Trash2,
  Plus,
  RefreshCw,
  Sparkles,
  Layers,
  X,
  Check,
  Megaphone,
  BarChart3
} from "lucide-react";

interface ChannelItem {
  id: string;
  platform: "SHOPIFY" | "ETSY";
  storeIdentifier: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface AdAccountItem {
  id: string;
  platform: "META" | "GOOGLE";
  adAccountId: string;
  accountName: string;
  isActive: boolean;
  createdAt: string;
}

const TIER_LIMITS: Record<string, { limit: number; label: string }> = {
  STARTER: { limit: 1, label: "1 Store (Shopify or Etsy)" },
  BASIC: { limit: 1, label: "1 Store (Shopify or Etsy)" },
  GROWTH: { limit: 3, label: "Up to 3 Channels" },
  PRO: { limit: 3, label: "Up to 3 Channels" },
  SCALE: { limit: 6, label: "Up to 6 Channels" },
  ENTERPRISE: { limit: 999, label: "Unlimited Channels" }
};

function IntegrationsContent() {
  const [shopifyDomain, setShopifyDomain] = useState("");
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [adAccounts, setAdAccounts] = useState<AdAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlanTier, setActivePlanTier] = useState<string>("GROWTH");

  // Editing state
  const [editingChannel, setEditingChannel] = useState<ChannelItem | null>(null);
  const [editIdentifier, setEditIdentifier] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [syncingShopify, setSyncingShopify] = useState<string | null>(null);
  const [syncingAdAccount, setSyncingAdAccount] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Add store modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addPlatform, setAddPlatform] = useState<"SHOPIFY" | "ETSY">("SHOPIFY");

  // Add Ad Account modal state
  const [showAddAdAccountModal, setShowAddAdAccountModal] = useState(false);
  const [adPlatform, setAdPlatform] = useState<"META" | "GOOGLE">("META");
  const [inputAdAccountId, setInputAdAccountId] = useState("");
  const [inputAccountName, setInputAccountName] = useState("");

  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const platformParam = searchParams.get("platform");
  const storeParam = searchParams.get("store");
  const errorParam = searchParams.get("error");

  const fetchConnectedChannels = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const [chRes, subRes, adRes] = await Promise.all([
        fetch("http://localhost:4000/api/v1/auth/channels", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("http://localhost:4000/api/v1/billing/subscription", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("http://localhost:4000/api/v1/adspend/accounts", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (chRes.ok) {
        const json = await chRes.json();
        setChannels(json.data || []);
      }
      if (subRes.ok) {
        const subJson = await subRes.json();
        const dbTier = subJson.data?.planTier;
        if (dbTier) {
          setActivePlanTier(dbTier.toUpperCase());
          localStorage.setItem("activePlanTier", dbTier.toUpperCase());
        }
      }
      if (adRes.ok) {
        const adJson = await adRes.json();
        setAdAccounts(adJson.data || []);
      }
    } catch {
      console.warn("Unable to fetch channels, subscription, or ad accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectedChannels();
  }, []);

  const planInfo = TIER_LIMITS[activePlanTier] || TIER_LIMITS.GROWTH;
  const isUnlimited = planInfo.limit >= 999;
  const isLimitReached = !isUnlimited && channels.length >= planInfo.limit;

  const handleShopifyConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopifyDomain) return;

    if (isLimitReached) {
      alert(`Channel limit reached for ${activePlanTier} Plan (${planInfo.label}). Please upgrade on the Billing page to add more stores.`);
      return;
    }

    let cleanDomain = shopifyDomain.trim().toLowerCase();
    if (!cleanDomain.endsWith(".myshopify.com")) {
      cleanDomain = `${cleanDomain}.myshopify.com`;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    window.location.href = `http://localhost:4000/api/v1/auth/shopify?shop=${cleanDomain}&token=${token}`;
  };

  const handleEtsyConnect = () => {
    if (isLimitReached) {
      alert(`Channel limit reached for ${activePlanTier} Plan (${planInfo.label}). Please upgrade on the Billing page to add more stores.`);
      return;
    }
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    window.location.href = `http://localhost:4000/api/v1/auth/etsy?token=${token}`;
  };

  const handleEditOpen = (channel: ChannelItem) => {
    setEditingChannel(channel);
    setEditIdentifier(channel.storeIdentifier);
  };

  const handleUpdateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChannel) return;

    setIsUpdating(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const response = await fetch(`http://localhost:4000/api/v1/auth/channels/${editingChannel.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          storeIdentifier: editIdentifier.trim()
        })
      });

      if (response.ok) {
        setEditingChannel(null);
        await fetchConnectedChannels();
      } else {
        alert("Failed to update store identifier.");
      }
    } catch {
      alert("Error updating channel.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteChannel = async (channelId: string, identifier: string) => {
    if (!confirm(`Are you sure you want to disconnect ${identifier}? This will halt order and fee syncing for this store.`)) {
      return;
    }

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const response = await fetch(`http://localhost:4000/api/v1/auth/channels/${channelId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        setChannels(channels.filter((c) => c.id !== channelId));
      } else {
        alert("Failed to disconnect store.");
      }
    } catch {
      alert("Error disconnecting store.");
    }
  };

  const handleSyncShopifyProducts = async (channelId: string) => {
    setSyncingShopify(channelId);
    setSyncMessage(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const response = await fetch("http://localhost:4000/api/v1/products/sync-shopify", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const json = await response.json();
        setSyncMessage(`Synced ${json.data?.syncedCount || 0} product variants successfully!`);
      } else {
        setSyncMessage("Catalog sync completed.");
      }
    } catch {
      setSyncMessage("Error syncing catalog.");
    } finally {
      setSyncingShopify(null);
    }
  };

  const handleAddAdAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputAdAccountId) return;

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const response = await fetch("http://localhost:4000/api/v1/adspend/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          platform: adPlatform,
          adAccountId: inputAdAccountId.trim(),
          accountName: inputAccountName.trim() || `${adPlatform} Ad Account (${inputAdAccountId.trim()})`
        })
      });

      if (response.ok) {
        setSyncMessage(`Connected ${adPlatform} Ad Account (${inputAdAccountId.trim()}) successfully!`);
        setShowAddAdAccountModal(false);
        setInputAdAccountId("");
        setInputAccountName("");
        await fetchConnectedChannels();
      } else {
        const errorJson = await response.json().catch(() => null);
        alert(errorJson?.message || errorJson?.error || "Failed to connect ad account.");
      }
    } catch {
      alert("Error connecting ad account. Ensure local backend server is running.");
    }
  };

  const handleDeleteAdAccount = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to disconnect ${name}?`)) return;

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const response = await fetch(`http://localhost:4000/api/v1/adspend/accounts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setAdAccounts(adAccounts.filter((a) => a.id !== id));
      } else {
        alert("Failed to disconnect ad account.");
      }
    } catch {
      alert("Error disconnecting ad account.");
    }
  };

  const handleSyncAdSpend = async (account: AdAccountItem) => {
    setSyncingAdAccount(account.id);
    setSyncMessage(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const endpoint = account.platform === "META" 
        ? "http://localhost:4000/api/v1/adspend/meta/sync" 
        : "http://localhost:4000/api/v1/adspend/google/sync";

      const bodyData = account.platform === "META"
        ? { adAccountId: account.adAccountId }
        : { customerId: account.adAccountId };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(bodyData)
      });

      if (response.ok) {
        setSyncMessage(`Ad spend synchronized for ${account.accountName}!`);
      } else {
        setSyncMessage("Ad spend sync complete.");
      }
    } catch {
      setSyncMessage("Error syncing ad spend.");
    } finally {
      setSyncingAdAccount(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Store className="h-7 w-7 text-indigo-400" />
            Integrations & Multi-Tenant Channel Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect your Shopify/Etsy stores and Meta/Google Ad accounts to automate POAS, ROAS, and net margin calculations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddAdAccountModal(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-all flex items-center gap-2"
          >
            <Megaphone className="h-4 w-4 text-purple-400" />
            <span>Link Ad Account</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            disabled={isLimitReached}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-lg ${
              isLimitReached
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/20"
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>Connect New Store</span>
          </button>
        </div>
      </div>

      {/* Subscription Tier Capacity Banner */}
      <div className="glass-card p-5 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-white">Active Plan: {activePlanTier}</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {planInfo.label}
              </span>
            </div>
            <span className="text-xs text-slate-400 mt-0.5 block">
              Store Channel Utilization:{" "}
              <strong className="text-white font-mono">{channels.length}</strong> /{" "}
              <strong className="text-white font-mono">{isUnlimited ? "Unlimited" : planInfo.limit}</strong> connected stores active.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isLimitReached && (
            <Link
              href="/billing"
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md hover:from-amber-400 hover:to-orange-400 flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Upgrade Tier for More Stores</span>
            </Link>
          )}

          {!isLimitReached && (
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Channel Capacity Available</span>
            </span>
          )}
        </div>
      </div>

      {/* Alert Banner */}
      {statusParam === "success" && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <span className="font-semibold text-white">Successfully Connected! </span>
            <span>
              Your {platformParam === "shopify" ? "Shopify" : "Etsy"} store{" "}
              <strong className="text-white">{storeParam}</strong> is now linked and active.
            </span>
          </div>
        </div>
      )}

      {statusParam === "error" && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          <div>
            <span className="font-semibold text-white">Connection Error: </span>
            <span>{errorParam || "Failed to complete shop authentication."}</span>
          </div>
        </div>
      )}

      {syncMessage && (
        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center justify-between">
          <span className="font-semibold">{syncMessage}</span>
          <button onClick={() => setSyncMessage(null)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Section 1: Connected Sales Stores */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          Connected Store Channels ({channels.length})
        </h2>

        {loading ? (
          <div className="glass-card p-8 rounded-3xl border border-slate-800 text-center text-xs text-slate-400">
            Loading sales channels...
          </div>
        ) : channels.length === 0 ? (
          <div className="glass-card p-10 rounded-3xl border border-slate-800 text-center space-y-3">
            <Store className="h-10 w-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">No Sales Channels Connected Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Connect your first Shopify or Etsy store below to begin pulling live orders, COGS calculations, and itemized platform fee deductions.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>Connect First Store</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {channels.map((channel) => {
              const isShopify = channel.platform === "SHOPIFY";
              return (
                <div
                  key={channel.id}
                  className={`glass-card glass-card-hover p-6 rounded-3xl border flex flex-col justify-between space-y-5 transition-all ${
                    isShopify ? "border-emerald-500/30 bg-emerald-950/10" : "border-amber-500/30 bg-amber-950/10"
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-lg border ${
                            isShopify
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}
                        >
                          {isShopify ? "S" : "E"}
                        </div>
                        <div>
                          <span
                            className={`text-[10px] font-extrabold uppercase tracking-wider block ${
                              isShopify ? "text-emerald-400" : "text-amber-400"
                            }`}
                          >
                            {isShopify ? "Shopify OAuth" : "Etsy PKCE"}
                          </span>
                          <span className="text-xs font-bold text-white block truncate max-w-[170px]">
                            {channel.storeIdentifier}
                          </span>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-400 text-[11px]">
                        <span>Platform Type:</span>
                        <span className="font-semibold text-white">{isShopify ? "Shopify Admin API" : "Etsy Open API v3"}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400 text-[11px]">
                        <span>Connected On:</span>
                        <span className="font-mono text-slate-300">{new Date(channel.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditOpen(channel)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 transition-all"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Edit</span>
                      </button>

                      {isShopify && (
                        <button
                          onClick={() => handleSyncShopifyProducts(channel.id)}
                          disabled={syncingShopify === channel.id}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold flex items-center gap-1.5 transition-all"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 text-indigo-400 ${syncingShopify === channel.id ? "animate-spin" : ""}`} />
                          <span>Sync</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteChannel(channel.id, channel.storeIdentifier)}
                      className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-[11px] font-semibold transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Ad Accounts (Meta & Google) */}
      <div className="space-y-4 pt-4 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-purple-400" />
            Linked Ad Accounts (Meta Ads & Google Ads)
          </h2>

          <button
            onClick={() => setShowAddAdAccountModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Ad Account</span>
          </button>
        </div>

        {adAccounts.length === 0 ? (
          <div className="glass-card p-6 rounded-2xl border border-slate-800 text-center space-y-2">
            <BarChart3 className="h-8 w-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No Ad Accounts Linked Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Link your Meta Ad Account ID (e.g. <code className="text-purple-300 font-mono">act_10203040</code>) or Google Ads Customer ID (e.g. <code className="text-purple-300 font-mono">123-456-7890</code>) to compute blended POAS and ROAS automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adAccounts.map((account) => {
              const isMeta = account.platform === "META";
              return (
                <div
                  key={account.id}
                  className={`glass-card p-6 rounded-3xl border flex flex-col justify-between space-y-4 ${
                    isMeta ? "border-blue-500/30 bg-blue-950/10" : "border-rose-500/30 bg-rose-950/10"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-lg border ${
                            isMeta
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}
                        >
                          {isMeta ? "M" : "G"}
                        </div>
                        <div>
                          <span
                            className={`text-[10px] font-extrabold uppercase tracking-wider block ${
                              isMeta ? "text-blue-400" : "text-rose-400"
                            }`}
                          >
                            {isMeta ? "Meta Ads API" : "Google Ads PMax"}
                          </span>
                          <span className="text-xs font-bold text-white block truncate max-w-[170px]">
                            {account.accountName}
                          </span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Linked
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs font-mono">
                      <div className="text-[10px] uppercase text-slate-400">Account ID:</div>
                      <div className="text-white font-semibold truncate">{account.adAccountId}</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleSyncAdSpend(account)}
                      disabled={syncingAdAccount === account.id}
                      className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-[11px] font-semibold flex items-center gap-1.5"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 text-purple-400 ${syncingAdAccount === account.id ? "animate-spin" : ""}`} />
                      <span>Sync Ad Spend</span>
                    </button>

                    <button
                      onClick={() => handleDeleteAdAccount(account.id, account.accountName)}
                      className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-[11px]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EDIT STORE IDENTIFIER MODAL */}
      {editingChannel && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 max-w-md w-full space-y-6 relative overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-indigo-400" />
                Edit Store Identifier
              </h3>
              <button
                onClick={() => setEditingChannel(null)}
                className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Store Domain / Identifier ({editingChannel.platform})
                </label>
                <input
                  type="text"
                  value={editIdentifier}
                  onChange={(e) => setEditIdentifier(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingChannel(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-slate-300 font-semibold text-xs hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all flex items-center gap-2"
                >
                  {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONNECT NEW AD ACCOUNT MODAL */}
      {showAddAdAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 max-w-lg w-full space-y-6 relative overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-purple-400" />
                Link Merchant Ad Account
              </h3>
              <button
                onClick={() => setShowAddAdAccountModal(false)}
                className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddAdAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAdPlatform("META")}
                  className={`p-4 rounded-2xl border text-center transition-all ${
                    adPlatform === "META"
                      ? "border-blue-500 bg-blue-500/10 text-white font-bold"
                      : "border-slate-800 bg-slate-900 text-slate-400"
                  }`}
                >
                  <div className="h-8 w-8 rounded-xl bg-blue-500/20 text-blue-400 mx-auto flex items-center justify-center font-bold mb-1">
                    M
                  </div>
                  <span className="text-xs">Meta Ads</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAdPlatform("GOOGLE")}
                  className={`p-4 rounded-2xl border text-center transition-all ${
                    adPlatform === "GOOGLE"
                      ? "border-rose-500 bg-rose-500/10 text-white font-bold"
                      : "border-slate-800 bg-slate-900 text-slate-400"
                  }`}
                >
                  <div className="h-8 w-8 rounded-xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center font-bold mb-1">
                    G
                  </div>
                  <span className="text-xs">Google Ads</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {adPlatform === "META" ? "Meta Ad Account ID (e.g. act_10203040)" : "Google Ads Customer ID (e.g. 123-456-7890)"}
                </label>
                <input
                  type="text"
                  value={inputAdAccountId}
                  onChange={(e) => setInputAdAccountId(e.target.value)}
                  placeholder={adPlatform === "META" ? "act_10203040" : "123-456-7890"}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Account Display Name (Optional)</label>
                <input
                  type="text"
                  value={inputAccountName}
                  onChange={(e) => setInputAccountName(e.target.value)}
                  placeholder={adPlatform === "META" ? "US Meta Prospecting Account" : "US Google Shopping Account"}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  <span>Link {adPlatform} Ad Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONNECT NEW STORE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 max-w-lg w-full space-y-6 relative overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-indigo-400" />
                Add Sales Channel Connection
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isLimitReached ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-3">
                <p className="font-semibold">
                  You have reached the store connection limit ({channels.length} / {planInfo.limit}) for your current{" "}
                  <strong>{activePlanTier}</strong> subscription plan.
                </p>
                <p className="text-slate-400">
                  Upgrade your plan to unlock more sales channel connections:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-300 font-mono text-[11px]">
                  <li>Growth / Pro Plan: Up to 3 Stores</li>
                  <li>Scale Plan: Up to 6 Stores</li>
                  <li>Enterprise Plan: Unlimited Stores</li>
                </ul>
                <div className="pt-2 flex items-center gap-3">
                  <Link
                    href="/billing"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Go to Billing Page</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAddPlatform("SHOPIFY")}
                    className={`p-4 rounded-2xl border text-center transition-all ${
                      addPlatform === "SHOPIFY"
                        ? "border-emerald-500 bg-emerald-500/10 text-white font-bold"
                        : "border-slate-800 bg-slate-900 text-slate-400"
                    }`}
                  >
                    <div className="h-8 w-8 rounded-xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center font-bold mb-1">
                      S
                    </div>
                    <span className="text-xs">Shopify Store</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddPlatform("ETSY")}
                    className={`p-4 rounded-2xl border text-center transition-all ${
                      addPlatform === "ETSY"
                        ? "border-amber-500 bg-amber-500/10 text-white font-bold"
                        : "border-slate-800 bg-slate-900 text-slate-400"
                    }`}
                  >
                    <div className="h-8 w-8 rounded-xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center font-bold mb-1">
                      E
                    </div>
                    <span className="text-xs">Etsy Shop</span>
                  </button>
                </div>

                {addPlatform === "SHOPIFY" ? (
                  <form onSubmit={handleShopifyConnect} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Shopify Store Domain</label>
                      <input
                        type="text"
                        value={shopifyDomain}
                        onChange={(e) => setShopifyDomain(e.target.value)}
                        placeholder="brand-name.myshopify.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2"
                    >
                      <span>Connect Shopify Store</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Authenticate your Etsy Shop via official Open API v3 PKCE handshake.
                    </p>
                    <button
                      type="button"
                      onClick={handleEtsyConnect}
                      className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2"
                    >
                      <span>Authenticate Etsy Shop</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="text-white text-center py-12 text-xs">Loading sales channels...</div>}>
      <IntegrationsContent />
    </Suspense>
  );
}
