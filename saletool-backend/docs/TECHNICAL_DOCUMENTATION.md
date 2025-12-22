# Deal Evaluation Engine - Technical Documentation

Version 1.0 | December 2025

---

## Table of Contents

1. Overview
2. Data Flow
3. Input Parameters
4. Data Sources
5. Fee Calculations
6. Landed Cost Calculation
7. Margin Calculation
8. Demand Estimation
9. Deal Scoring System
10. Decision Logic
11. Allocation Strategy
12. Negotiation Support
13. Supported Markets

---

## 1. Overview

The Deal Evaluation Engine analyzes product deals across multiple sales channels (Amazon and eBay) in multiple geographic markets. It calculates profitability, estimates demand, and provides allocation recommendations to optimize inventory distribution.

The system processes a single product EAN and returns:
- Profitability analysis per channel
- Overall deal score
- Buy/Hold/Renegotiate decision
- Inventory allocation plan
- Negotiation support (when applicable)

---

## 2. Data Flow

```
INPUT: EAN, Quantity, Buy Price, Currency, Supplier Region
                    |
                    v
    +-----------------------------------+
    |   Step 1: Fetch Market Data       |
    |   - Amazon pricing (6 markets)    |
    |   - eBay pricing (6 markets)      |
    +-----------------------------------+
                    |
                    v
    +-----------------------------------+
    |   Step 2: Calculate Landed Cost   |
    |   - Buy price conversion          |
    |   - Import duty                   |
    |   - Shipping cost                 |
    +-----------------------------------+
                    |
                    v
    +-----------------------------------+
    |   Step 3: Calculate Fees          |
    |   - Amazon: Referral + FBA        |
    |   - eBay: Final Value + Per Order |
    +-----------------------------------+
                    |
                    v
    +-----------------------------------+
    |   Step 4: Calculate Margins       |
    |   - Net proceeds per channel      |
    |   - Margin percentage             |
    +-----------------------------------+
                    |
                    v
    +-----------------------------------+
    |   Step 5: Estimate Demand         |
    |   - Sales rank analysis           |
    |   - Absorption capacity           |
    +-----------------------------------+
                    |
                    v
    +-----------------------------------+
    |   Step 6: Score and Decide        |
    |   - Weighted scoring              |
    |   - Decision logic                |
    +-----------------------------------+
                    |
                    v
    +-----------------------------------+
    |   Step 7: Allocate Inventory      |
    |   - Hybrid allocation strategy    |
    |   - Per-market caps               |
    +-----------------------------------+
                    |
                    v
OUTPUT: Deal Score, Decision, Allocation Plan, Channel Analysis
```

---

## 3. Input Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| ean | String | Product barcode (EAN/UPC) | 0045496395230 |
| quantity | Integer | Total units available | 1000 |
| buyPrice | Number | Per-unit purchase price | 110.00 |
| currency | String | Source currency | USD |
| supplierRegion | String | Supplier location | US, CN, EU |

---

## 4. Data Sources

### 4.1 Amazon Data (via Rainforest API)

Data retrieved per market:
- Buy Box Price
- Sales Rank (BSR)
- Sales Rank Category
- FBA Offer Count
- Product Title
- Category
- Weight

### 4.2 eBay Data (via eBay Browse API)

Data retrieved per market:
- Average Active Listing Price
- Active Listing Count
- Estimated Monthly Sales (derived from listing count)

---

## 5. Fee Calculations

### 5.1 Amazon Fees

```
Total Amazon Fees = Referral Fee + FBA Fee + Closing Fee (if media)

Referral Fee = Sell Price x Referral Rate

FBA Fee = Based on size tier and weight (lookup table)

Closing Fee = Fixed fee for media categories only
```

Referral Rate by Category:
- Electronics: 8%
- Video Games: 15%
- Apparel: 5-17% (tiered)
- Most categories: 15%
- Jewelry: 20%

