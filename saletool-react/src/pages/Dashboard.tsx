import { useState, useEffect } from 'react';
import { FiPackage, FiTrendingUp, FiSearch, FiZap } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import AddProductForm, { ProductInput } from '../components/AddProductForm';
import AddDiscoveryForm, { DiscoveryInput } from '../components/AddDiscoveryForm';
import AddQuickLookupForm, { QuickLookupInput } from '../components/AddQuickLookupForm';
import ModeSelector from '../components/ModeSelector';
import ProductCard from '../components/ProductCard';
import DiscoveryCard from '../components/DiscoveryCard';
import QuickLookupCard from '../components/QuickLookupCard';
import Loader from '../components/Loader';
import DataSourceToggle, { DataSourceMode } from '../components/DataSourceToggle';
import VersionInfo from '../components/VersionInfo';
import Pagination from '../components/Pagination';
import { Product, AnalysisMode, DiscoveryProduct, QuickLookupProduct, AnyProduct } from '../types/product';
import { API_ENDPOINTS } from '../config/api';

interface DealFromDB {
  id: string;
  ean: string;
  productName: string | null;
  analysisMode?: string;  // 'DEAL', 'DISCOVERY', 'QUICK_LOOKUP'
  dataSourceMode?: string;  // 'live' or 'mock'
  quantity: number;
  buyPrice: number;
  currency: string;
  supplierRegion: string;
  dealScore: number;
  netMargin: number;
  demandConfidence: number;
  volumeRisk: number;
  dataReliability: number;
  decision: string;
  explanation: string | null;
  bestChannel: string | null;
  bestMarketplace: string | null;
  bestMarginPercent: number | null;
  bestCurrency: string | null;
  performanceMetrics?: Product['performanceMetrics'];
  evaluationData: {
    channelAnalysis?: Array<{
      demand?: {
        estimatedMonthlySales?: { low: number; mid: number; high: number };
        actualSalesSource?: string;
        methodology?: string;
        dataSource?: string;
        fetchedAt?: string | null;
      };
      landedCost?: Product['landedCost'];
    }>;
    allocation?: {
      allocated?: Record<string, number>;
      hold?: number;
      rationale?: string;
      channelDetails?: Record<string, string>;
    };
    negotiationSupport?: Product['negotiationSupport'];
    sourcingSuggestions?: Product['sourcingSuggestions'];
    compliance?: Product['compliance'];
    scoreBreakdown?: Product['scoreBreakdown'];
  };
  productData: Record<string, unknown> | null;
  marketData: Record<string, unknown> | null;
  assumptions: Record<string, unknown> | null;
  // Discovery mode specific fields
  priceByRegion?: Record<string, unknown>;
  highestPriceRegions?: unknown[];
  largestVolumeRegions?: unknown[];
  demandSignals?: {
    level?: string;
    signals?: string[];
    compositeScore?: number;
    sources?: Record<string, any>;
    marketsAnalyzed?: number;
    confidence?: string;
    indicators?: Record<string, any>;
  };
  marketsAnalyzed?: { amazon: number; ebay: number };  // Added by backend for Discovery mode
  // Quick Lookup mode specific fields
  currentPrice?: { price: number; currency: string; market: string };
  riskSnapshot?: { level?: string; flags?: string[] };
  analyzedAt?: string;
  // FX rates snapshot at analysis time (Discovery mode)
  fxRates?: {
    rates: Record<string, number>;
    baseCurrency: string;
    fetchedAt: string | null;
    source: string;
  };
}

