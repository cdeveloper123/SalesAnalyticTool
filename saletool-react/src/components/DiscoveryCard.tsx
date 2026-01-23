import { useState } from 'react';
import { FiSearch, FiTrendingUp, FiMapPin, FiDollarSign, FiTrash2, FiChevronDown, FiChevronRight, FiCopy, FiInfo } from 'react-icons/fi';
import toast from 'react-hot-toast';
import type { DiscoveryProduct } from '../types/product';

interface DiscoveryCardProps {
    product: DiscoveryProduct;
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

// Convert amount to USD using provided rates (returns null if conversion not possible)
function convertToUSD(amount: number, currency: string, rates?: Record<string, number>): number | null {
    if (!rates) return null;
    if (currency === 'USD') return amount;
    const rate = rates[currency];
    if (!rate || rate === 0) return null;
    return amount / rate;  // Convert foreign currency to USD
}

// FX Rates Tooltip Component - only shows if fxRates available
interface FxRatesTooltipProps {
    fxRates?: {
        rates: Record<string, number>;
        baseCurrency: string;
        fetchedAt: string | null;
        source: 'live' | 'cache_expired' | 'fallback' | string;
    };
}

function FxRatesTooltip({ fxRates }: FxRatesTooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    // Don't render if no FX data
    if (!fxRates?.rates) return null;

    const rates = fxRates.rates;
    const source = fxRates.source;
    const fetchedAt = fxRates.fetchedAt;

    // Filter to show only currency conversions we care about
    const displayCurrencies = ['GBP', 'EUR', 'AUD'];

    // Get source message based on FX source
    const getSourceMessage = () => {
        switch (source) {
            case 'live': return 'Live rates from freecurrencyapi.com';
            case 'cache_expired': return 'Cached rates (refresh pending)';
            default: return 'Rates at analysis time';
        }
    };

    return (
        <div className="relative inline-block">
            <button
                type="button"
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onClick={(e) => { e.stopPropagation(); setIsVisible(!isVisible); }}
                className="text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 underline decoration-dotted underline-offset-2"
            >
                <FiInfo size={12} />
                <span>FX Rates when analyzed</span>
            </button>

            {isVisible && (
                <div className="absolute z-50 bottom-full right-0 mb-2 w-56">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl text-left">
                        <div className="text-xs font-semibold text-gray-300 mb-2">FX Rates (1 USD =)</div>
                        <div className="space-y-1 text-xs">
                            {displayCurrencies.map(currency => {
                                const rate = rates[currency];
                                return rate ? (
                                    <div key={currency} className="flex justify-between text-gray-400">
                                        <span>{currency}</span>
                                        <span className="text-gray-300">{rate.toFixed(4)}</span>
                                    </div>
                                ) : null;
                            })}
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-700 text-[10px] text-gray-500">
                            {getSourceMessage()}
                            {fetchedAt && (
                                <div className="mt-1 text-gray-600">
                                    {new Date(fetchedAt).toLocaleString()}
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Arrow */}
                    <div className="absolute top-full right-4 -mt-1 border-4 border-transparent border-t-gray-700"></div>
                </div>
            )}
        </div>
    );
}

// Get demand level color
function getDemandColor(level: string): string {
    switch (level) {
        case 'HIGH': return 'text-emerald-400';
        case 'MEDIUM': return 'text-yellow-400';
        case 'LOW': return 'text-orange-400';
        case 'VERY_LOW': return 'text-red-400';
        default: return 'text-gray-400';
    }
}

function getDemandBg(level: string): string {
    switch (level) {
        case 'HIGH': return 'bg-emerald-500/10 border-emerald-500/30';
        case 'MEDIUM': return 'bg-yellow-500/10 border-yellow-500/30';
        case 'LOW': return 'bg-orange-500/10 border-orange-500/30';
        case 'VERY_LOW': return 'bg-red-500/10 border-red-500/30';
        default: return 'bg-gray-500/10 border-gray-500/30';
    }
}

export default function DiscoveryCard({ product, onDelete }: DiscoveryCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const demandLevel = product.demandSignals?.level || 'UNKNOWN';

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) onDelete();
    };

