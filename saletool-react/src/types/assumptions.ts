/**
 * Assumption Override Types
 * 
 * TypeScript interfaces for assumption overrides and presets
 */

export interface ShippingOverride {
  origin: string;
  destination: string;
  method?: 'sea' | 'air' | 'express';
  ratePerKg?: number;
  transitDays?: number;
  minCharge?: number;
}

export interface DutyOverride {
  origin: string;
  destination: string;
  hsCode?: string;
  rate?: number; // 0-1 for percentage (e.g., 0.12 for 12%)
  amount?: number; // Direct duty amount
  calculationMethod?: 'category' | 'hscode' | 'direct';
}

export interface FeeOverride {
  marketplace: string; // 'US', 'UK', 'DE', etc.
  channel?: string; // 'Amazon', 'eBay', 'Retailer', 'Distributor'
  referralRate?: number; // 0-1 for percentage
  fbaFee?: number;
  closingFee?: number;
  paymentFee?: number; // 0-1 for percentage
  feeScheduleVersion?: string;
}

export interface AssumptionOverrides {
  shippingOverrides?: ShippingOverride | ShippingOverride[];
  dutyOverrides?: DutyOverride | DutyOverride[];
  feeOverrides?: FeeOverride | FeeOverride[];
}

export interface AssumptionPreset {
  id?: string;
  name: string;
  description?: string;
  shippingOverrides?: ShippingOverride | ShippingOverride[];
  dutyOverrides?: DutyOverride | DutyOverride[];
  feeOverrides?: FeeOverride | FeeOverride[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AssumptionVersion {
  version: string;
  setDate: string;
  description?: string;
}

export interface AssumptionDetails {
  shipping: Record<string, {
    origin: string;
    destination: string;
    method: string;
    ratePerKg?: number;
    transitDays?: number;
    minCharge?: number;
    isOverridden: boolean;
  }>;
  duty: Record<string, {
    origin: string;
    destination: string;
    category?: string;
    hsCode?: string;
    rate?: number;
    ratePercent?: string;
    calculationMethod: string;
    isOverridden: boolean;
  }>;
  fees: Record<string, {
    marketplace: string;
    channel?: string; // 'Amazon', 'eBay', 'Retailer', 'Distributor'
    sellPrice: number;
    sellPriceSource?: string;
    category: string;
    referralRate: number;
    referralFee: number;
    fbaFee: number;
    closingFee: number;
    // eBay-specific fees
    finalValueFee?: number;
    perOrderFee?: number;
    vatRate: number;
    vatAmount: number;
    feeScheduleVersion: string;
    isOverridden: boolean;
    currency?: string; // Currency code (USD, EUR, etc.)
  }>;
  currency?: {
    buyPriceCurrency: string;
    fxRates: {
      timestamp: string;
      source: string;
    };
  };
}

export interface DataFreshness {
  source: string;
  timestamp: string; // When calculation was performed
  age?: string;
  feeScheduleVersion?: string;
  isExpired?: boolean;
  cacheAge?: string;
  // New fields for data source freshness
  dataSourceLastUpdated?: string; // When the underlying data source was last updated
  dataSourceVersion?: string; // Version of the data source
  hsCodeMappingLastUpdated?: string; // For duty calculations using HS codes
  feeScheduleLastUpdated?: string; // For fee calculations
}

export interface SourceConfidence {
  level: 'high' | 'medium' | 'low';
  reason: string;
  sellPriceConfidence?: string;
}

export interface Methodology {
  calculation: string;
  rule: string;
  feeScheduleVersion?: string;
  vatTreatment?: string;
  cacheStatus?: {
    hasCache: boolean;
    lastUpdated: string | null;
    cacheAge: string | null;
    isExpired: boolean;
  };
}

export interface AssumptionsResponse {
  version: AssumptionVersion;
  timestamp: string;
  summary: {
    shippingRoutes: number;
    dutyRoutes: number;
    feeMarketplaces: number;
    hasOverrides: boolean;
  };
  details: AssumptionDetails;
  overrides: AssumptionOverrides;
  history?: AssumptionHistoryEntry[];
  dataFreshness?: Record<string, DataFreshness>;
  sourceConfidence?: Record<string, SourceConfidence>;
  methodology?: Record<string, Methodology>;
}

export interface AssumptionHistoryEntry {
  id: string;
  dealId?: string;
  assumptionType: 'shipping' | 'duty' | 'fee';
  oldValue: unknown;
  newValue: unknown;
  changedBy?: string;
  timestamp: string;
}

