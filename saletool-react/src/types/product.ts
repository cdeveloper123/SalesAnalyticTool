export interface ChannelData {
  channel: string;
  marketplace: string;
  sellPrice: number;
  currency: string;
  netProceeds: number;
  netMargin: number;
  marginPercent: number;
  recommendation: string;
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
  };
}

