export interface Product {
  ean: string;
  deal_quality_score: number; // Percentage
  net_margin: number;
  demand_confidence: number;
  volume_risk: number;
  data_reliability: number;
  decision: 'Buy' | 'Renegotiate' | 'Source Elsewhere' | 'Pass';
  explanation: string; // Plain-English explanation
}

