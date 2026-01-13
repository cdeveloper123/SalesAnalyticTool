import { useState, FormEvent } from 'react';
import { FiLoader, FiSearch } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Input from './Input';
import Select from './Select';
import Button from './Button';
import AssumptionControlPanel from './AssumptionControlPanel';
import AssumptionPresetManager from './AssumptionPresetManager';
import type { AssumptionOverrides } from '../types/assumptions';
import { API_ENDPOINTS } from '../config/api';

export interface ProductInput {
  ean: string;
  hsCode: string;  // Required HS code for duty calculation
  quantity: number;
  buy_price: number;
  currency: string;
  supplier_region: string;
  reclaimVat?: boolean;
  assumptionOverrides?: AssumptionOverrides;
}

interface AddProductFormProps {
  onSubmit: (data: ProductInput) => Promise<void>;
  onClose: () => void;
  onLoadingStart?: () => void;
}

const REGION_OPTIONS = [
  { value: 'US', label: 'US' },
  { value: 'UK', label: 'UK' },
  { value: 'DE', label: 'DE' },
  { value: 'FR', label: 'FR' },
  { value: 'IT', label: 'IT' },
  { value: 'AU', label: 'AU' },
];

// Hardcoded mapping: Supplier Region → Currency
const REGION_TO_CURRENCY: Record<string, string> = {
  'US': 'USD',
  'UK': 'GBP',
  'DE': 'EUR',
  'FR': 'EUR',
  'IT': 'EUR',
  'AU': 'AUD',
};

// Currency options - only currencies that match the regions in REGION_OPTIONS
// Hardcoded: US→USD, UK→GBP, DE/FR/IT→EUR, AU→AUD
const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' },
  { value: 'EUR', label: 'EUR' },
  { value: 'AUD', label: 'AUD' },
];

/**
 * Validates HS code format (6-10 digits)
 */
const validateHSCode = (hsCode: string): { isValid: boolean; error?: string } => {
  if (!hsCode || hsCode.trim() === '') {
    return { isValid: false, error: 'HS Code is required for accurate duty calculation' };
  }

  const cleanedHSCode = hsCode.replace(/[\s.-]/g, '');

  if (!/^\d+$/.test(cleanedHSCode)) {
    return { isValid: false, error: 'HS Code must contain only digits' };
  }

  if (cleanedHSCode.length < 6 || cleanedHSCode.length > 10) {
    return { isValid: false, error: 'HS Code must be 6-10 digits' };
  }

  return { isValid: true };
};

/**
 * Validates EAN/GTIN/UPC formats
 * Supports: EAN-8 (8 digits), UPC-A/GTIN-12 (12 digits), EAN-13 (13 digits), GTIN-14 (14 digits)
 */
const validateEAN = (ean: string): { isValid: boolean; error?: string } => {
  if (!ean || ean.trim() === '') {
    return { isValid: false, error: 'EAN is required' };
  }

  // Remove any spaces or dashes
  const cleanedEAN = ean.replace(/[\s-]/g, '');

  // Check if it contains only digits
  if (!/^\d+$/.test(cleanedEAN)) {
    return {
      isValid: false,
      error: 'Invalid EAN format. EAN must contain only digits (0-9).',
    };
  }

  // Check length - support EAN-8, UPC-A (12), EAN-13, GTIN-14
  const length = cleanedEAN.length;
  if (length === 8) {
    return { isValid: true }; // EAN-8
  } else if (length === 12) {
    return { isValid: true }; // UPC-A / GTIN-12
  } else if (length === 13) {
    return { isValid: true }; // EAN-13 (most common)
  } else if (length === 14) {
    return { isValid: true }; // GTIN-14
  } else {
    return {
      isValid: false,
      error: `Invalid EAN length. EAN must be 8, 12, 13, or 14 digits. You entered ${length} digit${length !== 1 ? 's' : ''}.`,
    };
  }
};