FBA Fee Tiers (US, approximate):
- Small Standard (under 1 lb): $3.06 - $3.87
- Large Standard (1-20 lb): $3.68 - $7.46
- Large Bulky: $9.61 base + $0.38/lb

VAT Rates (deducted before calculating net proceeds):
- US: 0%
- UK: 20%
- DE: 19%
- FR: 20%
- IT: 22%
- AU: 10% (GST)

### 5.2 eBay Fees

```
Total eBay Fees = Final Value Fee + Per Order Fee

Final Value Fee = Sell Price x 13.25%

Per Order Fee = $0.30 (or equivalent in local currency)
```

Net Proceeds Formula:
```
Net Proceeds = Sell Price - Total Fees
```

---

## 6. Landed Cost Calculation

Landed cost represents the total cost to get one unit to the destination market.

```
Landed Cost = Buy Price + Import Duty + Shipping Cost

Import Duty = Buy Price x Duty Rate

Shipping Cost = Weight (kg) x Shipping Rate per kg
```

### 6.1 Duty Rates

Duty rates vary by:
- Origin country
- Destination country
- Product category

Examples (from China):
- Electronics to US: 0%
- Toys to UK: 4.7%
- Clothing to EU: 12%

### 6.2 Shipping Rates (per kg, USD)

| Route | Sea | Air | Express |
|-------|-----|-----|---------|
| CN to US | $2.50 | $6.00 | $12.00 |
| CN to UK | $3.00 | $7.00 | $14.00 |
| CN to DE | $2.80 | $6.50 | $13.00 |
| CN to AU | $2.20 | $5.50 | $11.00 |

Default shipping method: Air

---

## 7. Margin Calculation

```
Net Margin = Net Proceeds - Landed Cost (in destination currency)

Margin Percent = (Net Margin / Landed Cost) x 100
```

Example:
```
Sell Price (UK): £132.65
eBay Fees: £17.88
Net Proceeds: £114.77

Landed Cost (USD): $116.30
Landed Cost (GBP): £93.04 (converted at 0.80 rate)

Net Margin = £114.77 - £93.04 = £21.73
Margin Percent = (£21.73 / £93.04) x 100 = 23.4%
```

---

## 8. Demand Estimation

### 8.1 Sales Rank to Sales Formula

```
Estimated Monthly Sales = Coefficient / (Sales Rank ^ Exponent)
```

Category-specific coefficients (US):
- Video Games: coefficient = 80,000, exponent = 0.72
- Electronics: coefficient = 120,000, exponent = 0.78
- Toys and Games: coefficient = 100,000, exponent = 0.75

Marketplace size factors (relative to US):
- US: 1.00
- UK: 0.30
- DE: 0.35
- FR: 0.20
- IT: 0.15
- AU: 0.10

### 8.2 Absorption Capacity

```
Absorption Capacity = Estimated Monthly Sales x Target Market Share

Target Market Share:
- 15+ FBA sellers: 8%
- 10-14 FBA sellers: 12%
- 5-9 FBA sellers: 18%
- 2-4 FBA sellers: 25%
- 0-1 FBA sellers: 35%
```

### 8.3 Months to Sell Calculation

```
Months to Sell = Allocated Quantity / Monthly Absorption Capacity
```

---

## 9. Deal Scoring System

The overall deal score is a weighted average of four component scores.

```
Overall Score = (Margin Score x 0.35) + (Demand Score x 0.25) + 
                (Volume Risk Score x 0.25) + (Data Reliability Score x 0.15)
```

### 9.1 Component Score Calculations

**Margin Score (0-100):**
```
If margin >= 40%: Score = 100
If margin >= 25%: Score = 75 + ((margin - 25) / 15) x 25
If margin >= 15%: Score = 50 + ((margin - 15) / 10) x 25
If margin >= 0%: Score = (margin / 15) x 50
If margin < 0%: Score = 0
```

