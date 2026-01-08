import { useState, useEffect } from 'react';
import { FiPlus, FiPackage } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import AddProductForm, { ProductInput } from '../components/AddProductForm';
import Button from '../components/Button';
import ProductCard from '../components/ProductCard';
import Loader from '../components/Loader';
import DataSourceToggle, { DataSourceMode } from '../components/DataSourceToggle';
import VersionInfo from '../components/VersionInfo';
import Pagination from '../components/Pagination';
import { Product } from '../types/product';
import { API_ENDPOINTS } from '../config/api';

interface DealFromDB {
  id: string;
  ean: string;
  productName: string | null;
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
  };
  productData: Record<string, unknown> | null;
  marketData: Record<string, unknown> | null;
  assumptions: Record<string, unknown> | null;
}

function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDeals, setIsLoadingDeals] = useState(true);
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>('mock');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 5;

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
        // Convert database deals to Product format
        const convertedProducts: Product[] = result.data.map((deal: DealFromDB) => {
          const evaluation = deal.evaluationData || {};
          const channelAnalysis = evaluation.channelAnalysis || [];
          const firstChannel = channelAnalysis[0] || {};
          
          return {
            id: deal.id,
            ean: deal.ean,
            productName: deal.productName || `Product ${deal.ean}`,
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

  const handleDeleteProduct = async (dealId: string) => {
    if (!dealId) {
      toast.error('Deal ID is required');
      return;
    }

    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.DEAL_DELETE(dealId), {
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
      const updatedProducts = products.filter(p => p.id !== dealId);
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
          quantity: data.quantity,
          buyPrice: data.buy_price,
          currency: data.currency,
          supplierRegion: data.supplier_region || 'CN',
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
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Sales Dashboard</h1>
            <div className="flex items-center gap-4">
              <DataSourceToggle 
                mode={dataSourceMode}
                onChange={setDataSourceMode}
              />
              <Button
                variant="primary"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 text-white"
              >
                <FiPlus size={18} />
                Add Product
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-10">
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
            <div className="p-12">
              <div className="text-center py-16">
                <div className="inline-flex p-6 bg-gray-700/50 rounded-2xl border border-gray-600/50 mb-6">
                  <FiPackage size={56} className="text-gray-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-300 mb-2">
                  No products yet
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Get started by adding your first product to the inventory
                </p>
                <Button
                  variant="primary"
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2"
                >
                  <FiPlus size={18} />
                  Add Your First Product
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-6">
                <div className="space-y-6">
                  {products.map((product, index) => (
                    <ProductCard 
                      key={product.id || `${product.ean}-${index}`} 
                      product={product}
                      onDelete={product.id ? () => handleDeleteProduct(product.id!) : undefined}
                      onUpdate={() => fetchSavedDeals(currentPage)}
                    />
                  ))}
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
        onClose={() => setIsModalOpen(false)}
        title="Add New Product"
      >
        <AddProductForm
          onSubmit={handleAddProduct}
          onClose={() => setIsModalOpen(false)}
          onLoadingStart={() => setIsLoading(true)}
        />
      </Modal>
      {/* Footer with version info */}
      <footer className="bg-gray-800 border-t border-gray-700 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <VersionInfo />
            <span className="text-xs text-gray-500">
              Sales Analytic Tool
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Dashboard;
