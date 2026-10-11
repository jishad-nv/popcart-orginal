import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { PopcartyLogo } from '../components/common/PopcartyLogo';
import { ProductImporterPanel } from '../components/admin/ProductImporterPanel';
import { ProductRestorePanel } from '../components/admin/ProductRestorePanel';
import { Product, Order, OrderStatus, PaymentStatusType, ProductVariant } from '../types';
import {
  ShieldCheck,
  Package,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  Plus,
  Trash2,
  Edit,
  Search,
  Check,
  X,
  RefreshCw,
  Tag,
  Settings,
  ArrowLeft,
  DownloadCloud,
  CheckSquare,
  FileSpreadsheet,
  Sparkles,
  ExternalLink,
  LogOut,
  Copy,
  MapPin,
  Phone,
  Mail,
  Truck,
  ArrowUp,
  ArrowDown,
  Layout,
  Eye,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    restockProduct,
    bulkDeleteProducts,
    bulkUpdateCategory,
    bulkUpdateStatus,
    bulkUpdateMarkup,
    bulkUpdateFlags,
    resetToDefaultCatalog,
    categories,
    orders,
    updateOrderStatus,
    updateOrderMetadata,
    coupons,
    addCoupon,
    deleteCoupon,
    settings,
    updateSettings,
    formatPrice,
    navigateTo,
    currentUser,
    logout,
    isLoggingOut,
    setAuthModalOpen,
    addToast,
  } = useStore();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'import' | 'products' | 'orders' | 'homepage' | 'coupons' | 'settings'
  >('overview');

  // Product Manager Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [productForm, setProductForm] = useState({
    name: '',
    brand: '',
    categoryId: 'kitchen',
    subcategory: '',
    costPrice: 199,
    price: 349,
    originalPrice: 699,
    stockQuantity: 50,
    sku: '',
    supplierSku: '',
    status: 'active' as 'active' | 'draft' | 'archived',
    shortDescription: '',
    description: '',
    images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'],
    badge: 'Trending',
    isTrending: true,
    isFeatured: true,
    isNewArrival: false,
    specifications: {} as Record<string, string>,
    variants: [] as ProductVariant[],
  });

  const [newImageUrl, setNewImageUrl] = useState('');
  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecValue, setNewSpecValue] = useState('');

  // Bulk Product Management State
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkCategoryTarget, setBulkCategoryTarget] = useState<string>(categories[0]?.id || 'kitchen');

  // Search & Filters in Products Management
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'archived'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'imported' | 'native'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'price_high' | 'price_low' | 'profit_high' | 'stock_low'>('newest');
  const [visibleProductsCount, setVisibleProductsCount] = useState<number>(50);

  // Coupon Manager Modal State
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponType, setNewCouponType] = useState<'percentage' | 'fixed'>('percentage');
  const [newCouponVal, setNewCouponVal] = useState(20);
  const [newCouponMin, setNewCouponMin] = useState(1500);

  // Order Search, Filters & Detail Modal State
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<string>('all');
  const [orderDateFilter, setOrderDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);
  const [modalTrackingNumber, setModalTrackingNumber] = useState('');
  const [modalCourierName, setModalCourierName] = useState('');
  const [modalAdminNotes, setModalAdminNotes] = useState('');
  const [modalPaymentStatus, setModalPaymentStatus] = useState<PaymentStatusType>('paid');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Homepage Customization Tab State
  const [hpSearchQuery, setHpSearchQuery] = useState('');
  const [hpSectionTab, setHpSectionTab] = useState<'trending' | 'popular' | 'newArrivals'>('trending');

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
    addToast('Copied to Clipboard', `${label} copied.`, 'info');
  };

  // Format complete copyable order summary block for supplier/courier dispatch
  const buildFullOrderSummaryText = (o: Order): string => {
    const addr = o.shippingAddress || ({} as any);
    const lines = [
      `=== POPCARTY ORDER #${o.orderNumber} ===`,
      `Date: ${new Date(o.createdAt).toLocaleString('en-IN')}`,
      `Order Status: ${o.orderStatus.toUpperCase()}`,
      `Payment: ${o.paymentMethod.toUpperCase()} (${o.paymentStatus.toUpperCase()})`,
      ``,
      `--- CUSTOMER & DELIVERY ADDRESS ---`,
      `Name: ${addr.fullName || addr.name || o.customerName}`,
      `Phone: ${addr.phone || o.customerPhone}${addr.alternatePhone ? ` / Alt: ${addr.alternatePhone}` : ''}`,
      `Email: ${addr.email || o.customerEmail || 'N/A'}`,
      `House/Flat: ${addr.houseNo || 'N/A'}`,
      `Street: ${addr.street || 'N/A'}`,
      `Area/Locality: ${addr.area || 'N/A'}`,
      `Landmark: ${addr.landmark || 'N/A'}`,
      `City: ${addr.city || 'N/A'}`,
      `District: ${addr.district || addr.city || 'N/A'}`,
      `State: ${addr.state || 'N/A'}`,
      `PIN Code: ${addr.pincode || addr.zipCode || 'N/A'}`,
      `Country: ${addr.country || 'India'}`,
    ];

    if (addr.latitude !== undefined && addr.longitude !== undefined) {
      lines.push(`GPS Coordinates: ${addr.latitude}, ${addr.longitude}`);
      lines.push(`Google Maps: https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`);
    }
    if (addr.deliveryInstructions) {
      lines.push(`Instructions: ${addr.deliveryInstructions}`);
    }

    lines.push(``, `--- ORDERED ITEMS (${o.items.length}) ---`);
    o.items.forEach((it, idx) => {
      lines.push(
        `${idx + 1}. ${it.productName}`,
        `   Product ID: ${it.productId} | Supplier SKU: ${it.supplierSku || it.sku || 'N/A'}`,
        `   Variant: ${it.color || it.variantTitle || 'Default'}${it.size ? ` / Size: ${it.size}` : ''}`,
        `   Qty: ${it.quantity} x ₹${it.price} = ₹${it.price * it.quantity} (Supplier Cost: ₹${it.costPrice || 'N/A'})`
      );
    });

    lines.push(
      ``,
      `--- BILLING ---`,
      `Subtotal: ₹${o.subtotal}`,
      `Shipping: ₹${o.shippingCost}`,
      `Discount: -₹${o.discountAmount}`,
      `Tax: ₹${o.tax}`,
      `Final Payable Amount: ₹${o.totalAmount}`
    );

    if (o.trackingNumber || o.courierName) {
      lines.push(``, `Courier: ${o.courierName || 'N/A'} | Tracking #: ${o.trackingNumber || 'N/A'}`);
    }

    return lines.join('\n');
  };

  const buildShippingLabelText = (o: Order): string => {
    const addr = o.shippingAddress || ({} as any);
    return [
      `${addr.fullName || addr.name || o.customerName}`,
      `Phone: ${addr.phone || o.customerPhone}${addr.alternatePhone ? `, ${addr.alternatePhone}` : ''}`,
      [addr.houseNo, addr.street, addr.area].filter(Boolean).join(', '),
      addr.landmark ? `Landmark: ${addr.landmark}` : '',
      `${[addr.city, addr.district, addr.state].filter(Boolean).join(', ')} - ${addr.pincode || addr.zipCode}`,
      addr.country || 'India',
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleOpenOrderModal = (ord: Order) => {
    setSelectedOrderForModal(ord);
    setModalTrackingNumber(ord.trackingNumber || '');
    setModalCourierName(ord.courierName || '');
    setModalAdminNotes(ord.adminNotes || '');
    setModalPaymentStatus(ord.paymentStatus || 'paid');
  };

  const handleSaveOrderDetailsModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForModal) return;
    await updateOrderMetadata(selectedOrderForModal.orderNumber, {
      paymentStatus: modalPaymentStatus,
      trackingNumber: modalTrackingNumber.trim(),
      courierName: modalCourierName.trim(),
      adminNotes: modalAdminNotes.trim(),
    });
    setSelectedOrderForModal((prev) =>
      prev
        ? {
            ...prev,
            paymentStatus: modalPaymentStatus,
            trackingNumber: modalTrackingNumber.trim(),
            courierName: modalCourierName.trim(),
            adminNotes: modalAdminNotes.trim(),
          }
        : null
    );
  };

  const handleExportOrdersCSV = () => {
    const headers =
      'OrderNumber,Date,CustomerName,Phone,AlternatePhone,Email,HouseNo,Street,Area,Landmark,City,District,State,PinCode,GPS,ItemsSummary,SupplierSKUs,Subtotal,Shipping,Discount,Tax,TotalAmount,PaymentMethod,PaymentStatus,OrderStatus,Courier,TrackingNumber\n';

    const rows = filteredOrders
      .map((o) => {
        const addr = o.shippingAddress || ({} as any);
        const itemsStr = o.items
          .map((i) => `${i.quantity}x ${i.productName} (${i.color || 'Default'})`)
          .join(' | ')
          .replace(/"/g, '""');
        const skusStr = o.items
          .map((i) => `${i.supplierSku || i.sku || i.productId}`)
          .join(' | ')
          .replace(/"/g, '""');
        const gpsStr =
          addr.latitude !== undefined && addr.longitude !== undefined
            ? `${addr.latitude},${addr.longitude}`
            : '';

        return [
          `"${o.orderNumber}"`,
          `"${new Date(o.createdAt).toISOString()}"`,
          `"${(addr.fullName || addr.name || o.customerName || '').replace(/"/g, '""')}"`,
          `"${addr.phone || o.customerPhone || ''}"`,
          `"${addr.alternatePhone || ''}"`,
          `"${addr.email || o.customerEmail || ''}"`,
          `"${(addr.houseNo || '').replace(/"/g, '""')}"`,
          `"${(addr.street || '').replace(/"/g, '""')}"`,
          `"${(addr.area || '').replace(/"/g, '""')}"`,
          `"${(addr.landmark || '').replace(/"/g, '""')}"`,
          `"${(addr.city || '').replace(/"/g, '""')}"`,
          `"${(addr.district || '').replace(/"/g, '""')}"`,
          `"${(addr.state || '').replace(/"/g, '""')}"`,
          `"${addr.pincode || addr.zipCode || ''}"`,
          `"${gpsStr}"`,
          `"${itemsStr}"`,
          `"${skusStr}"`,
          o.subtotal,
          o.shippingCost,
          o.discountAmount,
          o.tax,
          o.totalAmount,
          `"${o.paymentMethod}"`,
          `"${o.paymentStatus}"`,
          `"${o.orderStatus}"`,
          `"${(o.courierName || '').replace(/"/g, '""')}"`,
          `"${(o.trackingNumber || '').replace(/"/g, '""')}"`,
        ].join(',');
      })
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `popcarty_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Orders Exported', `Exported ${filteredOrders.length} orders to CSV.`, 'success');
  };

  // Overview Metrics Calculations
  const totalRevenue = useMemo(() => {
    return orders.reduce((sum, o) => sum + (o.orderStatus !== 'cancelled' ? o.totalAmount : 0), 0);
  }, [orders]);

  const totalUnitsSold = useMemo(() => {
    return orders.reduce((sum, o) => sum + o.items.reduce((acc, i) => acc + i.quantity, 0), 0);
  }, [orders]);

  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stockQuantity < 20);
  }, [products]);

  const totalProfitEstimate = useMemo(() => {
    return products.reduce((sum, p) => {
      const cost = p.costPrice || p.price * 0.7;
      const profit = Math.max(0, p.price - cost);
      return sum + profit * (p.stockQuantity || 1);
    }, 0);
  }, [products]);

  // Open Product Modal for Create
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      brand: 'Popcarty Verified',
      categoryId: categories[0]?.id || 'kitchen',
      subcategory: 'Essentials',
      costPrice: 199,
      price: 299,
      originalPrice: 599,
      stockQuantity: 40,
      sku: `POP-SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      supplierSku: '',
      status: 'active',
      shortDescription: 'Premium high-durability design with verified quality.',
      description: 'Engineered for seamless everyday performance with durable materials and strict quality inspection.',
      images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'],
      badge: 'Trending',
      isTrending: true,
      isFeatured: true,
      isNewArrival: true,
      specifications: {
        Quality: 'Popcarty Verified',
      },
      variants: [],
    });
    setNewImageUrl('');
    setIsProductModalOpen(true);
  };

  // Open Product Modal for Edit
  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name,
      brand: prod.brand || 'Popcarty Verified',
      categoryId: prod.categoryId,
      subcategory: prod.subcategory || '',
      costPrice: prod.costPrice || Math.round(prod.price * 0.7),
      price: prod.price,
      originalPrice: prod.originalPrice || Math.round(prod.price * 1.5),
      stockQuantity: prod.stockQuantity,
      sku: prod.sku || `POP-SKU-${prod.id.replace('prod-', '')}`,
      supplierSku: prod.supplierSku || '',
      status: prod.status || 'active',
      shortDescription: prod.shortDescription || prod.name,
      description: prod.description,
      images:
        prod.images && prod.images.length > 0
          ? [...prod.images]
          : ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'],
      badge: prod.badge || '',
      isTrending: !!prod.isTrending,
      isFeatured: !!prod.isFeatured,
      isNewArrival: !!prod.isNewArrival,
      specifications: prod.specifications ? { ...prod.specifications } : {},
      variants: prod.variants ? [...prod.variants] : [],
    });
    setNewImageUrl('');
    setIsProductModalOpen(true);
  };

  // Quick Margin Preset Application in Form
  const handleApplyMarginPreset = (percentage: number) => {
    const cost = Number(productForm.costPrice) || 100;
    const rawSelling = Math.round(cost * (1 + percentage / 100));
    const newSelling = Math.max(9, Math.round(rawSelling / 10) * 10 - 1);
    setProductForm({
      ...productForm,
      price: newSelling,
      originalPrice: Math.max(newSelling, productForm.originalPrice),
    });
  };

  // Save Product (Create or Update)
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) return;

    const costPrice = Math.max(1, Number(productForm.costPrice) || 100);
    const sellingPrice = Math.max(1, Number(productForm.price) || 150);
    const mrp = Math.max(sellingPrice, Number(productForm.originalPrice) || sellingPrice * 1.5);
    const profitAmount = sellingPrice - costPrice;
    const profitPercentage = Math.round((profitAmount / costPrice) * 100);
    const discountPercent = mrp > sellingPrice ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;

    const payload = {
      ...productForm,
      costPrice,
      price: sellingPrice,
      originalPrice: mrp,
      profitAmount,
      profitPercentage,
      discountPercent,
      inStock: productForm.status === 'active' && productForm.stockQuantity > 0,
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, {
        ...payload,
        updatedAt: new Date().toISOString(),
      });
    } else {
      addProduct({
        ...payload,
        rating: 4.8,
        reviewCount: 1,
        features: [
          'Supplier Verified Build & Quality',
          'Fast Protective Packaging',
          'Easy 7-Day Replacement Guarantee',
        ],
        colors: [],
        createdAt: new Date().toISOString(),
      });
    }

    setIsProductModalOpen(false);
  };

  // Image Management Helpers in Modal
  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    setProductForm({
      ...productForm,
      images: [...productForm.images, newImageUrl.trim()],
    });
    setNewImageUrl('');
  };

  const handleDeleteImage = (index: number) => {
    if (productForm.images.length <= 1) {
      addToast('Image Required', 'Product must have at least one image.', 'error');
      return;
    }
    setProductForm({
      ...productForm,
      images: productForm.images.filter((_, i) => i !== index),
    });
  };

  const handleSetPrimaryImage = (index: number) => {
    const target = productForm.images[index];
    const rest = productForm.images.filter((_, i) => i !== index);
    setProductForm({
      ...productForm,
      images: [target, ...rest],
    });
  };

  // Spec helper in Modal
  const handleAddSpec = () => {
    if (!newSpecKey.trim() || !newSpecValue.trim()) return;
    setProductForm({
      ...productForm,
      specifications: {
        ...productForm.specifications,
        [newSpecKey.trim()]: newSpecValue.trim(),
      },
    });
    setNewSpecKey('');
    setNewSpecValue('');
  };

  const handleDeleteSpec = (key: string) => {
    const updated = { ...productForm.specifications };
    delete updated[key];
    setProductForm({
      ...productForm,
      specifications: updated,
    });
  };

  // Bulk Actions Handlers
  const handleToggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map((p) => p.id));
    }
  };

  const handleToggleProductSelect = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (selectedProductIds.length === 0) return;
    bulkDeleteProducts(selectedProductIds);
    setSelectedProductIds([]);
  };

  const handleBulkCategory = () => {
    if (selectedProductIds.length === 0) return;
    bulkUpdateCategory(selectedProductIds, bulkCategoryTarget);
  };

  const handleBulkStatus = (status: 'active' | 'draft' | 'archived') => {
    if (selectedProductIds.length === 0) return;
    bulkUpdateStatus(selectedProductIds, status);
  };

  const handleBulkMarkup = (markupPercent: number) => {
    if (selectedProductIds.length === 0) return;
    bulkUpdateMarkup(selectedProductIds, 'percent', markupPercent);
  };

  const handleExportCSV = () => {
    const targets = products.filter((p) =>
      selectedProductIds.length > 0 ? selectedProductIds.includes(p.id) : true
    );
    const headers = 'ID,Name,Brand,Category,SKU,SupplierSKU,CostPrice,SellingPrice,MRP,Profit,Stock,Status\n';
    const rows = targets
      .map(
        (p) =>
          `"${p.id}","${p.name.replace(/"/g, '""')}","${p.brand}","${p.categoryId}","${p.sku || ''}","${p.supplierSku || ''}",${p.costPrice || 0},${p.price},${p.originalPrice},${p.profitAmount || p.price - (p.costPrice || 0)},${p.stockQuantity},"${p.status || 'active'}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `popcarty_products_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Catalog Exported', `Exported ${targets.length} products to CSV.`, 'success');
  };

  // Coupons Handler
  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;
    addCoupon({
      code: newCouponCode.trim().toUpperCase(),
      discountType: newCouponType,
      discountValue: Number(newCouponVal),
      minSpend: Number(newCouponMin),
      description: `${newCouponVal}${newCouponType === 'percentage' ? '%' : ' off'} on orders above ${formatPrice(newCouponMin)}`,
      expiryDate: '2026-12-31',
      isActive: true,
    });
    setIsCouponModalOpen(false);
    setNewCouponCode('');
  };

  // Homepage Section List Helpers
  const hpConfig = settings.homepageConfig || {};

  const getSectionProductIds = (section: 'trending' | 'popular' | 'newArrivals'): string[] => {
    if (section === 'trending') {
      if (Array.isArray(hpConfig.trendingProductIds) && hpConfig.trendingProductIds.length > 0) {
        return hpConfig.trendingProductIds;
      }
      return products.filter((p) => p.isTrending).slice(0, 12).map((p) => p.id);
    }
    if (section === 'popular') {
      if (Array.isArray(hpConfig.popularProductIds) && hpConfig.popularProductIds.length > 0) {
        return hpConfig.popularProductIds;
      }
      return products.filter((p) => p.isFeatured).slice(0, 8).map((p) => p.id);
    }
    if (Array.isArray(hpConfig.newArrivalsProductIds) && hpConfig.newArrivalsProductIds.length > 0) {
      return hpConfig.newArrivalsProductIds;
    }
    return products.filter((p) => p.isNewArrival).slice(0, 8).map((p) => p.id);
  };

  const updateSectionProductIds = (section: 'trending' | 'popular' | 'newArrivals', nextIds: string[]) => {
    const key =
      section === 'trending'
        ? 'trendingProductIds'
        : section === 'popular'
        ? 'popularProductIds'
        : 'newArrivalsProductIds';
    updateSettings({
      homepageConfig: {
        ...hpConfig,
        [key]: nextIds,
      },
    });
  };

  const handleMoveInSection = (
    section: 'trending' | 'popular' | 'newArrivals',
    index: number,
    direction: 'up' | 'down'
  ) => {
    const currentIds = [...getSectionProductIds(section)];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= currentIds.length) return;
    const temp = currentIds[index];
    currentIds[index] = currentIds[targetIdx];
    currentIds[targetIdx] = temp;
    updateSectionProductIds(section, currentIds);
  };

  const handleToggleProductInSection = (
    section: 'trending' | 'popular' | 'newArrivals',
    productId: string
  ) => {
    const currentIds = getSectionProductIds(section);
    const exists = currentIds.includes(productId);
    const nextIds = exists
      ? currentIds.filter((id) => id !== productId)
      : [productId, ...currentIds];
    updateSectionProductIds(section, nextIds);

    // Also update the product's boolean flag in Firestore so both mechanisms stay in sync
    if (section === 'trending') {
      updateProduct(productId, { isTrending: !exists });
    } else if (section === 'popular') {
      updateProduct(productId, { isFeatured: !exists });
    } else {
      updateProduct(productId, { isNewArrival: !exists });
    }
  };

  // Filtered & Sorted Products List
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const query = productSearch.toLowerCase();
        const matchSearch =
          p.name.toLowerCase().includes(query) ||
          p.brand.toLowerCase().includes(query) ||
          (p.sku && p.sku.toLowerCase().includes(query)) ||
          (p.supplierSku && p.supplierSku.toLowerCase().includes(query)) ||
          p.id.toLowerCase().includes(query);

        const matchCat = categoryFilter === 'all' || p.categoryId === categoryFilter;

        const matchStock =
          stockFilter === 'all'
            ? true
            : stockFilter === 'in_stock'
            ? p.stockQuantity > 0
            : stockFilter === 'low_stock'
            ? p.stockQuantity > 0 && p.stockQuantity < 20
            : p.stockQuantity <= 0;

        const matchStatus = statusFilter === 'all' || (p.status || 'active') === statusFilter;

        const matchSource =
          sourceFilter === 'all'
            ? true
            : sourceFilter === 'imported'
            ? !!p.isImported
            : !p.isImported;

        return matchSearch && matchCat && matchStock && matchStatus && matchSource;
      })
      .sort((a, b) => {
        if (sortBy === 'price_high') return b.price - a.price;
        if (sortBy === 'price_low') return a.price - b.price;
        if (sortBy === 'profit_high') {
          const profA = a.profitAmount || a.price - (a.costPrice || 0);
          const profB = b.profitAmount || b.price - (b.costPrice || 0);
          return profB - profA;
        }
        if (sortBy === 'stock_low') return a.stockQuantity - b.stockQuantity;
        return 0;
      });
  }, [products, productSearch, categoryFilter, stockFilter, statusFilter, sourceFilter, sortBy]);

  // Filtered Orders List
  const filteredOrders = useMemo(() => {
    const now = Date.now();
    return orders.filter((o) => {
      const q = orderSearch.trim().toLowerCase();
      const addr = o.shippingAddress || ({} as any);
      const matchSearch =
        !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.customerPhone || '').toLowerCase().includes(q) ||
        (addr.phone || '').toLowerCase().includes(q) ||
        (addr.pincode || addr.zipCode || '').toLowerCase().includes(q) ||
        (addr.city || '').toLowerCase().includes(q) ||
        o.items.some(
          (i) =>
            i.productName.toLowerCase().includes(q) ||
            (i.supplierSku || '').toLowerCase().includes(q) ||
            (i.sku || '').toLowerCase().includes(q)
        );

      const matchStatus = orderStatusFilter === 'all' || o.orderStatus === orderStatusFilter;
      const matchPayment =
        orderPaymentFilter === 'all' || o.paymentMethod === orderPaymentFilter;

      let matchDate = true;
      if (orderDateFilter !== 'all' && o.createdAt) {
        const orderTime = new Date(o.createdAt).getTime();
        const diffHours = (now - orderTime) / (1000 * 60 * 60);
        if (orderDateFilter === 'today') matchDate = diffHours <= 24;
        else if (orderDateFilter === '7days') matchDate = diffHours <= 24 * 7;
        else if (orderDateFilter === '30days') matchDate = diffHours <= 24 * 30;
      }

      return matchSearch && matchStatus && matchPayment && matchDate;
    });
  }, [orders, orderSearch, orderStatusFilter, orderPaymentFilter, orderDateFilter]);

  // Frontend Protection Check
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-5 animate-in fade-in">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto border border-rose-200 shadow-sm">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Administrator Access Restricted</h2>
          <p className="text-xs text-slate-500 mt-1.5">
            This dashboard and all store operations require verified owner privileges (popcarty7@gmail.com).
          </p>
        </div>
        <div className="flex flex-col gap-2.5 pt-2">
          <button
            onClick={() => setAuthModalOpen(true)}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl shadow-md shadow-violet-500/20 transition-all cursor-pointer"
          >
            Sign In as Administrator
          </button>
          <button
            onClick={() => navigateTo('home')}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Return to Storefront
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <PopcartyLogo size="md" />
          <div className="border-l border-slate-200 pl-4 hidden sm:block">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Admin Operations Control</h1>
            <p className="text-xs text-slate-500">
              Live order management, supplier product import, and homepage curation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('import')}
            className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-violet-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Import Products</span>
          </button>
          <button
            onClick={() => navigateTo('home')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Storefront</span>
          </button>
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={async () => {
              await logout();
            }}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 disabled:opacity-50 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{isLoggingOut ? 'Signing Out...' : 'Sign Out'}</span>
          </button>
        </div>
      </div>

      {/* Admin Nav Tabs */}
      <div className="w-full min-w-0 overflow-x-auto no-scrollbar border-b border-slate-200">
        <div className="flex items-center gap-1 sm:gap-2 flex-nowrap w-max pb-px">
          {[
            { id: 'overview', label: 'Dashboard & Metrics', icon: TrendingUp },
            { id: 'orders', label: `Orders (${orders.length})`, icon: ShoppingBag, badge: orders.length > 0 ? 'Live' : undefined },
            { id: 'homepage', label: 'Homepage & Trending', icon: Layout },
            { id: 'products', label: `Products (${products.length})`, icon: Package },
            { id: 'import', label: 'Import Products', icon: DownloadCloud, badge: 'Auto-Scraper' },
            { id: 'coupons', label: `Coupons (${coupons.length})`, icon: Tag },
            { id: 'settings', label: 'Store Settings', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-none shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer select-none ${
                  isActive
                    ? 'border-violet-600 text-violet-700 bg-violet-50/60 rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-t-xl'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-600 text-white leading-none">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. OVERVIEW & METRICS */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in duration-150">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Order Value
              </span>
              <strong className="text-2xl font-extrabold text-slate-900 tabular-nums">
                {formatPrice(totalRevenue)}
              </strong>
              <span className="text-[11px] text-emerald-600 font-semibold block pt-1">
                Synced with Firestore
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Active Catalog
              </span>
              <strong className="text-2xl font-extrabold text-slate-900 tabular-nums">
                {products.length} Items
              </strong>
              <span className="text-[11px] text-violet-600 font-semibold block pt-1">
                {products.filter((p) => p.isImported).length} imported products
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Units Ordered
              </span>
              <strong className="text-2xl font-extrabold text-slate-900 tabular-nums">
                {totalUnitsSold} Units
              </strong>
              <span className="text-[11px] text-emerald-600 font-semibold block pt-1">
                From {orders.length} customer orders
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Est. Inventory Profit
              </span>
              <strong className="text-2xl font-extrabold text-slate-900 tabular-nums">
                {formatPrice(totalProfitEstimate)}
              </strong>
              <span className="text-[11px] text-emerald-600 font-semibold block pt-1">
                Avg markup: ~42%
              </span>
            </div>
          </div>

          {/* Quick Import Promo Callout */}
          <div className="bg-gradient-to-r from-violet-900 via-indigo-900 to-purple-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Supplier Integration</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold">Import Products with 1-Click Profit Markup</h3>
              <p className="text-xs text-slate-200">
                Traverse supplier collections (e.g. Dropplier all), extract clean photos, descriptions & specs, apply profit margins, and publish to your store without source branding.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('import')}
              className="px-5 py-3 bg-white hover:bg-slate-100 text-violet-900 font-extrabold text-xs rounded-2xl shadow-lg transition-all shrink-0 flex items-center justify-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
            >
              <DownloadCloud className="w-4 h-4 text-violet-700" />
              <span>Open Product Importer &rarr;</span>
            </button>
          </div>

          {/* Low Stock Warning */}
          {lowStockProducts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <h3 className="text-sm font-bold">Inventory Low-Stock Warning</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {lowStockProducts.slice(0, 9).map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-white rounded-2xl border border-amber-200 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <strong className="block font-bold text-slate-900 truncate">{p.name}</strong>
                      <span className="text-amber-700 font-semibold">{p.stockQuantity} units remaining</span>
                    </div>
                    <button
                      onClick={() => restockProduct(p.id, 25)}
                      className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-xl transition-colors text-[11px] shrink-0 cursor-pointer"
                    >
                      +25 Units
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Orders Table */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Recent Customer Orders</h3>
              <button
                onClick={() => setActiveTab('orders')}
                className="text-xs font-semibold text-violet-600 hover:text-violet-800 cursor-pointer"
              >
                View All ({orders.length}) &rarr;
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px]">
                    <th className="pb-3 font-semibold">Order</th>
                    <th className="pb-3 font-semibold">Customer & Phone</th>
                    <th className="pb-3 font-semibold">City & PIN</th>
                    <th className="pb-3 font-semibold">Items</th>
                    <th className="pb-3 font-semibold">Total</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No orders placed yet.
                      </td>
                    </tr>
                  ) : (
                    orders.slice(0, 6).map((o) => (
                      <tr key={o.orderNumber || o.id} className="hover:bg-slate-50/50">
                        <td className="py-3 font-mono font-bold text-slate-900">#{o.orderNumber}</td>
                        <td className="py-3">
                          <span className="font-bold text-slate-800 block">{o.customerName}</span>
                          <span className="text-[11px] text-slate-500">{o.shippingAddress?.phone || o.customerPhone}</span>
                        </td>
                        <td className="py-3 text-slate-600">
                          {o.shippingAddress?.city} - {o.shippingAddress?.pincode || o.shippingAddress?.zipCode}
                        </td>
                        <td className="py-3 text-slate-500">{o.items.length} items</td>
                        <td className="py-3 font-bold text-slate-900 tabular-nums">{formatPrice(o.totalAmount)}</td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              o.orderStatus === 'delivered'
                                ? 'bg-emerald-100 text-emerald-800'
                                : o.orderStatus === 'shipped' || o.orderStatus === 'out_for_delivery'
                                ? 'bg-violet-100 text-violet-800'
                                : o.orderStatus === 'cancelled' || o.orderStatus === 'returned'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {o.orderStatus.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleOpenOrderModal(o)}
                            className="text-violet-600 hover:text-violet-800 font-bold cursor-pointer"
                          >
                            View Full Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. DEDICATED PRODUCT IMPORT SYSTEM TAB */}
      {activeTab === 'import' && (
        <div className="animate-in fade-in duration-150 space-y-6">
          <ProductRestorePanel />
          <ProductImporterPanel />
        </div>
      )}

      {/* 3. HOMEPAGE & TRENDING CUSTOMIZATION TAB */}
      {activeTab === 'homepage' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Homepage & "Discover What's Trending" Manager
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Control section titles, carousel speed, and the exact products & display order shown on your storefront homepage.
                </p>
              </div>
              <button
                onClick={() => navigateTo('home')}
                className="px-4 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer self-start"
              >
                <Eye className="w-4 h-4" />
                <span>Preview Homepage</span>
              </button>
            </div>

            {/* Section Headings & Carousel Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 block">
                  1. Trending Carousel Header
                </span>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Heading Title</label>
                  <input
                    type="text"
                    value={hpConfig.trendingTitle ?? "Discover What's Trending"}
                    onChange={(e) =>
                      updateSettings({
                        homepageConfig: { ...hpConfig, trendingTitle: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={
                      hpConfig.trendingSubtitle ??
                      'Discover useful home, kitchen and lifestyle products at honest prices.'
                    }
                    onChange={(e) =>
                      updateSettings({
                        homepageConfig: { ...hpConfig, trendingSubtitle: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hpConfig.autoPlayTrending !== false}
                      onChange={(e) =>
                        updateSettings({
                          homepageConfig: { ...hpConfig, autoPlayTrending: e.target.checked },
                        })
                      }
                      className="rounded accent-violet-600"
                    />
                    <span>Auto-scroll Carousel</span>
                  </label>
                  <select
                    value={hpConfig.trendingSpeedMs || 2800}
                    onChange={(e) =>
                      updateSettings({
                        homepageConfig: { ...hpConfig, trendingSpeedMs: Number(e.target.value) },
                      })
                    }
                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-semibold"
                  >
                    <option value={2000}>Fast (2s)</option>
                    <option value={2800}>Normal (2.8s)</option>
                    <option value={4000}>Relaxed (4s)</option>
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 block">
                  2. Popular & Trending Grid
                </span>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Heading Title</label>
                  <input
                    type="text"
                    value={hpConfig.popularTitle ?? 'Popular & Trending Products'}
                    onChange={(e) =>
                      updateSettings({
                        homepageConfig: { ...hpConfig, popularTitle: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={
                      hpConfig.popularSubtitle ??
                      'Hand-picked flagship essentials engineered for everyday excellence.'
                    }
                    onChange={(e) =>
                      updateSettings({
                        homepageConfig: { ...hpConfig, popularSubtitle: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 block">
                  3. New Arrivals Section
                </span>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Heading Title</label>
                  <input
                    type="text"
                    value={hpConfig.newArrivalsTitle ?? 'New Arrivals'}
                    onChange={(e) =>
                      updateSettings({
                        homepageConfig: { ...hpConfig, newArrivalsTitle: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Badge Text</label>
                  <input
                    type="text"
                    value={hpConfig.newArrivalsSubtitle ?? 'Freshly Dropped'}
                    onChange={(e) =>
                      updateSettings({
                        homepageConfig: { ...hpConfig, newArrivalsSubtitle: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Section Selector Sub-tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              {[
                {
                  id: 'trending' as const,
                  label: `Discover What's Trending (${getSectionProductIds('trending').length})`,
                },
                {
                  id: 'popular' as const,
                  label: `Popular & Trending Grid (${getSectionProductIds('popular').length})`,
                },
                {
                  id: 'newArrivals' as const,
                  label: `New Arrivals (${getSectionProductIds('newArrivals').length})`,
                },
              ].map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => setHpSectionTab(sec.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    hpSectionTab === sec.id
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            {/* Two-Column Manager: Left = Ordered Active List, Right = Search Catalog to Add */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Currently Pinned Products in Display Order */}
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Current Display Order (Use Up/Down to Reorder)
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {getSectionProductIds(hpSectionTab).length} products pinned
                  </span>
                </div>

                <div className="space-y-2 max-h-[440px] overflow-y-auto custom-scrollbar pr-1">
                  {getSectionProductIds(hpSectionTab).map((id, idx) => {
                    const prod = products.find((p) => p.id === id);
                    if (!prod) return null;
                    return (
                      <div
                        key={prod.id}
                        className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <img
                            src={prod.images[0]}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <strong className="font-bold text-slate-900 block truncate">{prod.name}</strong>
                            <span className="text-[11px] text-violet-700 font-semibold">
                              {formatPrice(prod.price)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveInSection(hpSectionTab, idx, 'up')}
                            disabled={idx === 0}
                            className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveInSection(hpSectionTab, idx, 'down')}
                            disabled={idx === getSectionProductIds(hpSectionTab).length - 1}
                            className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditProduct(prod)}
                            className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-violet-50 text-violet-600 cursor-pointer"
                            title="Edit Product Details"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleProductInSection(hpSectionTab, prod.id)}
                            className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 cursor-pointer"
                            title="Remove from section"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Search Any Store Product to Add to This Section */}
              <div className="lg:col-span-6 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={hpSearchQuery}
                    onChange={(e) => setHpSearchQuery(e.target.value)}
                    placeholder="Search catalog to add products to this section..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                  {products
                    .filter((p) => {
                      if (!hpSearchQuery.trim()) return true;
                      const q = hpSearchQuery.toLowerCase();
                      return (
                        p.name.toLowerCase().includes(q) ||
                        (p.sku && p.sku.toLowerCase().includes(q)) ||
                        (p.supplierSku && p.supplierSku.toLowerCase().includes(q))
                      );
                    })
                    .slice(0, 40)
                    .map((prod) => {
                      const isPinned = getSectionProductIds(hpSectionTab).includes(prod.id);
                      return (
                        <div
                          key={prod.id}
                          className="p-2.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-xs hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={prod.images[0]}
                              alt=""
                              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-900 block truncate">{prod.name}</span>
                              <span className="text-[11px] text-slate-500">
                                {formatPrice(prod.price)} · {prod.categoryId}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleProductInSection(hpSectionTab, prod.id)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-[11px] shrink-0 cursor-pointer transition-colors ${
                              isPinned
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-rose-100 hover:text-rose-700'
                                : 'bg-violet-600 text-white hover:bg-violet-700'
                            }`}
                          >
                            {isPinned ? '✓ Added' : '+ Add'}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. PRODUCT MANAGEMENT & BULK ACTIONS */}
      {activeTab === 'products' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Header Action Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Store Products Catalog</h2>
              <p className="text-xs text-slate-500">
                Manage selling prices, profit margins, inventory, homepage flags, and multiple product photos.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Export catalog as CSV"
              >
                <FileSpreadsheet className="w-4 h-4 text-slate-600" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => setActiveTab('import')}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>Import from Dropplier</span>
              </button>

              <button
                onClick={handleOpenAddProduct}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-violet-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Product</span>
              </button>
            </div>
          </div>

          {/* Search, Filters & Sorting Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-4 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search by Title, Supplier SKU, ID, or Brand..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              </div>

              <div className="lg:col-span-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-medium text-slate-700 cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as any)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-medium text-slate-700 cursor-pointer"
                >
                  <option value="all">All Stock Levels</option>
                  <option value="in_stock">In Stock (&gt;0)</option>
                  <option value="low_stock">Low Stock (&lt;20)</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as any)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-medium text-slate-700 cursor-pointer"
                >
                  <option value="all">All Sources</option>
                  <option value="imported">Imported Goods</option>
                  <option value="native">Native Catalog</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-bold text-slate-800 cursor-pointer"
                >
                  <option value="newest">Sort: Newest First</option>
                  <option value="profit_high">Sort: Highest Profit</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="stock_low">Stock: Low to High</option>
                </select>
              </div>
            </div>
          </div>

          {/* Floating / Sticky Bulk Actions Bar when items selected */}
          {selectedProductIds.length > 0 && (
            <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-bold">
                  {selectedProductIds.length} of {filteredProducts.length} products selected
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs">
                <button
                  onClick={() => handleBulkStatus('active')}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  Set Active
                </button>
                <button
                  onClick={() => handleBulkStatus('draft')}
                  className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg cursor-pointer"
                >
                  Set Draft
                </button>
                <button
                  onClick={() => bulkUpdateFlags(selectedProductIds, { isTrending: true })}
                  className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  Pin to Trending
                </button>

                <div className="flex items-center gap-1">
                  <select
                    value={bulkCategoryTarget}
                    onChange={(e) => setBulkCategoryTarget(e.target.value)}
                    className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-semibold text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        Move to {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkCategory}
                    className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg cursor-pointer"
                  >
                    Apply
                  </button>
                </div>

                <button
                  onClick={() => handleBulkMarkup(35)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 cursor-pointer"
                  title="Apply +35% Markup"
                >
                  +35% Margin
                </button>

                <button
                  onClick={handleBulkDelete}
                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected</span>
                </button>

                <button
                  onClick={() => setSelectedProductIds([])}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Products Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredProducts.length > 0 &&
                          selectedProductIds.length === filteredProducts.length
                        }
                        onChange={handleToggleSelectAll}
                        className="rounded accent-violet-600 w-3.5 h-3.5 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 font-semibold">Product / SKU</th>
                    <th className="py-3 font-semibold">Category</th>
                    <th className="py-3 font-semibold">Cost Price</th>
                    <th className="py-3 font-semibold">Selling Price</th>
                    <th className="py-3 font-semibold">Your Profit</th>
                    <th className="py-3 font-semibold">Homepage</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No products match your search/filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.slice(0, visibleProductsCount).map((p) => {
                      const isSelected = selectedProductIds.includes(p.id);
                      const cost = p.costPrice || Math.round(p.price * 0.7);
                      const profit = p.profitAmount !== undefined ? p.profitAmount : p.price - cost;
                      const profitPct =
                        p.profitPercentage !== undefined
                          ? p.profitPercentage
                          : cost > 0
                          ? Math.round((profit / cost) * 100)
                          : 0;

                      return (
                        <tr
                          key={p.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-violet-50/40' : 'hover:bg-slate-50/50'
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleProductSelect(p.id)}
                              className="rounded accent-violet-600 w-3.5 h-3.5 cursor-pointer"
                            />
                          </td>

                          <td className="py-3 flex items-center gap-3 pr-2">
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                              <img
                                src={p.images[0]}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                              {p.images.length > 1 && (
                                <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-slate-900/80 text-white px-0.5 rounded font-bold">
                                  +{p.images.length - 1}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <strong className="font-bold text-slate-900 block truncate">
                                  {p.name}
                                </strong>
                                {p.isImported && (
                                  <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded border border-indigo-100">
                                    Imported
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <span className="font-mono">SKU: {p.supplierSku || p.sku || p.id}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 capitalize text-slate-600 font-medium">
                            <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[11px]">
                              {categories.find((c) => c.id === p.categoryId)?.name || p.categoryId}
                            </span>
                          </td>

                          <td className="py-3 font-semibold text-slate-500 tabular-nums">
                            {formatPrice(cost)}
                          </td>

                          <td className="py-3">
                            <div className="font-extrabold text-slate-900 tabular-nums">
                              {formatPrice(p.price)}
                            </div>
                            {p.originalPrice > p.price && (
                              <div className="text-[10px] text-slate-400 line-through tabular-nums">
                                {formatPrice(p.originalPrice)}
                              </div>
                            )}
                          </td>

                          <td className="py-3">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              <span>+{formatPrice(profit)}</span>
                              <span className="text-[9px] text-emerald-600">({profitPct}%)</span>
                            </span>
                          </td>

                          <td className="py-3">
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={() => updateProduct(p.id, { isTrending: !p.isTrending })}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer border ${
                                  p.isTrending
                                    ? 'bg-violet-600 text-white border-violet-600'
                                    : 'bg-slate-50 text-slate-400 border-slate-200'
                                }`}
                                title="Toggle Discover What's Trending"
                              >
                                Trending
                              </button>
                              <button
                                type="button"
                                onClick={() => updateProduct(p.id, { isFeatured: !p.isFeatured })}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer border ${
                                  p.isFeatured
                                    ? 'bg-amber-500 text-white border-amber-500'
                                    : 'bg-slate-50 text-slate-400 border-slate-200'
                                }`}
                                title="Toggle Popular Section"
                              >
                                Popular
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => restockProduct(p.id, 25)}
                              className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-lg cursor-pointer"
                              title="Restock +25 units"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEditProduct(p)}
                              className="p-1.5 text-slate-600 hover:text-violet-700 hover:bg-violet-50 rounded-lg cursor-pointer"
                              title="Edit product"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteProduct(p.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Delete product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {visibleProductsCount < filteredProducts.length && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-center">
                <button
                  onClick={() => setVisibleProductsCount((prev) => prev + 50)}
                  className="px-5 py-2 bg-white hover:bg-violet-50 text-violet-700 border border-violet-200 text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  Show More Products ({filteredProducts.length - visibleProductsCount} remaining)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. COMPLETE ORDER MANAGEMENT (Synced with Firestore "orders") */}
      {activeTab === 'orders' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Top Search, Filter & Export Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search by Order ID, Customer Name, Phone Number, PIN Code, City, or Product SKU..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="placed">Placed</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="packed">Packed</option>
                  <option value="shipped">Shipped</option>
                  <option value="out_for_delivery">Out For Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="returned">Returned</option>
                </select>

                <select
                  value={orderPaymentFilter}
                  onChange={(e) => setOrderPaymentFilter(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer"
                >
                  <option value="all">All Payment Types</option>
                  <option value="cod">Cash on Delivery (COD)</option>
                  <option value="online">Online Prepaid</option>
                </select>

                <select
                  value={orderDateFilter}
                  onChange={(e) => setOrderDateFilter(e.target.value as any)}
                  className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Last 24 Hours</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                </select>

                <button
                  onClick={handleExportOrdersCSV}
                  className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export Orders CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Orders List Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Order ID & Date</th>
                    <th className="py-3.5 font-semibold">Customer & Phone</th>
                    <th className="py-3.5 font-semibold">Delivery Address & PIN</th>
                    <th className="py-3.5 font-semibold">Ordered Products & SKUs</th>
                    <th className="py-3.5 font-semibold">Amount & Payment</th>
                    <th className="py-3.5 font-semibold">Status</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No orders found matching your current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => {
                      const addr = o.shippingAddress || ({} as any);
                      return (
                        <tr key={o.orderNumber || o.id} className="hover:bg-slate-50/60 align-top">
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <strong className="font-mono font-bold text-slate-900">#{o.orderNumber}</strong>
                              <button
                                onClick={() => copyToClipboard(o.orderNumber, `Order #${o.orderNumber}`)}
                                className="text-slate-400 hover:text-violet-600 p-0.5 cursor-pointer"
                                title="Copy Order ID"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {new Date(o.createdAt).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                          </td>

                          <td className="py-3.5 pr-3">
                            <strong className="block text-slate-900 font-bold">
                              {addr.fullName || addr.name || o.customerName}
                            </strong>
                            <div className="flex items-center gap-1 text-[11px] text-slate-600 mt-0.5 font-mono">
                              <span>{addr.phone || o.customerPhone}</span>
                              <button
                                onClick={() =>
                                  copyToClipboard(addr.phone || o.customerPhone, 'Customer Phone')
                                }
                                className="text-slate-400 hover:text-violet-600 p-0.5 cursor-pointer"
                                title="Copy Phone"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                            {(addr.email || o.customerEmail) && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-[160px]">
                                {addr.email || o.customerEmail}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 pr-3 max-w-xs">
                            <p className="text-slate-700 text-[11px] leading-snug">
                              {[addr.houseNo, addr.street, addr.area].filter(Boolean).join(', ')}
                            </p>
                            <p className="text-slate-900 font-bold text-[11px] mt-0.5">
                              {[addr.city, addr.district, addr.state].filter(Boolean).join(', ')} -{' '}
                              <span className="font-mono text-violet-700">
                                {addr.pincode || addr.zipCode}
                              </span>
                            </p>
                            {addr.latitude !== undefined && addr.longitude !== undefined && (
                              <a
                                href={`https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold mt-0.5 hover:underline"
                              >
                                <MapPin className="w-3 h-3" />
                                <span>GPS Pin</span>
                              </a>
                            )}
                          </td>

                          <td className="py-3.5 pr-3">
                            <div className="space-y-1.5 max-w-xs">
                              {o.items.map((it, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px]">
                                  <img
                                    src={it.productImage}
                                    alt=""
                                    className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <span className="font-semibold text-slate-900 block truncate">
                                      {it.quantity}x {it.productName}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      SKU: {it.supplierSku || it.sku || it.productId}
                                      {it.color ? ` · ${it.color}` : ''}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>

                          <td className="py-3.5 whitespace-nowrap">
                            <div className="font-extrabold text-slate-900 tabular-nums text-sm">
                              {formatPrice(o.totalAmount)}
                            </div>
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              {o.paymentMethod.toUpperCase()} ·{' '}
                              {o.paymentStatus.replace(/_/g, ' ')}
                            </span>
                          </td>

                          <td className="py-3.5 whitespace-nowrap">
                            <select
                              value={o.orderStatus}
                              onChange={(e) => updateOrderStatus(o.orderNumber, e.target.value as OrderStatus)}
                              className={`text-[11px] font-bold rounded-xl px-2.5 py-1.5 border cursor-pointer ${
                                o.orderStatus === 'delivered'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : o.orderStatus === 'shipped' || o.orderStatus === 'out_for_delivery'
                                  ? 'bg-violet-50 text-violet-800 border-violet-200'
                                  : o.orderStatus === 'cancelled' || o.orderStatus === 'returned'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              <option value="placed">Placed</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="packed">Packed</option>
                              <option value="shipped">Shipped</option>
                              <option value="out_for_delivery">Out For Delivery</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                              <option value="returned">Returned</option>
                            </select>
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap space-y-1">
                            <button
                              onClick={() => handleOpenOrderModal(o)}
                              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-[11px] rounded-xl shadow-2xs transition-colors cursor-pointer block ml-auto"
                            >
                              Full Details & Copy
                            </button>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  buildShippingLabelText(o),
                                  `Address for #${o.orderNumber}`
                                )
                              }
                              className="text-[10px] font-semibold text-slate-500 hover:text-violet-700 cursor-pointer block ml-auto"
                            >
                              Copy Address
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. COUPONS MANAGEMENT */}
      {activeTab === 'coupons' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Promotional Discounts</h3>
            <button
              onClick={() => setIsCouponModalOpen(true)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-violet-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Coupon</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {coupons.map((c) => (
              <div
                key={c.id}
                className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-extrabold text-violet-700 px-3 py-1 bg-violet-50 rounded-xl border border-violet-100">
                    {c.code}
                  </span>
                  <button
                    onClick={() => deleteCoupon(c.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    title="Delete coupon"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 font-medium">{c.description}</p>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Used {c.usageCount} times</span>
                  <span className="text-emerald-600 font-semibold">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. STORE SETTINGS */}
      {activeTab === 'settings' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6 animate-in fade-in duration-150">
          <div>
            <h3 className="text-base font-bold text-slate-900">Storefront Global Configuration</h3>
            <p className="text-xs text-slate-500">Manage currencies, delivery thresholds, and announcements.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Store Name</label>
              <input
                type="text"
                value={settings.storeName}
                onChange={(e) => updateSettings({ storeName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Tagline</label>
              <input
                type="text"
                value={settings.tagline}
                onChange={(e) => updateSettings({ tagline: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Free Shipping Threshold</label>
              <input
                type="number"
                value={settings.freeShippingThreshold}
                onChange={(e) => updateSettings({ freeShippingThreshold: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Standard Shipping Fee</label>
              <input
                type="number"
                value={settings.standardShippingFee}
                onChange={(e) => updateSettings({ standardShippingFee: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="md:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">Featured Promo Coupon Code</label>
              <input
                type="text"
                value={settings.announcementBar.couponHighlight}
                onChange={(e) =>
                  updateSettings({
                    announcementBar: { ...settings.announcementBar, couponHighlight: e.target.value.toUpperCase() },
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={resetToDefaultCatalog}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-colors cursor-pointer"
            >
              Reset to Factory Seed Catalog
            </button>
            <span className="text-xs text-slate-400">Settings persist automatically to Firestore.</span>
          </div>
        </div>
      )}

      {/* ORDER FULL DETAILS & COPYABLE DISPATCH MODAL */}
      {selectedOrderForModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setSelectedOrderForModal(null)}
        >
          <div
            className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-7 space-y-6 max-h-[92vh] overflow-y-auto custom-scrollbar text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-slate-900 font-mono">
                    Order #{selectedOrderForModal.orderNumber}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-violet-100 text-violet-800">
                    {selectedOrderForModal.orderStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Placed on {new Date(selectedOrderForModal.createdAt).toLocaleString('en-IN')} · User UID:{' '}
                  <span className="font-mono">{selectedOrderForModal.userId}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      buildFullOrderSummaryText(selectedOrderForModal),
                      'Full Order Summary'
                    )
                  }
                  className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {copiedField === 'Full Order Summary' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>Copy Full Order Summary</span>
                </button>
                <button
                  onClick={() => setSelectedOrderForModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Customer & Delivery Address Grid */}
            {(() => {
              const addr = selectedOrderForModal.shippingAddress || ({} as any);
              const fullFormattedAddress = buildShippingLabelText(selectedOrderForModal);
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Customer Info */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Customer Contact
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            addr.phone || selectedOrderForModal.customerPhone,
                            'Customer Phone'
                          )
                        }
                        className="text-[11px] font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy Phone</span>
                      </button>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-extrabold text-slate-900">
                        {addr.fullName || addr.name || selectedOrderForModal.customerName}
                      </p>
                      <p className="text-slate-700 font-mono font-semibold flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-violet-600" />
                        <span>{addr.phone || selectedOrderForModal.customerPhone}</span>
                        {addr.alternatePhone && <span>/ Alt: {addr.alternatePhone}</span>}
                      </p>
                      {(addr.email || selectedOrderForModal.customerEmail) && (
                        <p className="text-slate-600 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-violet-600" />
                          <span>{addr.email || selectedOrderForModal.customerEmail}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Complete Shipping Address */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Complete Delivery Address ({addr.label || 'Home'})
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(fullFormattedAddress, 'Shipping Address')}
                        className="text-[11px] font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy Address</span>
                      </button>
                    </div>

                    <div className="text-slate-700 space-y-0.5 leading-relaxed">
                      {addr.houseNo && (
                        <div>
                          <strong className="text-slate-900">House/Flat:</strong> {addr.houseNo}
                        </div>
                      )}
                      <div>
                        <strong className="text-slate-900">Street/Road:</strong> {addr.street}
                      </div>
                      {addr.area && (
                        <div>
                          <strong className="text-slate-900">Area/Locality:</strong> {addr.area}
                        </div>
                      )}
                      {addr.landmark && (
                        <div>
                          <strong className="text-slate-900">Landmark:</strong> {addr.landmark}
                        </div>
                      )}
                      <div>
                        <strong className="text-slate-900">City / District / State:</strong>{' '}
                        {[addr.city, addr.district, addr.state].filter(Boolean).join(', ')}
                      </div>
                      <div>
                        <strong className="text-slate-900">PIN Code:</strong>{' '}
                        <span className="font-mono font-bold text-violet-700">
                          {addr.pincode || addr.zipCode}
                        </span>{' '}
                        ({addr.country || 'India'})
                      </div>
                      {addr.deliveryInstructions && (
                        <div className="text-amber-800 bg-amber-50 px-2 py-1 rounded mt-1">
                          <strong>Note:</strong> {addr.deliveryInstructions}
                        </div>
                      )}
                      {addr.latitude !== undefined && addr.longitude !== undefined && (
                        <div className="pt-1 flex items-center justify-between">
                          <span className="font-mono text-[11px] text-slate-500">
                            GPS: {addr.latitude}, {addr.longitude}
                          </span>
                          <a
                            href={`https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-violet-600 font-bold hover:underline"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Open in Google Maps</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Ordered Items Table with Supplier SKU & Copy */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Ordered Items ({selectedOrderForModal.items.length})
              </span>
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3">Supplier SKU / ID</th>
                      <th className="py-2.5 px-3">Variant</th>
                      <th className="py-2.5 px-3">Qty × Price</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrderForModal.items.map((item, i) => (
                      <tr key={i}>
                        <td className="py-2.5 px-3 flex items-center gap-2.5">
                          <img
                            src={item.productImage}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <strong className="font-bold text-slate-900 block">{item.productName}</strong>
                            <span className="text-[10px] text-slate-400">
                              Supplier Cost: {item.costPrice ? formatPrice(item.costPrice) : 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-violet-700">
                              {item.supplierSku || item.sku || item.productId}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(
                                  item.supplierSku || item.sku || item.productId,
                                  `SKU ${item.supplierSku || item.sku}`
                                )
                              }
                              className="text-slate-400 hover:text-violet-600 p-0.5 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400 block">ID: {item.productId}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {item.color || item.variantTitle || 'Standard'}
                          {item.size ? ` / ${item.size}` : ''}
                        </td>
                        <td className="py-2.5 px-3 font-semibold tabular-nums">
                          {item.quantity} × {formatPrice(item.price)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 tabular-nums">
                          {formatPrice(item.price * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Price Breakdown & Admin Status / Courier Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Order Status, Payment Status, Courier & Tracking Form */}
              <form
                onSubmit={handleSaveOrderDetailsModal}
                className="p-4 rounded-2xl bg-violet-50/50 border border-violet-200/80 space-y-3"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-900 block">
                  Fulfillment, Tracking & Payment Controls
                </span>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Order Status</label>
                    <select
                      value={selectedOrderForModal.orderStatus}
                      onChange={(e) => {
                        const nextSt = e.target.value as OrderStatus;
                        updateOrderStatus(selectedOrderForModal.orderNumber, nextSt);
                        setSelectedOrderForModal({ ...selectedOrderForModal, orderStatus: nextSt });
                      }}
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                    >
                      <option value="placed">Placed</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="packed">Packed</option>
                      <option value="shipped">Shipped</option>
                      <option value="out_for_delivery">Out For Delivery</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="returned">Returned</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Payment Status</label>
                    <select
                      value={modalPaymentStatus}
                      onChange={(e) => setModalPaymentStatus(e.target.value as PaymentStatusType)}
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                    >
                      <option value="paid">Paid</option>
                      <option value="cod_pending">COD Pending</option>
                      <option value="pending">Pending</option>
                      <option value="failed">Failed</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Courier Partner</label>
                    <input
                      type="text"
                      value={modalCourierName}
                      onChange={(e) => setModalCourierName(e.target.value)}
                      placeholder="e.g. Delhivery / BlueDart"
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Tracking / AWB #</label>
                    <input
                      type="text"
                      value={modalTrackingNumber}
                      onChange={(e) => setModalTrackingNumber(e.target.value)}
                      placeholder="AWB / Tracking ID"
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Admin / Supplier Notes</label>
                  <input
                    type="text"
                    value={modalAdminNotes}
                    onChange={(e) => setModalAdminNotes(e.target.value)}
                    placeholder="Supplier order ID or dispatch remarks..."
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Fulfillment & Tracking Details
                </button>
              </form>

              {/* Financial Summary */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Payment & Billing Summary
                  </span>
                  <div className="flex justify-between text-slate-600">
                    <span>Payment Method</span>
                    <strong className="uppercase text-slate-900">
                      {selectedOrderForModal.paymentMethod.toUpperCase()}
                    </strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Items Subtotal</span>
                    <span className="font-semibold tabular-nums">
                      {formatPrice(selectedOrderForModal.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping Charges</span>
                    <span className="font-semibold tabular-nums">
                      {selectedOrderForModal.shippingCost === 0
                        ? 'FREE'
                        : formatPrice(selectedOrderForModal.shippingCost)}
                    </span>
                  </div>
                  {selectedOrderForModal.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount ({selectedOrderForModal.couponCode})</span>
                      <span className="font-semibold tabular-nums">
                        -{formatPrice(selectedOrderForModal.discountAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Tax (GST)</span>
                    <span className="font-semibold tabular-nums">
                      {formatPrice(selectedOrderForModal.tax)}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="text-sm font-extrabold text-slate-900">Final Payable Total</span>
                  <span className="text-xl font-black text-violet-700 tabular-nums">
                    {formatPrice(selectedOrderForModal.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RICH ADD / EDIT PRODUCT MODAL (COMPLETE CRUD) */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-7 space-y-5 max-h-[92vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingProduct ? 'Edit Product & Margins' : 'Add New Store Product'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Configure prices, calculate profit, manage gallery photos, and edit specifications.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-5 text-xs">
              {/* SECTION 1: BASIC INFORMATION */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  1. Basic Details
                </span>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Product Title</label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="e.g. Manual Stainless Steel Kitchen Chopper"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Brand</label>
                    <input
                      type="text"
                      required
                      value={productForm.brand}
                      onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Category</label>
                    <select
                      value={productForm.categoryId}
                      onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl capitalize font-medium"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Subcategory / Type</label>
                    <input
                      type="text"
                      value={productForm.subcategory}
                      onChange={(e) => setProductForm({ ...productForm, subcategory: e.target.value })}
                      placeholder="e.g. Kitchen Tools"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Store SKU</label>
                    <input
                      type="text"
                      value={productForm.sku}
                      onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Supplier SKU</label>
                    <input
                      type="text"
                      value={productForm.supplierSku}
                      onChange={(e) => setProductForm({ ...productForm, supplierSku: e.target.value })}
                      placeholder="e.g. 0065"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Stock Quantity</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={productForm.stockQuantity}
                      onChange={(e) => setProductForm({ ...productForm, stockQuantity: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Status</label>
                    <select
                      value={productForm.status}
                      onChange={(e) => setProductForm({ ...productForm, status: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    >
                      <option value="active">Active (Visible)</option>
                      <option value="draft">Draft (Hidden)</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: PROFIT & PRICING ENGINE */}
              <div className="p-4 bg-violet-50/60 rounded-2xl border border-violet-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-violet-900 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-violet-600" />
                    <span>2. Pricing & Profit Margin Calculator</span>
                  </span>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500 font-semibold">Preset:</span>
                    {[25, 35, 50, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleApplyMarginPreset(pct)}
                        className="px-2 py-0.5 bg-white hover:bg-violet-600 hover:text-white text-violet-700 font-bold text-[10px] rounded border border-violet-200 transition-colors cursor-pointer"
                      >
                        +{pct}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Source / Cost Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        required
                        min={1}
                        value={productForm.costPrice}
                        onChange={(e) => setProductForm({ ...productForm, costPrice: Number(e.target.value) })}
                        className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-bold font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-violet-900 block mb-1">My Selling Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-violet-600 font-bold">₹</span>
                      <input
                        type="number"
                        required
                        min={1}
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                        className="w-full pl-7 pr-3 py-2 bg-white border border-violet-400 ring-1 ring-violet-400/20 rounded-xl font-black font-mono text-violet-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">MRP / Compare Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        required
                        min={1}
                        value={productForm.originalPrice}
                        onChange={(e) => setProductForm({ ...productForm, originalPrice: Number(e.target.value) })}
                        className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-bold font-mono text-slate-500"
                      />
                    </div>
                  </div>
                </div>

                {(() => {
                  const cost = Number(productForm.costPrice) || 1;
                  const sell = Number(productForm.price) || 1;
                  const profit = sell - cost;
                  const marginPct = cost > 0 ? Math.round((profit / cost) * 100) : 0;

                  return (
                    <div className="bg-white p-3 rounded-xl border border-violet-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">Calculated Profit:</span>
                        <strong className="text-sm font-extrabold text-emerald-600 tabular-nums">
                          +{formatPrice(profit)}
                        </strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-500">Margin:</span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-black ${
                            marginPct >= 30
                              ? 'bg-emerald-100 text-emerald-800'
                              : marginPct > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {marginPct}% ROI
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* SECTION 3: IMAGE GALLERY MANAGEMENT */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  3. Product Images Gallery ({productForm.images.length} Photos)
                </span>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="Paste image URL (https://...)"
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddImage}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Photo</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {productForm.images.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className="group relative rounded-xl border border-slate-200 overflow-hidden bg-slate-100 aspect-square"
                    >
                      <img
                        src={imgUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />

                      {idx === 0 && (
                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-violet-600 text-white text-[9px] font-extrabold rounded-md shadow-xs">
                          Primary
                        </span>
                      )}

                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                        {idx !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryImage(idx)}
                            className="p-1 bg-white text-slate-800 rounded text-[10px] font-bold hover:bg-violet-50 hover:text-violet-700"
                            title="Set as primary"
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(idx)}
                          className="p-1 bg-rose-600 text-white rounded hover:bg-rose-700"
                          title="Delete image"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 4: DESCRIPTION & SPECS */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  4. Description & Specifications
                </span>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Short Spec Summary</label>
                  <input
                    type="text"
                    required
                    value={productForm.shortDescription}
                    onChange={(e) => setProductForm({ ...productForm, shortDescription: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Full Rich Description</label>
                  <textarea
                    rows={4}
                    required
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl leading-relaxed"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <label className="font-bold text-slate-700 block">Technical Specifications Table</label>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Spec Name (e.g. Material)"
                      value={newSpecKey}
                      onChange={(e) => setNewSpecKey(e.target.value)}
                      className="w-1/2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Value (e.g. Stainless Steel)"
                      value={newSpecValue}
                      onChange={(e) => setNewSpecValue(e.target.value)}
                      className="w-1/2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddSpec}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl shrink-0 cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>

                  <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                    {Object.entries(productForm.specifications).map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200/80 text-[11px]"
                      >
                        <span className="font-bold text-slate-700">{k}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">{v}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteSpec(k)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Homepage Placement Toggles */}
              <div className="flex flex-wrap items-center gap-5 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={productForm.isTrending}
                    onChange={(e) => setProductForm({ ...productForm, isTrending: e.target.checked })}
                    className="rounded accent-violet-600 w-4 h-4 cursor-pointer"
                  />
                  <span>Show in "Discover What's Trending"</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={productForm.isFeatured}
                    onChange={(e) => setProductForm({ ...productForm, isFeatured: e.target.checked })}
                    className="rounded accent-violet-600 w-4 h-4 cursor-pointer"
                  />
                  <span>Show in "Popular & Trending"</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={productForm.isNewArrival}
                    onChange={(e) => setProductForm({ ...productForm, isNewArrival: e.target.checked })}
                    className="rounded accent-violet-600 w-4 h-4 cursor-pointer"
                  />
                  <span>Show in "New Arrivals"</span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                {editingProduct ? (
                  <button
                    type="button"
                    onClick={() => {
                      deleteProduct(editingProduct.id);
                      setIsProductModalOpen(false);
                    }}
                    className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    Delete Product
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white font-extrabold rounded-xl shadow-md shadow-violet-500/20 transition-all cursor-pointer"
                  >
                    {editingProduct ? 'Save Changes' : 'Save & Publish Product'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE COUPON MODAL */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create Discount Coupon</h3>
              <button
                onClick={() => setIsCouponModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Coupon Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FLASH30"
                  value={newCouponCode}
                  onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Discount Type</label>
                  <select
                    value={newCouponType}
                    onChange={(e) => setNewCouponType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {newCouponType === 'percentage' ? 'Percent Off (%)' : 'Amount Off (₹)'}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newCouponVal}
                    onChange={(e) => setNewCouponVal(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Minimum Order Amount</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={newCouponMin}
                  onChange={(e) => setNewCouponMin(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCouponModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-md"
                >
                  Create Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
