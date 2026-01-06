/**
 * Data Source Metadata Service
 * 
 * Tracks when underlying data sources were last updated
 * This provides transparency about data freshness
 */

// Data source last updated timestamps
// Update these when you modify the underlying data sources
export const DATA_SOURCE_METADATA = {
  feeSchedule: {
    version: '2025-01',
    lastUpdated: '2025-01-15T00:00:00Z', // When fee schedules were last updated
    source: 'Amazon published fee schedules',
    description: 'Amazon marketplace fee schedules (referral, FBA, closing fees)'
  },
  shippingRates: {
    version: '2024-2025',
    lastUpdated: '2024-12-01T00:00:00Z', // When shipping rates were last updated
    source: 'DHL, FedEx, UPS, Flexport estimates',
    description: 'Freight rates per kg for sea, air, and express shipping'
  },
  dutyRates: {
    version: '2024-2025',
    lastUpdated: '2024-12-01T00:00:00Z', // When duty rates were last updated
    source: 'US HTS, UK Trade Tariff, EU TARIC',
    description: 'Category-based duty rate tables'
  },
  hsCodeMapping: {
    version: '2022',
    lastUpdated: '2022-01-01T00:00:00Z', // When HS code mapping was last updated
    source: 'WCO HS Nomenclature 2022, US HTS, EU TARIC',
    description: 'Category to HS code mapping table'
  },
  tariffLookup: {
    version: '2024-2025',
    lastUpdated: '2024-12-01T00:00:00Z', // When tariff lookup service was last updated
    source: 'Official tariff APIs (US, UK, EU, AU)',
    description: 'Real-time HS code-based tariff lookup service'
  },
  assumptionSet: {
    version: '1.0.0',
    lastUpdated: '2025-01-01T00:00:00Z', // When default assumption set was last updated
    source: 'Default assumption set',
    description: 'Default assumption set for 2025'
  }
};

/**
 * Get metadata for a specific data source
 */
export function getDataSourceMetadata(sourceType) {
  return DATA_SOURCE_METADATA[sourceType] || null;
}

/**
 * Get all data source metadata
 */
export function getAllDataSourceMetadata() {
  return DATA_SOURCE_METADATA;
}

export default {
  DATA_SOURCE_METADATA,
  getDataSourceMetadata,
  getAllDataSourceMetadata
};

