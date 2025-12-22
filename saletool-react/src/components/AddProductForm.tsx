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

function AddProductForm({ onSubmit, onClose, onLoadingStart }: AddProductFormProps) {
  const [formData, setFormData] = useState<ProductInput>({
    ean: '',
    quantity: 0,
    buy_price: 0,
    currency: 'USD',
    supplier_region: 'US',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'quantity' || name === 'buy_price'
          ? parseFloat(value) || 0
          : value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.ean || formData.quantity <= 0 || formData.buy_price <= 0) {
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
        label="EAN"
        name="ean"
        type="text"
        value={formData.ean}
        onChange={handleChange}
        required
        placeholder="Enter EAN code"
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
