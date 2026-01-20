import { useState } from 'react';
import { FiZap, FiDollarSign, FiActivity, FiAlertTriangle, FiTrash2, FiChevronDown, FiChevronRight, FiCopy, FiPackage, FiTrendingUp, FiStar, FiTag, FiHash, FiShoppingBag } from 'react-icons/fi';
import toast from 'react-hot-toast';
import type { QuickLookupProduct } from '../types/product';

interface QuickLookupCardProps {
    product: QuickLookupProduct;
    onDelete?: () => void;
}

// Format currency based on market
function formatCurrency(amount: number, currency: string): string {
    const currencySymbols: Record<string, string> = {
        USD: '$', GBP: '£', EUR: '€', AUD: 'A$'
    };
    const symbol = currencySymbols[currency] || currency + ' ';
    return `${symbol}${amount.toFixed(2)}`;
}

// Format large numbers with K/M suffix
function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
}

// Get demand level styling
function getDemandStyle(level: string): { color: string; bg: string } {
    switch (level) {
        case 'HIGH': return { color: 'text-emerald-400', bg: 'bg-emerald-500/20' };
        case 'MEDIUM': return { color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
        case 'LOW': return { color: 'text-orange-400', bg: 'bg-orange-500/20' };
        case 'VERY_LOW': return { color: 'text-red-400', bg: 'bg-red-500/20' };
        default: return { color: 'text-gray-400', bg: 'bg-gray-500/20' };
    }
}

// Get risk level styling
function getRiskStyle(level: string): { color: string; bg: string; border: string } {
    switch (level) {
        case 'HIGH': return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
        case 'MEDIUM': return { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
        case 'LOW': return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
        default: return { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30' };
    }
}

// Get sales rank color based on value
function getSalesRankStyle(rank: number): string {
    if (rank < 5000) return 'text-emerald-400';
    if (rank < 25000) return 'text-yellow-400';
    if (rank < 100000) return 'text-orange-400';
    return 'text-red-400';
}

export default function QuickLookupCard({ product, onDelete }: QuickLookupCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMarketsExpanded, setIsMarketsExpanded] = useState(true); // For collapsible markets section
    const demandStyle = getDemandStyle(product.demand?.level || 'UNKNOWN');
    const riskStyle = getRiskStyle(product.riskSnapshot?.level || 'UNKNOWN');

    // Extract demand indicators and prices
    const indicators = product.demand?.indicators as Record<string, any> || {};
    const pricesByChannel = (product as any).pricesByChannel as Record<string, any> || {};

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) onDelete();
    };

    const handleCopyEAN = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!product.ean) return;
        try {
            await navigator.clipboard.writeText(product.ean);
            toast.success('EAN copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy EAN:', error);
            toast.error('Failed to copy EAN');
        }
    };

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-gray-600 transition-all duration-300">
            {/* Header Section - Clickable to expand/collapse */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full bg-gray-800/50 border-b border-gray-700 px-4 sm:px-6 py-4 hover:bg-gray-750 transition-colors text-left"
            >
                <div className="flex flex-col sm:flex-row sm:justify-between gap-3 sm:gap-0">
                    <div className="flex-1 flex items-center gap-3">
                        {isExpanded ? (
                            <FiChevronDown className="text-gray-400 flex-shrink-0" size={20} />
                        ) : (
                            <FiChevronRight className="text-gray-400 flex-shrink-0" size={20} />
                        )}
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h2 className="text-lg sm:text-xl font-bold text-white line-clamp-2">
                                    {product.productName || product.product?.title || 'Unknown Product'}
                                </h2>
                                {/* Quick Lookup Mode Badge - Inline with product name */}
                                <div className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 flex-shrink-0">
                                    <div className="flex items-center gap-1 text-amber-400">
                                        <FiZap size={10} />
                                        <span className="text-[10px] font-semibold uppercase tracking-wide">Quick Lookup</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400 text-sm font-mono">EAN: {product.ean}</span>
                                <button
                                    type="button"
                                    onClick={handleCopyEAN}
                                    className="p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 rounded transition-colors"
                                    title="Copy EAN to clipboard"
                                >
                                    <FiCopy size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
                        {/* Delete Button */}
                        {onDelete && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Delete product"
                            >
                                <FiTrash2 size={18} />
                            </button>
                        )}

                        {/* Risk Badge - Same width as Score badge */}
                        <div className={`flex flex-col items-center justify-center px-3 sm:px-4 py-2 sm:py-3 rounded-lg border ${riskStyle.bg} ${riskStyle.border} min-w-[80px] sm:min-w-[100px]`}>
                            <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">Risk</span>
                            <span className={`text-xl sm:text-2xl font-bold ${riskStyle.color}`}>
                                {product.riskSnapshot?.level || 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                    {/* Product Info Section */}
                    {product.product && (product.product.asin || product.product.category || product.product.brand) && (
                        <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
                            <div className="flex items-center gap-2 mb-3">
                                <FiPackage className="text-blue-400" size={16} />
                                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Product Info</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {product.product.asin && (
                                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-600/20">
                                        <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                                            <FiHash size={10} />
                                            ASIN
                                        </div>
                                        <div className="text-sm font-medium text-white font-mono">{product.product.asin}</div>
                                    </div>
                                )}
                                {product.product.category && (
                                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-600/20">
                                        <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                                            <FiTag size={10} />
                                            Category
                                        </div>
                                        <div className="text-sm font-medium text-white truncate">{product.product.category}</div>
                                    </div>
                                )}
                                {product.product.brand && (
                                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-600/20">
                                        <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                                            <FiShoppingBag size={10} />
                                            Brand
                                        </div>
                                        <div className="text-sm font-medium text-white">{product.product.brand}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Three Key Metrics - Premium Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Best Price Card */}
                        <div className="relative bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent rounded-xl p-5 border border-emerald-500/20 group hover:border-emerald-500/40 transition-all duration-300">
                            {/* Background Glow - Contained */}
                            <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                            </div>

                            <div className="relative">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                                        <FiDollarSign size={22} className="text-emerald-400" />
                                    </div>
                                    <div className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Best Price</div>
                                </div>

                                {product.currentPrice ? (
                                    <div className="space-y-2">
                                        <div className="text-3xl font-bold text-white tracking-tight">
                                            {formatCurrency(product.currentPrice.price, product.currentPrice.currency)}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-400">{product.currentPrice.market}</span>
                                            {product.currentPrice.dataSource && (
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${product.currentPrice.dataSource === 'live'
                                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                                    }`}>
                                                    {product.currentPrice.dataSource === 'live' ? 'LIVE' : 'MOCK'}
                                                </span>
                                            )}
                                        </div>
                                        {/* Price range info */}
                                        {Object.keys(indicators).length > 1 && (
                                            <div className="pt-2 mt-1 border-t border-gray-600/30 text-[10px] text-gray-500">
                                                {Object.keys(indicators).length} markets compared
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-2xl font-bold text-gray-500">N/A</div>
                                )}
                            </div>
                        </div>

                        {/* Overall Demand Card - Now shows average-based demand with highest region */}
                        <div className={`relative rounded-xl p-5 border group hover:border-opacity-60 transition-all duration-300 ${product.demand?.level === 'HIGH'
                            ? 'bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent border-emerald-500/20 hover:border-emerald-500/40'
                            : product.demand?.level === 'MEDIUM'
                                ? 'bg-gradient-to-br from-yellow-500/20 via-yellow-500/10 to-transparent border-yellow-500/20 hover:border-yellow-500/40'
                                : product.demand?.level === 'LOW'
                                    ? 'bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-transparent border-orange-500/20 hover:border-orange-500/40'
                                    : 'bg-gradient-to-br from-red-500/20 via-red-500/10 to-transparent border-red-500/20 hover:border-red-500/40'
                            }`}>
                            {/* Background Glow - Contained */}
                            <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                                <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl transition-all ${product.demand?.level === 'HIGH' ? 'bg-emerald-500/10 group-hover:bg-emerald-500/20' :
                                    product.demand?.level === 'MEDIUM' ? 'bg-yellow-500/10 group-hover:bg-yellow-500/20' :
                                        product.demand?.level === 'LOW' ? 'bg-orange-500/10 group-hover:bg-orange-500/20' :
                                            'bg-red-500/10 group-hover:bg-red-500/20'
                                    }`}></div>
                            </div>

                            <div className="relative">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-2.5 rounded-xl border ${demandStyle.bg} ${product.demand?.level === 'HIGH' ? 'border-emerald-500/30' :
                                        product.demand?.level === 'MEDIUM' ? 'border-yellow-500/30' :
                                            product.demand?.level === 'LOW' ? 'border-orange-500/30' :
                                                'border-red-500/30'
                                        }`}>
                                        <FiActivity size={22} className={demandStyle.color} />
                                    </div>
                                    <div className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Overall Demand</div>
                                </div>

                                <div className="space-y-2">
                                    <div className={`text-3xl font-bold tracking-tight ${demandStyle.color}`}>
                                        {product.demand?.level || 'N/A'}
                                    </div>

                                    {/* Composite score info with tooltip */}
                                    {(product.demand as any)?.compositeScore !== undefined && (
                                        <div className="relative group/score-tooltip inline-block">
                                            <div className="text-xs text-gray-500 cursor-help hover:text-gray-400 transition-colors flex items-center gap-1">
                                                Score: {(product.demand as any).compositeScore}/100 ({(product.demand as any).marketsAnalyzed} markets)
                                                <span className="opacity-60 text-[10px]">ⓘ</span>
                                            </div>

                                            {/* Custom Instant Tooltip - Fixed and Minimized */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-max min-w-[180px] p-2 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl opacity-0 invisible group-hover/score-tooltip:opacity-100 group-hover/score-tooltip:visible transition-all duration-150 z-[100] pointer-events-none ring-1 ring-white/5 backdrop-blur-sm">
                                                <div className="text-[10px] font-bold text-gray-200 mb-1.5 border-b border-gray-700/50 pb-1 flex items-center gap-1">
                                                    <FiActivity size={10} className="text-blue-400" />
                                                    Weight Distribution
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between items-center gap-4">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                                                            <span className="text-xs text-gray-400">Amazon BSR</span>
                                                        </div>
                                                        <span className="text-[10px] text-white font-bold bg-white/5 px-1 rounded">50%</span>
                                                    </div>
                                                    <div className="flex justify-between items-center gap-4">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                            <span className="text-xs text-gray-400">eBay Sales</span>
                                                        </div>
                                                        <span className="text-[10px] text-white font-bold bg-white/5 px-1 rounded">35%</span>
                                                    </div>
                                                    <div className="flex justify-between items-center gap-4">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                                            <span className="text-xs text-gray-400">Retail Sales</span>
                                                        </div>
                                                        <span className="text-[10px] text-white font-bold bg-white/5 px-1 rounded">15%</span>
                                                    </div>
                                                </div>
                                                {/* Tooltip Arrow */}
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sources breakdown */}
                                    {(product.demand as any)?.sources && (
                                        <div className="flex flex-wrap gap-1 text-[10px]">
                                            {(product.demand as any).sources.amazon?.count > 0 && (
                                                <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                                                    Amazon: {(product.demand as any).sources.amazon.count}
                                                </span>
                                            )}
                                            {(product.demand as any).sources.ebay?.count > 0 && (
                                                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                                    eBay: {(product.demand as any).sources.ebay.count}
                                                </span>
                                            )}
                                            {(product.demand as any).sources.retailers?.count > 0 && (
                                                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                                                    Retail: {(product.demand as any).sources.retailers.count}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Best Per Channel - Compact with tooltip */}
                                    {(product.demand as any)?.sources && (
                                        (() => {
                                            const sources = (product.demand as any).sources;
                                            const hasBest = !!(sources.amazon?.best || sources.ebay?.best || sources.retailers?.best);

                                            return hasBest ? (
                                                <div className="pt-2 mt-1 border-t border-gray-600/30">
                                                    <div className="relative group/tooltip inline-flex items-center gap-1 text-[10px] text-gray-500 cursor-help hover:text-gray-300 transition-colors">
                                                        <span>🏆 Best Markets</span>
                                                        <span className="text-gray-400 font-normal opacity-60">(hover)</span>

                                                        {/* Custom Instant Tooltip */}
                                                        <div className="absolute bottom-full left-0 mb-2 w-max max-w-[250px] p-2.5 bg-gray-900/95 border border-gray-700/50 rounded-lg shadow-2xl backdrop-blur-md opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-150 z-50 pointer-events-none ring-1 ring-white/10">
                                                            <div className="text-[10px] space-y-1.5">
                                                                {sources.amazon?.best && (
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-4 h-4 rounded-sm bg-orange-500/20 flex items-center justify-center text-[9px] font-bold text-orange-400">A</div>
                                                                        <span className="text-gray-300">Amazon:</span>
                                                                        <span className="text-white font-semibold">{sources.amazon.best.marketCode}</span>
                                                                        <span className="text-emerald-400 font-medium">#{formatNumber(sources.amazon.best.rank)}</span>
                                                                    </div>
                                                                )}
                                                                {sources.ebay?.best && (
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-4 h-4 rounded-sm bg-blue-500/20 flex items-center justify-center text-[9px] font-bold text-blue-400">E</div>
                                                                        <span className="text-gray-300">eBay:</span>
                                                                        <span className="text-white font-semibold">{sources.ebay.best.marketCode}</span>
                                                                        <span className="text-emerald-400 font-medium">{formatNumber(sources.ebay.best.monthlySales)}/mo</span>
                                                                    </div>
                                                                )}
                                                                {sources.retailers?.best && (
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-4 h-4 rounded-sm bg-purple-500/20 flex items-center justify-center text-[9px] font-bold text-purple-400">R</div>
                                                                        <span className="text-gray-300">Retail:</span>
                                                                        <span className="text-white font-semibold truncate max-w-[80px]">{sources.retailers.best.market}</span>
                                                                        <span className="text-yellow-400 font-medium">{formatNumber(sources.retailers.best.monthlySales)}/mo</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {/* Tooltip Arrow */}
                                                            <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900/95"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null;
                                        })()
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Risk Level Card */}
                        <div className={`relative rounded-xl p-5 border group hover:border-opacity-60 transition-all duration-300 ${product.riskSnapshot?.level === 'HIGH'
                            ? 'bg-gradient-to-br from-red-500/20 via-red-500/10 to-transparent border-red-500/20 hover:border-red-500/40'
                            : product.riskSnapshot?.level === 'MEDIUM'
                                ? 'bg-gradient-to-br from-yellow-500/20 via-yellow-500/10 to-transparent border-yellow-500/20 hover:border-yellow-500/40'
                                : 'bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent border-emerald-500/20 hover:border-emerald-500/40'
                            }`}>
                            {/* Background Glow - Contained */}
                            <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                                <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl transition-all ${product.riskSnapshot?.level === 'HIGH' ? 'bg-red-500/10 group-hover:bg-red-500/20' :
                                    product.riskSnapshot?.level === 'MEDIUM' ? 'bg-yellow-500/10 group-hover:bg-yellow-500/20' :
                                        'bg-emerald-500/10 group-hover:bg-emerald-500/20'
                                    }`}></div>
                            </div>

                            <div className="relative">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2.5 rounded-xl border ${riskStyle.bg} ${riskStyle.border}`}>
                                        <FiAlertTriangle size={22} className={riskStyle.color} />
                                    </div>
                                    <div className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Risk</div>
                                </div>

                                <div className="space-y-2">
                                    <div className={`text-3xl font-bold tracking-tight ${riskStyle.color}`}>
                                        {product.riskSnapshot?.level || 'N/A'}
                                    </div>
                                    {product.riskSnapshot?.flags && product.riskSnapshot.flags.length > 0 ? (
                                        <>
                                            <div className="text-sm text-gray-400">
                                                {product.riskSnapshot.flags.length} {product.riskSnapshot.flags.length === 1 ? 'issue' : 'issues'} detected
                                            </div>
                                            {/* Show first flag as preview */}
                                            <div className="pt-2 mt-1 border-t border-gray-600/30 text-[10px] text-gray-500 truncate" title={product.riskSnapshot.flags[0]}>
                                                ⚠️ {product.riskSnapshot.flags[0].length > 35 ? product.riskSnapshot.flags[0].substring(0, 35) + '...' : product.riskSnapshot.flags[0]}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="text-sm text-gray-400">No issues found</div>
                                            <div className="pt-2 mt-1 border-t border-gray-600/30 text-[10px] text-emerald-400">
                                                ✓ Safe to proceed
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* Market Demand Indicators & Prices - Collapsible */}
                    {Object.keys(indicators).length > 0 && (
                        <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-lg border border-blue-500/20 overflow-hidden">
                            {/* Collapsible Header */}
                            <button
                                type="button"
                                onClick={() => setIsMarketsExpanded(!isMarketsExpanded)}
                                className="w-full flex items-center justify-between p-4 hover:bg-blue-500/5 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <FiTrendingUp className="text-blue-400" size={16} />
                                    <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Market Demand Indicators & Prices</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                                        {Object.keys(indicators).length} markets
                                    </span>
                                </div>
                                {isMarketsExpanded ? (
                                    <FiChevronDown className="text-gray-400" size={18} />
                                ) : (
                                    <FiChevronRight className="text-gray-400" size={18} />
                                )}
                            </button>

                            {/* Collapsible Content */}
                            {isMarketsExpanded && (
                                <div className="px-4 pb-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {Object.entries(indicators).map(([market, data]: [string, any]) => {
                                            // Detect market type
                                            const isAmazonMarket = ['US', 'UK', 'DE', 'FR', 'IT', 'AU'].includes(market);
                                            const isEbayMarket = market.startsWith('eBay-');
                                            const isRetailer = market.startsWith('Walmart-') || market.startsWith('Target-');

                                            // Determine channel label and styling
                                            let channelLabel = market;
                                            let channelBg = 'bg-gray-500/20';
                                            let channelColor = 'text-gray-400';

                                            // Get the price for this market
                                            let priceKey = isAmazonMarket ? `Amazon-${market}` : market;
                                            const priceData = pricesByChannel[priceKey];

                                            if (isAmazonMarket) {
                                                channelLabel = `Amazon ${market}`;
                                                channelBg = 'bg-orange-500/20';
                                                channelColor = 'text-orange-400';
                                            } else if (isEbayMarket) {
                                                channelLabel = market;
                                                channelBg = 'bg-blue-500/20';
                                                channelColor = 'text-blue-400';
                                            } else if (isRetailer) {
                                                channelLabel = market.replace('-', ' ');
                                                channelBg = 'bg-purple-500/20';
                                                channelColor = 'text-purple-400';
                                            }

                                            return (
                                                <div key={market} className="bg-gray-800/50 rounded-lg p-3 border border-gray-600/20">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-semibold text-white">
                                                                {channelLabel}
                                                            </span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${channelBg} ${channelColor}`}>
                                                                {isAmazonMarket ? 'Amazon' : isEbayMarket ? 'eBay' : 'Retail'}
                                                            </span>
                                                        </div>
                                                        {/* Data Source Badge */}
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${data.dataSource === 'live' || data.dataSource === 'api'
                                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                                            }`}>
                                                            {data.dataSource === 'live' || data.dataSource === 'api' ? 'LIVE' : 'MOCK'}
                                                        </span>
                                                    </div>

                                                    {/* Price Display - Always show */}
                                                    <div className="flex items-center justify-between text-sm mb-2 pb-2 border-b border-gray-600/30">
                                                        <span className="text-gray-400 flex items-center gap-1">
                                                            <FiDollarSign size={12} /> Price
                                                        </span>
                                                        {priceData && priceData.price > 0 ? (
                                                            <span className="font-bold text-emerald-400">
                                                                {formatCurrency(priceData.price, priceData.currency)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-500 text-xs italic">N/A</span>
                                                        )}
                                                    </div>

                                                    <div className="space-y-2">
                                                        {/* Amazon-specific indicators */}
                                                        {isAmazonMarket && (
                                                            <>
                                                                {data.salesRank && (
                                                                    <div className="flex items-center justify-between text-sm">
                                                                        <span className="text-gray-400">Sales Rank</span>
                                                                        <span className={`font-bold ${getSalesRankStyle(data.salesRank)}`}>
                                                                            #{formatNumber(data.salesRank)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center justify-between text-sm">
                                                                    <span className="text-gray-400">Recent Sales</span>
                                                                    {data.recentSales ? (
                                                                        <span className="font-medium text-emerald-400">{data.recentSales}</span>
                                                                    ) : (
                                                                        <span className="text-gray-500 text-xs italic">Not available</span>
                                                                    )}
                                                                </div>
                                                                {(data.ratingsTotal !== undefined || data.rating !== undefined) && (
                                                                    <div className="flex items-center justify-between text-sm">
                                                                        <span className="text-gray-400 flex items-center gap-1">
                                                                            <FiStar size={12} /> Ratings
                                                                        </span>
                                                                        <span className="font-medium text-white">
                                                                            {data.rating ? `${data.rating}★` : ''}
                                                                            {data.ratingsTotal ? ` (${formatNumber(data.ratingsTotal)})` : ''}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}

                                                        {/* eBay-specific indicators */}
                                                        {isEbayMarket && (
                                                            <>
                                                                {data.estimatedMonthlySales !== undefined && (
                                                                    <div className="flex items-center justify-between text-sm">
                                                                        <span className="text-gray-400">Est. Monthly Sales</span>
                                                                        <span className="font-bold text-emerald-400">
                                                                            {formatNumber(data.estimatedMonthlySales)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {data.activeListings !== undefined && (
                                                                    <div className="flex items-center justify-between text-sm">
                                                                        <span className="text-gray-400">Active Listings</span>
                                                                        <span className="font-medium text-white">
                                                                            {formatNumber(data.activeListings)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {data.confidence && (
                                                                    <div className="flex items-center justify-between text-sm">
                                                                        <span className="text-gray-400">Confidence</span>
                                                                        <span className={`font-medium ${data.confidence === 'HIGH' ? 'text-emerald-400' :
                                                                            data.confidence === 'MEDIUM' ? 'text-yellow-400' : 'text-orange-400'
                                                                            }`}>
                                                                            {data.confidence}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}

                                                        {/* Retailer-specific indicators (Walmart, Target) */}
                                                        {isRetailer && (
                                                            <>
                                                                {data.estimatedMonthlySales !== undefined && (
                                                                    <div className="flex items-center justify-between text-sm">
                                                                        <span className="text-gray-400">Est. Monthly Sales</span>
                                                                        <span className="font-bold text-emerald-400">
                                                                            {formatNumber(data.estimatedMonthlySales)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {data.confidence && (
                                                                    <div className="flex items-center justify-between text-sm">
                                                                        <span className="text-gray-400">Confidence</span>
                                                                        <span className="text-orange-400 font-medium">
                                                                            {data.confidence}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Risk Flags (if any) */}
                    {product.riskSnapshot?.flags && product.riskSnapshot.flags.length > 0 && (
                        <div className={`rounded-lg p-4 border ${product.riskSnapshot.level === 'HIGH'
                            ? 'bg-red-500/10 border-red-500/20'
                            : product.riskSnapshot.level === 'MEDIUM'
                                ? 'bg-yellow-500/10 border-yellow-500/20'
                                : 'bg-gray-700/30 border-gray-600/30'
                            }`}>
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                                <FiAlertTriangle size={16} className={
                                    product.riskSnapshot.level === 'HIGH' ? 'text-red-400' :
                                        product.riskSnapshot.level === 'MEDIUM' ? 'text-yellow-400' : 'text-amber-400'
                                } />
                                Risk Flags
                                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${product.riskSnapshot.level === 'HIGH'
                                    ? 'bg-red-500/20 text-red-400'
                                    : product.riskSnapshot.level === 'MEDIUM'
                                        ? 'bg-yellow-500/20 text-yellow-400'
                                        : 'bg-gray-500/20 text-gray-400'
                                    }`}>
                                    {product.riskSnapshot.flags.length} {product.riskSnapshot.flags.length === 1 ? 'issue' : 'issues'}
                                </span>
                            </div>
                            <ul className="space-y-2">
                                {product.riskSnapshot.flags.map((flag, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${product.riskSnapshot?.level === 'HIGH' ? 'bg-red-400' :
                                            product.riskSnapshot?.level === 'MEDIUM' ? 'bg-yellow-400' : 'bg-amber-400'
                                            }`}></span>
                                        {flag}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="text-xs text-gray-500">
                        Analyzed: {new Date(product.analyzedAt).toLocaleString()}
                    </div>
                </div>
            )}
        </div>
    );
}

