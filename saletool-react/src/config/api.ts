// API Configuration
const API_BASE_URL = import.meta.env.VITE_REACT_BACKEND_URL || 'http://localhost:3001';

export const API_ENDPOINTS = {
  ANALYZE: `${API_BASE_URL}/api/v1/deals/analyze`,
  DEALS: `${API_BASE_URL}/api/v1/deals`,
  DEAL_DELETE: (id: string) => `${API_BASE_URL}/api/v1/deals/${id}`,
  ASSUMPTIONS_OVERRIDES: `${API_BASE_URL}/api/v1/assumptions/overrides`,
  ASSUMPTIONS_OVERRIDE: (id: string) => `${API_BASE_URL}/api/v1/assumptions/overrides/${id}`,
  ASSUMPTIONS_VISIBILITY: (dealId: string) => `${API_BASE_URL}/api/v1/assumptions/${dealId}`,
  ASSUMPTIONS_PRESETS: `${API_BASE_URL}/api/v1/assumptions/presets`,
  ASSUMPTIONS_PRESET_APPLY: (id: string) => `${API_BASE_URL}/api/v1/assumptions/presets/${id}/apply`,
  ASSUMPTIONS_PRESET_DELETE: (id: string) => `${API_BASE_URL}/api/v1/assumptions/presets/${id}`,
  DATA_SOURCE: `${API_BASE_URL}/api/v1/data-source`,
};

export default API_BASE_URL;

