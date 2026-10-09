import React, { useRef, useState } from 'react';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { DownloadCloud, RefreshCw, Percent, CheckCircle2, AlertCircle } from 'lucide-react';
import { db } from '../../services/firebase';
import { useStore } from '../../context/StoreContext';
import { calculateProductPricing } from '../../services/productImporter';

const BATCH_SIZE = 400;

const toPlainText = (html: string, max: number): string =>
  String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/dropplier(\.in)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const buildPricing = (cost: number, oldMrp: number, margin: number) => {
  const p = calculateProductPricing(cost, oldMrp, { type: 'percent', value: margin });
  const discountPercent = p.mrp > p.sellingPrice ? Math.round(((p.mrp - p.sellingPrice) / p.mrp) * 100) : 0;
  return {
    price: p.sellingPrice,
    originalPrice: p.mrp,
    profitAmount: p.profitAmount,
    profitPercentage: p.profitPercentage,
    discountPercent,
  };
};

export const ProductRestorePanel: React.FC = () => {
  const { addToast } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [margin, setMargin] = useState<number>(30);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const validMargin = Number.isFinite(margin) && margin >= 0 && margin <= 500;

  const finish = (text: string) => {
    setMessage(text);
    addToast('Done', text, 'success');
    setTimeout(() => window.location.reload(), 2000);
  };

  // A. Load products from a JSON file (array, or an object with a "products" array)
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !validMargin) return;

    setBusy(true);
    setError('');
    setProgress(0);
    setMessage('Reading file...');
    try {
      const raw = JSON.parse(await file.text());
      const list: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.products) ? raw.products : [];
      const items = list.filter((p) => p && p.name && Number(p.costPrice) > 0);
      if (items.length === 0) throw new Error('No valid products found in this file (need "name" and "costPrice").');

      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        for (const p of items.slice(i, i + BATCH_SIZE)) {
          const id = p.sourceProductId ? `prod-${p.sourceProductId}` : String(p.id);
          const pricing = buildPricing(Number(p.costPrice), Number(p.originalPrice) || 0, margin);
          const productDoc = {
            ...p,
            id,
            description: toPlainText(p.description, 800),
            shortDescription: toPlainText(p.shortDescription || p.name, 160),
            images: Array.isArray(p.images) ? p.images.slice(0, 1) : [],
            status: 'active',
            inStock: p.inStock !== false,
            ...pricing,
            updatedAt: new Date().toISOString(),
          };
          batch.set(doc(db, 'products', id), JSON.parse(JSON.stringify(productDoc)), { merge: true });
        }
        await batch.commit();
        const done = Math.min(i + BATCH_SIZE, items.length);
        setProgress(Math.round((done / items.length) * 100));
        setMessage(`Saved ${done} of ${items.length} products...`);
      }
      finish(`${items.length} products saved with ${margin}% margin. Reloading...`);
    } catch (err: any) {
      const text = err?.code === 'permission-denied'
        ? 'Permission denied. Sign in as the owner and publish the new Firestore rules.'
        : err?.message || 'Import failed.';
      setError(text);
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  // B. Re-price every product already in Firestore from its cost price
  const handleApplyMargin = async () => {
    if (!validMargin) return;
    if (!window.confirm(`Set the selling price of ALL products to cost + ${margin}% ?`)) return;

    setBusy(true);
    setError('');
    setProgress(0);
    setMessage('Loading products...');
    try {
      const snap = await getDocs(collection(db, 'products'));
      const docs = snap.docs.filter((d: any) => Number(d.data().costPrice) > 0);
      if (docs.length === 0) throw new Error('No products with a cost price found.');

      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        for (const d of docs.slice(i, i + BATCH_SIZE)) {
          const data: any = d.data();
          const pricing = buildPricing(Number(data.costPrice), Number(data.originalPrice) || 0, margin);
          batch.update(d.ref, { ...pricing, updatedAt: new Date().toISOString() });
        }
        await batch.commit();
        const done = Math.min(i + BATCH_SIZE, docs.length);
        setProgress(Math.round((done / docs.length) * 100));
        setMessage(`Updated ${done} of ${docs.length} products...`);
      }
      finish(`${docs.length} products re-priced at ${margin}% margin. Reloading...`);
    } catch (err: any) {
      setError(err?.code === 'permission-denied' ? 'Permission denied. Sign in as the owner.' : err?.message || 'Update failed.');
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-2">
          <DownloadCloud className="w-3.5 h-3.5" />
          <span>Restore &amp; Margin Tools</span>
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Load product file and set margin</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          Upload the product backup file (JSON). Every product is saved to the store with selling price = cost + margin.
          You can also re-price all existing products any time.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
            <Percent className="w-3.5 h-3.5" /> Margin on cost
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={500}
              value={Number.isFinite(margin) ? margin : ''}
              onChange={(e) => setMargin(parseFloat(e.target.value))}
              disabled={busy}
              className="w-28 px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <span className="text-sm font-semibold text-slate-600">%</span>
          </div>
        </div>

        <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />
        <button
          type="button"
          disabled={busy || !validMargin}
          onClick={() => fileRef.current?.click()}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <DownloadCloud className="w-4 h-4" />
          <span>Load products from file</span>
        </button>

        <button
          type="button"
          disabled={busy || !validMargin}
          onClick={handleApplyMargin}
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
          <span>Apply margin to all products</span>
        </button>
      </div>

      {(busy || message) && (
        <div className="space-y-2">
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> {message}
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </p>
      )}
    </div>
  );
};
