import { useState } from 'react';
import { FiPlus, FiPackage } from 'react-icons/fi';
import Modal from '../components/Modal';
import AddProductForm, { ProductInput } from '../components/AddProductForm';
import Button from '../components/Button';
import ProductCard from '../components/ProductCard';
import { Product } from '../types/product';
import { API_ENDPOINTS } from '../config/api';

// Static products data - will be replaced with API call in future
const STATIC_PRODUCTS: Product[] = [
  {
    ean: '45496395230',
    deal_quality_score: 85,
    net_margin: 22,
    demand_confidence: 90,
    volume_risk: 15,
    data_reliability: 95,
    decision: 'Buy',
    explanation: 'Strong margins with high demand confidence and reliable data. Low volume risk makes this an excellent opportunity to proceed with the purchase.',
  },
  {
    ean: '78912345678',
    deal_quality_score: 65,
    net_margin: 18,
    demand_confidence: 70,
    volume_risk: 25,
    data_reliability: 80,
    decision: 'Renegotiate',
    explanation: 'Moderate margins and demand confidence, but volume risk is elevated. Consider negotiating better terms to improve profitability before committing.',
  },
  {
    ean: '12345678901',
    deal_quality_score: 45,
    net_margin: 12,
    demand_confidence: 55,
    volume_risk: 40,
    data_reliability: 70,
    decision: 'Source Elsewhere',
    explanation: 'Low margins combined with moderate demand confidence and high volume risk. Better alternatives likely available in the market with improved terms.',
  },
  {
    ean: '98765432109',
    deal_quality_score: 92,
    net_margin: 28,
    demand_confidence: 95,
    volume_risk: 10,
    data_reliability: 98,
    decision: 'Buy',
    explanation: 'Exceptional deal quality with outstanding margins, high demand confidence, minimal volume risk, and highly reliable data. Strong recommendation to proceed immediately.',
  },
  {
    ean: '45678901234',
    deal_quality_score: 35,
    net_margin: 8,
    demand_confidence: 45,
    volume_risk: 50,
    data_reliability: 60,
    decision: 'Pass',
    explanation: 'Poor margins, low demand confidence, high volume risk, and questionable data reliability. This deal does not meet our quality standards and should be declined.',
  },
];

function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>(STATIC_PRODUCTS);

  const handleAddProduct = async (data: ProductInput) => {
    const response = await fetch(API_ENDPOINTS.PRODUCTS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `API Error: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    // The backend returns { success: true, message: '...', data: {...} }
    // For now, we'll just log it since the backend console logs the payload
    console.log('Product submitted successfully:', result);
    
    // Note: The backend currently just logs the data, so we won't add it to the products list
    // In the future when the backend returns the created product, we can add it here
    return result.data || result;
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

          {products.length === 0 ? (
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
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
