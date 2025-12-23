export interface LandedCost {
  buyPrice: number;
  duty: number;
  shipping: number;
  total: number;
}

export interface ChannelData {
  channel: string;
  marketplace: string;
  sellPrice: number;
  currency: string;
  netProceeds: number;
  netMargin: number;
  marginPercent: number;
  recommendation: string;
  landedCost?: LandedCost;
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

export interface Product {
  ean: string;
  productName?: string;
  deal_quality_score: number;
  net_margin: number;
  demand_confidence: number;
  volume_risk: number;
  data_reliability: number;
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
    allocated: Record<string, number>;
    hold: number;
    rationale?: string;
    channelDetails?: Record<string, string>;
  };
  landedCost?: LandedCost;
  negotiationSupport?: NegotiationSupport;
  sourcingSuggestions?: SourcingSuggestions;
  compliance?: Compliance;
}
