import { FiGlobe, FiLayers } from 'react-icons/fi';

export type DataSourceMode = 'live' | 'mock';

interface DataSourceToggleProps {
  mode: DataSourceMode;
  onChange: (mode: DataSourceMode) => void;
  className?: string;
}

export default function DataSourceToggle({ mode, onChange, className = '' }: DataSourceToggleProps) {
  const handleModeChange = (newMode: DataSourceMode) => {
    if (newMode !== mode) {
      onChange(newMode);
    }
  };

  const getModeConfig = (m: DataSourceMode) => {
    switch (m) {
      case 'live':
        return {
          icon: FiGlobe,
          label: 'Live',
          color: 'text-green-400',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
          description: 'Real API calls'
        };
      case 'mock':
        return {
          icon: FiLayers,
          label: 'Mock',
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          description: 'Mock data only'
        };
    }
  };

  const modes: DataSourceMode[] = ['live', 'mock'];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs text-gray-400 mr-2">Data Source:</span>
      <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
        {modes.map((m) => {
          const config = getModeConfig(m);
          const Icon = config.icon;
          const isActive = mode === m;

          return (
            <button
              key={m}
              type="button"
              onClick={() => handleModeChange(m)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all
                ${isActive
                  ? `${config.bgColor} ${config.borderColor} border ${config.color}`
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-750'
                }
              `}
              title={config.description}
            >
              <Icon size={14} />
              <span>{config.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

