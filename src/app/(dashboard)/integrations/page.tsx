"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Store, ShieldCheck, CheckCircle2, ExternalLink, ArrowRight, AlertCircle } from "lucide-react";

interface ChannelItem {
  id: string;
  platform: "SHOPIFY" | "ETSY";
  storeIdentifier: string;
  isActive: boolean;
  createdAt: string;
}

function IntegrationsContent() {
  const [shopifyDomain, setShopifyDomain] = useState("");
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(true);

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
      const response = await fetch("http://localhost:4000/api/v1/auth/channels", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const json = await response.json();
        setChannels(json.data || []);
      }
    } catch {
      console.warn("Unable to fetch channels");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectedChannels();
  }, []);

  const shopifyChannel = channels.find((c) => c.platform === "SHOPIFY");
  const etsyChannel = channels.find((c) => c.platform === "ETSY");

  const handleShopifyConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopifyDomain) return;

    let cleanDomain = shopifyDomain.trim().toLowerCase();
    if (!cleanDomain.endsWith(".myshopify.com")) {
      cleanDomain = `${cleanDomain}.myshopify.com`;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    window.location.href = `http://localhost:4000/api/v1/auth/shopify?shop=${cleanDomain}&token=${token}`;
  };

  const handleEtsyConnect = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    window.location.href = `http://localhost:4000/api/v1/auth/etsy?token=${token}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <Store className="h-6 w-6 text-indigo-400" />
          Sales Channel Integrations & OAuth
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Connect your Shopify and Etsy stores to enable real-time order webhook ingestion and automated fee deduction tracking.
        </p>
      </div>

      {/* Alert Banner for OAuth Redirect Results */}
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

      {/* Grid of Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Shopify Partner OAuth Card */}
        <div className="glass-card p-8 rounded-3xl border border-slate-800 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 text-xl">
                S
              </div>
              {shopifyChannel ? (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Active Connection
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Official OAuth 2.0
                </span>
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">Shopify Store Connection</h2>
              <p className="text-xs text-slate-400 mt-1">
                Sync orders, products, and transaction gateway processing fees automatically via Shopify Webhooks & Admin API.
              </p>
            </div>

            {shopifyChannel ? (
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-300">Connected Store Domain:</div>
                <div className="text-sm font-bold text-emerald-400">{shopifyChannel.storeIdentifier}</div>
                <div className="text-[11px] text-slate-500">Connected on {new Date(shopifyChannel.createdAt).toLocaleDateString()}</div>
              </div>
            ) : (
              <form onSubmit={handleShopifyConnect} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Shopify Store Domain</label>
                  <input
                    type="text"
                    value={shopifyDomain}
                    onChange={(e) => setShopifyDomain(e.target.value)}
                    placeholder="my-store-name.myshopify.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span>Connect Shopify Store</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Tokens encrypted with AES-256-GCM under row-level multi-tenancy.</span>
          </div>
        </div>

        {/* Etsy Open API v3 PKCE Card */}
        <div className="glass-card p-8 rounded-3xl border border-slate-800 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-400 text-xl">
                E
              </div>
              {etsyChannel ? (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Active Connection
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Open API v3 PKCE
                </span>
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">Etsy Shop Connection</h2>
              <p className="text-xs text-slate-400 mt-1">
                Calculate exact Etsy 6.5% transaction fees, $0.20 listing cuts, and 3%+$0.25 payment processing deductions via PKCE.
              </p>
            </div>

            {etsyChannel ? (
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-300">Connected Etsy Shop ID:</div>
                <div className="text-sm font-bold text-amber-400">{etsyChannel.storeIdentifier}</div>
                <div className="text-[11px] text-slate-500">Connected on {new Date(etsyChannel.createdAt).toLocaleDateString()}</div>
              </div>
            ) : (
              <div className="pt-4">
                <button
                  onClick={handleEtsyConnect}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span>Connect Etsy Shop via PKCE</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />
            <span>Automated S256 code verifier & challenge rotation enabled.</span>
          </div>
        </div>
      </div>
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

