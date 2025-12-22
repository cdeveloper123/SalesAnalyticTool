# Global Trading Intelligence Core - Backend API

Backend API for the Global Trading Intelligence system built with Node.js, Express, MongoDB Atlas, and Mongoose.

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- MongoDB Atlas account (or local MongoDB)
- npm or yarn

### Installation

1. **Install dependencies:**
   ```bash
   cd saletool-backend
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Configure MongoDB Atlas:**
   - Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
   - Create a new cluster
   - Get your connection string
   - Update `MONGODB_URI` in `.env` file:
     ```
     MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/saletool?retryWrites=true&w=majority
     ```

4. **Seed initial data (optional but recommended):**
   ```bash
   npm run seed
   ```
   This will populate basic channel and country configurations.

5. **Start the server:**
   ```bash
   # Development mode (with nodemon)
   npm run dev

   # Production mode
   npm start
   ```

The server will start on `http://localhost:3001` (or the port specified in `.env`).

## 📡 API Endpoints

### Health Check
```
GET /api/health
```

### Deal Evaluation
```
POST /api/v1/deals/evaluate
```

**Request Body:**
```json
{
  "productEAN": "1234567890123",
  "quantity": 1000,
  "buyPrice": 25.00,
  "supplierRegion": "China",
  "productCategory": "Electronics",
  "productWeight": 0.5,
  "hsCode": "8517.12.00",
  "listingPrices": {
    "US_Marketplace": 99.99,
    "UK_Marketplace": 79.99,
    "DE_Marketplace": 89.99
  },
  "demandSignals": {
    "categoryPopularity": "High",
    "competitorCount": 15,
    "reviewVelocity": 8,
    "priceRank": 2
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dealId": "...",
    "dealQualityScore": 72,
    "decision": "Buy",
    "explanation": "...",
    "evaluation": {
      "netMargin": 28.5,
      "demandConfidence": 65,
      "volumeRisk": 25,
      "dataReliability": 80
    },
    "pricing": [...],
    "demandEstimates": [...],
    "allocation": {...},
    "negotiation": {...}
  }
}
```

### Get Deal
```
GET /api/v1/deals/:id
```

### Get All Deals
```
GET /api/v1/deals
```

## 🏗️ Architecture

### Core Services

1. **DealEvaluationService** - Main orchestration service that combines all other services
2. **PricingService** - Calculates net margin across countries and channels
3. **DemandService** - Estimates sales volume with ranges and confidence levels
4. **AllocationService** - Manages high-volume protection and allocation
5. **NegotiationService** - Provides supplier negotiation support

### Models

- **Product** - Product information (EAN, category, weight, HS code)
- **Deal** - Deal evaluation results and metadata
- **Channel** - Channel configurations (Amazon, retailers, distributors)
- **Country** - Country-specific settings (VAT, import duties, shipping)

## 🎯 Key Features

### Deal Evaluation Engine
- Calculates Deal Quality Score (0-100%)
- Combines: Net margin, Demand confidence, Volume risk, Data reliability
- Provides clear decision: Buy / Renegotiate / Source Elsewhere / Pass
- Plain-English explanations

### Global Pricing & Net Margin
- Supports 5-7 countries (US, UK, DE, FR, IT, ES, CA)
- Multiple channels: Marketplaces, Retailers, Distributors
- Accounts for:
  - Platform/marketplace fees
  - Payment fees
  - Import duties (HS-code-based)
  - Shipping & logistics
  - VAT handling

### Sales Volume Estimation
- Uses multiple signals (not single scraped number)
- Outputs ranges with confidence levels
- Conservative assumptions to prevent inflated demand
- Applies to all channel types

### High-Volume Protection
- Caps allocation per country/channel (max 30%)
- Limits exposure to realistic monthly absorption
- Supports phased/drip allocation over 3 months

### Supplier Negotiation Support
- Calculates target buy price
- Determines walk-away price
- Suggests counter-offer logic
- Provides alternative sourcing options

## 🔧 Configuration

### Amazon Marketplaces (Trial Scope)
- Amazon US (amazon.com)
- Amazon UK (amazon.co.uk)
- Amazon Germany (amazon.de)

Each marketplace includes:
- Category-specific referral fees
- FBA/FBM fees
- Compliance flags (brand gating, transparency)
- Sales estimates with confidence levels

## 📝 Environment Variables

```env
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb+srv://...
API_VERSION=v1
```

## 🧪 Testing

Example curl request:

```bash
curl -X POST http://localhost:3001/api/v1/deals/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "productEAN": "1234567890123",
    "quantity": 1000,
    "buyPrice": 25.00,
    "supplierRegion": "China",
    "productCategory": "Electronics"
  }'
```

## 🚦 Next Steps (Phase 2+)

- Integrate live APIs for pricing and demand data
- Add supplier/customer management
- Implement automation workflows
- Expand to additional Amazon marketplaces
- Add more channel types and countries

## 📄 License

ISC

