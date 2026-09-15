"use client";

import React, { useState, useEffect } from "react";
import {
  Package,
  Upload,
  Plus,
  Edit2,
  AlertCircle,
  RefreshCw,
  FileText,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Store
} from "lucide-react";

interface Product {
  id: string;
  sku: string;
  title: string;
  sellingPriceCents: number;
  imageUrl?: string | null;
  channel: string;
  baseCostCents: number;
  packagingCents: number;
  createdAt: string;
  updatedAt: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncingShopify, setIsSyncingShopify] = useState(false);

  // Edit Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editBaseCost, setEditBaseCost] = useState("");
  const [editPackagingCost, setEditPackagingCost] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CSV Upload State
  const [csvContent, setCsvContent] = useState("");
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);

  // Single Product Create State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSku, setNewSku] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newBaseCost, setNewBaseCost] = useState("");
  const [newPackagingCost, setNewPackagingCost] = useState("");

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const response = await fetch("http://localhost:4000/api/v1/products", {
        headers: {
          Authorization: token ? `Bearer ${token}` : ""
        }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch products. Please ensure you are logged in.");
      }

      const json = await response.json();
      if (json.success) {
        setProducts(json.data);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSyncShopify = async () => {
    setIsSyncingShopify(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:4000/api/v1/products/sync-shopify", {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : ""
        }
      });

      const json = await response.json();
      if (response.ok && json.success) {
        alert(json.message || "Successfully synced products from Shopify!");
        fetchProducts();
      } else {
        alert(json.message || "Failed to sync Shopify products");
      }
    } catch (err) {
      alert("Error executing Shopify catalog sync");
    } finally {
      setIsSyncingShopify(false);
    }
  };

  const handleUpdateCogs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const baseCostCents = Math.round(parseFloat(editBaseCost || "0") * 100);
      const packagingCents = Math.round(parseFloat(editPackagingCost || "0") * 100);

      const response = await fetch(`http://localhost:4000/api/v1/products/${editingProduct.id}/cogs`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ baseCostCents, packagingCents })
      });

      if (response.ok) {
        setEditingProduct(null);
        fetchProducts();
      } else {
        const json = await response.json();
        alert(json.message || "Failed to update COGS");
      }
    } catch (err) {
      alert("Error updating COGS");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const baseCostCents = Math.round(parseFloat(newBaseCost || "0") * 100);
      const packagingCents = Math.round(parseFloat(newPackagingCost || "0") * 100);

      const response = await fetch("http://localhost:4000/api/v1/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          sku: newSku,
          title: newTitle,
          baseCostCents,
          packagingCents
        })
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewSku("");
        setNewTitle("");
        setNewBaseCost("");
        setNewPackagingCost("");
        fetchProducts();
      } else {
        const json = await response.json();
        alert(json.message || "Failed to create product");
      }
    } catch (err) {
      alert("Error creating product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setCsvMessage(null);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:4000/api/v1/products/bulk-csv", {
        method: "POST",
        headers: {
          "Content-Type": "text/csv",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: csvContent
      });

      const json = await response.json();
      if (response.ok && json.success) {
        setCsvMessage(`Success: Processed ${json.data.successCount} products!`);
        setTimeout(() => {
          setShowCsvModal(false);
          setCsvContent("");
          setCsvMessage(null);
          fetchProducts();
        }, 1200);
      } else {
        setCsvMessage(`Error: ${json.message || "Failed to upload CSV"}`);
      }
    } catch (err) {
      setCsvMessage("Error executing bulk CSV upload.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Summary Metrics
  const configuredCount = products.filter((p) => p.baseCostCents + p.packagingCents > 0).length;
  const missingCount = products.length - configuredCount;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Package className="h-6 w-6 text-indigo-400" />
            Products & COGS Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track variant acquisition costs, landed shipping overhead, and estimated unit margins across channels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncShopify}
            disabled={isSyncingShopify}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-semibold text-emerald-300 transition-all"
          >
            <ShoppingBag className={`h-4 w-4 ${isSyncingShopify ? "animate-spin" : ""}`} />
            <span>{isSyncingShopify ? "Syncing Shopify..." : "Sync Shopify Catalog"}</span>
          </button>

          <button
            onClick={() => setShowCsvModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition-all"
          >
            <Upload className="h-4 w-4 text-indigo-400" />
            <span>Bulk CSV Upload</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Metric Overview Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">Total Catalog Items</span>
            <div className="text-2xl font-black text-white mt-1">{products.length}</div>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Package className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">COGS Configured</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">{configuredCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">Missing COGS Flag</span>
            <div className="text-2xl font-black text-rose-400 mt-1">{missingCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Product List Table */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            Active Catalog Products & COGS ({products.length})
          </h2>
          <button onClick={fetchProducts} className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
            <span>Loading tenant product catalog...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs space-y-3">
            <Package className="h-10 w-10 text-slate-700 mx-auto" />
            <p>No products found for this tenant account.</p>
            <p className="text-[11px] text-slate-600">Click "Sync Shopify Catalog" or "Add Product" above to populate your COGS catalog.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Product & Channel</th>
                  <th className="py-3.5 px-4">Variant & SKU</th>
                  <th className="py-3.5 px-4">Selling Price</th>
                  <th className="py-3.5 px-4">Unit COGS</th>
                  <th className="py-3.5 px-4">Landed Overhead</th>
                  <th className="py-3.5 px-4">Est. Unit Margin</th>
                  <th className="py-3.5 px-4">COGS Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-xs">
                {products.map((product) => {
                  const sellingPriceDollars = product.sellingPriceCents ? product.sellingPriceCents / 100 : 0;
                  const baseDollars = product.baseCostCents / 100;
                  const packagingDollars = product.packagingCents / 100;
                  const totalCostDollars = baseDollars + packagingDollars;

                  // Formula: Unit Margin (%) = (Selling Price - (Unit COGS + Overhead)) / Selling Price * 100
                  const marginPercent = sellingPriceDollars > 0
                    ? ((sellingPriceDollars - totalCostDollars) / sellingPriceDollars) * 100
                    : 0;

                  const isConfigured = product.baseCostCents + product.packagingCents > 0;

                  return (
                    <tr key={product.id} className="hover:bg-slate-900/40 transition-colors">
                      {/* Product Title, Image & Channel Badge */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.title}
                              className="h-10 w-10 object-cover rounded-xl border border-slate-800 bg-slate-900 shrink-0"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-center shrink-0 text-slate-500">
                              <Package className="h-5 w-5" />
                            </div>
                          )}

                          <div className="space-y-1">
                            <span className="font-semibold text-slate-100 block line-clamp-1">{product.title}</span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Store className="h-3 w-3" />
                              {product.channel || "SHOPIFY"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Variant & SKU */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-indigo-400 font-semibold block">{product.sku}</span>
                        <span className="text-[11px] text-slate-500">Variant ID Level</span>
                      </td>

                      {/* Selling Price */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                        {product.sellingPriceCents > 0 ? `$${sellingPriceDollars.toFixed(2)}` : <span className="text-slate-500">—</span>}
                      </td>

                      {/* Cost of Goods Sold (COGS) */}
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        ${baseDollars.toFixed(2)}
                      </td>

                      {/* Landed Cost / Shipping Overhead */}
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        ${packagingDollars.toFixed(2)}
                      </td>

                      {/* Estimated Unit Margin / Markup */}
                      <td className="py-3.5 px-4">
                        {sellingPriceDollars > 0 && isConfigured ? (
                          <span
                            className={`inline-flex items-center gap-1 font-mono font-bold px-2.5 py-1 rounded-lg text-xs ${
                              marginPercent >= 25
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : marginPercent > 0
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {marginPercent < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                            {marginPercent.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">N/A</span>
                        )}
                      </td>

                      {/* COGS Status Indicator */}
                      <td className="py-3.5 px-4">
                        {isConfigured ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Configured
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20" title="No COGS entered. Orders containing this SKU cannot compute net margin.">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Missing Cost
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setEditBaseCost(baseDollars.toString());
                            setEditPackagingCost(packagingDollars.toString());
                          }}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition-all inline-flex items-center gap-1.5"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>Edit COGS</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit COGS Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl border border-slate-800 max-w-md w-full space-y-5">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-indigo-400" />
                Update SKU Cost of Goods Sold
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-1">SKU: {editingProduct.sku} — {editingProduct.title}</p>
            </div>

            <form onSubmit={handleUpdateCogs} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Base Unit Acquisition Cost ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editBaseCost}
                  onChange={(e) => setEditBaseCost(e.target.value)}
                  placeholder="15.00"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Landed Cost / Shipping Overhead ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editPackagingCost}
                  onChange={(e) => setEditPackagingCost(e.target.value)}
                  placeholder="2.00"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none font-mono"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>Unit COGS + Overhead:</span>
                  <span className="text-white font-bold">${((parseFloat(editBaseCost || "0") + parseFloat(editPackagingCost || "0")) || 0).toFixed(2)}</span>
                </div>
                {editingProduct.sellingPriceCents > 0 && (
                  <div className="flex justify-between text-emerald-400 pt-1 border-t border-slate-800/80">
                    <span>Estimated Margin %:</span>
                    <span className="font-bold">
                      {(((editingProduct.sellingPriceCents / 100 - (parseFloat(editBaseCost || "0") + parseFloat(editPackagingCost || "0"))) / (editingProduct.sellingPriceCents / 100)) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-500/20"
                >
                  {isSubmitting ? "Saving..." : "Save COGS"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk CSV Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl border border-slate-800 max-w-xl w-full space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                Bulk Product COGS CSV Upload
              </h3>
            </div>

            {csvMessage && (
              <div className={`p-3 rounded-xl text-xs font-medium ${csvMessage.startsWith("Success") ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                {csvMessage}
              </div>
            )}

            <form onSubmit={handleBulkCsvUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">CSV Content (Header: SKU, BaseCost, PackagingCost)</label>
                <textarea
                  rows={8}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  placeholder={`SKU,BaseCost,PackagingCost\nSHIRT-BLK,12.50,1.50\nHOODIE-GRY,25.00,2.00`}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCsvModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
                >
                  {isSubmitting ? "Uploading..." : "Upload & Parse CSV"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Product Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl border border-slate-800 max-w-md w-full space-y-5">
            <h3 className="text-lg font-bold text-white">Add New Product</h3>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">SKU Code</label>
                <input
                  type="text"
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  placeholder="SHIRT-BLK-L"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Product Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Black Heavyweight Tee"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Base Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newBaseCost}
                    onChange={(e) => setNewBaseCost(e.target.value)}
                    placeholder="12.50"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Packaging Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPackagingCost}
                    onChange={(e) => setNewPackagingCost(e.target.value)}
                    placeholder="1.50"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
                >
                  {isSubmitting ? "Creating..." : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
