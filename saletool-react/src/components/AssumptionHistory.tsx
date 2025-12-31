import { useState } from 'react';
import { FiClock, FiChevronDown, FiChevronUp, FiArrowRight } from 'react-icons/fi';
import type { AssumptionHistoryEntry } from '../types/assumptions';

interface AssumptionHistoryProps {
  history: AssumptionHistoryEntry[];
}

/**
 * Format a value for display in history
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(none)';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Get label for assumption type
 */
function getTypeLabel(type: string): string {
  switch (type) {
    case 'shipping': return 'Shipping';
    case 'duty': return 'Duty/Tariff';
    case 'fee': return 'Marketplace Fees';
    default: return type;
  }
}

/**
 * Get color class for assumption type
 */
function getTypeColor(type: string): string {
  switch (type) {
    case 'shipping': return 'text-blue-400 bg-blue-900/30';
    case 'duty': return 'text-orange-400 bg-orange-900/30';
    case 'fee': return 'text-green-400 bg-green-900/30';
    default: return 'text-gray-400 bg-gray-800';
  }
}

/**
 * Get source label (user or preset name)
 */
function getSourceLabel(changedBy?: string): string {
  if (!changedBy) return 'User';
  if (changedBy.startsWith('preset:')) {
    return `Preset: ${changedBy.replace('preset:', '')}`;
  }
  return changedBy;
}

export default function AssumptionHistory({ history }: AssumptionHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  if (!history || history.length === 0) {
    return null;
  }

  const toggleEntry = (id: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedEntries(newExpanded);
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mt-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <FiClock className="text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-300">Change History</h3>
          <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded-full">
            {history.length} change{history.length !== 1 ? 's' : ''}
          </span>
        </div>
        {isExpanded ? (
          <FiChevronUp className="text-gray-400" />
        ) : (
          <FiChevronDown className="text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          {history.map((entry) => (
            <div key={entry.id} className="border border-gray-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleEntry(entry.id)}
                className="flex items-center justify-between w-full p-3 bg-gray-750 hover:bg-gray-700 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 text-xs rounded ${getTypeColor(entry.assumptionType)}`}>
                    {getTypeLabel(entry.assumptionType)}
                  </span>
                  <span className="text-gray-300 text-sm">
                    {getSourceLabel(entry.changedBy)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-xs">
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  {expandedEntries.has(entry.id) ? (
                    <FiChevronUp />
                  ) : (
                    <FiChevronDown />
                  )}
                </div>
              </button>

              {expandedEntries.has(entry.id) && (
                <div className="p-3 bg-gray-850 border-t border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Previous Value</div>
                      <pre className="text-xs text-gray-400 bg-gray-900 p-2 rounded overflow-x-auto max-h-32">
                        {formatValue(entry.oldValue)}
                      </pre>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <FiArrowRight size={10} />
                        New Value
                      </div>
                      <pre className="text-xs text-green-400 bg-gray-900 p-2 rounded overflow-x-auto max-h-32">
                        {formatValue(entry.newValue)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
