/**
 * Data Source Controller
 * 
 * Manages data source mode (Live/Cached/Mock) for Amazon API
 */

/**
 * GET /api/v1/data-source
 * Get current data source mode
 */
export const getDataSourceMode = (req, res) => {
  const mode = process.env.AMAZON_DATA_SOURCE || 'live';
  res.status(200).json({
    success: true,
    data: {
      mode,
      availableModes: ['live', 'cached', 'mock']
    }
  });
};

/**
 * POST /api/v1/data-source
 * Set data source mode (for development/testing)
 * Note: This only works if AMAZON_DATA_SOURCE is not set in environment
 */
export const setDataSourceMode = (req, res) => {
  const { mode } = req.body;
  
  if (!mode || !['live', 'cached', 'mock'].includes(mode)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid mode. Must be one of: live, cached, mock'
    });
  }

  // If environment variable is set, it takes precedence
  if (process.env.AMAZON_DATA_SOURCE) {
    return res.status(403).json({
      success: false,
      message: 'Data source mode is set via environment variable and cannot be changed via API',
      currentMode: process.env.AMAZON_DATA_SOURCE
    });
  }

  // Set the mode (in-memory for this session)
  // In production, you might want to use Redis or a config file
  process.env.AMAZON_DATA_SOURCE = mode;

  res.status(200).json({
    success: true,
    message: `Data source mode set to: ${mode}`,
    data: {
      mode,
      note: 'Mode will reset when server restarts. Set AMAZON_DATA_SOURCE environment variable for persistence.'
    }
  });
};

export default {
  getDataSourceMode,
  setDataSourceMode
};

