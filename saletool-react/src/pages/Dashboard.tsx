import { useState } from 'react';
import { FiPlus, FiPackage, FiLoader } from 'react-icons/fi';
import Modal from '../components/Modal';
import AddProductForm, { ProductInput } from '../components/AddProductForm';
import Button from '../components/Button';
import ProductCard from '../components/ProductCard';
import { Product } from '../types/product';
import { API_ENDPOINTS } from '../config/api';

function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
        const ev = result.data.evaluation;
        const prod = result.data.product;
        
        // Get landed cost from first channel
        const firstChannel = ev.channelAnalysis?.[0];
        const landedCost = firstChannel?.landedCost || undefined;
        
        const newProduct: Product = {
          ean: data.ean,
          productName: prod?.title || ev.productTitle || `Product ${data.ean}`,
          deal_quality_score: ev.dealScore,
          net_margin: ev.bestChannel.marginPercent,
          demand_confidence: ev.scoreBreakdown.demandConfidenceScore,
          volume_risk: 100 - ev.scoreBreakdown.volumeRiskScore,
          data_reliability: ev.scoreBreakdown.dataReliabilityScore,
          decision: ev.decision,
          explanation: ev.explanation,
          bestChannel: {
            channel: ev.bestChannel.channel,
            marketplace: ev.bestChannel.marketplace,
            marginPercent: ev.bestChannel.marginPercent,
            currency: ev.bestChannel.currency,
          },
          channels: ev.channelAnalysis || [],
          allocation: ev.allocation ? {
            allocated: ev.allocation.allocated,
            hold: ev.allocation.hold,
          } : undefined,
          landedCost,
          negotiationSupport: ev.negotiationSupport || undefined,
          sourcingSuggestions: ev.sourcingSuggestions || undefined,
        };
        setProducts([newProduct, ...products]);
      } else {
        console.error('No evaluation data in response');
      }
      
      return result.data || result;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Sales Dashboard</h1>
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
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Products</h2>
              <span className="text-sm text-gray-400">
                {products.length} {products.length === 1 ? 'item' : 'items'}
              </span>
            </div>
          </div>

          {products.length === 0 && !isLoading ? (
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
          ) : isLoading ? (
            <div className="p-12">
              <div className="text-center py-16">
                <div className="inline-flex p-6 bg-blue-500/10 rounded-2xl border border-blue-500/50 mb-6">
                  <FiLoader size={56} className="text-blue-400 animate-spin" />
                </div>
                <h3 className="text-xl font-semibold text-gray-300 mb-2">
                  Analyzing Deal...
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Fetching prices from Amazon & eBay, calculating fees, duties, and shipping...
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-6">
                {products.map((product, index) => (
                  <ProductCard key={`${product.ean}-${index}`} product={product} />
                ))}
              </div>
            </div>
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
        />
      </Modal>
    </div>
  );
}

export default Dashboard;
