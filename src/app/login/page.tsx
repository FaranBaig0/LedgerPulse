"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrendingUp, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:4000/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const json = await response.json();

      if (response.ok && json.success && json.data?.token) {
        localStorage.setItem("token", json.data.token);
        if (json.data.tenant?.baseCurrency) {
          localStorage.setItem("selectedCurrency", json.data.tenant.baseCurrency);
        }
        if (json.data.tenant?.planTier) {
          localStorage.setItem("activePlanTier", json.data.tenant.planTier.toUpperCase());
        } else {
          localStorage.removeItem("activePlanTier");
        }
        router.push("/analytics");
      } else {
        setError(json.message || "Invalid email or password");
      }
    } catch {
      setError("Unable to connect to server. Please verify backend is running on port 4000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow Background Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-72 h-72 rounded-full bg-purple-500/10 blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md space-y-8 z-10">
        {/* Brand Logo Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/30">
            <div className="h-full w-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-indigo-400" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight gradient-text">
            Welcome Back to LedgerPulse
          </h1>
          <p className="text-xs text-slate-400">
            Real-time multi-tenant contribution margins & COGS intelligence
          </p>
        </div>

        {/* Login Form Card */}
        <div className="glass-card p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="merchant@acme.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-semibold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 mt-2"
            >
              <span>{loading ? "Signing in..." : "Sign In to Dashboard"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800/60 text-center">
            <p className="text-xs text-slate-400">
              Don't have a merchant account?{" "}
              <Link href="/register" className="text-indigo-400 font-semibold hover:underline">
                Create Tenant Account
              </Link>
            </p>
          </div>
        </div>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-indigo-400" />
          <span>Row-Level Multi-Tenant Isolation & JWT Auth</span>
        </div>
      </div>
    </div>
  );
}
