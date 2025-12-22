import { FiHash, FiTrendingUp, FiCheckCircle, FiXCircle, FiAlertCircle, FiRefreshCw, FiShoppingCart, FiDollarSign, FiPackage } from 'react-icons/fi';
import { Product } from '../types/product';

interface ProductCardProps {
  product: Product;
}

const getDecisionConfig = (decision: Product['decision']) => {
  switch (decision) {
    case 'Buy':
      return {
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/20',
        textColor: 'text-green-400',
        icon: FiCheckCircle,
      };
    case 'Renegotiate':
      return {
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/20',
        textColor: 'text-yellow-400',
        icon: FiRefreshCw,
      };
    case 'Source Elsewhere':
      return {
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/20',
        textColor: 'text-orange-400',
        icon: FiAlertCircle,
      };
    case 'Pass':
      return {
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/20',
        textColor: 'text-red-400',
        icon: FiXCircle,
      };
  }
};

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
};

function ProductCard({ product }: ProductCardProps) {
  const decisionConfig = getDecisionConfig(product.decision);
  const DecisionIcon = decisionConfig.icon;

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
      {/* Header with Product Name and EAN */}
      <div className="mb-6 pb-4 border-b border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-2">
          {product.productName || `Product ${product.ean}`}
        </h2>
        <div className="flex items-center gap-2">
          <FiHash className="text-blue-400" size={14} />
          <span className="text-gray-400 text-sm">EAN: {product.ean}</span>
        </div>
      </div>

      {/* Main Content - Horizontal Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Score & Decision */}
        <div className="space-y-4">
          {/* Deal Quality Score */}
          <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
            <div className="flex items-center gap-2 mb-2">
              <FiTrendingUp className="text-purple-400" size={16} />
              <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Deal Score</span>
            </div>
            <div className={`text-4xl font-bold ${getScoreColor(product.deal_quality_score)}`}>
              {product.deal_quality_score}%
            </div>
          </div>

          {/* Decision */}
          <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
            <div className="flex items-center gap-2 mb-3">
              <DecisionIcon className={decisionConfig.textColor} size={16} />
              <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Decision</span>
            </div>
            <div className={`inline-flex items-center gap-2 px-4 py-2 ${decisionConfig.bgColor} border ${decisionConfig.borderColor} rounded-lg`}>
              <DecisionIcon className={decisionConfig.textColor} size={18} />
              <span className={`text-lg font-bold ${decisionConfig.textColor}`}>
                {product.decision}
              </span>
            </div>
          </div>

          {/* Best Channel */}
          {product.bestChannel && (
            <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg p-4 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <FiShoppingCart className="text-green-400" size={16} />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Best Channel</span>
              </div>
              <div className="text-xl font-bold text-white mb-1">
                {product.bestChannel.channel}-{product.bestChannel.marketplace}
              </div>
              <div className="text-3xl font-bold text-green-400">
                {product.bestChannel.marginPercent.toFixed(1)}%
              </div>
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-700/20 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Net Margin</div>
              <div className="text-lg font-bold text-white">{product.net_margin.toFixed(1)}%</div>
            </div>
            <div className="bg-gray-700/20 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Demand</div>
              <div className="text-lg font-bold text-white">{product.demand_confidence}%</div>
            </div>
            <div className="bg-gray-700/20 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Risk</div>
              <div className="text-lg font-bold text-white">{product.volume_risk}%</div>
            </div>
            <div className="bg-gray-700/20 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Reliability</div>
              <div className="text-lg font-bold text-white">{product.data_reliability}%</div>
            </div>
          </div>

          {/* Landed Cost Breakdown */}
          {product.landedCost && (
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg p-4 border border-amber-500/20 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <FiDollarSign className="text-amber-400" size={16} />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Landed Cost</span>
              </div>
              <div className="text-2xl font-bold text-white mb-2">
                ${product.landedCost.total.toFixed(2)}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Buy Price</span>
                  <span className="text-white">${product.landedCost.buyPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Duty</span>
                  <span className="text-white">${product.landedCost.duty.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Shipping</span>
                  <span className="text-white">${product.landedCost.shipping.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Middle Column - Channel Breakdown */}
        <div className="space-y-4">
          <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
            <div className="flex items-center gap-2 mb-4">
              <FiDollarSign className="text-blue-400" size={16} />
              <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                All Channels ({product.channels?.length || 0})
              </span>
            </div>
            
            {product.channels && product.channels.length > 0 ? (
              <div className="space-y-2">
                {product.channels.map((channel, idx) => (
                  <div key={idx} className="bg-gray-700/50 rounded-lg p-3 border border-gray-600/20">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-white text-sm">
                          {channel.channel}-{channel.marketplace}
                        </div>
                        <div className="text-xs text-gray-400">
                          Sell: {channel.currency} {channel.sellPrice.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">
                          Net: {channel.currency} {channel.netProceeds.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-bold ${channel.marginPercent > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {channel.marginPercent.toFixed(1)}%
                        </div>
                        <div className={`text-xs px-2 py-0.5 rounded-full mt-1 ${channel.recommendation === 'Sell' ? 'bg-green-900/30 text-green-400 border border-green-700' : 'bg-red-900/30 text-red-400 border border-red-700'}`}>
                          {channel.recommendation}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">No channel data available</div>
            )}
          </div>
        </div>

        {/* Right Column - Allocation & Explanation */}
        <div className="space-y-4">
          {/* Allocation */}
          {product.allocation && Object.keys(product.allocation.allocated).length > 0 && (
            <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
              <div className="flex items-center gap-2 mb-4">
                <FiPackage className="text-orange-400" size={16} />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                  Allocation Plan
                </span>
              </div>
              <div className="space-y-2">
                {Object.entries(product.allocation.allocated).map(([channel, qty]) => (
                  <div key={channel} className="flex justify-between items-center bg-gray-700/50 rounded p-2">
                    <span className="text-sm text-gray-300">{channel}</span>
                    <span className="text-sm text-white font-bold">{qty} units</span>
                  </div>
                ))}
                {product.allocation.hold > 0 && (
                  <div className="flex justify-between items-center bg-yellow-900/20 border border-yellow-700/30 rounded p-2">
                    <span className="text-sm text-yellow-400 font-semibold">Hold</span>
                    <span className="text-sm text-yellow-400 font-bold">{product.allocation.hold} units</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Explanation */}
          <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
            <div className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-3">Analysis</div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {product.explanation}
            </p>
          </div>

          {/* Negotiation Support - for Renegotiate decision */}
          {product.negotiationSupport && (
            <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-lg p-4 border border-yellow-500/20">
              <div className="flex items-center gap-2 mb-3">
                <FiRefreshCw className="text-yellow-400" size={16} />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Negotiation Support</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">Current</div>
                  <div className="text-lg font-bold text-white">
                    ${product.negotiationSupport.currentBuyPrice}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-green-400 mb-1">Target</div>
                  <div className="text-lg font-bold text-green-400">
                    ${product.negotiationSupport.targetBuyPrice}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-red-400 mb-1">Walk-Away</div>
                  <div className="text-lg font-bold text-red-400">
                    ${product.negotiationSupport.walkAwayPrice}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-300 italic">
                {product.negotiationSupport.message}
              </p>
            </div>
          )}

          {/* Sourcing Suggestions - for Source Elsewhere decision */}
          {product.sourcingSuggestions && (
            <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg p-4 border border-orange-500/20">
              <div className="flex items-center gap-2 mb-3">
                <FiAlertCircle className="text-orange-400" size={16} />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Alternative Sourcing</span>
              </div>
              <div className="space-y-3">
                <div className="bg-gray-700/50 rounded p-2">
                  <div className="text-xs text-gray-400 mb-1">Target Buy Price</div>
                  <div className="text-lg font-bold text-green-400">
                    ${product.sourcingSuggestions.targetBuyPrice}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-2">Alternative Regions:</div>
                  <div className="space-y-1">
                    {product.sourcingSuggestions.alternatives.map((alt, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-gray-700/50 rounded p-2">
                        <span className="text-sm font-medium text-white">{alt.region} - {alt.name}</span>
                        <span className="text-xs text-gray-400">{alt.pros}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-2">Supplier Types:</div>
                  <div className="space-y-1">
                    {product.sourcingSuggestions.supplierTypes.map((s, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-gray-300">{s.type}</span>
                        <span className="text-green-400 font-medium">{s.estimatedSavings}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
