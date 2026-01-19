import { useState, useEffect } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
}

export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isLoading = false
}: ConfirmDialogProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            const timer = setTimeout(() => setIsVisible(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible && !isOpen) return null;

    const variantStyles = {
        danger: {
            icon: 'bg-red-500/20 text-red-400',
            button: 'bg-red-600 hover:bg-red-700 text-white',
            border: 'border-red-500/30'
        },
        warning: {
            icon: 'bg-amber-500/20 text-amber-400',
            button: 'bg-amber-600 hover:bg-amber-700 text-white',
            border: 'border-amber-500/30'
        },
        info: {
            icon: 'bg-blue-500/20 text-blue-400',
            button: 'bg-blue-600 hover:bg-blue-700 text-white',
            border: 'border-blue-500/30'
        }
    };

    const styles = variantStyles[variant];

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'
                }`}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div
                className={`relative bg-gray-800 rounded-xl border ${styles.border} shadow-2xl max-w-md w-full transform transition-all duration-200 ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
                    }`}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                    <FiX size={18} />
                </button>

                {/* Content */}
                <div className="p-6">
                    {/* Icon and Title */}
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl ${styles.icon}`}>
                            <FiAlertTriangle size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-2">
                                {title}
                            </h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                {message}
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${styles.button}`}
                        >
                            {isLoading && (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            )}
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
