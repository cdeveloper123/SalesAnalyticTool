import { useState, FormEvent } from 'react';
import { FiLoader, FiSearch, FiHash, FiType } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Input from './Input';
import Button from './Button';

export interface DiscoveryInput {
    ean?: string;
    productName?: string;
    searchType?: 'ean' | 'keyword';
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
    const [searchMode, setSearchMode] = useState<'ean' | 'keyword'>('ean');
    const [inputValue, setInputValue] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [inputError, setInputError] = useState('');

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

    // Handle search mode change
    const handleModeChange = (mode: 'ean' | 'keyword') => {
        setSearchMode(mode);
        setInputValue(''); // Clear input when switching modes
        setInputError('');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = searchMode === 'ean'
            ? e.target.value.replace(/[^0-9]/g, '') // Only digits for EAN
            : e.target.value;
        setInputValue(value);
        setInputError('');
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!inputValue.trim()) {
            const errorMsg = searchMode === 'ean' ? 'Please enter an EAN' : 'Please enter a product name';
            toast.error(errorMsg);
            setInputError(errorMsg);
            return;
        }

        // Validate EAN format if in EAN mode
        if (searchMode === 'ean') {
            const eanValidation = validateEAN(inputValue);
            if (!eanValidation.isValid) {
                setInputError(eanValidation.error || 'Invalid EAN');
                toast.error(eanValidation.error || 'Invalid EAN format');
                return;
            }
        }

        setIsSubmitting(true);
        onLoadingStart?.();
        onClose();

        try {
            await onSubmit({
                ean: searchMode === 'ean' ? inputValue.trim() : undefined,
                productName: searchMode === 'keyword' ? inputValue.trim() : undefined,
                searchType: searchMode
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

            {/* Search Mode Selector */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Search By
                </label>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => handleModeChange('ean')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all duration-200 ${searchMode === 'ean'
                                ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                                : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <FiHash size={16} />
                        <span className="font-medium">EAN / UPC</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleModeChange('keyword')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all duration-200 ${searchMode === 'keyword'
                                ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                                : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                            }`}
                    >
                        <FiType size={16} />
                        <span className="font-medium">Product Name</span>
                    </button>
                </div>
            </div>

            {/* Dynamic Input Field */}
            <Input
                label={searchMode === 'ean' ? 'Product EAN/UPC' : 'Product Name'}
                name="searchInput"
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                placeholder={
                    searchMode === 'ean'
                        ? 'e.g., 0045496395230'
                        : 'e.g., Nintendo Switch Pro Controller'
                }
                error={inputError}
                maxLength={searchMode === 'ean' ? 14 : 200}
                hint={
                    searchMode === 'ean'
                        ? 'Enter the 8-14 digit barcode number'
                        : 'Enter the product name to search Amazon'
                }
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
                    disabled={isSubmitting || !inputValue.trim()}
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
