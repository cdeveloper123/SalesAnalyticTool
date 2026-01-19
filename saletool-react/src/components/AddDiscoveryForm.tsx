import { useState, FormEvent } from 'react';
import { FiLoader, FiSearch } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Input from './Input';
import Button from './Button';

export interface DiscoveryInput {
    ean?: string;
    productName?: string;
}

interface AddDiscoveryFormProps {
    onSubmit: (data: DiscoveryInput) => Promise<void>;
    onClose: () => void;
    onLoadingStart?: () => void;
}

export default function AddDiscoveryForm({
    onSubmit,
    onClose,
    onLoadingStart
}: AddDiscoveryFormProps) {
    const [formData, setFormData] = useState<DiscoveryInput>({
        ean: '',
        productName: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [eanError, setEanError] = useState('');

    // Validate EAN format (if provided)
    const validateEAN = (ean: string): { isValid: boolean; error?: string } => {
        if (!ean || ean.trim() === '') {
            return { isValid: true }; // Empty is OK if productName is provided
        }

        const cleanEan = ean.replace(/\D/g, '');
        if (cleanEan.length < 8 || cleanEan.length > 14) {
            return { isValid: false, error: 'EAN must be 8-14 digits' };
        }
        return { isValid: true };
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'ean') {
            setEanError('');
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        // Validate: at least one field required
        if (!formData.ean?.trim() && !formData.productName?.trim()) {
            toast.error('Please provide either EAN or Product Name');
            return;
        }

        // Validate EAN format if provided
        if (formData.ean?.trim()) {
            const eanValidation = validateEAN(formData.ean);
            if (!eanValidation.isValid) {
                setEanError(eanValidation.error || 'Invalid EAN');
                toast.error(eanValidation.error || 'Invalid EAN format');
                return;
            }
        }

        setIsSubmitting(true);
        onLoadingStart?.();
        onClose(); // Close modal immediately

        try {
            await onSubmit({
                ean: formData.ean?.trim() || undefined,
                productName: formData.productName?.trim() || undefined
            });
            toast.success('Discovery analysis completed!');
        } catch (error) {
            console.error('Discovery analysis error:', error);
            toast.error(error instanceof Error ? error.message : 'Discovery analysis failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Header Info */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <FiSearch size={18} />
                    <span className="font-medium">Discovery Mode</span>
                </div>
                <p className="text-sm text-gray-400">
                    Find highest price regions, largest volume markets, and demand signals.
                    No buy price or quantity needed.
                </p>
            </div>

            {/* EAN Input */}
            <Input
                label="Product EAN/UPC"
                name="ean"
                type="text"
                value={formData.ean}
                onChange={handleChange}
                placeholder="e.g., 0045496395230"
                error={eanError}
                hint="Optional if product name is provided"
            />

            {/* OR Divider */}
            <div className="flex items-center gap-4">
                <div className="flex-1 border-t border-gray-700"></div>
                <span className="text-gray-500 text-sm">OR</span>
                <div className="flex-1 border-t border-gray-700"></div>
            </div>

            {/* Product Name Input */}
            <Input
                label="Product Name"
                name="productName"
                type="text"
                value={formData.productName}
                onChange={handleChange}
                placeholder="e.g., Nintendo Switch Pro Controller"
                hint="Optional if EAN is provided"
            />

            {/* What You'll Get */}
            <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">What you'll get:</h4>
                <ul className="text-sm text-gray-400 space-y-1">
                    <li>• Highest price regions (top markets)</li>
                    <li>• Largest volume regions (best demand)</li>
                    <li>• Price comparison across all markets</li>
                    <li>• Demand signals and trends</li>
                </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
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
                    disabled={isSubmitting || (!formData.ean?.trim() && !formData.productName?.trim())}
                    className="flex items-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <FiLoader className="animate-spin" size={16} />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <FiSearch size={16} />
                            Discover Markets
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
}
