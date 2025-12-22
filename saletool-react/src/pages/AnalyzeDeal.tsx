import { useState } from 'react';
import { FiTrendingUp, FiDollarSign, FiPackage, FiAlertCircle } from 'react-icons/fi';
import Button from '../components/Button';
import Input from '../components/Input';
import { API_ENDPOINTS } from '../config/api';
import toast from 'react-hot-toast';

interface DealAnalysisInput {
  ean: string;
  quantity: number;
  buyPrice: number;
  currency: string;
}

interface ChannelAnalysis {
  channel: string;
  marketplace: string;
  sellPrice: number;
  currency: string;
  netProceeds: number;
  netMargin: number;
  marginPercent: number;
  recommendation: string;
  monthsToSell: number;
}

interface DealResult {
  dealScore: number;
  decision: string;
  explanation: string;
  bestChannel: {
    channel: string;
    marketplace: string;
    marginPercent: number;
    netProceeds: number;
    currency: string;
  };
  channelAnalysis: ChannelAnalysis[];
  allocation: {
    totalQuantity: number;
    allocated: Record<string, number>;
    hold: number;
    rationale: string;
  };
}

function AnalyzeDeal() {
  const [formData, setFormData] = useState<DealAnalysisInput>({
    ean: '',
    quantity: 100,
    buyPrice: 50,
    currency: 'USD',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DealResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(API_ENDPOINTS.ANALYZE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze deal');
      }

      const data = await response.json();
      setResult(data.data.evaluation);
      toast.success('Deal analyzed successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to analyze deal');
    } finally {
      setLoading(false);
    }
  };

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'Buy':
        return 'text-green-400 bg-green-900/30 border-green-700';
      case 'Renegotiate':
        return 'text-yellow-400 bg-yellow-900/30 border-yellow-700';
      case 'Source Elsewhere':
        return 'text-orange-400 bg-orange-900/30 border-orange-700';
      default:
        return 'text-red-400 bg-red-900/30 border-red-700';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-400';
    if (score >= 55) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-white">Deal Analysis</h1>
          <p className="text-gray-400 text-sm mt-1">
            Analyze deals across Amazon & eBay channels
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Input Form */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-6">Product Details</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <Input
                label="EAN / GTIN"
                type="text"
                value={formData.ean}
                onChange={(e) => setFormData({ ...formData, ean: e.target.value })}
                placeholder="e.g. 0045496395230"
                required
              />
            </div>
            <Input
              label="Quantity"
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
              required
              min="1"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Buy Price"
                type="number"
                step="0.01"
                value={formData.buyPrice}
                onChange={(e) => setFormData({ ...formData, buyPrice: parseFloat(e.target.value) })}
                required
                min="0.01"
              />
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-700 text-white rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
            <div className="md:col-span-2">
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Analyzing...' : 'Analyze Deal'}
              </Button>
            </div>
          </form>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <FiTrendingUp className="text-blue-400" size={24} />
                  <span className={`text-3xl font-bold ${getScoreColor(result.dealScore)}`}>
                    {result.dealScore}%
                  </span>
                </div>
                <p className="text-gray-400 text-sm">Deal Score</p>
              </div>

              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="mb-2">
                  <FiAlertCircle className="text-purple-400" size={24} />
                </div>
                <p className={`text-lg font-bold inline-flex px-3 py-1 rounded-full border ${getDecisionColor(result.decision)}`}>
                  {result.decision}
                </p>
                <p className="text-gray-400 text-sm mt-2">Decision</p>
              </div>

              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="mb-2">
                  <FiDollarSign className="text-green-400" size={24} />
                </div>
                <p className="text-2xl font-bold text-white">
                  {result.bestChannel.marginPercent.toFixed(1)}%
                </p>
                <p className="text-gray-400 text-sm">Best Margin</p>
              </div>

              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="mb-2">
                  <FiPackage className="text-orange-400" size={24} />
                </div>
                <p className="text-2xl font-bold text-white">
                  {result.bestChannel.channel}-{result.bestChannel.marketplace}
                </p>
                <p className="text-gray-400 text-sm">Best Channel</p>
              </div>
            </div>

            {/* Explanation */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-3">Explanation</h3>
              <p className="text-gray-300">{result.explanation}</p>
            </div>

            {/* Channel Breakdown */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Channel Analysis</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Channel
                </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Sell Price
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Net Proceeds
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Margin %
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Months to Sell
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Recommendation
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {result.channelAnalysis.map((channel, idx) => (
                      <tr key={idx} className="hover:bg-gray-700/30">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                          {channel.channel}-{channel.marketplace}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">
                          {channel.currency} {channel.sellPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">
                          {channel.currency} {channel.netProceeds.toFixed(2)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${channel.marginPercent > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {channel.marginPercent.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">
                          {channel.monthsToSell.toFixed(1)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${channel.recommendation === 'Sell' ? 'bg-green-900/30 text-green-400 border border-green-700' : 'bg-red-900/30 text-red-400 border border-red-700'}`}>
                            {channel.recommendation}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Allocation */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Allocation Strategy</h3>
              <div className="space-y-3">
                {Object.entries(result.allocation.allocated).map(([channel, qty]) => (
                  <div key={channel} className="flex items-center justify-between">
                    <span className="text-gray-300">{channel}</span>
                    <span className="text-white font-semibold">{qty} units</span>
                  </div>
                ))}
                {result.allocation.hold > 0 && (
                  <div className="flex items-center justify-between border-t border-gray-700 pt-3">
                    <span className="text-gray-300">Hold</span>
                    <span className="text-yellow-400 font-semibold">{result.allocation.hold} units</span>
                  </div>
                )}
              </div>
              <p className="text-gray-400 text-sm mt-4 italic">{result.allocation.rationale}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AnalyzeDeal;
