import { FiTrendingUp, FiPackage, FiDollarSign } from 'react-icons/fi';

interface LoaderProps {
  message?: string;
  subMessage?: string;
}

function Loader({ message = 'Analyzing Deal...', subMessage }: LoaderProps) {
  const defaultSubMessage = 'Fetching prices from Amazon & eBay, calculating fees, duties, and shipping...';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/95 backdrop-blur-md">
      <div className="relative">
        {/* Animated Background Circle */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-64 rounded-full bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 animate-pulse"></div>
        </div>

        {/* Main Content */}
        <div className="relative bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl p-8 max-w-md mx-4">
          {/* Animated Icons */}
          <div className="flex justify-center items-center mb-6">
            <div className="relative w-20 h-20">
              {/* Rotating Icons */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <FiTrendingUp 
                    className="text-blue-400 animate-spin" 
                    size={32}
                    style={{ animationDuration: '2s' }}
                  />
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <FiPackage 
                    className="text-purple-400 animate-spin" 
                    size={28}
                    style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}
                  />
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <FiDollarSign 
                    className="text-green-400 animate-spin" 
                    size={24}
                    style={{ animationDuration: '1s' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Loading Spinner */}
          <div className="flex justify-center mb-6">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-gray-700 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 border-4 border-transparent border-r-purple-500 rounded-full animate-spin" style={{ animationDuration: '0.8s', animationDirection: 'reverse' }}></div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-sm text-gray-300">Fetching product data...</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <span className="text-sm text-gray-300">Analyzing market prices...</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              <span className="text-sm text-gray-300">Calculating margins...</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" style={{ animationDelay: '0.6s' }}></div>
              <span className="text-sm text-gray-300">Generating allocation plan...</span>
            </div>
          </div>

          {/* Message */}
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-2">{message}</h3>
            <p className="text-sm text-gray-400">{subMessage || defaultSubMessage}</p>
          </div>

          {/* Animated Bar */}
          <div className="mt-6 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Loader;

