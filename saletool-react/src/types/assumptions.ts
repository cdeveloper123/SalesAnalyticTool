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
    sellPrice: number;
    category: string;
    referralRate: number;
    referralFee: number;
    fbaFee: number;
    closingFee: number;
    vatRate: number;
    vatAmount: number;
    feeScheduleVersion: string;
    isOverridden: boolean;
  }>;
  currency?: {
    buyPriceCurrency: string;
    fxRates: {
      timestamp: string;
      source: string;
    };
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
}

