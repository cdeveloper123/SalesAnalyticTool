import { FiHash, FiTrendingUp, FiCheckCircle, FiXCircle, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { Product } from '../types/product';

interface ProductCardProps {
  product: Product;
}

const getDecisionConfig = (decision: Product['decision']) => {
  switch (decision) {
    case 'Buy':
      return {
        color: 'green',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/20',
        textColor: 'text-green-400',
        icon: FiCheckCircle,
      };
    case 'Renegotiate':
      return {
        color: 'yellow',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/20',
        textColor: 'text-yellow-400',
        icon: FiRefreshCw,
      };
    case 'Source Elsewhere':
      return {
        color: 'orange',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/20',
        textColor: 'text-orange-400',
        icon: FiAlertCircle,
      };
    case 'Pass':
      return {
        color: 'red',
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
    <div className="group bg-gradient-to-br from-gray-800 to-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 h-full flex flex-col relative overflow-hidden">
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 transition-all duration-300 pointer-events-none" />
      
      <div className="relative flex-1 flex flex-col justify-between">
        {/* Header Section */}
        <div className="mb-6">
          {/* EAN */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <FiHash className="text-blue-400" size={14} />
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">EAN</div>
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {product.ean}
            </h3>
          </div>

          {/* Deal Quality Score */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <FiTrendingUp className="text-purple-400" size={14} />
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">Deal Quality Score</div>
            </div>
            <div className={`text-3xl font-bold ${getScoreColor(product.deal_quality_score)}`}>
              {product.deal_quality_score}%
            </div>
          </div>
          
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-2 bg-gray-700/30 rounded-lg border border-gray-600/30">
              <div className="text-xs text-gray-400 mb-1">Net Margin</div>
              <div className="text-sm font-semibold text-white">{product.net_margin}%</div>
            </div>
            <div className="p-2 bg-gray-700/30 rounded-lg border border-gray-600/30">
              <div className="text-xs text-gray-400 mb-1">Demand Confidence</div>
              <div className="text-sm font-semibold text-white">{product.demand_confidence}%</div>
            </div>
            <div className="p-2 bg-gray-700/30 rounded-lg border border-gray-600/30">
              <div className="text-xs text-gray-400 mb-1">Volume Risk</div>
              <div className="text-sm font-semibold text-white">{product.volume_risk}%</div>
            </div>
            <div className="p-2 bg-gray-700/30 rounded-lg border border-gray-600/30">
              <div className="text-xs text-gray-400 mb-1">Data Reliability</div>
              <div className="text-sm font-semibold text-white">{product.data_reliability}%</div>
            </div>
          </div>
        </div>
        
        {/* Decision & Explanation Section */}
        <div className="pt-5 border-t border-gray-700/50 space-y-4">
          {/* Decision */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 ${decisionConfig.bgColor} rounded-lg border ${decisionConfig.borderColor}`}>
                <DecisionIcon className={decisionConfig.textColor} size={14} />
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">Clear Decision</div>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 ${decisionConfig.bgColor} border ${decisionConfig.borderColor} rounded-lg`}>
              <DecisionIcon className={decisionConfig.textColor} size={16} />
              <span className={`text-sm font-bold ${decisionConfig.textColor}`}>
                {product.decision}
              </span>
            </div>
          </div>

          {/* Explanation */}
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">Explanation</div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {product.explanation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;

