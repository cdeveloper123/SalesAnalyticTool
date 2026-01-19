import { useState, useRef, useEffect } from 'react';
import { FiTrendingUp, FiSearch, FiZap, FiChevronDown } from 'react-icons/fi';
import type { AnalysisMode } from '../types/product';

interface ModeSelectorProps {
    onSelectMode: (mode: AnalysisMode) => void;
    buttonClassName?: string;
}

const MODE_OPTIONS = [
    {
        mode: 'deal' as AnalysisMode,
        label: 'Deal Analysis',
        description: 'Full evaluation with margin, score & allocation',
        icon: FiTrendingUp,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20',
        borderColor: 'border-emerald-500/30'
    },
    {
        mode: 'discovery' as AnalysisMode,
        label: 'Discovery Mode',
        description: 'Market research - prices & demand by region',
        icon: FiSearch,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        borderColor: 'border-blue-500/30'
    },
    {
        mode: 'quickLookup' as AnalysisMode,
        label: 'Quick Lookup',
        description: 'Fast snapshot - price, demand & risk',
        icon: FiZap,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
        borderColor: 'border-amber-500/30'
    }
];

export default function ModeSelector({ onSelectMode, buttonClassName = '' }: ModeSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (mode: AnalysisMode) => {
        setIsOpen(false);
        onSelectMode(mode);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 ${buttonClassName}`}
            >
                <span>Add Product</span>
                <FiChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-gray-800 rounded-lg border border-gray-700 shadow-xl z-50 overflow-hidden animate-fadeIn">
                    <div className="px-4 py-3 border-b border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-300">Select Analysis Mode</h3>
                    </div>
                    <div className="p-2">
                        {MODE_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            return (
                                <button
                                    key={option.mode}
                                    onClick={() => handleSelect(option.mode)}
                                    className="w-full flex items-start gap-3 p-3 rounded-lg transition-all duration-150 hover:bg-gray-700/50 text-left group"
                                >
                                    <div className={`p-2 rounded-lg ${option.bgColor} ${option.color} group-hover:scale-110 transition-transform`}>
                                        <Icon size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-medium text-white group-hover:${option.color} transition-colors`}>
                                            {option.label}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-0.5">
                                            {option.description}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// Add required CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fadeIn {
    animation: fadeIn 0.15s ease-out;
  }
`;
if (!document.head.querySelector('[data-mode-selector-styles]')) {
    style.setAttribute('data-mode-selector-styles', 'true');
    document.head.appendChild(style);
}
