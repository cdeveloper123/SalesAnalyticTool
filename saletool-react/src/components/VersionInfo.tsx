import { FiInfo } from 'react-icons/fi';

// These are injected at build time by Vite
declare const __APP_VERSION__: string;
declare const __BUILD_TIMESTAMP__: string;
declare const __GIT_COMMIT__: string;

export default function VersionInfo() {
  const version = __APP_VERSION__ || '0.0.0';
  const buildTime = __BUILD_TIMESTAMP__ || new Date().toISOString();
  const commit = __GIT_COMMIT__ || 'unknown';

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <FiInfo size={12} />
      <span className="font-medium text-gray-400">v{version}</span>
      <span className="text-gray-600">•</span>
      <span>{new Date(buildTime).toLocaleString()}</span>
      {commit !== 'unknown' && (
        <>
          <span className="text-gray-600">•</span>
          <span className="font-mono text-gray-500">{commit}</span>
        </>
      )}
    </div>
  );
}

