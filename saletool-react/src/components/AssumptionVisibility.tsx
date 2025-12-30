import { FiInfo, FiCheck, FiX } from 'react-icons/fi';
import type { AssumptionsResponse } from '../types/assumptions';

interface AssumptionVisibilityProps {
  assumptions: AssumptionsResponse;
}

export default function AssumptionVisibility({ assumptions }: AssumptionVisibilityProps) {
  if (!assumptions) {
    return null;
  }

  const { version, timestamp, summary, details, overrides } = assumptions;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <FiInfo className="text-blue-400" />
        <h3 className="text-lg font-semibold text-gray-300">Assumptions Used</h3>
        {summary.hasOverrides && (
          <span className="px-2 py-0.5 bg-yellow-600 text-white text-xs rounded-full">
            Overrides Active
          </span>
        )}
      </div>

      <div className="space-y-4 text-sm">
        {/* Version Info */}
        <div className="pb-3 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Assumption Set Version:</span>
            <span className="text-gray-300 font-medium">{version.version}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-gray-400">Set Date:</span>
            <span className="text-gray-300">{version.setDate}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-gray-400">Calculation Timestamp:</span>
            <span className="text-gray-300">{new Date(timestamp).toLocaleString()}</span>
          </div>
        </div>

        {/* Shipping Assumptions */}
        {Object.keys(details.shipping || {}).length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-300 mb-2">Shipping Assumptions</h4>
            <div className="space-y-2">
              {Object.entries(details.shipping).map(([marketplace, shipping]) => (
                <div key={marketplace} className="bg-gray-750 rounded p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-300 font-medium">{marketplace}</span>
                    {shipping.isOverridden ? (
                      <span className="flex items-center gap-1 text-yellow-400 text-xs">
                        <FiCheck size={12} />
                        Overridden
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-500 text-xs">
                        <FiX size={12} />
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-gray-400 text-xs space-y-1">
                    <div>{shipping.origin} → {shipping.destination}</div>
                    <div>Method: {shipping.method}</div>
                    {shipping.ratePerKg && <div>Rate: ${shipping.ratePerKg}/kg</div>}
                    {shipping.transitDays && <div>Transit: {shipping.transitDays} days</div>}
                    {shipping.minCharge && <div>Min Charge: ${shipping.minCharge}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Duty Assumptions */}
        {Object.keys(details.duty || {}).length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-300 mb-2">Duty Assumptions</h4>
            <div className="space-y-2">
              {Object.entries(details.duty).map(([marketplace, duty]) => (
                <div key={marketplace} className="bg-gray-750 rounded p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-300 font-medium">{marketplace}</span>
                    {duty.isOverridden ? (
                      <span className="flex items-center gap-1 text-yellow-400 text-xs">
                        <FiCheck size={12} />
                        Overridden
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-500 text-xs">
                        <FiX size={12} />
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-gray-400 text-xs space-y-1">
                    <div>{duty.origin} → {duty.destination}</div>
                    <div>Method: {duty.calculationMethod}</div>
                    {duty.hsCode && <div>HS Code: {duty.hsCode}</div>}
                    {duty.ratePercent && <div>Rate: {duty.ratePercent}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fee Assumptions */}
        {Object.keys(details.fees || {}).length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-300 mb-2">Fee Assumptions</h4>
            <div className="space-y-2">
              {Object.entries(details.fees).map(([marketplace, fee]) => (
                <div key={marketplace} className="bg-gray-750 rounded p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-300 font-medium">{marketplace}</span>
                    {fee.isOverridden ? (
                      <span className="flex items-center gap-1 text-yellow-400 text-xs">
                        <FiCheck size={12} />
                        Overridden
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-500 text-xs">
                        <FiX size={12} />
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-gray-400 text-xs space-y-1">
                    <div>Referral Rate: {(fee.referralRate * 100).toFixed(1)}%</div>
                    <div>FBA Fee: ${fee.fbaFee.toFixed(2)}</div>
                    {fee.closingFee > 0 && <div>Closing Fee: ${fee.closingFee.toFixed(2)}</div>}
                    <div>VAT Rate: {fee.vatRate.toFixed(1)}%</div>
                    <div>Schedule Version: {fee.feeScheduleVersion}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Currency Assumptions */}
        {details.currency && (
          <div>
            <h4 className="font-semibold text-gray-300 mb-2">Currency Assumptions</h4>
            <div className="bg-gray-750 rounded p-2">
              <div className="text-gray-400 text-xs space-y-1">
                <div>Buy Price Currency: {details.currency.buyPriceCurrency}</div>
                <div>FX Rate Source: {details.currency.fxRates.source}</div>
                <div>FX Rate Timestamp: {new Date(details.currency.fxRates.timestamp).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

