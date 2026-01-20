import { useState, FormEvent } from 'react';
import { FiLoader, FiZap } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Input from './Input';
import Button from './Button';

export interface QuickLookupInput {
    ean: string;
}

interface AddQuickLookupFormProps {
    onSubmit: (data: QuickLookupInput) => Promise<void>;
    onClose: () => void;
    onLoadingStart?: () => void;
}

export default function AddQuickLookupForm({
    onSubmit,
    onClose,
    onLoadingStart
}: AddQuickLookupFormProps) {
    const [ean, setEan] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [eanError, setEanError] = useState('');

    // Validate EAN format
    const validateEAN = (ean: string): { isValid: boolean; error?: string } => {
        if (!ean || ean.trim() === '') {
            return { isValid: false, error: 'EAN is required' };
        }

        const cleanEan = ean.replace(/\D/g, '');
        if (cleanEan.length < 8 || cleanEan.length > 14) {
            return { isValid: false, error: 'EAN must be 8-14 digits' };
        }
        return { isValid: true };
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Only allow numeric input (digits 0-9)
        const numericValue = e.target.value.replace(/[^0-9]/g, '');
        setEan(numericValue);
        setEanError('');
    };

    // Block non-numeric key presses
    const handleEANKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Allow control key combinations (Ctrl+A, Ctrl+C, Ctrl+V, etc.)
        if (e.ctrlKey || e.metaKey) {
            return;
        }

        // Allow navigation and control keys
        const allowedKeys = [
            'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
            'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
            'Home', 'End'
        ];
        if (allowedKeys.includes(e.key)) {
            return;
        }

        // Only allow digits 0-9
        if (!/^[0-9]$/.test(e.key)) {
            e.preventDefault();
        }
    };

    // Validate on blur
    const handleEANBlur = () => {
        if (ean) {
            const validation = validateEAN(ean);
            if (!validation.isValid) {
                setEanError(validation.error || 'Invalid EAN');
            }
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        // Validate EAN
        const validation = validateEAN(ean);
        if (!validation.isValid) {
            setEanError(validation.error || 'Invalid EAN');
            toast.error(validation.error || 'Invalid EAN format');
            return;
        }

        setIsSubmitting(true);
        onLoadingStart?.();
        onClose(); // Close modal immediately

        try {
            await onSubmit({ ean: ean.trim() });
            toast.success('Quick lookup completed!');
        } catch (error) {
            console.error('Quick lookup error:', error);
            toast.error(error instanceof Error ? error.message : 'Quick lookup failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Header Info */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-400 mb-2">
                    <FiZap size={18} />
                    <span className="font-medium">Quick Lookup Mode</span>
                </div>
                <p className="text-sm text-gray-400">
                    Get a fast snapshot of price, demand level, and risk indicators.
                    Perfect for quick product checks.
                </p>
            </div>

            {/* EAN Input */}
            <Input
                label="Product EAN/UPC"
                name="ean"
                type="text"
                value={ean}
                onChange={handleChange}
                onBlur={handleEANBlur}
                onKeyPress={handleEANKeyPress}
                placeholder="e.g., 0045496395230"
                error={eanError}
                required
                maxLength={14}
                pattern="[0-9]*"
                inputMode="numeric"
            />

            {/* What You'll Get */}
            <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Quick snapshot includes:</h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-gray-700/50 rounded-lg p-3">
                        <div className="text-lg font-bold text-green-400">💰</div>
                        <div className="text-xs text-gray-400 mt-1">Best Price</div>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                        <div className="text-lg font-bold text-blue-400">📊</div>
                        <div className="text-xs text-gray-400 mt-1">Demand Level</div>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                        <div className="text-lg font-bold text-amber-400">⚠️</div>
                        <div className="text-xs text-gray-400 mt-1">Risk Flags</div>
                    </div>
                </div>
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
                    disabled={isSubmitting || !ean.trim()}
                    className="flex items-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <FiLoader className="animate-spin" size={16} />
                            Looking up...
                        </>
                    ) : (
                        <>
                            <FiZap size={16} />
                            Quick Lookup
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
}
