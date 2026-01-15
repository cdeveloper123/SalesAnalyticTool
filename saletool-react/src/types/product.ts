export interface LandedCost {
  buyPrice: number;
  duty: number;
  importVat?: number;
  importVatRate?: number;
  reclaimVat?: boolean;
  shipping: number;
  total: number;
}

// FX transparency data
export interface FxData {
  rate: number;
  pair: string;
  timestamp: string | null;
  source: 'live' | 'fallback';
}

// Currency info for scoring transparency
export interface CurrencyInfo {
  inputCurrency: string;
  scoringMethod: string;
  scoringExplanation: string;
  fxAppliedOnce: boolean;
  fxConversionPoint: string;
  fxTimestamp: string | null;
  fxSource: 'live' | 'fallback';
}

export interface DemandData {
  estimatedMonthlySales?: {
    low: number;
    mid: number;
    high: number;
  };
  confidence?: string;
  absorptionCapacity?: number;
  signals?: string[];
  actualSalesSource?: string;
  dataSource?: string;
  fetchedAt?: string | null;
  methodology?: string;
}

export interface ChannelData {
  channel: string;
  marketplace: string;
  sellPrice: number;
  priceExVat?: number;  // Ex-VAT price for transparency
  currency: string;
  netProceeds: number;
  netMargin: number;
  marginPercent: number;
  recommendation: string;
  landedCost?: LandedCost;
  landedCostConverted?: number;  // Converted landed cost
  fx?: FxData;  // FX rate used for conversion
  demand?: DemandData;
}

export interface NegotiationSupport {
  currentBuyPrice: number;
  targetBuyPrice: number;
  walkAwayPrice: number;
  currency: string;
  currentMarginPercent: number;
  targetMarginPercent: number;
  savings: number;
  savingsPercent: number;
  message: string;
}

export interface SourcingAlternative {
  region: string;
  name: string;
  pros: string;
  cons: string;
}

export interface SourcingSuggestions {
  currentRegion: string;
  targetBuyPrice: number;
  alternatives: SourcingAlternative[];
  supplierTypes: { type: string; estimatedSavings: string }[];
  recommendation: string;
}

export interface ComplianceFlag {
  type: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
}

export interface Compliance {
  flags: ComplianceFlag[];
  flagCount: number;
  overallRisk: 'high' | 'medium' | 'low';
  canSell: boolean;
  canSellWithApproval: boolean;
  summary: string;
}

export interface ScoreBreakdown {
  breakdown: {
    netMarginScore: number;
    demandConfidenceScore: number;
    volumeRiskScore: number;
    dataReliabilityScore: number;
  };
  weighted: {
    marginContribution: number;
    demandContribution: number;
    volumeContribution: number;
    reliabilityContribution: number;
  };
  weights: {
    netMargin: number;
    demandConfidence: number;
    volumeRisk: number;
    dataReliability: number;
  };
}

export interface Product {
  id?: string; // Deal ID from database
  ean: string;
  productName?: string;
  // Basic input fields
  quantity?: number;
  buy_price?: number;
  currency?: string;
  supplier_region?: string;
  deal_quality_score: number;
  net_margin: number;
  demand_confidence: number;
  volume_risk: number;
  data_reliability: number;
  scoreBreakdown?: ScoreBreakdown;
  decision: 'Buy' | 'Renegotiate' | 'Source Elsewhere' | 'Pass';
  explanation: string;
  // Monthly sales data
  monthlySales?: {
    low: number;
    mid: number;
    high: number;
    source?: string;
  };
  bestChannel?: {
    channel: string;
    marketplace: string;
    marginPercent: number;
    currency: string;
  };
  channels?: ChannelData[];
  allocation?: {
    totalQuantity?: number;
    allocated: Record<string, number>;
    hold: number;
    rationale?: string;
    channelDetails?: Record<string, string>;
  };
  landedCost?: LandedCost;
  currencyInfo?: CurrencyInfo;  // FX transparency info
  negotiationSupport?: NegotiationSupport;
  sourcingSuggestions?: SourcingSuggestions;
  compliance?: Compliance;
  // Assumptions and history
  assumptions?: {
    history?: Array<{
      id: string;
      dealId?: string;
      assumptionType: 'shipping' | 'duty' | 'fee';
      oldValue: unknown;
      newValue: unknown;
      changedBy?: string;
      timestamp: string;
    }>;
  };
  // Performance metrics (only totals, no detailed breakdowns)
  performanceMetrics?: {
    total: number;
    db: {
      total: number;
    };
    api: {
      total: number;
    };
    logic: {
      total: number;
    };
  };
}
