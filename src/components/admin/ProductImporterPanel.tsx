import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  fetchCollectionProducts,
  calculateProductPricing,
  convertToStoreProduct,
  commitImportToBackend,
  startImportJobOnBackend,
  getImportJobStatus,
  MarkupRule,
} from '../../services/productImporter';
import { ImportPreviewProduct, ImportErrorItem, ImportStats } from '../../types';
import {
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Check,
  X,
  Layers,
  ArrowRight,
  TrendingUp,
  Percent,
  Sliders,
  Sparkles,
  DollarSign,
  Package,
  Eye,
  Edit3,
  ExternalLink,
  ChevronRight,
  Filter,
  Play,
} from 'lucide-react';

export const ProductImporterPanel: React.FC = () => {
  const { importProducts, categories, formatPrice, addToast } = useStore();

  // Source configuration
  const [sourceUrl, setSourceUrl] = useState('https://dropplier.in/collections/all');
  const [selectedTargetCategory, setSelectedTargetCategory] = useState<string>('auto');
  const [markupType, setMarkupType] = useState<'percent' | 'fixed'>('percent');
  const [markupValue, setMarkupValue] = useState<number>(30);
  const [scanAllPages, setScanAllPages] = useState<boolean>(true);

  // Scan / Preview State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewProducts, setPreviewProducts] = useState<ImportPreviewProduct[]>([]);
  const [currentPageScanned, setCurrentPageScanned] = useState<number>(1);
  const [totalPagesFound, setTotalPagesFound] = useState<number>(1);
  const [sourceOrigin, setSourceOrigin] = useState<string>('dropplier.in');

  // Import Execution & Progress State
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importStatusMessage, setImportStatusMessage] = useState<string>('Importing products...');
  const [currentImportedCount, setCurrentImportedCount] = useState<number>(0);
  const [totalImportTarget, setTotalImportTarget] = useState<number>(0);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [errorList, setErrorList] = useState<ImportErrorItem[]>([]);

  // Background Job Polling
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const jobPollInterval = useRef<any>(null);

  // Search & Filter in Preview
  const [previewFilter, setPreviewFilter] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // Quick edit single preview item
  const [editingPreviewId, setEditingPreviewId] = useState<string | null>(null);
  const [customPriceInput, setCustomPriceInput] = useState<number>(0);
  const [customTitleInput, setCustomTitleInput] = useState<string>('');

  // 1. Fetch & Preview Complete Collection from Source
  const handleFetchProducts = async () => {
    if (!sourceUrl.trim()) {
      addToast('URL Required', 'Please provide a collection URL.', 'error');
      return;
    }

    setIsLoading(true);
    setErrorList([]);
    setImportStats(null);
    setPreviewProducts([]);

    const rule: MarkupRule = { type: markupType, value: markupValue };

    try {
      setCurrentPageScanned(1);
      const result = await fetchCollectionProducts(sourceUrl, 1, rule, scanAllPages);
      setSourceOrigin(result.sourceOrigin);
      setTotalPagesFound(result.totalPagesScanned || 1);

      // If target category is explicitly set, override
      const processed = result.products.map((p: any) => {
        if (selectedTargetCategory !== 'auto') {
          const catObj = categories.find((c) => c.id === selectedTargetCategory);
          return {
            ...p,
            categoryId: selectedTargetCategory,
            category: catObj ? catObj.name : p.category,
          };
        }
        return p;
      });

      setPreviewProducts(processed);
      addToast(
        'Catalog Scan Complete',
        `Discovered ${processed.length} products across ${result.totalPagesScanned || 1} pages from ${result.sourceOrigin}.`,
        'success'
      );
    } catch (err: any) {
      addToast('Import Scan Failed', err.message || 'Could not fetch collection.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Direct 1-Click Complete Collection Import (2,000+ items)
  const handleStartFullCollectionJob = async () => {
    if (!sourceUrl.trim()) {
      addToast('URL Required', 'Please provide a collection URL.', 'error');
      return;
    }

    setIsImporting(true);
    setImportProgress(5);
    setImportStatusMessage('Scanning all pages from supplier collection...');
    setErrorList([]);
    setImportStats(null);

    const rule: MarkupRule = { type: markupType, value: markupValue };

    try {
      const scanResult = await fetchCollectionProducts(
        sourceUrl,
        1,
        rule,
        true,
        (stats) => {
          setImportStatusMessage(`Scanned page ${stats.page} • Found ${stats.foundInBatch} products in batch...`);
          setImportProgress(Math.min(50, stats.page * 10));
        }
      );

      const productsToCommit = scanResult.products.map((p: any) => {
        if (selectedTargetCategory !== 'auto') {
          const catObj = categories.find((c) => c.id === selectedTargetCategory);
          return {
            ...p,
            categoryId: selectedTargetCategory,
            category: catObj ? catObj.name : p.category,
          };
        }
        return p;
      });

      setImportStatusMessage(`Saving ${productsToCommit.length} products to database...`);
      setImportProgress(60);

      const commitResult = await commitImportToBackend(
        productsToCommit,
        rule,
        sourceUrl,
        (current, total) => {
          setCurrentImportedCount(current);
          setTotalImportTarget(total);
          setImportProgress(60 + Math.round((current / total) * 35));
          setImportStatusMessage(`Saving to database... ${current} / ${total} products saved`);
        }
      );

      const validStoreProducts = productsToCommit.map((p: any) => convertToStoreProduct(p));
      importProducts(validStoreProducts);

      setIsImporting(false);
      setImportProgress(100);
      setImportStats(commitResult.stats);
      setErrorList(commitResult.errors);
      addToast(
        'Complete Collection Imported',
        `Successfully imported ${commitResult.imported} products across ${scanResult.totalPagesScanned} pages.`,
        'success'
      );
    } catch (err: any) {
      setIsImporting(false);
      addToast('Import Failed', err.message || 'Failed to complete collection import.', 'error');
    }
  };

  useEffect(() => {
    return () => {
      if (jobPollInterval.current) clearInterval(jobPollInterval.current);
    };
  }, []);

  // Re-calculate prices for all preview items if markup rule changes
  const handleApplyMarkupToPreview = (type: 'percent' | 'fixed', val: number) => {
    setMarkupType(type);
    setMarkupValue(val);
    const rule: MarkupRule = { type, value: val };

    setPreviewProducts((prev) =>
      prev.map((p) => {
        const pricing = calculateProductPricing(p.costPrice, p.mrp, rule);
        return {
          ...p,
          sellingPrice: pricing.sellingPrice,
          profitAmount: pricing.profitAmount,
          profitPercentage: pricing.profitPercentage,
          mrp: pricing.mrp,
        };
      })
    );
  };

  // Selection handlers
  const handleToggleSelectAll = (select: boolean) => {
    setPreviewProducts((prev) => prev.map((p) => ({ ...p, selected: select })));
  };

  const handleToggleSingle = (id: string) => {
    setPreviewProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  };

  const selectedCount = previewProducts.filter((p) => p.selected).length;

  // Execute Import of Selected in Batches
  const handleExecuteImport = async (importAll = false) => {
    const toImport = previewProducts.filter((p) => (importAll ? true : p.selected));

    if (toImport.length === 0) {
      addToast('No Items Selected', 'Please select at least one product to import.', 'error');
      return;
    }

    setIsImporting(true);
    setImportProgress(10);
    setImportStatusMessage(`Importing ${toImport.length} products to database...`);
    setErrorList([]);
    setTotalImportTarget(toImport.length);

    const rule: MarkupRule = { type: markupType, value: markupValue };

    try {
      const backendRes = await commitImportToBackend(
        toImport,
        rule,
        sourceUrl,
        (current, total) => {
          setCurrentImportedCount(current);
          setImportProgress(Math.round((current / total) * 95));
          setImportStatusMessage(`Importing products... ${current} / ${total}`);
        }
      );

      // Sync into local store context
      const validStoreProducts = toImport.map((p) => convertToStoreProduct(p));
      importProducts(validStoreProducts);

      setImportProgress(100);
      setImportStats(backendRes.stats);
      setErrorList(backendRes.errors);
      addToast(
        'Import Succeeded',
        `Imported ${backendRes.imported} new items to store database.`,
        'success'
      );
    } catch (err: any) {
      const validStoreProducts = toImport.map((p) => convertToStoreProduct(p));
      const localResult = importProducts(validStoreProducts);
      setImportProgress(100);
      setImportStats({
        found: toImport.length,
        imported: localResult.imported,
        updated: localResult.updated,
        skipped: 0,
        duplicates: 0,
        errors: 0,
      });
    } finally {
      setIsImporting(false);
      setPreviewProducts((prev) =>
        prev.map((p) => (toImport.some((imp) => imp.id === p.id) ? { ...p, selected: false } : p))
      );
    }
  };

  // Filtered preview list
  const filteredPreview = previewProducts.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(previewFilter.toLowerCase()) ||
      p.sku.toLowerCase().includes(previewFilter.toLowerCase()) ||
      p.category.toLowerCase().includes(previewFilter.toLowerCase());
    const matchesCat =
      selectedCategoryFilter === 'all' || p.categoryId === selectedCategoryFilter;
    return matchesSearch && matchesCat;
  });

  // Start quick edit
  const handleStartEdit = (p: ImportPreviewProduct) => {
    setEditingPreviewId(p.id);
    setCustomTitleInput(p.name);
    setCustomPriceInput(p.sellingPrice);
  };

  const handleSaveQuickEdit = (id: string) => {
    setPreviewProducts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const profit = customPriceInput - p.costPrice;
        const profitPct = p.costPrice > 0 ? Math.round((profit / p.costPrice) * 100) : 0;
        return {
          ...p,
          name: customTitleInput.trim() || p.name,
          sellingPrice: customPriceInput,
          profitAmount: profit,
          profitPercentage: profitPct,
        };
      })
    );
    setEditingPreviewId(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Source Configuration Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-bold uppercase tracking-wider mb-2">
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Complete Collection Importer (2,000+ Items)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Product Import & Markup Engine
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
              Traverses all available pages in the supplier collection without limits. Automatically applies markup, strips third-party branding, and saves all items to the store database.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Full Pagination Active</span>
            </span>
          </div>
        </div>

        {/* Input Parameters Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          {/* Source Collection URL */}
          <div className="lg:col-span-5 space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Collection Source URL</span>
              <span className="text-[11px] font-normal text-slate-400">Shopify / Dropplier</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://dropplier.in/collections/under-499?page=2"
                className="w-full pl-3.5 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 font-mono text-slate-700 transition-all"
              />
              <button
                onClick={() => setSourceUrl('https://dropplier.in/collections/all')}
                className="absolute right-2.5 top-2.5 text-[10px] font-bold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
                title="Use Default Dropplier All Collection"
              >
                Reset Default
              </button>
            </div>
          </div>

          {/* Target Category Mapping */}
          <div className="lg:col-span-3 space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">Map to Store Category</label>
            <select
              value={selectedTargetCategory}
              onChange={(e) => setSelectedTargetCategory(e.target.value)}
              className="w-full px-3 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 font-medium text-slate-700 cursor-pointer"
            >
              <option value="auto">✨ Auto-Detect from Source Tags</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons: Preview & 1-Click Import */}
          <div className="lg:col-span-4 flex items-center gap-2">
            <button
              onClick={handleFetchProducts}
              disabled={isLoading || isImporting}
              className="flex-1 h-11 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Scanning Pages...</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  <span>Fetch & Preview</span>
                </>
              )}
            </button>

            <button
              onClick={handleStartFullCollectionJob}
              disabled={isLoading || isImporting}
              className="flex-1 h-11 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-violet-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              title="Import all 2,000+ items in background"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>Import Full Collection</span>
            </button>
          </div>
        </div>

        {/* Profit Markup & Pagination Controls */}
        <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800">Profit Markup Rule:</span>
            </div>

            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                onClick={() => handleApplyMarkupToPreview('percent', 30)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  markupType === 'percent' && markupValue === 30
                    ? 'bg-violet-600 text-white font-bold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                +30% Margin
              </button>
              <button
                onClick={() => handleApplyMarkupToPreview('percent', 50)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  markupType === 'percent' && markupValue === 50
                    ? 'bg-violet-600 text-white font-bold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                +50% Margin
              </button>
              <button
                onClick={() => handleApplyMarkupToPreview('fixed', 99)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  markupType === 'fixed' && markupValue === 99
                    ? 'bg-violet-600 text-white font-bold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                +₹99 Flat
              </button>
              <button
                onClick={() => handleApplyMarkupToPreview('fixed', 199)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  markupType === 'fixed' && markupValue === 199
                    ? 'bg-violet-600 text-white font-bold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                +₹199 Flat
              </button>
            </div>

            <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
              <span>Custom:</span>
              <input
                type="number"
                min={0}
                value={markupValue}
                onChange={(e) => handleApplyMarkupToPreview(markupType, Number(e.target.value))}
                className="w-16 px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-center font-bold text-violet-700"
              />
              <span>{markupType === 'percent' ? '%' : '₹'}</span>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={scanAllPages}
              onChange={(e) => setScanAllPages(e.target.checked)}
              className="rounded accent-violet-600 w-4 h-4 cursor-pointer"
            />
            <span>Auto-traverse all pages (?page=1, 2, 3... to end)</span>
          </label>
        </div>
      </div>

      {/* 2. Real-Time Import Progress Bar & Live Counter */}
      {isImporting && (
        <div className="bg-white rounded-3xl border border-violet-200 p-6 shadow-md space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-violet-900 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-violet-600" />
              <span>{importStatusMessage}</span>
            </span>
            <span className="text-violet-700 font-mono text-sm">{importProgress}%</span>
          </div>
          <div className="w-full bg-violet-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-violet-600 to-indigo-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${importProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* 3. Final Summary Breakdown */}
      {importStats && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 shadow-xs space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-emerald-900">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <div>
                <h4 className="text-sm font-bold">Complete Collection Import Summary</h4>
                <p className="text-xs text-emerald-700">
                  All products from the source collection have been validated, marked up, and committed to the store database.
                </p>
              </div>
            </div>
            <button
              onClick={() => setImportStats(null)}
              className="p-1.5 text-emerald-600 hover:text-emerald-900 rounded-lg hover:bg-emerald-100/60"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            <div className="bg-white p-3 rounded-xl border border-emerald-100 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Source Total</span>
              <strong className="text-base font-extrabold text-slate-800">{importStats.found}</strong>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100 text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-600 block">New Imported</span>
              <strong className="text-base font-extrabold text-emerald-700">+{importStats.imported}</strong>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100 text-center">
              <span className="text-[10px] uppercase font-bold text-blue-600 block">Updated Existing</span>
              <strong className="text-base font-extrabold text-blue-700">{importStats.updated}</strong>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Duplicates Prevented</span>
              <strong className="text-base font-extrabold text-slate-700">{importStats.duplicates}</strong>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100 text-center">
              <span className="text-[10px] uppercase font-bold text-rose-500 block">Failed / Errors</span>
              <strong className="text-base font-extrabold text-rose-600">{importStats.errors}</strong>
            </div>
          </div>
        </div>
      )}

      {/* 4. Preview Products Section */}
      {previewProducts.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
          {/* Top Bar with Selection Stats & Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>Discovered Products</span>
                <span className="px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 text-xs font-bold">
                  {previewProducts.length} items ({totalPagesFound} pages scanned)
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedCount} of {previewProducts.length} selected for import.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleToggleSelectAll(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Select All
              </button>
              <button
                onClick={() => handleToggleSelectAll(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Deselect All
              </button>
              <button
                onClick={() => handleExecuteImport(false)}
                disabled={isImporting || selectedCount === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Import Selected ({selectedCount})</span>
              </button>
              <button
                onClick={() => handleExecuteImport(true)}
                disabled={isImporting || previewProducts.length === 0}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>Import All ({previewProducts.length})</span>
              </button>
            </div>
          </div>

          {/* Filter / Search within Preview */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={previewFilter}
                onChange={(e) => setPreviewFilter(e.target.value)}
                placeholder="Search preview by title, SKU, or category..."
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-800"
              />
            </div>

            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full sm:w-44 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-700 cursor-pointer font-medium"
            >
              <option value="all">All Categories ({previewProducts.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Preview Table & Cards */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
            {filteredPreview.slice(0, 100).map((item) => {
              const isEditing = editingPreviewId === item.id;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    item.selected
                      ? 'border-violet-300 bg-violet-50/30 ring-1 ring-violet-400/20'
                      : 'border-slate-200 bg-white opacity-85'
                  }`}
                >
                  {/* Left: Checkbox + Image + Title */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={!!item.selected}
                      onChange={() => handleToggleSingle(item.id)}
                      className="rounded accent-violet-600 w-4 h-4 mt-1 sm:mt-0 cursor-pointer shrink-0"
                    />

                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 shrink-0">
                      <img
                        src={item.images[0]}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {item.images.length > 1 && (
                        <span className="absolute bottom-1 right-1 text-[9px] bg-slate-900/80 text-white font-bold px-1 rounded">
                          +{item.images.length - 1}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      {isEditing ? (
                        <input
                          type="text"
                          value={customTitleInput}
                          onChange={(e) => setCustomTitleInput(e.target.value)}
                          className="w-full text-xs font-bold text-slate-900 border border-violet-300 rounded px-2 py-1"
                        />
                      ) : (
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1">
                          {item.name}
                        </h4>
                      )}

                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
                        <span className="font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded">
                          {item.category}
                        </span>
                        <span>SKU: {item.sku}</span>
                        {item.variants.length > 1 && (
                          <span className="text-slate-400">({item.variants.length} variants)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Pricing & Profit Breakdown + Action */}
                  <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-4 shrink-0 border-t md:border-t-0 pt-2 md:pt-0">
                    {/* Cost / Source Price */}
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Cost Price</span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-600">
                        {formatPrice(item.costPrice)}
                      </span>
                    </div>

                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 hidden sm:block" />

                    {/* Store Selling Price */}
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-violet-600 block">Selling Price</span>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <span>₹</span>
                          <input
                            type="number"
                            value={customPriceInput}
                            onChange={(e) => setCustomPriceInput(Number(e.target.value))}
                            className="w-20 text-xs font-bold border border-violet-300 rounded px-1.5 py-0.5"
                          />
                        </div>
                      ) : (
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                          {formatPrice(item.sellingPrice)}
                        </span>
                      )}
                    </div>

                    {/* Profit Pill */}
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-emerald-600 block">Your Profit</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        <span>+{formatPrice(item.profitAmount)}</span>
                        <span className="text-[9px] text-emerald-600">({item.profitPercentage}%)</span>
                      </span>
                    </div>

                    {/* Quick Edit Button */}
                    <div className="shrink-0">
                      {isEditing ? (
                        <button
                          onClick={() => handleSaveQuickEdit(item.id)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                          title="Tweak price or title"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredPreview.length > 100 && (
              <div className="p-3 text-center text-xs font-semibold text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                Showing first 100 preview items of {filteredPreview.length} discovered products. All items will be imported upon clicking "Import All".
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