    const handleCopyEAN = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const valueToCopy = product.ean || (product as any).asin || product.product?.asin;
        if (!valueToCopy) return;
        try {
            await navigator.clipboard.writeText(valueToCopy);
            toast.success(`${product.ean ? 'EAN' : 'ASIN'} copied to clipboard!`);
        } catch (error) {
            console.error('Failed to copy:', error);
            toast.error('Failed to copy to clipboard');
        }
    };

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl hover:border-gray-600 transition-all duration-300">
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
                                {/* Discovery Mode Badge - Inline with product name */}
                                <div className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 flex-shrink-0">
                                    <div className="flex items-center gap-1 text-blue-400">
                                        <FiSearch size={10} />
                                        <span className="text-[10px] font-semibold uppercase tracking-wide">Discovery</span>
                                    </div>
                                </div>
                            </div>
                            {/* Show EAN if available, otherwise show ASIN for keyword searches */}
                            {(product.ean || (product as any).asin || product.product?.asin) && (
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-sm font-mono">
                                        {product.ean ? `EAN: ${product.ean}` : `ASIN: ${(product as any).asin || product.product?.asin}`}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleCopyEAN}
                                        className="p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 rounded transition-colors"
                                        title={product.ean ? "Copy EAN to clipboard" : "Copy ASIN to clipboard"}
                                    >
                                        <FiCopy size={14} />
                                    </button>
                                </div>
                            )}
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

                        {/* Demand Badge - Same width as Score badge */}
                        <div className={`flex flex-col items-center justify-center px-3 sm:px-4 py-2 sm:py-3 rounded-lg border ${getDemandBg(demandLevel)} min-w-[80px] sm:min-w-[100px]`}>
                            <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">Demand</span>
                            <span className={`text-xl sm:text-2xl font-bold ${getDemandColor(demandLevel)}`}>
                                {demandLevel}
                            </span>
                        </div>
                    </div>
                </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        {/* Demand Level */}
                        <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                            <div className="text-sm text-gray-400 mb-1">Demand Level</div>
                            <div className={`text-xl font-bold ${getDemandColor(demandLevel)}`}>
                                {demandLevel}
                            </div>
                        </div>

                        {/* Markets Analyzed */}
                        <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                            <div className="text-sm text-gray-400 mb-1">Markets Analyzed</div>
                            {(() => {
                                const amazonCount = product.marketsAnalyzed?.amazon ||
                                    (product.priceByRegion ? Object.keys(product.priceByRegion).filter(k => k.startsWith('Amazon')).length : 0);
                                const ebayCount = product.marketsAnalyzed?.ebay ||
                                    (product.priceByRegion ? Object.keys(product.priceByRegion).filter(k => k.startsWith('eBay')).length : 0);
                                return (
                                    <>
                                        <div className="text-xl font-bold text-white">
                                            {amazonCount + ebayCount}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {amazonCount} Amazon, {ebayCount} eBay
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        {/* Price Range - Always in USD (if FX rates available) */}
                        <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                            <div className="text-sm text-gray-400 mb-1">
                                {product.fxRates?.rates ? 'Price Range (USD)' : 'Price Range'}
                            </div>
                            {product.priceByRegion && Object.keys(product.priceByRegion).length > 0 ? (() => {
                                const regions = Object.values(product.priceByRegion);

                                // If FX rates available, convert to USD
                                if (product.fxRates?.rates) {
                                    const usdPrices = regions
                                        .map(p => convertToUSD(p.price, p.currency, product.fxRates?.rates))
                                        .filter((p): p is number => p !== null && p > 0);

                                    if (usdPrices.length > 0) {
                                        const minUsd = Math.min(...usdPrices);
                                        const maxUsd = Math.max(...usdPrices);
                                        return (
                                            <div className="text-xl font-bold text-emerald-400">
                                                ${minUsd.toFixed(2)} - ${maxUsd.toFixed(2)}
                                            </div>
                                        );
                                    }
                                }

                                // Fallback: show raw price range without USD conversion
                                const prices = regions.map(p => p.price).filter(p => p > 0);
                                if (prices.length > 0) {
                                    const minPrice = Math.min(...prices);
                                    const maxPrice = Math.max(...prices);
                                    return (
                                        <div className="text-xl font-bold text-emerald-400">
                                            {formatCurrency(minPrice, regions[0].currency)} - {formatCurrency(maxPrice, regions[0].currency)}
                                        </div>
                                    );
                                }
                                return <div className="text-xl font-bold text-gray-500">N/A</div>;
                            })() : (
                                <div className="text-xl font-bold text-gray-500">N/A</div>
                            )}
                        </div>
                    </div>

                    {/* Highest Price Regions */}
                    {product.highestPriceRegions && product.highestPriceRegions.length > 0 && (
                        <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                                <FiDollarSign size={16} className="text-emerald-400" />
                                Highest Price Regions
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {product.highestPriceRegions.slice(0, 5).map((region, idx) => (
                                    <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
                                        <span className="text-sm font-medium text-gray-300">{region.region}</span>
                                        <span className="text-sm font-bold text-emerald-400">
                                            {formatCurrency(region.price, region.currency)}
                                        </span>
                                        {/* Status badge - handles Live, Estimated, and Mock */}
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${region.dataSource === 'live' || region.dataSource === 'api'
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                            : region.dataSource === 'estimated'
                                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                            }`}>
                                            {region.dataSource === 'live' || region.dataSource === 'api' ? 'LIVE' : region.dataSource === 'estimated' ? 'ESTIMATED' : 'MOCK'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Largest Volume Regions */}
                    {product.largestVolumeRegions && product.largestVolumeRegions.length > 0 && (
                        <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                                <FiTrendingUp size={16} className="text-blue-400" />
                                Largest Volume Regions
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {product.largestVolumeRegions.slice(0, 5).map((region, idx) => {
                                    // Use actual dataSource from backend
                                    const isLiveData = region.dataSource === 'live' || region.dataSource === 'api';
                                    const isEstimated = region.dataSource === 'estimated';
                                    return (
                                        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
                                            <span className="text-sm font-medium text-gray-300">{region.region}</span>
                                            {region.salesRank && (
                                                <span className="text-xs text-gray-400">Rank #{region.salesRank.toLocaleString()}</span>
                                            )}
                                            {region.recentSales && (
                                                <span className="text-xs text-emerald-400">{region.recentSales}</span>
                                            )}
                                            {/* Status badge - handles Live, Estimated (fallback), and Mock */}
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${isLiveData
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                : isEstimated
                                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                                }`}>
                                                {isLiveData ? 'LIVE' : isEstimated ? 'ESTIMATED' : 'MOCK'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Demand Signals */}
                    {product.demandSignals?.signals && product.demandSignals.signals.length > 0 && (
                        <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Demand Signals</h4>
                            <ul className="space-y-1">
                                {product.demandSignals.signals.map((signal, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-400">
                                        <FiMapPin size={12} className="mt-1 text-blue-400 flex-shrink-0" />
                                        {signal}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* All Market Prices */}
                    {product.priceByRegion && Object.keys(product.priceByRegion).length > 0 && (
                        <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
                            <h4 className="text-sm font-medium text-gray-300 mb-2">All Market Prices</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {Object.entries(product.priceByRegion).map(([key, data]) => (
                                    <div key={key} className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-400">{key}</span>
                                            {/* Status badge - handles Live, Estimated, and Mock */}
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${data.dataSource === 'live' || data.dataSource === 'api'
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                : data.dataSource === 'estimated'
                                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                                }`}>
                                                {data.dataSource === 'live' || data.dataSource === 'api' ? 'LIVE' : data.dataSource === 'estimated' ? 'ESTIMATED' : 'MOCK'}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium text-white">
                                            {formatCurrency(data.price, data.currency)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Analyzed At & FX Rates */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Analyzed: {new Date(product.analyzedAt).toLocaleString()}</span>
                        <FxRatesTooltip fxRates={product.fxRates} />
                    </div>
                </div>
            )}
        </div>
    );
}