function AddProductForm({
  onSubmit,
  onClose,
  onLoadingStart
}: AddProductFormProps) {
  const [formData, setFormData] = useState<ProductInput>({
    ean: '',
    hsCode: '',
    quantity: 0,
    buy_price: 0,
    currency: 'USD',
    supplier_region: 'US',
    reclaimVat: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggestingHS, setIsSuggestingHS] = useState(false);
  const [eanError, setEanError] = useState<string | undefined>();
  const [hsCodeError, setHsCodeError] = useState<string | undefined>();
  const [hsCodeInfo, setHsCodeInfo] = useState<string | undefined>();
  const [assumptionOverrides, setAssumptionOverrides] = useState<AssumptionOverrides>({});


  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // For EAN field: Only allow numeric input (digits 0-9)
    if (name === 'ean') {
      // Remove any non-numeric characters
      const numericValue = value.replace(/[^0-9]/g, '');

      // Clear EAN error when user starts typing
      if (eanError) {
        setEanError(undefined);
      }

      setFormData((prev) => ({
        ...prev,
        [name]: numericValue,
      }));
      return;
    }

    // For HS Code field: Only allow numeric input (digits 0-9)
    if (name === 'hsCode') {
      const numericValue = value.replace(/[^0-9]/g, '');

      // Clear HS error when user starts typing
      if (hsCodeError) {
        setHsCodeError(undefined);
      }
      setHsCodeInfo(undefined);

      setFormData((prev) => ({
        ...prev,
        hsCode: numericValue,
      }));
      return;
    }

    // When supplier region changes, update currency to match
    if (name === 'supplier_region') {
      const matchingCurrency = REGION_TO_CURRENCY[value] || 'USD';
      setFormData((prev) => ({
        ...prev,
        supplier_region: value,
        currency: matchingCurrency, // Auto-update currency to match region
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'quantity' || name === 'buy_price'
          ? parseFloat(value) || 0
          : (e.target as HTMLInputElement).type === 'checkbox'
            ? (e.target as HTMLInputElement).checked
            : value,
    }));
  };

  // Suggest HS code from EAN
  const handleSuggestHSCode = async () => {
    // Validate EAN first
    const eanValidation = validateEAN(formData.ean);
    if (!eanValidation.isValid) {
      toast.error('Please enter a valid EAN first');
      setEanError(eanValidation.error);
      return;
    }

    setIsSuggestingHS(true);
    setHsCodeError(undefined);
    setHsCodeInfo(undefined);

    try {
      const response = await fetch(API_ENDPOINTS.PRODUCT_SUGGEST_HS(formData.ean));
      const result = await response.json();

      if (result.success && result.data?.hsCode) {
        setFormData((prev) => ({
          ...prev,
          hsCode: result.data.hsCode,
        }));

        // Show info about the suggested HS code
        const confidence = result.data.hsConfidence || 'unknown';
        const chapter = result.data.chapterDescription || 'Unknown category';
        setHsCodeInfo(`${chapter} (${confidence} confidence)`);
        toast.success(`HS Code suggested: ${result.data.hsCode}`);
      } else {
        toast.error(result.message || 'Could not suggest HS code. Please enter manually.');
      }
    } catch (error) {
      console.error('Error suggesting HS code:', error);
      toast.error('Failed to suggest HS code. Please enter manually.');
    } finally {
      setIsSuggestingHS(false);
    }
  };


  const handleEANKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

  const handleEANBlur = () => {
    // Validate EAN when user leaves the field
    if (formData.ean) {
      const validation = validateEAN(formData.ean);
      if (!validation.isValid) {
        setEanError(validation.error);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate EAN format
    const eanValidation = validateEAN(formData.ean);
    if (!eanValidation.isValid) {
      setEanError(eanValidation.error);
      toast.error(eanValidation.error || 'Invalid EAN format');
      return;
    }

    // Validate HS Code format
    const hsValidation = validateHSCode(formData.hsCode);
    if (!hsValidation.isValid) {
      setHsCodeError(hsValidation.error);
      toast.error(hsValidation.error || 'Invalid HS Code format');
      return;
    }

    // Validate other fields
    if (formData.quantity <= 0 || formData.buy_price <= 0) {
      toast.error('Please fill in all required fields with valid values.');
      return;
    }


    setIsSubmitting(true);

    // Notify parent that loading is starting (for immediate loader display)
    if (onLoadingStart) {
      onLoadingStart();
    }

    // Close modal immediately on submit
    onClose();

    try {
      await onSubmit({ ...formData, assumptionOverrides });
      toast.success('Product analyzed successfully!');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to analyze product. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label="EAN / GTIN / UPC"
        name="ean"
        type="text"
        value={formData.ean}
        onChange={handleChange}
        onBlur={handleEANBlur}
        onKeyPress={handleEANKeyPress}
        required
        placeholder="Enter EAN code (8, 12, 13, or 14 digits)"
        error={eanError}
        maxLength={14}
        pattern="[0-9]*"
        inputMode="numeric"
      />

      {/* HS Code Input with Suggest Button */}
      <div className="w-full">
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          HS Code <span className="text-red-400 ml-1">*</span>
        </label>
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="text"
              name="hsCode"
              value={formData.hsCode}
              onChange={handleChange}
              placeholder="Enter HS Code (6-10 digits)"
              maxLength={10}
              pattern="[0-9]*"
              inputMode="numeric"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${hsCodeError ? 'border-red-600' : 'border-gray-700'
                }`}
            />
          </div>
          <button
            type="button"
            onClick={handleSuggestHSCode}
            disabled={isSuggestingHS || !formData.ean || formData.ean.length < 8}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors font-medium"
          >
            {isSuggestingHS ? (
              <>
                <FiLoader className="animate-spin" size={16} />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <FiSearch size={16} />
                <span>Suggest</span>
              </>
            )}
          </button>
        </div>
        {hsCodeError && (
          <p className="mt-1 text-sm text-red-400">{hsCodeError}</p>
        )}
        {hsCodeInfo && !hsCodeError && (
          <p className="mt-1 text-sm text-green-400">{hsCodeInfo}</p>
        )}
        <p className="mt-1 text-sm text-gray-500">
          Required for accurate duty/tariff calculation. Click "Suggest" to auto-detect from EAN.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Quantity"
          name="quantity"
          type="number"
          value={formData.quantity || ''}
          onChange={handleChange}
          required
          min="1"
          placeholder="Enter quantity"
        />

        <Input
          label="Buy Price Per Unit"
          name="buy_price"
          type="number"
          value={formData.buy_price || ''}
          onChange={handleChange}
          required
          min="0"
          step="0.01"
          placeholder="Enter buy price"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Currency"
          name="currency"
          value={formData.currency}
          onChange={handleChange}
          required
          options={CURRENCY_OPTIONS}
        />

        <Select
          label="Supplier Region"
          name="supplier_region"
          value={formData.supplier_region}
          onChange={handleChange}
          required
          options={REGION_OPTIONS}
        />
      </div>

      <div className="flex items-center gap-3 bg-gray-700/30 p-4 rounded-lg border border-gray-600/30">
        <input
          type="checkbox"
          id="reclaimVat"
          name="reclaimVat"
          checked={formData.reclaimVat}
          onChange={handleChange}
          className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
        />
        <label htmlFor="reclaimVat" className="flex flex-col">
          <span className="text-sm font-semibold text-gray-200">Reclaim Import VAT</span>
          <span className="text-xs text-gray-400">Enable if business is VAT-registered. VAT will be tracked but not added to Landed Cost.</span>
        </label>
      </div>

      <div className="mt-6 space-y-4">
        <AssumptionControlPanel
          overrides={assumptionOverrides}
          onChange={setAssumptionOverrides}
          supplierRegion={formData.supplier_region}
          showSuggestButton={false}
        />

        <AssumptionPresetManager
          currentOverrides={assumptionOverrides}
          onApplyPreset={(overrides) => {
            setAssumptionOverrides(overrides);
            toast.success('Preset applied successfully!');
          }}
        />
      </div>

      <div className="flex justify-end gap-4 pt-6 border-t border-gray-700">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting}
          isLoading={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <FiLoader className="animate-spin" size={18} />
              Submitting...
            </span>
          ) : (
            'Submit'
          )}
        </Button>
      </div>
    </form>
  );
}

export default AddProductForm;
