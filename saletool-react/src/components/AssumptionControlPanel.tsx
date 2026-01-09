import { useState, useEffect, useRef } from 'react';
import { FiChevronDown, FiChevronUp, FiSettings, FiZap } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Input from './Input';
import Select from './Select';
import Button from './Button';
import { suggestHsCode } from '../services/assumptionService';
import type {
  AssumptionOverrides,
  ShippingOverride,
  DutyOverride,
  FeeOverride
} from '../types/assumptions';

interface AssumptionControlPanelProps {
  overrides: AssumptionOverrides;
  onChange: (overrides: AssumptionOverrides) => void;
  supplierRegion?: string;
  productCategory?: string;  // For HS code suggestion
  productName?: string;      // For HS code suggestion
  showSuggestButton?: boolean; // Whether to show the HS code suggest button (default: true)
}

const REGIONS = [
  { value: 'CN', label: 'China (CN)' },
  { value: 'US', label: 'United States (US)' },
  { value: 'UK', label: 'United Kingdom (UK)' },
  { value: 'DE', label: 'Germany (DE)' },
  { value: 'FR', label: 'France (FR)' },
  { value: 'IT', label: 'Italy (IT)' },
  { value: 'AU', label: 'Australia (AU)' },
];

const MARKETPLACES = [
  { value: 'US', label: 'United States (US)' },
  { value: 'UK', label: 'United Kingdom (UK)' },
  { value: 'DE', label: 'Germany (DE)' },
  { value: 'FR', label: 'France (FR)' },
  { value: 'IT', label: 'Italy (IT)' },
  { value: 'AU', label: 'Australia (AU)' },
];

const SHIPPING_METHODS = [
  { value: 'sea', label: 'Sea Freight' },
  { value: 'air', label: 'Air Freight' },
  { value: 'express', label: 'Express' },
];

const DUTY_CALCULATION_METHODS = [
  { value: 'category', label: 'Category-Based' },
  { value: 'hscode', label: 'HS Code-Based' },
  { value: 'direct', label: 'Direct Amount' },
];

