import { useState } from 'react';
import { FiInfo, FiCheck, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import type { AssumptionsResponse, ShippingOverride, DutyOverride, FeeOverride } from '../types/assumptions';

interface AssumptionVisibilityProps {
  assumptions: AssumptionsResponse;
}

export default function AssumptionVisibility({ assumptions }: AssumptionVisibilityProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!assumptions) {
    return null;
  }

  const { summary, overrides } = assumptions;

  // Normalize overrides to arrays (can be single object or array)
  const normalizeToArray = <T,>(value: T | T[] | undefined): T[] => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  const shippingOverrides = normalizeToArray<ShippingOverride>(overrides?.shippingOverrides);
  const dutyOverrides = normalizeToArray<DutyOverride>(overrides?.dutyOverrides);
  const feeOverrides = normalizeToArray<FeeOverride>(overrides?.feeOverrides);

  // Check if there are any overrides to show
  const hasOverrides = shippingOverrides.length > 0 || 
                       dutyOverrides.length > 0 || 
                       feeOverrides.length > 0;

  // If there are no overrides, show a message
  if (!hasOverrides && !summary.hasOverrides) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <FiInfo className="text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-300">Assumption Overrides</h3>
        </div>
        <div className="mt-3 text-sm text-gray-400">
          No assumption overrides are currently active. All calculations use default assumptions.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      {/* Header - Clickable to expand/collapse */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-2 mb-0 text-left"
      >
        <div className="flex items-center gap-2">
          <FiInfo className="text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-300">Assumption Overrides</h3>
          {summary.hasOverrides && (
            <span className="px-2 py-0.5 bg-yellow-600 text-white text-xs rounded-full">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasOverrides && (
            <span className="text-xs text-gray-400">
              {shippingOverrides.length + dutyOverrides.length + feeOverrides.length} override(s)
            </span>
          )}
          {isExpanded ? (
            <FiChevronUp className="text-gray-400" size={20} />
          ) : (
            <FiChevronDown className="text-gray-400" size={20} />
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="space-y-4 text-sm mt-4 pt-4 border-t border-gray-700">
          {/* Shipping Overrides */}
          {shippingOverrides.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-300 mb-2">Shipping Overrides</h4>
              <div className="space-y-2">
                {shippingOverrides.map((shipping, index) => (
                  <div key={index} className="bg-gray-750 rounded p-3 border border-yellow-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-300 font-medium">{shipping.origin} → {shipping.destination}</span>
                      <span className="flex items-center gap-1 text-yellow-400 text-xs">
                        <FiCheck size={12} />
                        Overridden
                      </span>
                    </div>
                    <div className="text-gray-400 text-xs space-y-1">
                      {shipping.method && <div><span className="text-gray-500">Method:</span> {shipping.method}</div>}
                      {shipping.ratePerKg !== undefined && <div><span className="text-gray-500">Rate:</span> ${shipping.ratePerKg}/kg</div>}
                      {shipping.transitDays !== undefined && <div><span className="text-gray-500">Transit:</span> {shipping.transitDays} days</div>}
                      {shipping.minCharge !== undefined && <div><span className="text-gray-500">Min Charge:</span> ${shipping.minCharge}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duty Overrides */}
          {dutyOverrides.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-300 mb-2">Duty Overrides</h4>
              <div className="space-y-2">
                {dutyOverrides.map((duty, index) => (
                  <div key={index} className="bg-gray-750 rounded p-3 border border-yellow-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-300 font-medium">{duty.origin} → {duty.destination}</span>
                      <span className="flex items-center gap-1 text-yellow-400 text-xs">
                        <FiCheck size={12} />
                        Overridden
                      </span>
                    </div>
                    <div className="text-gray-400 text-xs space-y-1">
                      {duty.calculationMethod && <div><span className="text-gray-500">Method:</span> {duty.calculationMethod}</div>}
                      {duty.hsCode && <div><span className="text-gray-500">HS Code:</span> {duty.hsCode}</div>}
                      {duty.rate !== undefined && <div><span className="text-gray-500">Duty Rate:</span> {(duty.rate * 100).toFixed(2)}%</div>}
                      {duty.amount !== undefined && <div><span className="text-gray-500">Duty Amount:</span> ${duty.amount.toFixed(2)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fee Overrides */}
          {feeOverrides.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-300 mb-2">Fee Overrides</h4>
              <div className="space-y-2">
                {feeOverrides.map((fee, index) => (
                  <div key={index} className="bg-gray-750 rounded p-3 border border-yellow-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-300 font-medium">{fee.marketplace}</span>
                      <span className="flex items-center gap-1 text-yellow-400 text-xs">
                        <FiCheck size={12} />
                        Overridden
                      </span>
                    </div>
                    <div className="text-gray-400 text-xs space-y-1">
                      {fee.referralRate !== undefined && <div><span className="text-gray-500">Referral Rate:</span> {(fee.referralRate * 100).toFixed(1)}%</div>}
                      {fee.fbaFee !== undefined && <div><span className="text-gray-500">FBA Fee:</span> ${fee.fbaFee.toFixed(2)}</div>}
                      {fee.closingFee !== undefined && fee.closingFee > 0 && <div><span className="text-gray-500">Closing Fee:</span> ${fee.closingFee.toFixed(2)}</div>}
                      {fee.paymentFee !== undefined && <div><span className="text-gray-500">Payment Fee:</span> {(fee.paymentFee * 100).toFixed(1)}%</div>}
                      {fee.feeScheduleVersion && <div><span className="text-gray-500">Schedule Version:</span> {fee.feeScheduleVersion}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show message if no overrides but hasOverrides flag is true */}
          {!hasOverrides && summary.hasOverrides && (
            <div className="text-sm text-gray-400 italic">
              Overrides were applied but details are not available.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