**Demand Confidence Score (0-100):**
Based on available signals:
- Sales rank available (top 1K): +35 points
- Sales rank available (top 10K): +30 points
- FBA sellers count (5+): +25 points
- Price stability: +15-25 points

**Volume Risk Score (0-100):**
```
If months to sell <= 1: Score = 100
If months to sell <= 2: Score = 80
If months to sell <= 3: Score = 60
If months to sell <= 6: Score = 40
If months to sell <= 12: Score = 20
If months to sell > 12: Score = 0
```

**Data Reliability Score (0-100):**
```
Score = min(100, Number of Channels Found x 20)
```

---

## 10. Decision Logic

The system outputs one of four decisions based on the overall score and margin.

| Decision | Criteria |
|----------|----------|
| Buy | Score >= 75 AND best margin >= 25% |
| Renegotiate | Score >= 50 AND score < 75 AND best margin >= 15% |
| Source Elsewhere | Score >= 50 AND best margin >= 15% AND margin could improve with different sourcing |
| Avoid | Score < 50 OR best margin < 15% |

---

## 11. Allocation Strategy

The system uses a hybrid allocation approach that balances profit maximization with inventory risk reduction.

### 11.1 Allocation Phases

**Phase 1 - High Margin Allocation (65% of quantity):**
- Channels sorted by margin percentage (descending)
- Allocate up to 3 months of absorption capacity per channel
- Only allocate to channels with margin >= 15%

**Phase 2 - Fast Absorption Allocation (remaining quantity):**
- Channels sorted by months to sell (ascending)
- Allocate remaining quantity to fastest-moving channels
- Cap at 3 months of absorption capacity per channel

### 11.2 Hold Quantity

```
Hold Quantity = Total Quantity - Sum of Allocated Quantities
```

Units are held when:
- Market absorption capacity is insufficient
- Risk of market flooding exists
- Demand confidence is low

---

## 12. Negotiation Support

When the decision is "Renegotiate", the system calculates target and walk-away prices.

```
Target Buy Price = Best Net Proceeds / 1.25
(Achieves 25% margin)

Walk-Away Price = Best Net Proceeds / 1.15
(Achieves minimum 15% margin)

Savings = Current Buy Price - Target Buy Price
```

Example:
```
Best Net Proceeds (converted to USD): $143.46
Target Buy Price: $143.46 / 1.25 = $114.77
Walk-Away Price: $143.46 / 1.15 = $124.75

Current Buy Price: $110.00
Current Margin: 30.4% (already exceeds target)
```

---

## 13. Supported Markets

### 13.1 Amazon Markets

| Market | Currency | VAT Rate |
|--------|----------|----------|
| US | USD | 0% |
| UK | GBP | 20% |
| DE | EUR | 19% |
| FR | EUR | 20% |
| IT | EUR | 22% |
| AU | AUD | 10% |

### 13.2 eBay Markets

| Market | Currency | Site ID |
|--------|----------|---------|
| US | USD | EBAY_US |
| UK | GBP | EBAY_GB |
| DE | EUR | EBAY_DE |
| FR | EUR | EBAY_FR |
| IT | EUR | EBAY_IT |
| AU | AUD | EBAY_AU |

---

## Appendix A: Channel Recommendation Logic

Per-channel recommendation is based on margin thresholds:

| Margin Range | Recommendation |
|--------------|----------------|
| >= 25% | Sell |
| 15% to 24.9% | Sell (with caution) |
| 0% to 14.9% | Avoid |
| < 0% | Avoid |

---

## Appendix B: Currency Conversion

All prices are converted to a common currency (USD) for comparison using live exchange rates.

Exchange rates are cached for 1 hour and refreshed automatically.

Fallback rates (if API unavailable):
- EUR: 0.96
- GBP: 0.80
- AUD: 1.53

---

## Appendix C: Risk Flags

The system assigns risk flags to channels based on:

| Flag | Condition |
|------|-----------|
| High inventory risk | Months to sell > 6 |
| Low demand confidence | Confidence score < 50 |
| Negative margin | Margin < 0% |
| Price volatility | Price variance > 30% |