export default function AssumptionControlPanel({
  overrides,
  onChange,
  supplierRegion = 'CN',
  productCategory,
  productName,
  showSuggestButton = true // Default to true for edit mode
}: AssumptionControlPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'shipping' | 'duty' | 'fees'>('shipping');
  const [isSuggestingHsCode, setIsSuggestingHsCode] = useState(false);

  // Shipping override state
  const [shippingOverride, setShippingOverride] = useState<ShippingOverride>({
    origin: supplierRegion,
    destination: 'US',
    method: 'air',
  });

  // Duty override state
  const [dutyOverride, setDutyOverride] = useState<DutyOverride>({
    origin: supplierRegion,
    destination: 'US',
    calculationMethod: 'category',
  });

  // Fee override state
  const [feeOverride, setFeeOverride] = useState<FeeOverride>({
    marketplace: 'US',
  });

  // Store raw string values for rate inputs to allow intermediate states like "0."
  const [rateInputValues, setRateInputValues] = useState<{
    dutyRate?: string;
    referralRate?: string;
    vatRate?: string;
    paymentFee?: string;
  }>({});

  // Track if we're updating from user input (to prevent useEffect from overwriting)
  const isUserInputRef = useRef(false);
  const prevOverridesRef = useRef<AssumptionOverrides>({});
  const isInitialMountRef = useRef(true);
  
  // Sync internal state with overrides prop when it changes (e.g., when preset is applied or modal loads)
  // Only sync if the change came from outside (preset applied, initial load), not from user input
  useEffect(() => {
    // Skip if this change was triggered by user input
    if (isUserInputRef.current) {
      isUserInputRef.current = false;
      prevOverridesRef.current = overrides;
      isInitialMountRef.current = false;
      return;
    }
    
    const prevOverrides = prevOverridesRef.current;
    const isInitialLoad = isInitialMountRef.current;
    const hasShippingChanged = JSON.stringify(prevOverrides.shippingOverrides) !== JSON.stringify(overrides.shippingOverrides);
    const hasDutyChanged = JSON.stringify(prevOverrides.dutyOverrides) !== JSON.stringify(overrides.dutyOverrides);
    const hasFeesChanged = JSON.stringify(prevOverrides.feeOverrides) !== JSON.stringify(overrides.feeOverrides);
    
    // Only update shipping if shipping overrides actually changed or this is initial load
    if (hasShippingChanged || isInitialLoad) {
      if (overrides.shippingOverrides) {
        const shippingOverrides = Array.isArray(overrides.shippingOverrides) 
          ? overrides.shippingOverrides 
          : [overrides.shippingOverrides];
        if (shippingOverrides.length > 0) {
          const firstOverride = shippingOverrides[0];
          setShippingOverride({
            origin: firstOverride.origin || supplierRegion,
            destination: firstOverride.destination || 'US',
            method: firstOverride.method || 'air',
            ratePerKg: firstOverride.ratePerKg,
            transitDays: firstOverride.transitDays,
            minCharge: firstOverride.minCharge,
          });
          // Auto-expand panel when preset is applied or initial load with overrides
          if (isInitialLoad || hasShippingChanged) {
            setIsExpanded(true);
            setActiveTab('shipping');
          }
        }
      } else if (!isInitialLoad) {
        // Only reset to defaults if shipping overrides were removed (not on initial load)
        setShippingOverride({
          origin: supplierRegion,
          destination: 'US',
          method: 'air',
        });
      }
    }

    // Only update duty if duty overrides actually changed or this is initial load
    if (hasDutyChanged || isInitialLoad) {
      if (overrides.dutyOverrides) {
        const dutyOverrides = Array.isArray(overrides.dutyOverrides)
          ? overrides.dutyOverrides
          : [overrides.dutyOverrides];
        if (dutyOverrides.length > 0) {
          const firstOverride = dutyOverrides[0];
          setDutyOverride({
            origin: firstOverride.origin || supplierRegion,
            destination: firstOverride.destination || 'US',
            calculationMethod: firstOverride.calculationMethod || 'category',
            hsCode: firstOverride.hsCode,
            rate: firstOverride.rate,
            amount: firstOverride.amount,
          });
          // Clear raw input values when syncing from outside
          setRateInputValues(prev => ({ ...prev, dutyRate: undefined }));
          // Auto-expand panel when preset is applied or initial load with overrides
          if (isInitialLoad || hasDutyChanged) {
            setIsExpanded(true);
            if (!hasShippingChanged && !isInitialLoad) {
              setActiveTab('duty');
            } else if (isInitialLoad && !overrides.shippingOverrides) {
              setActiveTab('duty');
            }
          }
        }
      } else if (!isInitialLoad) {
        // Only reset to defaults if duty overrides were removed (not on initial load)
        setDutyOverride({
          origin: supplierRegion,
          destination: 'US',
          calculationMethod: 'category',
        });
        setRateInputValues(prev => ({ ...prev, dutyRate: undefined }));
      }
    }

    // Only update fees if fee overrides actually changed or this is initial load
    if (hasFeesChanged || isInitialLoad) {
      if (overrides.feeOverrides) {
        const feeOverrides = Array.isArray(overrides.feeOverrides)
          ? overrides.feeOverrides
          : [overrides.feeOverrides];
        if (feeOverrides.length > 0) {
          const firstOverride = feeOverrides[0];
          setFeeOverride({
            marketplace: firstOverride.marketplace || 'US',
            referralRate: firstOverride.referralRate,
            fbaFee: firstOverride.fbaFee,
            closingFee: firstOverride.closingFee,
            paymentFee: firstOverride.paymentFee,
            vatRate: firstOverride.vatRate,
            vatAmount: firstOverride.vatAmount,
            feeScheduleVersion: firstOverride.feeScheduleVersion,
          });
          // Clear raw input values when syncing from outside
          setRateInputValues(prev => ({ ...prev, referralRate: undefined, paymentFee: undefined, vatRate: undefined }));
          // Auto-expand panel when preset is applied or initial load with overrides
          if (isInitialLoad || hasFeesChanged) {
            setIsExpanded(true);
            if (!hasShippingChanged && !hasDutyChanged && !isInitialLoad) {
              setActiveTab('fees');
            } else if (isInitialLoad && !overrides.shippingOverrides && !overrides.dutyOverrides) {
              setActiveTab('fees');
            }
          }
        }
      } else if (!isInitialLoad) {
        // Only reset to defaults if fee overrides were removed (not on initial load)
        setFeeOverride({
          marketplace: 'US',
        });
        setRateInputValues(prev => ({ ...prev, referralRate: undefined, paymentFee: undefined, vatRate: undefined }));
      }
    }
    
    // Update ref for next comparison
    prevOverridesRef.current = overrides;
    isInitialMountRef.current = false;
  }, [overrides, supplierRegion]);

  const handleShippingChange = (field: keyof ShippingOverride, value: any) => {
    const updated = { ...shippingOverride, [field]: value };
    setShippingOverride(updated);
    
    // Mark as user input to prevent useEffect from overwriting
    isUserInputRef.current = true;
    
    const shippingOverrides = Array.isArray(overrides.shippingOverrides)
      ? [...overrides.shippingOverrides]
      : overrides.shippingOverrides ? [overrides.shippingOverrides] : [];
    
    // Update or add override
    const existingIndex = shippingOverrides.findIndex(
      o => o.origin === updated.origin && o.destination === updated.destination
    );
    
    if (existingIndex >= 0) {
      shippingOverrides[existingIndex] = updated;
    } else {
      shippingOverrides.push(updated);
    }
    
    onChange({ ...overrides, shippingOverrides });
  };

  const handleDutyChange = (field: keyof DutyOverride, value: any) => {
    let updated = { ...dutyOverride, [field]: value };
    
    // When calculation method changes, clear irrelevant fields
    if (field === 'calculationMethod') {
      if (value === 'hscode') {
        // Clear amount when switching to HS code method
        updated = { ...updated, amount: undefined };
      } else if (value === 'direct') {
        // Clear rate and hsCode when switching to direct method
        updated = { ...updated, rate: undefined, hsCode: undefined };
      } else if (value === 'category') {
        // Clear all override fields when switching to category method
        updated = { ...updated, amount: undefined, rate: undefined, hsCode: undefined };
      }
    }
    
    setDutyOverride(updated);
    
    // Mark as user input to prevent useEffect from overwriting
    isUserInputRef.current = true;
    
    // Only save if origin and destination are set (required fields)
    if (!updated.origin || !updated.destination) {
      return;
    }
    
    const dutyOverrides = Array.isArray(overrides.dutyOverrides)
      ? [...overrides.dutyOverrides]
      : overrides.dutyOverrides ? [overrides.dutyOverrides] : [];
    
    // Find existing override for this exact route
    const existingIndex = dutyOverrides.findIndex(
      o => o.origin === updated.origin && o.destination === updated.destination
    );
    
    if (existingIndex >= 0) {
      // Update existing override for this route
      dutyOverrides[existingIndex] = updated;
    } else {
      // Add new override only if it has required fields and a value to override
      const hasOverrideValue = updated.amount !== undefined || 
                               updated.rate !== undefined || 
                               updated.hsCode !== undefined ||
                               updated.calculationMethod !== 'category';
      
      if (hasOverrideValue) {
        dutyOverrides.push(updated);
      }
    }
    
    // Only update if there are overrides to save
    onChange({ 
      ...overrides, 
      dutyOverrides: dutyOverrides.length > 0 ? dutyOverrides : undefined 
    });
  };

  const handleFeeChange = (field: keyof FeeOverride, value: any) => {
    const updated = { ...feeOverride, [field]: value };
    setFeeOverride(updated);
    
    // Mark as user input to prevent useEffect from overwriting
    isUserInputRef.current = true;
    
    const feeOverrides = Array.isArray(overrides.feeOverrides)
      ? [...overrides.feeOverrides]
      : overrides.feeOverrides ? [overrides.feeOverrides] : [];
    
    const existingIndex = feeOverrides.findIndex(
      o => o.marketplace === updated.marketplace
    );
    
    if (existingIndex >= 0) {
      feeOverrides[existingIndex] = updated;
    } else {
      feeOverrides.push(updated);
    }
    
    onChange({ ...overrides, feeOverrides });
  };

  // Validation handlers for input fields
  const handleHsCodeKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Only allow numeric keys (0-9) and control/navigation keys
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End'
    ];
    
    // Allow control key combinations (Ctrl+A, Ctrl+C, Ctrl+V, etc.)
    if (e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow navigation and control keys
    if (allowedKeys.includes(e.key)) {
      return;
    }
    
    // Only allow digits 0-9
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleHsCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove any non-numeric characters
    const numericValue = e.target.value.replace(/[^0-9]/g, '');
    
    // Limit to 10 digits max (HS codes are 6-10 digits)
    const limitedValue = numericValue.slice(0, 10);
    
    handleDutyChange('hsCode', limitedValue || undefined);
  };

  const handleHsCodeBlur = () => {
    // Validate HS code length on blur (must be 6-10 digits)
    if (dutyOverride.hsCode) {
      const length = dutyOverride.hsCode.length;
      if (length < 6 || length > 10) {
        toast.error(`HS Code must be 6-10 digits. Current length: ${length}`);
        // Clear invalid value
        handleDutyChange('hsCode', undefined);
      }
    }
  };

  const handleRateKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, currentValue: string) => {
    // Only allow numeric keys (0-9), decimal point, and control/navigation keys
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End'
    ];
    
    // Allow control key combinations (Ctrl+A, Ctrl+C, Ctrl+V, etc.)
    if (e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow navigation and control keys
    if (allowedKeys.includes(e.key)) {
      return;
    }
    
    // Allow decimal point only if not already present
    if (e.key === '.' && !currentValue.includes('.')) {
      return;
    }
    
    // Only allow digits 0-9
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleDutyRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Remove any non-numeric characters except decimal point
    value = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Store raw string value to allow intermediate states like "0."
    setRateInputValues(prev => ({ ...prev, dutyRate: value }));
    
    // If empty, clear the value
    if (value === '') {
      handleDutyChange('rate', undefined);
      return;
    }
    
    // Allow intermediate states like "." or "0." while typing
    if (value === '.' || value.endsWith('.')) {
      // Don't parse yet, just store the raw string
      return;
    }
    
    // Parse and validate range (0-1) for complete values
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      // Clamp to 0-1 range
      if (numValue < 0) {
        handleDutyChange('rate', 0);
        setRateInputValues(prev => ({ ...prev, dutyRate: '0' }));
      } else if (numValue > 1) {
        handleDutyChange('rate', 1);
        setRateInputValues(prev => ({ ...prev, dutyRate: '1' }));
      } else {
        handleDutyChange('rate', numValue);
      }
    }
  };

  const handleFeeRateChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'referralRate' | 'paymentFee' | 'vatRate'
  ) => {
    let value = e.target.value;
    
    // Remove any non-numeric characters except decimal point
    value = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Store raw string value to allow intermediate states like "0."
    const inputKey = field;
    setRateInputValues(prev => ({ ...prev, [inputKey]: value }));
    
    // If empty, clear the value
    if (value === '') {
      handleFeeChange(field, undefined);
      return;
    }
    
    // Allow intermediate states like "." or "0." while typing
    if (value === '.' || value.endsWith('.')) {
      // Don't parse yet, just store the raw string
      return;
    }
    
    // Parse and validate range (0-1) for complete values
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      // Clamp to 0-1 range
      if (numValue < 0) {
        handleFeeChange(field, 0);
        setRateInputValues(prev => ({ ...prev, [inputKey]: '0' }));
      } else if (numValue > 1) {
        handleFeeChange(field, 1);
        setRateInputValues(prev => ({ ...prev, [inputKey]: '1' }));
      } else {
        handleFeeChange(field, numValue);
      }
    }
  };


  const handleSuggestHsCode = async () => {
    if (!productCategory && !productName) {
      toast.error('Product category or name is required to suggest HS code');
      return;
    }

    setIsSuggestingHsCode(true);
    try {
      const result = await suggestHsCode(productCategory, productName);
      if (result.success && result.data.hsCode) {
        handleDutyChange('hsCode', result.data.hsCode);
        
        const confidenceEmoji = result.data.confidence === 'high' ? '🎯' : 
                                result.data.confidence === 'medium' ? '✓' : '?';
        toast.success(
          `${confidenceEmoji} HS Code: ${result.data.hsCode}\n${result.data.chapterDescription || 'Suggested based on ' + result.data.source}`
        );
      } else {
        toast.error('Could not suggest HS code for this product');
      }
    } catch (error) {
      console.error('Error suggesting HS code:', error);
      toast.error('Failed to suggest HS code');
    } finally {
      setIsSuggestingHsCode(false);
    }
  };

  const hasOverrides = 
    (overrides.shippingOverrides && (Array.isArray(overrides.shippingOverrides) ? overrides.shippingOverrides.length > 0 : true)) ||
    (overrides.dutyOverrides && (Array.isArray(overrides.dutyOverrides) ? overrides.dutyOverrides.length > 0 : true)) ||
    (overrides.feeOverrides && (Array.isArray(overrides.feeOverrides) ? overrides.feeOverrides.length > 0 : true));

  return (
    <div className="border border-gray-700 rounded-lg bg-gray-800">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FiSettings className="text-gray-400" />
          <span className="font-semibold text-gray-300">Assumptions & Overrides</span>
          {hasOverrides && (
            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
              Active
            </span>
          )}
        </div>
        {isExpanded ? (
          <FiChevronUp className="text-gray-400" />
        ) : (
          <FiChevronDown className="text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-700">
          {/* Tabs */}
          <div className="flex gap-2 mt-4 mb-4 border-b border-gray-700">
            <button
              type="button"
              onClick={() => setActiveTab('shipping')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'shipping'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Shipping
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('duty')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'duty'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Duty
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('fees')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'fees'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Fees
            </button>
          </div>

          {/* Shipping Tab */}
          {activeTab === 'shipping' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Origin"
                  value={shippingOverride.origin}
                  onChange={(e) => handleShippingChange('origin', e.target.value)}
                  options={REGIONS}
                />
                <Select
                  label="Destination"
                  value={shippingOverride.destination}
                  onChange={(e) => handleShippingChange('destination', e.target.value)}
                  options={REGIONS}
                />
              </div>
              <Select
                label="Shipping Method"
                value={shippingOverride.method || 'air'}
                onChange={(e) => handleShippingChange('method', e.target.value)}
                options={SHIPPING_METHODS}
              />
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Rate per KG (USD)"
                  type="number"
                  step="0.01"
                  value={shippingOverride.ratePerKg || ''}
                  onChange={(e) => handleShippingChange('ratePerKg', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="Auto"
                />
                <Input
                  label="Transit Days"
                  type="number"
                  value={shippingOverride.transitDays || ''}
                  onChange={(e) => handleShippingChange('transitDays', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Auto"
                />
                <Input
                  label="Min Charge (USD)"
                  type="number"
                  step="0.01"
                  value={shippingOverride.minCharge || ''}
                  onChange={(e) => handleShippingChange('minCharge', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="Auto"
                />
              </div>
            </div>
          )}

          {/* Duty Tab */}
          {activeTab === 'duty' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Origin"
                  value={dutyOverride.origin}
                  onChange={(e) => handleDutyChange('origin', e.target.value)}
                  options={REGIONS}
                />
                <Select
                  label="Destination"
                  value={dutyOverride.destination}
                  onChange={(e) => handleDutyChange('destination', e.target.value)}
                  options={REGIONS}
                />
              </div>
              <Select
                label="Calculation Method"
                value={dutyOverride.calculationMethod || 'category'}
                onChange={(e) => handleDutyChange('calculationMethod', e.target.value)}
                options={DUTY_CALCULATION_METHODS}
              />
              {dutyOverride.calculationMethod === 'hscode' && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      label="HS Code (6-10 digits)"
                      type="text"
                      value={dutyOverride.hsCode || ''}
                      onChange={handleHsCodeChange}
                      onKeyPress={handleHsCodeKeyPress}
                      onBlur={handleHsCodeBlur}
                      placeholder="e.g., 9504500000"
                      pattern="[0-9]{6,10}"
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </div>
                  {showSuggestButton && (
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleSuggestHsCode}
                        disabled={isSuggestingHsCode || (!productCategory && !productName)}
                        className="flex items-center gap-1 whitespace-nowrap"
                        title={productCategory || productName ? 'Suggest HS code based on product' : 'Product category/name required'}
                      >
                        <FiZap size={14} />
                        {isSuggestingHsCode ? 'Suggesting...' : 'Suggest'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {dutyOverride.calculationMethod === 'hscode' && (
                <Input
                  label="Duty Rate (0-1, e.g., 0.12 for 12%)"
                  type="text"
                  inputMode="decimal"
                  value={rateInputValues.dutyRate !== undefined ? rateInputValues.dutyRate : (dutyOverride.rate !== undefined ? dutyOverride.rate.toString() : '')}
                  onChange={handleDutyRateChange}
                  onKeyPress={(e) => handleRateKeyPress(e, rateInputValues.dutyRate || (dutyOverride.rate !== undefined ? dutyOverride.rate.toString() : ''))}
                  onBlur={() => {
                    // On blur, ensure we have a valid number or clear
                    if (rateInputValues.dutyRate === '.' || rateInputValues.dutyRate === '') {
                      handleDutyChange('rate', undefined);
                      setRateInputValues(prev => ({ ...prev, dutyRate: undefined }));
                    }
                  }}
                  placeholder="Auto"
                />
              )}
              {dutyOverride.calculationMethod === 'direct' && (
                <Input
                  label="Direct Duty Amount (USD)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={dutyOverride.amount || ''}
                  onChange={(e) => handleDutyChange('amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="Enter amount"
                />
              )}
            </div>
          )}

          {/* Fees Tab */}
          {activeTab === 'fees' && (
            <div className="space-y-4">
              <Select
                label="Marketplace"
                value={feeOverride.marketplace}
                onChange={(e) => handleFeeChange('marketplace', e.target.value)}
                options={MARKETPLACES}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Referral Fee Rate (0-1, e.g., 0.15 for 15%)"
                  type="text"
                  inputMode="decimal"
                  value={rateInputValues.referralRate !== undefined ? rateInputValues.referralRate : (feeOverride.referralRate !== undefined ? feeOverride.referralRate.toString() : '')}
                  onChange={(e) => handleFeeRateChange(e, 'referralRate')}
                  onKeyPress={(e) => handleRateKeyPress(e, rateInputValues.referralRate || (feeOverride.referralRate !== undefined ? feeOverride.referralRate.toString() : ''))}
                  onBlur={() => {
                    // On blur, ensure we have a valid number or clear
                    if (rateInputValues.referralRate === '.' || rateInputValues.referralRate === '') {
                      handleFeeChange('referralRate', undefined);
                      setRateInputValues(prev => ({ ...prev, referralRate: undefined }));
                    }
                  }}
                  placeholder="Auto"
                />
                <Input
                  label="FBA Fee (USD)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={feeOverride.fbaFee !== undefined ? feeOverride.fbaFee : ''}
                  onChange={(e) => handleFeeChange('fbaFee', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="Auto"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Closing Fee (USD)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={feeOverride.closingFee !== undefined ? feeOverride.closingFee : ''}
                  onChange={(e) => handleFeeChange('closingFee', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="Auto"
                />
                <Input
                  label="Payment Processing Fee (0-1)"
                  type="text"
                  inputMode="decimal"
                  value={rateInputValues.paymentFee !== undefined ? rateInputValues.paymentFee : (feeOverride.paymentFee !== undefined ? feeOverride.paymentFee.toString() : '')}
                  onChange={(e) => handleFeeRateChange(e, 'paymentFee')}
                  onKeyPress={(e) => handleRateKeyPress(e, rateInputValues.paymentFee || (feeOverride.paymentFee !== undefined ? feeOverride.paymentFee.toString() : ''))}
                  onBlur={() => {
                    if (rateInputValues.paymentFee === '.' || rateInputValues.paymentFee === '') {
                      handleFeeChange('paymentFee', undefined);
                      setRateInputValues(prev => ({ ...prev, paymentFee: undefined }));
                    }
                  }}
                  placeholder="Auto"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700/50">
                <Input
                  label="VAT Rate (0-1, e.g., 0.20 for 20%)"
                  type="text"
                  inputMode="decimal"
                  value={rateInputValues.vatRate !== undefined ? rateInputValues.vatRate : (feeOverride.vatRate !== undefined ? feeOverride.vatRate.toString() : '')}
                  onChange={(e) => handleFeeRateChange(e, 'vatRate')}
                  onKeyPress={(e) => handleRateKeyPress(e, rateInputValues.vatRate || (feeOverride.vatRate !== undefined ? feeOverride.vatRate.toString() : ''))}
                  onBlur={() => {
                    if (rateInputValues.vatRate === '.' || rateInputValues.vatRate === '') {
                      handleFeeChange('vatRate', undefined);
                      setRateInputValues(prev => ({ ...prev, vatRate: undefined }));
                    }
                  }}
                  placeholder="Auto (Category default)"
                />
                <Input
                  label="VAT Amount (direct override)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={feeOverride.vatAmount !== undefined ? feeOverride.vatAmount : ''}
                  onChange={(e) => handleFeeChange('vatAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="Auto"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

