import { useState, FormEvent } from 'react';
import { FiLoader } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Input from './Input';
import Select from './Select';
import Button from './Button';

export interface ProductInput {
  ean: string;
  quantity: number;
  buy_price: number;
  currency: string;
  supplier_region: string;
}

interface AddProductFormProps {
  onSubmit: (data: ProductInput) => Promise<void>;
  onClose: () => void;
  onLoadingStart?: () => void;
}

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'JPY', label: 'JPY' },
  { value: 'CNY', label: 'CNY' },
];

const REGION_OPTIONS = [
  { value: 'US', label: 'US' },
  { value: 'EU', label: 'EU' },
  { value: 'UK', label: 'UK' },
  { value: 'JP', label: 'JP' },
  { value: 'CN', label: 'CN' },
];

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

function AddProductForm({ onSubmit, onClose, onLoadingStart }: AddProductFormProps) {
  const [formData, setFormData] = useState<ProductInput>({
    ean: '',
    quantity: 0,
    buy_price: 0,
    currency: 'USD',
    supplier_region: 'US',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eanError, setEanError] = useState<string | undefined>();

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
    
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'quantity' || name === 'buy_price'
          ? parseFloat(value) || 0
          : value,
    }));
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
      await onSubmit(formData);
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
