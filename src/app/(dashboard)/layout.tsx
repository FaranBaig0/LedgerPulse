"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Store,
  CreditCard,
  TrendingUp,
  ChevronDown,
  ShieldCheck,
  Zap,
  Globe,
  Check,
  LogOut,
  LogIn,
  UserPlus
} from "lucide-react";
import { SUPPORTED_CURRENCIES, SupportedCurrency } from "../../lib/currency";

const NAVIGATION_ITEMS = [
  { name: "Executive Analytics", href: "/analytics", icon: LayoutDashboard },
  { name: "Products & COGS", href: "/products", icon: Package },
  { name: "Integrations & OAuth", href: "/integrations", icon: Store },
  { name: "Billing & Plans", href: "/billing", icon: CreditCard }
];

interface UserContextData {
  email: string;
  tenant: {
    name: string;
    baseCurrency: string;
  };
}

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [storeOpen, setStoreOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>("USD");
  const [userInfo, setUserInfo] = useState<UserContextData | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check saved currency preference
    const savedCurrency = localStorage.getItem("selectedCurrency") as SupportedCurrency;
    if (savedCurrency && SUPPORTED_CURRENCIES[savedCurrency]) {
      setSelectedCurrency(savedCurrency);
    }

    const fetchMe = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setIsLoggedIn(false);
          return;
        }

        setIsLoggedIn(true);
        const response = await fetch("http://localhost:4000/api/v1/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (response.ok) {
          const json = await response.json();
          if (json.success && json.data) {
            setUserInfo(json.data);
            if (json.data.tenant?.baseCurrency && SUPPORTED_CURRENCIES[json.data.tenant.baseCurrency as SupportedCurrency]) {
              setSelectedCurrency(json.data.tenant.baseCurrency as SupportedCurrency);
            }
          }
        } else {
          setIsLoggedIn(false);
        }
      } catch {
        // Fallback default
      }
    };

    fetchMe();
  }, []);

  const handleSelectCurrency = (code: SupportedCurrency) => {
    setSelectedCurrency(code);
    localStorage.setItem("selectedCurrency", code);
    setStoreOpen(false);
    window.dispatchEvent(new Event("currencyChanged"));
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    setUserInfo(null);
    router.push("/login");
  };

  const tenantName = userInfo?.tenant?.name || "Acme Store";
  const userEmail = userInfo?.email || "merchant@acme.com";
  const currencyConfig = SUPPORTED_CURRENCIES[selectedCurrency] || SUPPORTED_CURRENCIES.USD;

  return (
    <div className="flex h-screen bg-[#090d16] text-slate-100 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-800/80 bg-slate-950/80 backdrop-blur-xl flex flex-col justify-between z-20">
        <div>
          {/* Logo Brand Header */}
          <div className="p-6 flex items-center gap-3 border-b border-slate-800/60">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/30 flex items-center justify-center">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight gradient-text">LedgerPulse</span>
              <span className="block text-[10px] text-slate-500 font-mono uppercase tracking-widest">Real-Time COGS</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {NAVIGATION_ITEMS.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/analytics" && pathname?.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-lg shadow-indigo-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Live Ingestion Health Badge */}
        <div className="p-4 m-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Zap className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              Ingestion Queue
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
              Online
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            BullMQ Redis worker syncing Shopify & Etsy webhooks in real-time.
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Navbar */}
        <header className="h-16 border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-xl px-8 flex items-center justify-between z-10">
          {/* Active Tenant / Store & Multi-Currency Selector */}
          <div className="relative">
            <button
              onClick={() => setStoreOpen(!storeOpen)}
              className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-200 transition-colors"
            >
              <span className="h-2 w-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500"></span>
              <span>{tenantName}</span>
              <span className="text-indigo-400 font-mono font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {currencyConfig.code} ({currencyConfig.symbol.trim()})
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-1" />
            </button>

            {/* Currency Selector Dropdown */}
            {storeOpen && (
              <div className="absolute top-10 left-0 w-64 glass-card rounded-xl p-2 border border-slate-800 shadow-2xl z-50 space-y-1">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="h-3 w-3 text-indigo-400" />
                  Select Display Currency
                </div>

                {(Object.keys(SUPPORTED_CURRENCIES) as SupportedCurrency[]).map((code) => {
                  const curr = SUPPORTED_CURRENCIES[code];
                  const isSelected = selectedCurrency === code;

                  return (
                    <button
                      key={code}
                      onClick={() => handleSelectCurrency(code)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                        isSelected
                          ? "bg-indigo-600/20 text-indigo-300 font-bold border border-indigo-500/30"
                          : "text-slate-300 hover:bg-slate-900/80 hover:text-white"
                      }`}
                    >
                      <span>{curr.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* User Profile & Auth Options */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/60 border border-slate-800/60 text-xs text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
              Multi-Tenant Isolated
            </div>

            {isLoggedIn ? (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-md shadow-indigo-500/20">
                  {userEmail.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-xs">
                  <span className="block font-medium text-slate-200">Merchant Admin</span>
                  <span className="block text-slate-500 text-[10px]">{userEmail}</span>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-rose-500/40 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-all ml-1"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/register"
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Register Tenant</span>
                </Link>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Page Content Container */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#090d16]">
          {children}
        </main>
      </div>
    </div>
  );
}