---

## Appendix D: Compliance Flags

The system detects selling restrictions that may prevent or complicate Amazon listings.

### D.1 Brand Gating

Certain brands are restricted on Amazon and require approval:

| Brand Category | Examples | Severity |
|----------------|----------|----------|
| Gaming | Nintendo, Sony, Xbox | High |
| Electronics | Apple, Samsung, Bose | High |
| Toys | LEGO, Hasbro, Mattel | Medium-High |
| Apparel | Nike, Adidas, Under Armour | High |
| Beauty | L'Oreal, Olay | Medium |

Detection: Brand name matched against database of 50+ gated brands.

### D.2 Transparency Program

Some brands require unique QR codes on each unit:

| Enrolled Brands |
|-----------------|
| Bose, Beats, Anker, OtterBox, Spigen, Belkin, Logitech, Razer, Corsair |

Action Required: Contact brand owner for Transparency codes before selling.

### D.3 Category Restrictions

Some categories require Amazon approval:

| Category | Difficulty | Notes |
|----------|------------|-------|
| Grocery | Medium | FDA compliance required |
| Jewelry | High | Professional account required |
| Watches | High | High-value item approval |
| Fine Art | Very High | Invitation only |

### D.4 Hazmat Detection

Products with certain keywords are flagged for potential hazmat classification:

Keywords: battery, lithium, aerosol, spray, flammable, pressurized, alcohol, perfume, sanitizer

Impact: Higher FBA fees, special handling, storage restrictions.

---

## Appendix E: Retailer Channels (Mocked)

Non-Amazon retailers are included for multi-channel evaluation.

### E.1 Supported Retailers

| Retailer | Market | Commission | Price vs Amazon |
|----------|--------|------------|-----------------|
| Walmart | US | 15% + 2.9% payment | -7% (lower) |
| Target | US | 15% + 2.9% payment | -4% (lower) |

### E.2 Retailer Pricing Logic

```
Retailer Sell Price = Amazon Price x Price Multiplier

Walmart: Amazon Price x 0.93
Target: Amazon Price x 0.96

Net Proceeds = Sell Price - Commission - Payment Fee
```

### E.3 Retailer Demand Estimation

Retailer demand is estimated as a fraction of marketplace demand:

```
Retailer Monthly Sales = Base Demand x Category Multiplier

Category Multipliers:
- Video Games: 0.30
- Electronics: 0.40
- Toys: 0.50
```

---

## Appendix F: Distributor Channels (Mocked)

B2B distributor channels for wholesale evaluation.

### F.1 Supported Distributors

| Distributor | Region | Pays % of Retail | Min Order |
|-------------|--------|------------------|-----------|
| Ingram Micro | US | 55% | 500 units |
| Alliance Entertainment | US | 58% | 1,000 units |

### F.2 Distributor Pricing Logic

In distributor channels, YOU are the SELLER and the distributor is the BUYER.

```
Distributor Pays = Retail Price x Buy Percent

Ingram Micro: Amazon Price x 0.55
Alliance Ent: Amazon Price x 0.58

Your Margin = Distributor Pays - Your Landed Cost
```

### F.3 When to Use Distributors

Distributors are only profitable when:
- Your buy price is very low (< 40% of retail)
- You have high volume (1,000+ units)
- Marketplace margins are negative

For most deals, distributors will show "Avoid" because wholesale prices are too low.

---

## Appendix G: Channel Type Summary

| Channel Type | Fee Structure | Demand Source | Use Case |
|--------------|---------------|---------------|----------|
| Marketplace (Amazon) | Referral + FBA | Sales rank | Primary B2C |
| Marketplace (eBay) | Final Value + Per Order | Active listings | B2C alternative |
| Retailer | Commission + Payment | Mocked estimate | Multi-channel B2C |
| Distributor | None (B2B sale) | Capacity estimate | Bulk liquidation |

---

End of Document