function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<AnalysisMode | null>(null);
  const [products, setProducts] = useState<AnyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDeals, setIsLoadingDeals] = useState(true);
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>('mock');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 5;

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; mode?: string; name?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch saved deals when page changes
  useEffect(() => {
    fetchSavedDeals(currentPage);
  }, [currentPage]);

  const fetchSavedDeals = async (page: number = 1) => {
    setIsLoadingDeals(true);
    try {
      const offset = (page - 1) * itemsPerPage;
      const url = `${API_ENDPOINTS.DEALS}?limit=${itemsPerPage}&offset=${offset}&orderBy=analyzedAt&order=desc`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch deals: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Convert database deals to appropriate product format based on analysisMode
        const convertedProducts: AnyProduct[] = result.data.map((deal: DealFromDB) => {
          const mode = deal.analysisMode?.toLowerCase() || 'deal';

          // For Discovery mode, return DiscoveryProduct
          if (mode === 'discovery') {
            return {
              id: deal.id,
              ean: deal.ean || undefined,
              productName: deal.productName || undefined,
              analysisMode: 'discovery' as const,
              dataSourceMode: deal.dataSourceMode as 'live' | 'mock' | undefined,
              product: deal.productData as DiscoveryProduct['product'],
              priceByRegion: deal.priceByRegion || {},
              highestPriceRegions: (deal.highestPriceRegions || []) as DiscoveryProduct['highestPriceRegions'],
              largestVolumeRegions: (deal.largestVolumeRegions || []) as DiscoveryProduct['largestVolumeRegions'],
              demandSignals: (deal.demandSignals || { level: 'UNKNOWN', signals: [] }) as DiscoveryProduct['demandSignals'],
              marketsAnalyzed: deal.marketsAnalyzed || (deal.marketData as any)?.marketsAnalyzed,
              fxRates: deal.fxRates || (deal.marketData as any)?.fxRates,
              analyzedAt: deal.analyzedAt || new Date().toISOString(),
            } as DiscoveryProduct;
          }

          // For Quick Lookup mode, return QuickLookupProduct
          if (mode === 'quick_lookup' || mode === 'quicklookup') {
            const rawDemand = deal.demandSignals as any;
            const demandData = typeof rawDemand === 'string' ? JSON.parse(rawDemand) : rawDemand;

            return {
              id: deal.id,
              ean: deal.ean || '',
              productName: deal.productName || undefined,
              analysisMode: 'quickLookup' as const,
              dataSourceMode: deal.dataSourceMode as 'live' | 'mock' | undefined,
              product: deal.productData as QuickLookupProduct['product'],
              currentPrice: (deal.currentPrice || { price: 0, currency: 'USD', market: 'Unknown', channel: '', marketplace: '' }) as QuickLookupProduct['currentPrice'],
              pricesByChannel: deal.priceByRegion || {},  // Restore market prices
              demand: {
                level: (demandData?.level || 'UNKNOWN').toUpperCase(),
                confidence: demandData?.confidence || 'NONE',
                indicators: demandData?.indicators || {},
                compositeScore: demandData?.compositeScore || demandData?.score, // Handle both naming conventions
                sources: demandData?.sources,
                marketsAnalyzed: demandData?.marketsAnalyzed || demandData?.totalMarkets,
              } as QuickLookupProduct['demand'],
              riskSnapshot: (deal.riskSnapshot || { level: 'UNKNOWN', flags: [] }) as QuickLookupProduct['riskSnapshot'],
              fxRates: deal.fxRates || (deal.marketData as any)?.fxRates,
              analyzedAt: deal.analyzedAt || new Date().toISOString(),
            } as QuickLookupProduct;
          }

          // For Deal mode (default), return Product
          const evaluation = deal.evaluationData || {};
          const channelAnalysis = evaluation.channelAnalysis || [];
          const firstChannel = channelAnalysis[0] || {};

          return {
            id: deal.id,
            ean: deal.ean,
            productName: deal.productName || `Product ${deal.ean}`,
            analysisMode: 'deal' as const,  // Tag as Deal mode
            dataSourceMode: deal.dataSourceMode as 'live' | 'mock' | undefined,
            // Basic input fields
            quantity: deal.quantity,
            buy_price: deal.buyPrice,
            currency: deal.currency,
            supplier_region: deal.supplierRegion,
            deal_quality_score: deal.dealScore,
            net_margin: deal.netMargin,
            demand_confidence: deal.demandConfidence,
            volume_risk: 100 - deal.volumeRisk,
            data_reliability: deal.dataReliability,
            scoreBreakdown: evaluation.scoreBreakdown,
            decision: deal.decision as Product['decision'],
            explanation: deal.explanation || '',
            bestChannel: deal.bestChannel ? {
              channel: deal.bestChannel,
              marketplace: deal.bestMarketplace || '',
              marginPercent: deal.bestMarginPercent || 0,
              currency: deal.bestCurrency || 'USD',
            } : undefined,
            channels: channelAnalysis,
            monthlySales: firstChannel.demand?.estimatedMonthlySales ? {
              low: firstChannel.demand.estimatedMonthlySales.low || 0,
              mid: firstChannel.demand.estimatedMonthlySales.mid || 0,
              high: firstChannel.demand.estimatedMonthlySales.high || 0,
              source: firstChannel.demand.actualSalesSource || firstChannel.demand.methodology || 'Estimated',
              actualSalesSource: firstChannel.demand.actualSalesSource,
              dataSource: firstChannel.demand.dataSource,
              fetchedAt: firstChannel.demand.fetchedAt,
              methodology: firstChannel.demand.methodology,
            } : undefined,
            allocation: evaluation.allocation ? {
              allocated: evaluation.allocation.allocated || {},
              hold: evaluation.allocation.hold || 0,
              rationale: evaluation.allocation.rationale,
              channelDetails: evaluation.allocation.channelDetails || {},
            } : undefined,
            landedCost: firstChannel.landedCost ? (() => {
              const lc = firstChannel.landedCost;
              const dutyValue = typeof lc.duty === 'number'
                ? lc.duty
                : (typeof lc.duty === 'object' && lc.duty !== null && 'cost' in lc.duty
                  ? (lc.duty as { cost: number }).cost
                  : 0);
              const shippingValue = typeof lc.shipping === 'number'
                ? lc.shipping
                : (typeof lc.shipping === 'object' && lc.shipping !== null && 'cost' in lc.shipping
                  ? (lc.shipping as { cost: number }).cost
                  : 0);
              return {
                buyPrice: lc.buyPrice || 0,
                duty: dutyValue,
                shipping: shippingValue,
                importVat: lc.importVat || 0,
                importVatRate: lc.importVatRate || 0,
                reclaimVat: lc.reclaimVat ?? true,
                total: lc.total || 0
              };
            })() : undefined,
            negotiationSupport: evaluation.negotiationSupport,
            sourcingSuggestions: evaluation.sourcingSuggestions,
            compliance: evaluation.compliance,
            // Include assumptions with history
            assumptions: deal.assumptions as Product['assumptions'],
            // Include performance metrics
            performanceMetrics: deal.performanceMetrics,
            // Store supplierRegion for use in EditAssumptionsModal
            supplierRegion: deal.supplierRegion || 'CN',
          } as Product & { supplierRegion?: string };
        });

        setProducts(convertedProducts);
        // Update total count from backend response
        if (result.total !== undefined) {
          setTotalCount(result.total);
        }
      }
    } catch (error) {
      console.error('Error fetching saved deals:', error);
      // Don't show error to user - just start with empty list
    } finally {
      setIsLoadingDeals(false);
    }
  };

  // Show delete confirmation dialog
  const handleDeleteProduct = async (dealId: string, analysisMode?: string, productName?: string) => {
    if (!dealId) {
      toast.error('Deal ID is required');
      return;
    }

    setDeleteTarget({ id: dealId, mode: analysisMode, name: productName });
    setDeleteDialogOpen(true);
  };

  // Perform the actual delete
  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      // Determine the correct delete endpoint based on analysisMode
      const mode = deleteTarget.mode?.toLowerCase() || 'deal';
      let deleteUrl: string;

      if (mode === 'discovery') {
        deleteUrl = API_ENDPOINTS.DISCOVERY_DELETE(deleteTarget.id);
      } else if (mode === 'quick_lookup' || mode === 'quicklookup') {
        deleteUrl = API_ENDPOINTS.QUICKLOOKUP_DELETE(deleteTarget.id);
      } else {
        deleteUrl = API_ENDPOINTS.DEAL_DELETE(deleteTarget.id);
      }

      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete: ${response.statusText}`);
      }

      // Remove from local state
      const updatedProducts = products.filter(p => p.id !== deleteTarget.id);
      setProducts(updatedProducts);

      // Update total count
      setTotalCount(prev => Math.max(0, prev - 1));

      // Adjust page if current page becomes empty
      const newTotalPages = Math.ceil((totalCount - 1) / itemsPerPage);
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      } else if (updatedProducts.length === 0 && currentPage > 1) {
        // If current page is empty and not on page 1, go to previous page
        setCurrentPage(prev => Math.max(1, prev - 1));
      } else {
        // Refresh current page to get updated data
        fetchSavedDeals(currentPage);
      }

      toast.success('Product deleted successfully');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete product');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const handleAddProduct = async (data: ProductInput) => {
    setIsLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.ANALYZE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ean: data.ean,
          hsCode: data.hsCode || null,  // Send HS code for accurate duty calculation
          quantity: data.quantity,
          buyPrice: data.buy_price,
          currency: data.currency,
          supplierRegion: data.supplier_region || 'CN',
          reclaimVat: data.reclaimVat ?? true,
          assumptionOverrides: data.assumptionOverrides || null,
          dataSourceMode: dataSourceMode, // Send data source mode from frontend
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `API Error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      console.log('Deal analysis result:', result);

      if (result.data?.evaluation) {
        // Update total count
        setTotalCount(prev => prev + 1);
        // Reset to page 1 to show the newly added product
        setCurrentPage(1);
        // Always fetch page 1 to show the new product immediately
        // This ensures it works even if we're already on page 1 (useEffect won't trigger)
        await fetchSavedDeals(1);
      } else {
        console.error('No evaluation data in response');
      }

      return result.data || result;
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Discovery mode analysis
  const handleAddDiscovery = async (data: DiscoveryInput) => {
    setIsLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.DISCOVERY_ANALYZE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ean: data.ean,
          productName: data.productName,
          searchType: data.searchType,  // 'ean' or 'keyword'
          dataSourceMode
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setTotalCount(prev => prev + 1);
        setCurrentPage(1);
        await fetchSavedDeals(1);
      }
      return result.data;
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Quick Lookup mode analysis
  const handleAddQuickLookup = async (data: QuickLookupInput) => {
    setIsLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.QUICKLOOKUP_ANALYZE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ean: data.ean,
          dataSourceMode
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setTotalCount(prev => prev + 1);
        setCurrentPage(1);
        await fetchSavedDeals(1);
      }
      return result.data;
    } finally {
      setIsLoading(false);
    }
  };

  // Handle mode selection from ModeSelector
  const handleModeSelect = (mode: AnalysisMode) => {
    setSelectedMode(mode);
    setIsModalOpen(true);
  };

  // Close modal and reset mode
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMode(null);
  };

  // Get modal title based on selected mode
  const getModalTitle = () => {
    switch (selectedMode) {
      case 'deal': return 'Add New Product - Deal Analysis';
      case 'discovery': return 'Add New Product - Discovery Mode';
      case 'quickLookup': return 'Add New Product - Quick Lookup';
      default: return 'Add New Product';
    }
  };

  // Render the correct card based on product's analysisMode
  const renderProductCard = (product: AnyProduct, index: number) => {
    // Check analysisMode from database
    const mode = (product as any).analysisMode?.toLowerCase?.() || 'deal';
    const productName = (product as any).productName || (product as any).product?.title || 'Unknown Product';

    if (mode === 'discovery') {
      return (
        <DiscoveryCard
          key={product.id || `discovery-${index}`}
          product={product as DiscoveryProduct}
          onDelete={product.id ? () => handleDeleteProduct(product.id!, 'discovery', productName) : undefined}
        />
      );
    }

    if (mode === 'quick_lookup' || mode === 'quicklookup') {
      return (
        <QuickLookupCard
          key={product.id || `quicklookup-${index}`}
          product={product as QuickLookupProduct}
          onDelete={product.id ? () => handleDeleteProduct(product.id!, 'quick_lookup', productName) : undefined}
        />
      );
    }

    // Default: Deal mode (and backwards compatibility for existing products)
    return (
      <ProductCard
        key={product.id || `${(product as Product).ean}-${index}`}
        product={product as Product}
        onDelete={product.id ? () => handleDeleteProduct(product.id!, 'deal', productName) : undefined}
        onUpdate={() => fetchSavedDeals(currentPage)}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Full-screen Loader */}
      {isLoading && (
        <Loader
          message="Analyzing Deal..."
          subMessage="Fetching prices from Amazon & eBay, calculating fees, duties, and shipping..."
          steps={[
            'Fetching product data...',
            'Analyzing market prices...',
            'Calculating margins...',
            'Generating allocation plan...'
          ]}
        />
      )}
      {isLoadingDeals && !isLoading && (
        <Loader
          message="Loading Products..."
          subMessage="Fetching your saved deals from the database..."
          steps={[
            'Loading saved deals...',
            'Preparing dashboard...'
          ]}
        />
      )}

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Sales Dashboard</h1>
            <div className="flex items-center gap-3 sm:gap-4">
              <DataSourceToggle
                mode={dataSourceMode}
                onChange={setDataSourceMode}
              />
              <ModeSelector
                onSelectMode={handleModeSelect}
                buttonClassName="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-sm sm:text-base"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Products</h2>
              <span className="text-sm text-gray-400">
                {totalCount} {totalCount === 1 ? 'item' : 'items'}
              </span>
            </div>
          </div>

          {products.length === 0 && !isLoading && !isLoadingDeals ? (
            <div className="p-8 sm:p-12">
              <div className="text-center">
                <div className="inline-flex p-4 bg-gray-700/30 rounded-xl border border-gray-600/30 mb-4">
                  <FiPackage size={40} className="text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-300 mb-1">
                  No products yet
                </h3>
                <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto">
                  Get started by selecting an mode below
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-3xl mx-auto">
                  <button
                    onClick={() => handleModeSelect('deal')}
                    className="w-full sm:w-auto flex items-center gap-3 pr-5 pl-3 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/20 transition-all group"
                  >
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                      <FiTrendingUp size={20} />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white text-sm">Deal Analysis</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider">Full Eval</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleModeSelect('discovery')}
                    className="w-full sm:w-auto flex items-center gap-3 pr-9 pl-3 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/20 transition-all group"
                  >
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform">
                      <FiSearch size={20} />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white text-sm">Discovery</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider">Research</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleModeSelect('quickLookup')}
                    className="w-full sm:w-auto flex items-center gap-3 pr-5 pl-3 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/20 transition-all group"
                  >
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform">
                      <FiZap size={20} />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white text-sm">Quick Lookup</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider">Fast Snap</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="p-6">
                <div className="space-y-6">
                  {products.map((product, index) => renderProductCard(product, index))}
                </div>
              </div>

              {totalCount > itemsPerPage && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(totalCount / itemsPerPage)}
                  totalItems={totalCount}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Add Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={getModalTitle()}
      >
        {selectedMode === 'deal' && (
          <AddProductForm
            onSubmit={handleAddProduct}
            onClose={handleCloseModal}
            onLoadingStart={() => setIsLoading(true)}
          />
        )}
        {selectedMode === 'discovery' && (
          <AddDiscoveryForm
            onSubmit={handleAddDiscovery}
            onClose={handleCloseModal}
            onLoadingStart={() => setIsLoading(true)}
          />
        )}
        {selectedMode === 'quickLookup' && (
          <AddQuickLookupForm
            onSubmit={handleAddQuickLookup}
            onClose={handleCloseModal}
            onLoadingStart={() => setIsLoading(true)}
          />
        )}
      </Modal>
      {/* Footer with version info */}
      <footer className="bg-gray-800 border-t border-gray-700 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <VersionInfo />
            <span className="text-xs text-gray-500">
              Sales Analytic Tool
            </span>
          </div>
        </div>
      </footer>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name || 'this product'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

export default Dashboard;
