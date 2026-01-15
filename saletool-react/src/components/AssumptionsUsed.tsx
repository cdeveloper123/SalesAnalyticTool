import { useState } from 'react';
import { FiInfo, FiChevronDown, FiChevronUp, FiClock, FiAlertCircle, FiCheckCircle, FiHelpCircle } from 'react-icons/fi';
import type { AssumptionsResponse, ShippingOverride, DutyOverride, FeeOverride } from '../types/assumptions';

interface AssumptionsUsedProps {
  assumptions: AssumptionsResponse;
}

export default function AssumptionsUsed({ assumptions }: AssumptionsUsedProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    shipping: false,
    duty: false,
    fees: false,
    currency: false
  });

  if (!assumptions) {
    return null;
  }

  const { details, dataFreshness, sourceConfidence, methodology, overrides } = assumptions;

  // Format timestamp for display
  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts);
      return date.toLocaleString();
    } catch {
      return ts;
    }
  };

  // Get currency symbol
  const getCurrencySymbol = (currency?: string) => {
    const symbols: Record<string, string> = {
      'USD': '$',
      'GBP': '£',
      'EUR': '€',
      'AUD': 'A$',
      'CAD': 'C$',
      'JPY': '¥',
      'CNY': '¥'
    };
    return symbols[currency || 'USD'] || currency || '$';
  };

  // Get confidence badge color and icon
  const getConfidenceBadge = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'high':
        return { color: 'text-green-400', bg: 'bg-green-400/20', icon: FiCheckCircle, label: 'High' };
      case 'medium':
        return { color: 'text-yellow-400', bg: 'bg-yellow-400/20', icon: FiAlertCircle, label: 'Medium' };
      case 'low':
        return { color: 'text-red-400', bg: 'bg-red-400/20', icon: FiHelpCircle, label: 'Low' };
      default:
        return { color: 'text-gray-400', bg: 'bg-gray-400/20', icon: FiHelpCircle, label: 'Unknown' };
    }
  };

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FiInfo className="text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-300">Assumptions Used</h3>
        </div>
      </div>

      <div className="space-y-3">
        {/* Shipping Assumptions */}
        {details.shipping && Object.keys(details.shipping).length > 0 && (
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('shipping')}
              className="w-full flex items-center justify-between p-3 bg-gray-750 hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-300">Shipping</span>
                <span className="text-xs text-gray-500">
                  ({Object.keys(details.shipping).length} route{Object.keys(details.shipping).length !== 1 ? 's' : ''})
                </span>
              </div>
              {expandedSections.shipping ? (
                <FiChevronUp className="text-gray-400" size={18} />
              ) : (
                <FiChevronDown className="text-gray-400" size={18} />
              )}
            </button>
            {expandedSections.shipping && (
              <div className="p-3 space-y-3 border-t border-gray-700">
                {Object.entries(details.shipping).map(([marketplace, shipping]) => {
                  const freshnessKey = `shipping_${marketplace}`;
                  const freshness = dataFreshness?.[freshnessKey];
                  const confidence = sourceConfidence?.[freshnessKey];
                  const method = methodology?.[freshnessKey];
                  const confidenceBadge = getConfidenceBadge(confidence?.level);

                  // Find matching override to show original override values
                  const shippingOverrideArray: ShippingOverride[] = overrides?.shippingOverrides
                    ? (Array.isArray(overrides.shippingOverrides) ? overrides.shippingOverrides : [overrides.shippingOverrides])
                    : [];
                  const matchingOverride = shippingOverrideArray.find((ov) =>
                    ov.destination?.toUpperCase() === marketplace.toUpperCase() &&
                    ov.origin?.toUpperCase() === shipping.origin.toUpperCase()
                  );

                  return (
                    <div key={marketplace} className="bg-gray-750 rounded p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-300">
                          {shipping.origin} → {marketplace}
                        </span>
                        {confidence && (
                          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${confidenceBadge.bg} ${confidenceBadge.color}`}>
                            <confidenceBadge.icon size={12} />
                            <span>{confidenceBadge.label}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-gray-400 space-y-1">
                        <div><span className="text-gray-500">Method:</span> {matchingOverride?.method || shipping.method}</div>
                        {(matchingOverride?.ratePerKg !== undefined || shipping.ratePerKg !== undefined) && (
                          <div><span className="text-gray-500">Rate:</span> ${(matchingOverride?.ratePerKg ?? shipping.ratePerKg ?? 0)}/kg</div>
                        )}
                        {(matchingOverride?.transitDays !== undefined || shipping.transitDays !== undefined) && (
                          <div><span className="text-gray-500">Transit:</span> {matchingOverride?.transitDays ?? shipping.transitDays ?? 0} days</div>
                        )}
                        {(matchingOverride?.minCharge !== undefined || shipping.minCharge !== undefined) && (
                          <div><span className="text-gray-500">Min Charge:</span> ${matchingOverride?.minCharge ?? shipping.minCharge ?? 0}</div>
                        )}
                      </div>

                      {/* Data Freshness */}
                      {freshness && (
                        <div className="text-xs text-gray-400 pt-2 border-t border-gray-700 space-y-1">
                          <div className="flex items-center gap-2">
                            <FiClock size={12} />
                            <span>Source: {freshness.source}</span>
                            {freshness.timestamp && (
                              <span className="text-gray-500">• Calculated: {formatTimestamp(freshness.timestamp)}</span>
                            )}
                          </div>
                          {freshness.dataSourceLastUpdated && (
                            <div className="text-gray-500 pl-5">
                              Data Updated: {formatTimestamp(freshness.dataSourceLastUpdated)}
                              {freshness.dataSourceVersion && ` (v${freshness.dataSourceVersion})`}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Methodology */}
                      {method && (
                        <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
                          <div className="text-gray-500 mb-1">Calculation:</div>
                          <div className="text-gray-300">{method.calculation}</div>
                        </div>
                      )}

                      {/* Confidence Reason */}
                      {confidence && (
                        <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
                          <div className="text-gray-500 mb-1">Confidence:</div>
                          <div className="text-gray-300">{confidence.reason}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Duty Assumptions */}
        {details.duty && Object.keys(details.duty).length > 0 && (
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('duty')}
              className="w-full flex items-center justify-between p-3 bg-gray-750 hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-300">Duty</span>
                <span className="text-xs text-gray-500">
                  ({Object.keys(details.duty).length} route{Object.keys(details.duty).length !== 1 ? 's' : ''})
                </span>
              </div>
              {expandedSections.duty ? (
                <FiChevronUp className="text-gray-400" size={18} />
              ) : (
                <FiChevronDown className="text-gray-400" size={18} />
              )}
            </button>
            {expandedSections.duty && (
              <div className="p-3 space-y-3 border-t border-gray-700">
                {Object.entries(details.duty).map(([marketplace, duty]) => {
                  const freshnessKey = `duty_${marketplace}`;
                  const freshness = dataFreshness?.[freshnessKey];
                  const confidence = sourceConfidence?.[freshnessKey];
                  const method = methodology?.[freshnessKey];
                  const confidenceBadge = getConfidenceBadge(confidence?.level);

                  // Find matching override to show original override value
                  const dutyOverrideArray: DutyOverride[] = overrides?.dutyOverrides
                    ? (Array.isArray(overrides.dutyOverrides) ? overrides.dutyOverrides : [overrides.dutyOverrides])
                    : [];
                  const matchingOverride = dutyOverrideArray.find((ov) =>
                    ov.destination?.toUpperCase() === marketplace.toUpperCase() &&
                    ov.origin?.toUpperCase() === duty.origin.toUpperCase()
                  );

                  return (
                    <div key={marketplace} className="bg-gray-750 rounded p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-300">
                          {duty.origin} → {marketplace}
                        </span>
                        {confidence && (
                          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${confidenceBadge.bg} ${confidenceBadge.color}`}>
                            <confidenceBadge.icon size={12} />
                            <span>{confidenceBadge.label}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-gray-400 space-y-1">
                        <div><span className="text-gray-500">Method:</span> {duty.calculationMethod}</div>
                        {duty.hsCode && <div><span className="text-gray-500">HS Code:</span> {duty.hsCode}</div>}
                        {duty.category && <div><span className="text-gray-500">Category:</span> {duty.category}</div>}
                        {/* Show override amount if it's a direct override, otherwise show calculated rate */}
                        {matchingOverride && matchingOverride.calculationMethod === 'direct' && matchingOverride.amount !== undefined ? (
                          <div><span className="text-gray-500">Duty Amount:</span> ${matchingOverride.amount.toFixed(2)}</div>
                        ) : matchingOverride && matchingOverride.rate !== undefined ? (
                          <div><span className="text-gray-500">Duty Rate:</span> {(matchingOverride.rate * 100).toFixed(2)}%</div>
                        ) : duty.ratePercent ? (
                          <div><span className="text-gray-500">Rate:</span> {duty.ratePercent}</div>
                        ) : null}
                        {duty.importVat !== undefined && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Import VAT:</span>
                            <span className="text-gray-300">${duty.importVat.toFixed(2)}</span>
                            {duty.reclaimVat && <span className="text-[10px] px-1 bg-green-500/20 text-green-400 rounded">Reclaimed</span>}
                          </div>
                        )}
                      </div>

                      {/* Data Freshness */}
                      {freshness && (
                        <div className="text-xs text-gray-400 pt-2 border-t border-gray-700 space-y-1">
                          <div className="flex items-center gap-2">
                            <FiClock size={12} />
                            <span>Source: {freshness.source}</span>
                            {freshness.timestamp && (
                              <span className="text-gray-500">• Calculated: {formatTimestamp(freshness.timestamp)}</span>
                            )}
                          </div>
                          {freshness.dataSourceLastUpdated && (
                            <div className="text-gray-500 pl-5">
                              Data Updated: {formatTimestamp(freshness.dataSourceLastUpdated)}
                              {freshness.dataSourceVersion && ` (v${freshness.dataSourceVersion})`}
                            </div>
                          )}
                          {freshness.hsCodeMappingLastUpdated && (
                            <div className="text-gray-500 pl-5">
                              HS Code Mapping Updated: {formatTimestamp(freshness.hsCodeMappingLastUpdated)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Methodology */}
                      {method && (
                        <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
                          <div className="text-gray-500 mb-1">Calculation:</div>
                          <div className="text-gray-300">{method.calculation}</div>
                        </div>
                      )}

                      {/* Confidence Reason */}
                      {confidence && (
                        <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
                          <div className="text-gray-500 mb-1">Confidence:</div>
                          <div className="text-gray-300">{confidence.reason}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Fee Assumptions */}
        {details.fees && Object.keys(details.fees).length > 0 && (
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('fees')}
              className="w-full flex items-center justify-between p-3 bg-gray-750 hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-300">Fees</span>
                <span className="text-xs text-gray-500">
                  ({Object.keys(details.fees).length} channel{Object.keys(details.fees).length !== 1 ? 's' : ''})
                </span>
              </div>
              {expandedSections.fees ? (
                <FiChevronUp className="text-gray-400" size={18} />
              ) : (
                <FiChevronDown className="text-gray-400" size={18} />
              )}
            </button>
            {expandedSections.fees && (
              <div className="p-3 space-y-3 border-t border-gray-700">
                {Object.entries(details.fees).map(([feeKey, fee]) => {
                  // Parse composite key: marketplace_channelName (e.g., "US_Amazon", "US_eBay", "US_Walmart", "US_Ingram Micro")
                  // For backward compatibility, handle both old format (just marketplace) and new format (marketplace_channel)
                  const isCompositeKey = feeKey.includes('_');
                  const marketplace = isCompositeKey ? feeKey.split('_')[0] : feeKey;
                  // Use retailer/distributor name from fee object if available, otherwise parse from key
                  let channelName = fee.channel || (isCompositeKey ? feeKey.split('_')[1] : 'Unknown');
                  // Check if fee has retailer or distributor name (for display purposes)
                  if ((fee as any).retailer) {
                    channelName = (fee as any).retailer;
                  } else if ((fee as any).distributor) {
                    channelName = (fee as any).distributor;
                  }

                  // Use composite key for freshness, confidence, and methodology
                  const freshnessKey = `fees_${feeKey}`;
                  const freshness = dataFreshness?.[freshnessKey];
                  const confidence = sourceConfidence?.[freshnessKey];
                  const method = methodology?.[freshnessKey];
                  const confidenceBadge = getConfidenceBadge(confidence?.level);

                  // Find matching override - try both composite key and marketplace match
                  const feeOverrideArray: FeeOverride[] = overrides?.feeOverrides
                    ? (Array.isArray(overrides.feeOverrides) ? overrides.feeOverrides : [overrides.feeOverrides])
                    : [];
                  const matchingOverride = feeOverrideArray.find((ov) => {
                    // Try matching by marketplace_channel if override has channel field
                    if (ov.marketplace && ov.channel) {
                      return ov.marketplace.toUpperCase() === marketplace.toUpperCase() &&
                        ov.channel === channelName;
                    }
                    // Fallback to marketplace-only match
                    return ov.marketplace?.toUpperCase() === marketplace.toUpperCase();
                  });

                  // Determine channel type for styling
                  const isAmazon = channelName === 'Amazon';
                  const isEbay = channelName === 'eBay';
                  const isRetailer = channelName === 'Retailer';
                  const isDistributor = channelName === 'Distributor';

                  // Get border color based on channel type
                  const borderColor = isAmazon
                    ? 'border-blue-500/30 bg-blue-500/5'
                    : isEbay
                      ? 'border-orange-500/30 bg-orange-500/5'
                      : isRetailer
                        ? 'border-purple-500/30 bg-purple-500/5'
                        : isDistributor
                          ? 'border-cyan-500/30 bg-cyan-500/5'
                          : 'border-gray-600/30';

                  // Format display name
                  const displayName = `${channelName}-${marketplace}`;

                  return (
                    <div key={feeKey} className={`bg-gray-750 rounded-lg p-3 space-y-2 border ${borderColor}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-300">{displayName}</span>
                        {confidence && (
                          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${confidenceBadge.bg} ${confidenceBadge.color}`}>
                            <confidenceBadge.icon size={12} />
                            <span>{confidenceBadge.label}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-gray-400 space-y-1">
                        <div><span className="text-gray-500">Sell Price:</span> {getCurrencySymbol(fee.currency)}{fee.sellPrice.toFixed(2)}</div>
                        {fee.sellPriceSource && <div><span className="text-gray-500">Price Source:</span> {fee.sellPriceSource}</div>}

                        {/* Amazon-specific fees */}
                        {isAmazon && (
                          <>
                            {(matchingOverride?.referralRate !== undefined || fee.referralRate !== undefined) && (
                              <div><span className="text-gray-500">Referral Rate:</span> {(matchingOverride?.referralRate !== undefined ? matchingOverride.referralRate * 100 : fee.referralRate).toFixed(1)}%</div>
                            )}
                            {(matchingOverride?.fbaFee !== undefined || fee.fbaFee !== undefined) && (
                              <div><span className="text-gray-500">FBA Fee:</span> {getCurrencySymbol(fee.currency)}{(matchingOverride?.fbaFee ?? fee.fbaFee ?? 0).toFixed(2)}</div>
                            )}
                            {(matchingOverride?.closingFee !== undefined || fee.closingFee > 0) && (
                              <div><span className="text-gray-500">Closing Fee:</span> {getCurrencySymbol(fee.currency)}{(matchingOverride?.closingFee ?? fee.closingFee ?? 0).toFixed(2)}</div>
                            )}
                          </>
                        )}

                        {/* eBay-specific fees */}
                        {isEbay && (
                          <>
                            {(fee.finalValueFee !== undefined && fee.finalValueFee > 0) && (
                              <div><span className="text-gray-500">Final Value Fee:</span> {getCurrencySymbol(fee.currency)}{fee.finalValueFee.toFixed(2)}</div>
                            )}
                            {(fee.perOrderFee !== undefined && fee.perOrderFee > 0) && (
                              <div><span className="text-gray-500">Per-Order Fee:</span> {getCurrencySymbol(fee.currency)}{fee.perOrderFee.toFixed(2)}</div>
                            )}
                          </>
                        )}

                        {/* Retailer/Distributor fees (similar to Amazon) */}
                        {(isRetailer || isDistributor) && (
                          <>
                            {(matchingOverride?.referralRate !== undefined || fee.referralRate !== undefined) && (
                              <div><span className="text-gray-500">Referral Rate:</span> {(matchingOverride?.referralRate !== undefined ? matchingOverride.referralRate * 100 : fee.referralRate).toFixed(1)}%</div>
                            )}
                            {(matchingOverride?.fbaFee !== undefined || fee.fbaFee !== undefined) && (
                              <div><span className="text-gray-500">FBA Fee:</span> {getCurrencySymbol(fee.currency)}{(matchingOverride?.fbaFee ?? fee.fbaFee ?? 0).toFixed(2)}</div>
                            )}
                            {(matchingOverride?.closingFee !== undefined || fee.closingFee > 0) && (
                              <div><span className="text-gray-500">Closing Fee:</span> {getCurrencySymbol(fee.currency)}{(matchingOverride?.closingFee ?? fee.closingFee ?? 0).toFixed(2)}</div>
                            )}
                          </>
                        )}

                        {/* Common fees */}
                        {(matchingOverride?.paymentFee !== undefined || fee.paymentFee !== undefined) && (
                          <div><span className="text-gray-500">Payment Fee:</span> {((matchingOverride?.paymentFee ?? fee.paymentFee ?? 0) * 100).toFixed(1)}%</div>
                        )}
                        {(matchingOverride?.vatRate !== undefined || fee.vatRate > 0) && (
                          <>
                            <div><span className="text-gray-500">VAT Rate:</span> {matchingOverride?.vatRate !== undefined ? (matchingOverride.vatRate * 100).toFixed(1) + '%' : fee.vatRate + '%'}</div>
                            <div><span className="text-gray-500">VAT Amount:</span> {getCurrencySymbol(fee.currency)}{(matchingOverride?.vatAmount ?? fee.vatAmount ?? 0).toFixed(2)}</div>
                          </>
                        )}
                        {(matchingOverride?.feeScheduleVersion || fee.feeScheduleVersion) && (
                          <div><span className="text-gray-500">Fee Schedule:</span> {matchingOverride?.feeScheduleVersion || fee.feeScheduleVersion}</div>
                        )}
                      </div>

                      {/* VAT Treatment */}
                      {method?.vatTreatment && (
                        <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
                          <div className="text-gray-500 mb-1">VAT Treatment:</div>
                          <div className="text-gray-300">{method.vatTreatment}</div>
                        </div>
                      )}

                      {/* Data Freshness */}
                      {freshness && (
                        <div className="text-xs text-gray-400 pt-2 border-t border-gray-700 space-y-1">
                          <div className="flex items-center gap-2">
                            <FiClock size={12} />
                            <span>Source: {freshness.source}</span>
                            {freshness.timestamp && (
                              <span className="text-gray-500">• Calculated: {formatTimestamp(freshness.timestamp)}</span>
                            )}
                            {freshness.feeScheduleVersion && (
                              <span className="text-gray-500">• Schedule: {freshness.feeScheduleVersion}</span>
                            )}
                          </div>
                          {freshness.feeScheduleLastUpdated && (
                            <div className="text-gray-500 pl-5">
                              Fee Schedule Updated: {formatTimestamp(freshness.feeScheduleLastUpdated)}
                              {freshness.dataSourceVersion && ` (v${freshness.dataSourceVersion})`}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Methodology */}
                      {method && (
                        <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
                          <div className="text-gray-500 mb-1">Calculation:</div>
                          <div className="text-gray-300">{method.calculation}</div>
                        </div>
                      )}

                      {/* Confidence Reason */}
                      {confidence && (
                        <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
                          <div className="text-gray-500 mb-1">Confidence:</div>
                          <div className="text-gray-300">{confidence.reason}</div>
                          {confidence.sellPriceConfidence && (
                            <div className="text-gray-500 mt-1">Sell Price: {confidence.sellPriceConfidence}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Currency Assumptions */}
        {details.currency && (
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('currency')}
              className="w-full flex items-center justify-between p-3 bg-gray-750 hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-300">Currency Exchange Rates</span>
              </div>
              {expandedSections.currency ? (
                <FiChevronUp className="text-gray-400" size={18} />
              ) : (
                <FiChevronDown className="text-gray-400" size={18} />
              )}
            </button>
            {expandedSections.currency && (
              <div className="p-3 space-y-2 border-t border-gray-700">
                <div className="bg-gray-750 rounded p-3 space-y-2">
                  <div className="text-xs text-gray-400 space-y-2">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-700/50">
                      <span className="text-gray-500 font-medium lowercase tracking-wide">Evaluation Base Currency</span>
                      <span className="text-white font-bold px-2 py-0.5 bg-gray-700 rounded text-[10px] uppercase">{details.currency.baseCurrency}</span>
                    </div>

                    {details.currency.fxRates && (
                      <div className="space-y-3 pt-1">
                        {/* Currency Pairs Grid */}
                        {details.currency.fxRates.pairs && Object.keys(details.currency.fxRates.pairs).length > 0 && (
                          <div className="space-y-2">
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">Applied Exchange Rates</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {Object.entries(details.currency.fxRates.pairs).map(([pair, data]) => (
                                <div key={pair} className="bg-gray-800/50 border border-gray-700 rounded p-2 flex flex-col gap-1">
                                  <div className="flex justify-between items-center">
                                    <span className="text-blue-400 font-bold text-[10px] tracking-tight">1 {pair.split('/')[0]} =</span>
                                    <span className="text-white font-mono text-xs">{data.rate.toFixed(4)} {pair.split('/')[1]}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[9px]">
                                    <span className="text-gray-500 italic">
                                      {new Date(data.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}, {new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className={`px-1 rounded-[2px] uppercase font-bold tracking-tighter ${data.source === 'live' ? 'text-green-400' : 'text-yellow-400'}`}>
                                      {data.source}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="text-[10px] pt-2 border-t border-gray-700/50 flex flex-wrap gap-x-4 gap-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-500">Source:</span>
                            <span className="text-gray-300">{details.currency.fxRates.source}</span>
                          </div>
                          {details.currency.fxRates.timestamp && (
                            <div className="flex items-center gap-1.5">
                              <FiClock size={10} className="text-gray-500" />
                              <span className="text-gray-500">Global Sync:</span>
                              <span className="text-gray-300">{formatTimestamp(details.currency.fxRates.timestamp)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Currency Data Freshness */}
                  {dataFreshness?.currency && (
                    <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
                      <div className="flex items-center gap-2">
                        <FiClock size={12} />
                        <span>Source: {dataFreshness.currency.source}</span>
                        {dataFreshness.currency.timestamp && (
                          <span className="text-gray-500">• {formatTimestamp(dataFreshness.currency.timestamp)}</span>
                        )}
                        {dataFreshness.currency.isExpired && (
                          <span className="text-yellow-400">• Expired</span>
                        )}
                      </div>
                      {dataFreshness.currency.cacheAge && (
                        <div className="text-gray-500 mt-1">Cache Age: {dataFreshness.currency.cacheAge}</div>
                      )}
                    </div>
                  )}

                  {/* Currency Methodology */}
                  {methodology?.currency && (
                    <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
                      <div className="text-gray-500 mb-1">Calculation:</div>
                      <div className="text-gray-300">{methodology.currency.calculation}</div>
                    </div>
                  )}

                  {/* Currency Confidence */}
                  {sourceConfidence?.currency && (
                    <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
                      <div className="text-gray-500 mb-1">Confidence:</div>
                      <div className="text-gray-300">{sourceConfidence.currency.reason}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

