import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/product/ProductCard';
import {
  Star,
  Heart,
  ShoppingBag,
  Zap,
  Truck,
  ShieldCheck,
  RefreshCw,
  Check,
  ChevronRight,
  Share2,
  Sparkles,
} from 'lucide-react';

export const ProductDetailPage: React.FC = () => {
  const {
    selectedProductId,
    getProductById,
    products,
    formatPrice,
    addToCart,
    toggleWishlist,
    isWishlisted,
    navigateTo,
    getProductReviews,
    addReview,
    addToast,
  } = useStore();

  const product = (selectedProductId ? getProductById(selectedProductId) : undefined) || products[0];

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product?.colors?.[0]?.name || '');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'specifications' | 'reviews'>('description');
  const [isAdded, setIsAdded] = useState(false);

  // Review Form state
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewTitle, setNewReviewTitle] = useState('');
  const [newReviewComment, setNewReviewComment] = useState('');

  useEffect(() => {
    if (product) {
      setActiveImageIndex(0);
      setSelectedColor(product.colors?.[0]?.name || '');
      setQuantity(1);
    }
  }, [product?.id]);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-4">
        <p className="text-sm font-semibold text-slate-500">Loading product details...</p>
      </div>
    );
  }

  const wishlisted = isWishlisted(product.id);
  const productReviews = getProductReviews(product.id);

  // Related products from same category
  const relatedProducts = products
    .filter((p) => p.categoryId === product.categoryId && p.id !== product.id)
    .slice(0, 4);

  const handleAddToCart = () => {
    addToCart(product, quantity, selectedColor || product.colors?.[0]?.name);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const handleBuyNow = () => {
    addToCart(product, quantity, selectedColor || product.colors?.[0]?.name);
    navigateTo('checkout');
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewTitle.trim() || !newReviewComment.trim()) {
      addToast('Review Incomplete', 'Please fill in both title and comment.', 'error');
      return;
    }
    addReview(product.id, newReviewRating, newReviewTitle, newReviewComment);
    setNewReviewTitle('');
    setNewReviewComment('');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: product.shortDescription,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      addToast('Link Copied', 'Product link copied to your clipboard!', 'info');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <button onClick={() => navigateTo('home')} className="hover:text-slate-900 transition-colors">
          Home
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <button
          onClick={() => navigateTo('shop', { categoryId: product.categoryId })}
          className="hover:text-slate-900 transition-colors capitalize"
        >
          {product.categoryId}
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-slate-800 font-semibold truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Main PDP Grid: Gallery (Left) & Purchase Module (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Gallery (Left - 6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-white border border-slate-200/80 shadow-xs flex items-center justify-center">
            <img
              src={product.images[activeImageIndex] || product.images[0]}
              alt={product.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-all duration-300"
            />
            {product.discountPercent > 0 && (
              <span className="absolute top-4 left-4 bg-violet-600 text-white text-xs font-bold px-2.5 py-1 rounded-xl shadow-md">
                -{product.discountPercent}% OFF
              </span>
            )}
            <button
              onClick={() => toggleWishlist(product.id)}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-white/90 hover:bg-white text-slate-600 hover:text-rose-500 shadow-md backdrop-blur-xs transition-colors"
              aria-label="Wishlist"
            >
              <Heart className={`w-5 h-5 ${wishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
          </div>

          {/* Thumbnail Bar */}
          {product.images.length > 1 && (
            <div className="flex gap-3 justify-center">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                    activeImageIndex === idx
                      ? 'border-violet-600 ring-2 ring-violet-500/20 shadow-md'
                      : 'border-slate-200 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Purchase Module (Right - 6 Cols) */}
        <div className="lg:col-span-6 space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-violet-600">
                {product.brand} · {product.categoryId}
              </span>
              <button
                onClick={handleShare}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition-colors p-1"
                title="Share product"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </button>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight leading-tight">
              {product.name}
            </h1>

            {/* Rating & Review Adjacency */}
            <div className="flex items-center gap-2 mt-2.5">
              <div className="flex items-center text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.floor(product.rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300'
                    }`}
                  />
                ))}
                <span className="text-xs font-bold text-slate-800 ml-1.5">{product.rating}</span>
              </div>
              <span className="text-slate-300">·</span>
              <button
                onClick={() => setActiveTab('reviews')}
                className="text-xs text-violet-600 hover:text-violet-800 font-semibold"
              >
                ({product.reviewCount} verified reviews)
              </button>
            </div>
          </div>

          {/* Pricing Row */}
          <div className="p-4 rounded-2xl bg-violet-50/50 border border-violet-100 flex items-baseline gap-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tabular-nums">
              {formatPrice(product.price)}
            </span>
            {product.originalPrice > product.price && (
              <span className="text-base text-slate-400 line-through tabular-nums">
                {formatPrice(product.originalPrice)}
              </span>
            )}
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-lg ml-auto">
              Save {formatPrice(product.originalPrice - product.price)} ({product.discountPercent}%)
            </span>
          </div>

          {/* Short Benefit Summary */}
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {product.shortDescription}
          </p>

          {/* Key Feature Badges (As in video 00:17) */}
          {product.features && product.features.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              {product.features.map((feat, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 font-medium"
                >
                  <Sparkles className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                  <span className="truncate">{feat}</span>
                </div>
              ))}
            </div>
          )}

          {/* Color Variation Selection */}
          {product.colors && product.colors.length > 0 && (
            <div className="pt-2">
              <label className="text-xs font-bold text-slate-900 block mb-2">
                Color Finish: <span className="font-medium text-slate-600">{selectedColor || product.colors[0].name}</span>
              </label>
              <div className="flex items-center gap-3">
                {product.colors.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setSelectedColor(c.name)}
                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      (selectedColor || product.colors[0].name) === c.name
                        ? 'border-violet-600 bg-violet-50 text-violet-900 ring-2 ring-violet-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-300"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Controls & In Stock Indicator */}
          <div className="pt-2 flex items-center gap-4">
            <div>
              <label className="text-xs font-bold text-slate-900 block mb-1">Quantity</label>
              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-200 text-sm font-bold transition-colors"
                >
                  -
                </button>
                <span className="px-4 text-xs font-bold tabular-nums text-slate-800">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-200 text-sm font-bold transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                In Stock ({product.stockQuantity} units available)
              </span>
            </div>
          </div>

          {/* Primary Action CTAs: Add to Cart & Buy Now */}
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleAddToCart}
              className={`py-3.5 px-6 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                isAdded
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                  : 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-500/25'
              }`}
            >
              {isAdded ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
              <span>{isAdded ? 'Added to Bag!' : 'Add to Cart'}</span>
            </button>

            <button
              onClick={handleBuyNow}
              className="py-3.5 px-6 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>Buy Now</span>
            </button>
          </div>

          {/* Guarantee Badges (As in video 00:18) */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 text-xs text-slate-700">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <strong className="block text-slate-900 font-bold">Express Delivery</strong>
                <span className="text-[11px] text-slate-500">Fast delivery in 2-4 days</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-xs text-slate-700">
              <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <strong className="block text-slate-900 font-bold">1-Year Warranty</strong>
                <span className="text-[11px] text-slate-500">Official brand protection</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Details Tabs (Description, Specifications, Customer Reviews) */}
      <div className="pt-10 border-t border-slate-200">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-px mb-8 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('description')}
            className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'description'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Product Description
          </button>

          <button
            onClick={() => setActiveTab('specifications')}
            className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'specifications'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Specifications
          </button>

          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'reviews'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Customer Reviews</span>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs">
              {productReviews.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Description */}
        {activeTab === 'description' && (
          <div className="space-y-6 max-w-3xl animate-in fade-in duration-200">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              Crafted for Everyday Excellence
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {product.description}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                  Precision Engineering
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Every component is rigorously stress-tested for thermal stability, drop impact resistance, and ergonomic endurance.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                  Seamless Eco-Packaging
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Shipped in 100% recyclable molded fiber cartons with zero single-use plastics.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Specifications */}
        {activeTab === 'specifications' && (
          <div className="max-w-3xl animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {Object.entries(product.specifications || {}).map(([key, val], idx) => (
                <div
                  key={key}
                  className={`grid grid-cols-3 p-3.5 text-xs ${
                    idx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'
                  }`}
                >
                  <span className="font-bold text-slate-700">{key}</span>
                  <span className="col-span-2 text-slate-600 font-medium">{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Reviews & Write Review */}
        {activeTab === 'reviews' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-200">
            {/* Review List (8 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Verified Reviews ({productReviews.length})
              </h3>

              {productReviews.length === 0 ? (
                <p className="text-xs text-slate-500 py-6">No reviews yet for this product. Be the first to share your thoughts!</p>
              ) : (
                <div className="space-y-4">
                  {productReviews.map((rev) => (
                    <div key={rev.id} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-amber-400">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] text-slate-400">{rev.date}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">{rev.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                      <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-700">{rev.userName}</span>
                        {rev.verifiedPurchase && (
                          <span className="text-emerald-600 font-semibold">· Verified Buyer</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Write a Review Form (5 cols) */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 h-fit">
              <h4 className="text-sm font-bold text-slate-900">Write a Customer Review</h4>
              <form onSubmit={handleReviewSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Overall Rating</label>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setNewReviewRating(star)}
                        className="p-1 text-amber-400 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= newReviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Headline</label>
                  <input
                    type="text"
                    required
                    value={newReviewTitle}
                    onChange={(e) => setNewReviewTitle(e.target.value)}
                    placeholder="e.g. Superb build quality and sound"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Your Feedback</label>
                  <textarea
                    required
                    rows={3}
                    value={newReviewComment}
                    onChange={(e) => setNewReviewComment(e.target.value)}
                    placeholder="Describe your experience with battery life, build, sound, or delivery..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Submit Review
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* You Might Also Like / Related Products (As in Video 00:19) */}
      {relatedProducts.length > 0 && (
        <div className="pt-12 border-t border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">You Might Also Like</h3>
            <button
              onClick={() => navigateTo('shop', { categoryId: product.categoryId })}
              className="text-xs font-semibold text-violet-600 hover:text-violet-800"
            >
              Explore Category &rarr;
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
