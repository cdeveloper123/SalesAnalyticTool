import { useState } from 'react';
import { FiHash, FiCheckCircle, FiXCircle, FiAlertCircle, FiRefreshCw, FiShoppingCart, FiDollarSign, FiPackage, FiInfo, FiChevronDown, FiChevronUp, FiShield, FiAlertTriangle } from 'react-icons/fi';
import { Product } from '../types/product';

interface ProductCardProps {
  product: Product;
}

const getDecisionConfig = (decision: Product['decision']) => {
  switch (decision) {
    case 'Buy':
      return {
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        textColor: 'text-green-400',
        icon: FiCheckCircle,
      };
    case 'Renegotiate':
      return {
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
        textColor: 'text-yellow-400',
        icon: FiRefreshCw,
      };
    case 'Source Elsewhere':
      return {
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30',
        textColor: 'text-orange-400',
        icon: FiAlertCircle,
      };
    case 'Pass':
      return {
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        textColor: 'text-red-400',
        icon: FiXCircle,
      };
  }
};

const getScoreColor = (score: number) => {
  if (score >= 80) return { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' };
  if (score >= 60) return { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
  if (score >= 40) return { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
  return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
};

const formatCurrency = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    // Fallback if currency code is invalid
    return `${currency || 'USD'} ${amount.toFixed(2)}`;
  }
};

function ProductCard({ product }: ProductCardProps) {
  const [isChannelsCollapsed, setIsChannelsCollapsed] = useState(false);
  const decisionConfig = getDecisionConfig(product.decision);
  const DecisionIcon = decisionConfig.icon;
  const scoreColors = getScoreColor(product.deal_quality_score);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-gray-600 transition-all duration-300">
      {/* Header Section */}
      <div className="bg-gray-800/50 border-b border-gray-700 px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white mb-2 line-clamp-2">
              {product.productName || `Product ${product.ean}`}
            </h2>
            <div className="flex items-center gap-2">
              <FiHash className="text-gray-500" size={14} />
              <span className="text-gray-400 text-sm font-mono">EAN: {product.ean}</span>
            </div>
          </div>

          {/* Deal Score Badge */}
          <div className={`flex flex-col items-center justify-center px-4 py-3 rounded-lg border ${scoreColors.bg} ${scoreColors.border} min-w-[80px]`}>
            <span className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">Score</span>
            <span className={`text-3xl font-bold ${scoreColors.text}`}>
              {product.deal_quality_score}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Top Row: Decision & Best Channel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Decision Card */}
          <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
            <div className="flex items-center gap-2 mb-3">
              <DecisionIcon className={decisionConfig.textColor} size={18} />
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Decision</span>
            </div>
            <div className={`inline-flex items-center gap-2 px-4 py-2.5 ${decisionConfig.bgColor} border ${decisionConfig.borderColor} rounded-lg`}>
              <DecisionIcon className={decisionConfig.textColor} size={20} />
              <span className={`text-base font-bold ${decisionConfig.textColor}`}>
                {product.decision}
              </span>
            </div>
          </div>

          {/* Best Channel Card */}
          {product.bestChannel && (
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 rounded-lg p-4 border border-green-500/20">
              <div className="flex items-center gap-2 mb-3">
                <FiShoppingCart className="text-green-400" size={18} />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Best Channel</span>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-bold text-white">
                  {product.bestChannel.channel}-{product.bestChannel.marketplace}
                </div>
                <div className="text-2xl font-bold text-green-400">
                  {product.bestChannel.marginPercent.toFixed(1)}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-gray-700/20 rounded-lg p-3 border border-gray-600/20">
            <div className="text-xs text-gray-400 mb-1.5 font-medium">Net Margin</div>
            <div className="text-lg font-bold text-white">{product.net_margin.toFixed(1)}%</div>
          </div>
          <div className="bg-gray-700/20 rounded-lg p-3 border border-gray-600/20">
            <div className="text-xs text-gray-400 mb-1.5 font-medium">Monthly Sales</div>
            {product.monthlySales ? (
              <>
                <div className="text-lg font-bold text-white">
                  {product.monthlySales.mid >= 1000 
                    ? `${(product.monthlySales.mid / 1000).toFixed(1)}K` 
                    : product.monthlySales.mid}
                  <span className="text-sm text-gray-400">/mo</span>
                </div>
                <div className="text-xs text-gray-500">
                  {product.monthlySales.source?.includes('Amazon') ? '📊 Amazon data' : '📈 Estimated'}
                </div>
              </>
            ) : (
              <div className="text-lg font-bold text-gray-500">N/A</div>
            )}
          </div>
          <div className="bg-gray-700/20 rounded-lg p-3 border border-gray-600/20">
            <div className="text-xs text-gray-400 mb-1.5 font-medium">Demand Confidence</div>
            <div className="text-lg font-bold text-white">{product.demand_confidence}%</div>
          </div>
          <div className="bg-gray-700/20 rounded-lg p-3 border border-gray-600/20">
            <div className="text-xs text-gray-400 mb-1.5 font-medium">Volume Risk</div>
            <div className="text-lg font-bold text-white">{product.volume_risk}%</div>
          </div>
          <div className="bg-gray-700/20 rounded-lg p-3 border border-gray-600/20">
            <div className="text-xs text-gray-400 mb-1.5 font-medium">Data Reliability</div>
            <div className="text-lg font-bold text-white">{product.data_reliability}%</div>
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

        {/* Channels Section */}
        {product.channels && product.channels.length > 0 && (
          <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
            <button
              onClick={() => setIsChannelsCollapsed(!isChannelsCollapsed)}
              className="w-full flex items-center justify-between mb-2 group/header"
            >
              <div className="flex items-center gap-2">
                <FiDollarSign className="text-blue-400" size={18} />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold group-hover/header:text-gray-300 transition-colors">
                  All Channels ({product.channels.length})
                </span>
              </div>
              <div className="text-gray-500 group-hover/header:text-gray-300 transition-colors">
                {isChannelsCollapsed ? <FiChevronDown size={20} /> : <FiChevronUp size={20} />}
              </div>
            </button>

            {!isChannelsCollapsed && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {product.channels.map((channel, idx) => {
                  // Determine channel type for styling
                  const isRetailer = channel.channel === 'Retailer';
                  const isDistributor = channel.channel === 'Distributor';

                  // Get display name
                  const displayName = isRetailer
                    ? `${(channel as any).retailer}`
                    : isDistributor
                      ? `${(channel as any).distributor}`
                      : `${channel.channel}-${channel.marketplace}`;

                  // Get border color based on type and recommendation
                  const borderColor = channel.recommendation === 'Sell'
                    ? 'border-green-500/30 bg-green-500/5'
                    : isRetailer
                      ? 'border-purple-500/30 bg-purple-500/5'
                      : isDistributor
                        ? 'border-cyan-500/30 bg-cyan-500/5'
                        : 'border-gray-600/30';

                  return (
                    <div
                      key={idx}
                      className={`bg-gray-800 rounded-lg p-3 border ${borderColor}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {isRetailer && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">Retail</span>}
                            {isDistributor && <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">Distributor</span>}
                            <span className="font-semibold text-white text-sm">{displayName}</span>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-xs text-gray-400">
                              {isDistributor ? 'They Pay: ' : 'Sell: '}
                              <span className="text-gray-300 font-medium">{formatCurrency(channel.sellPrice, channel.currency)}</span>
                            </div>
                            <div className="text-xs text-gray-400">
                              Net: <span className="text-gray-300 font-medium">{formatCurrency(channel.netProceeds, channel.currency)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <div className={`text-xl font-bold ${channel.marginPercent >= 30 ? 'text-green-400' :
                            channel.marginPercent >= 15 ? 'text-yellow-400' :
                              channel.marginPercent > 0 ? 'text-orange-400' :
                                'text-red-400'
                            }`}>
                            {channel.marginPercent.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      {channel.recommendation && (
                        <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium mt-2 ${channel.recommendation === 'Sell'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : channel.recommendation === 'Consider'
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                          {channel.recommendation}
                        </div>
                      )}
                      {(channel as any).explanation && (
                        <div className="mt-2 text-xs text-gray-400 leading-relaxed">
                          {(channel as any).explanation}
                        </div>
                      )}
                      {/* Demand Signals */}
                      {(channel as any).demand?.signals && (channel as any).demand.signals.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1.5">
                            Demand Signals
                          </div>
                          {(channel as any).demand.signals.map((signal: string, signalIdx: number) => (
                            <div key={signalIdx} className="flex items-start gap-2 text-xs">
                              <span className="text-blue-400 mt-0.5">•</span>
                              <span className="text-gray-400">{signal}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Bottom Row: Allocation & Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Allocation Plan */}
          {product.allocation && (Object.keys(product.allocation.allocated).length > 0 || product.allocation.hold > 0) && (
            <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
              <div className="flex items-center gap-2 mb-4">
                <FiPackage className="text-orange-400" size={18} />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                  Allocation Plan
                </span>
                {product.allocation.rationale && (
                  <div className="relative group">
                    <FiInfo className="text-blue-400 cursor-help hover:text-blue-300 transition-colors" size={16} />
                    <div className="absolute left-0 bottom-full mb-2 w-80 max-w-[calc(100vw-2rem)] p-3 bg-gray-900 border border-gray-600 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-xs text-gray-300 leading-relaxed">
                      <div className="font-semibold text-white mb-2">Allocation Rationale:</div>
                      <div className="mb-2 whitespace-normal">{product.allocation.rationale}</div>
                      {product.allocation.channelDetails && Object.keys(product.allocation.channelDetails).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <div className="font-semibold text-white mb-2">Channel Details:</div>
                          {Object.entries(product.allocation.channelDetails).map(([channel, detail]) => (
                            <div key={channel} className="mb-2 last:mb-0 whitespace-normal">
                              <span className="font-medium text-blue-400">{channel}:</span>
                              <span className="ml-1">{detail}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="absolute bottom-0 left-4 transform translate-y-full">
                        <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-600"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {Object.keys(product.allocation.allocated).length > 0 ? (
                  Object.entries(product.allocation.allocated).map(([channel, qty]) => (
                    <div
                      key={channel}
                      className="flex justify-between items-center bg-gray-800 rounded-lg px-3 py-2 border border-gray-600/20"
                    >
                      <span className="text-sm text-gray-300 font-medium">{channel}</span>
                      <span className="text-sm text-white font-bold">{qty.toLocaleString()} units</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-400 italic text-center py-2">
                    No channels allocated
                  </div>
                )}
                {product.allocation.hold > 0 && (
                  <div className="flex justify-between items-center bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 mt-2">
                    <span className="text-sm text-yellow-400 font-semibold flex items-center gap-2">
                      <FiAlertCircle size={14} />
                      Hold
                    </span>
                    <span className="text-sm text-yellow-400 font-bold">{product.allocation.hold.toLocaleString()} units</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Analysis/Explanation */}
          <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Analysis</span>
            </div>
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

          {/* Compliance Flags Section */}
          {product.compliance && product.compliance.flagCount > 0 && (
            <div className={`rounded-lg p-4 border ${product.compliance.overallRisk === 'high'
              ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30'
              : product.compliance.overallRisk === 'medium'
                ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30'
                : 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/30'
              }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FiShield className={`${product.compliance.overallRisk === 'high' ? 'text-red-400' :
                    product.compliance.overallRisk === 'medium' ? 'text-yellow-400' : 'text-blue-400'
                    }`} size={18} />
                  <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                    Compliance ({product.compliance.flagCount})
                  </span>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${product.compliance.overallRisk === 'high'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : product.compliance.overallRisk === 'medium'
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-green-500/20 text-green-400 border border-green-500/30'
                  }`}>
                  {product.compliance.canSell ? 'Can Sell' : product.compliance.canSellWithApproval ? 'Needs Approval' : 'Cannot Sell'}
                </div>
              </div>

              <div className="space-y-2">
                {product.compliance.flags.map((flag, idx) => (
                  <div
                    key={idx}
                    className={`bg-gray-800/50 rounded-lg p-3 border-l-4 ${flag.severity === 'high' ? 'border-l-red-500' :
                      flag.severity === 'medium' ? 'border-l-yellow-500' : 'border-l-blue-500'
                      }`}
                  >
                    <div className="flex items-start gap-2">
                      <FiAlertTriangle className={`mt-0.5 flex-shrink-0 ${flag.severity === 'high' ? 'text-red-400' :
                        flag.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'
                        }`} size={14} />
                      <div className="flex-1">
                        <div className="font-medium text-white text-sm">{flag.title}</div>
                        <p className="text-xs text-gray-400 mt-1">{flag.description}</p>
                        <div className="mt-2 flex items-center gap-1">
                          <span className="text-xs text-gray-500">Action:</span>
                          <span className="text-xs text-cyan-400">{flag.action}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Compliance Issues */}
          {product.compliance && product.compliance.flagCount === 0 && (
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg p-3 border border-green-500/20">
              <div className="flex items-center gap-2">
                <FiCheckCircle className="text-green-400" size={16} />
                <span className="text-sm text-green-400">No compliance issues detected</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
