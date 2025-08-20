# ML Service Integration - LEAPS Trading System

## Overview

The ML Service Agent provides comprehensive machine learning integration for the LEAPS trading system, enabling:

- **Intelligent Strike Selection**: ML-powered ranking of option contracts
- **Entry/Exit Optimization**: Dynamic stop-loss and take-profit adjustments
- **Strategy Improvement**: Continuous learning from market performance
- **Backtesting**: ML-enhanced historical strategy validation
- **Model Management**: Version control, A/B testing, and performance monitoring

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Trading App   │    │   ML Service    │    │   ML Models     │
│                 │◄──►│                 │◄──►│                 │
│ • Contract      │    │ • Feature       │    │ • Strike        │
│   Selection     │    │   Builder       │    │   Selection     │
│ • Risk Mgmt     │    │ • ML Engine     │    │ • Entry/Exit    │
│ • Portfolio     │    │ • Model Mgr     │    │ • Strategy      │
│   Mgmt          │    │ • Backtester    │    │   Improvement   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Core Components

### 1. ML Engine Core (`src/ml/engine/mlEngine.ts`)

The central orchestrator that coordinates all ML operations:

```typescript
import { MLEngineCore } from './ml/engine/mlEngine';

const mlEngine = new MLEngineCore();

// Score option candidates
const scores = await mlEngine.scoreStrike(request);

// Get entry/exit recommendations
const recommendation = await mlEngine.scoreEntryExit(request);
```

**Key Features:**
- Unified interface for all ML operations
- Automatic feature engineering
- Model ensemble support
- Fallback to rule-based logic

### 2. Feature Builder (`src/features/FeatureBuilder.ts`)

Deterministic feature construction for consistent ML inputs:

```typescript
import { FeatureBuilder } from './features/FeatureBuilder';

const fb = new FeatureBuilder();

// Build underlying features
const underlyingFeatures = fb.buildUnderlyingFeatures({
  symbol: 'AAPL',
  spot: 150,
  ivRank: 45,
  rsi14: 65,
  atr14: 2.5,
  trendDays: 3
});

// Build contract features
const contractFeatures = fb.buildContractFeatures(150, optionContract);

// Combine features
const combinedFeatures = fb.buildCombinedFeatures(underlying, contract);
```

**Feature Categories:**
- **Underlying Features**: Spot price, IV rank, RSI, ATR, trend strength
- **Contract Features**: Strike, DTE, bid/ask, Greeks, volume, OI
- **Derived Features**: Moneyness, extrinsic value, spread percentage

### 3. Strike Optimizer (`src/ml/engine/strikeOptimizer.ts`)

Intelligent option contract ranking using multiple factors:

```typescript
import { StrikeOptimizer } from './ml/engine/strikeOptimizer';

const optimizer = new StrikeOptimizer();

const scores = await optimizer.scoreCandidates(candidates, context);
```

**Scoring Factors:**
1. **Delta Alignment** (30%): Proximity to target delta range
2. **DTE Alignment** (20%): Days to expiration optimization
3. **Liquidity** (20%): Volume, OI, and spread analysis
4. **IV Rank** (15%): Volatility regime consideration
5. **Extrinsic Value** (15%): Premium efficiency

### 4. Entry/Exit Model (`src/ml/engine/entryExitModel.ts`)

Dynamic stop-loss and take-profit optimization:

```typescript
import { EntryExitModel } from './ml/engine/entryExitModel';

const model = new EntryExitModel();

const recommendation = await model.getRecommendation(
  'AAPL',
  'long_call',
  features
);
```

**Market Regime Analysis:**
- **Volatility**: High IV → wider SL, extended TP
- **Trend**: Strong trends → extended TP
- **Momentum**: Extreme RSI → wider SL for reversals

### 5. Model Manager (`src/ml/engine/modelManager.ts`)

Comprehensive model lifecycle management:

```typescript
import { ModelManager } from './ml/engine/modelManager';

const manager = new ModelManager();

// Register new model
manager.registerModel(modelMeta);

// Activate model for specific type
manager.activateModel('strike_selection', 'leaps-v2.0');

// Get performance metrics
const metrics = await manager.getPerformanceMetrics();
```

**Capabilities:**
- Model versioning and deployment
- Performance tracking and comparison
- A/B testing support
- Health monitoring

### 6. Backtester (`src/backtest/Backtester.ts`)

ML-enhanced historical strategy validation:

```typescript
import { Backtester } from './backtest/Backtester';

const backtester = new Backtester(router, mlEngine);

const results = await backtester.run({
  symbols: ['AAPL', 'SPY', 'QQQ'],
  start: '2023-01-01',
  end: '2023-12-31',
  side: 'long_call',
  useML: true,
  initialCapital: 100000
});
```

**Features:**
- ML vs rule-based comparison
- Comprehensive performance metrics
- Risk analysis (drawdown, Sharpe ratio)
- Trade-by-trade analysis

## Integration Points

### 1. Contract Selection Enhancement

The ML service enhances the existing contract selector:

```typescript
// Before: Rule-based selection
const pick = selector.pick(selection, chain, { spot: 150, ivRank: 45 });

// After: ML-enhanced selection
const pick = selector.pick(selection, chain, { 
  spot: 150, 
  ivRank: 45,
  mlEnabled: true,
  model: 'leaps-v1.2'
});
```

**ML Contributions:**
- Contract ranking refinement
- Confidence scoring
- Alternative recommendations
- Risk-adjusted selection

### 2. Portfolio Risk Management

ML optimizes entry/exit timing:

```typescript
// Base risk assessment
const risk = assessOptionRisk(mid, buyingPower);

// ML-enhanced adjustments
if (mlEngine && config.ENABLE_ML_SCORING) {
  const mlRecommendation = await mlEngine.scoreEntryExit({
    model: 'entry-exit-v1.0',
    underlying: contract.underlying,
    side: strategy.side,
    features: features
  });

  // Apply ML adjustments
  const adjustedSL = risk.stopLossPrice * (1 + mlRecommendation.slPctAdj);
  const adjustedTP = risk.takeProfitPrice * (1 + mlRecommendation.tpPctAdj);
}
```

### 3. Signal Generation

ML enhances trading signals:

```typescript
const signal = {
  contract: selectedContract,
  entryPrice: midPrice,
  stopLoss: adjustedSL,
  takeProfit: adjustedTP,
  confidence: mlRecommendation.confidence,
  mlScore: mlScore,
  reasons: [...baseReasons, ...mlReasons]
};
```

## Configuration

### Environment Variables

```bash
# ML Service Configuration
ML_BASE_URL=http://localhost:8080
ML_API_KEY=your_ml_service_key_here
ML_ENABLED=true
ML_FALLBACK_ENABLED=true
ML_SHADOW_MODE=false

# Model Configuration
DEFAULT_STRIKE_MODEL=leaps-v1.2
DEFAULT_ENTRY_EXIT_MODEL=entry-exit-v1.0
ML_SCORING_WEIGHT=0.3
ML_ENTRY_EXIT_WEIGHT=0.4
```

### Feature Flags

```typescript
// Enable/disable ML features
config.ENABLE_ML_SCORING = true;
config.ENABLE_ML_ENTRY_EXIT = true;
config.ENABLE_ML_BACKTESTING = true;

// Shadow mode: ML scores but doesn't affect decisions
config.ML_SHADOW_MODE = true;
```

## Usage Examples

### 1. Basic ML Integration

```typescript
import { MLEngineCore } from './ml/engine/mlEngine';
import { FeatureBuilder } from './features/FeatureBuilder';

class TradingStrategy {
  constructor(private mlEngine: MLEngineCore) {}

  async selectContract(symbol: string, side: string) {
    // Get option chain
    const chain = await this.getOptionChain(symbol);
    
    // Build features
    const features = chain.map(contract => 
      this.featureBuilder.buildContractFeatures(spot, contract)
    );

    // ML scoring
    const scores = await this.mlEngine.scoreStrike({
      model: 'leaps-v1.2',
      candidates: chain.map((c, i) => ({ contract: c, features: features[i] })),
      selectionContext: { side, deltaRange: [0.55, 0.70] }
    });

    // Select best contract
    return scores.scored[0];
  }
}
```

### 2. Entry/Exit Optimization

```typescript
async optimizeEntryExit(contract: OptionContract, strategy: Strategy) {
  const features = this.featureBuilder.buildUnderlyingFeatures({
    symbol: contract.underlying,
    spot: currentSpot,
    ivRank: currentIVRank,
    rsi14: currentRSI,
    trendDays: trendStrength
  });

  const recommendation = await this.mlEngine.scoreEntryExit({
    model: 'entry-exit-v1.0',
    underlying: contract.underlying,
    side: strategy.side,
    features
  });

  return {
    stopLoss: baseSL * (1 + recommendation.slPctAdj),
    takeProfit: baseTP * (1 + recommendation.tpPctAdj),
    confidence: recommendation.confidence,
    reasons: recommendation.reasons
  };
}
```

### 3. Backtesting with ML

```typescript
async runMLBacktest() {
  const backtester = new Backtester(this.router, this.mlEngine);
  
  // Run baseline (rule-based)
  const baseline = await backtester.run({
    ...params,
    useML: false
  });

  // Run ML-enhanced
  const mlEnhanced = await backtester.run({
    ...params,
    useML: true
  });

  // Compare results
  const improvement = {
    winRate: mlEnhanced.summary.winRate - baseline.summary.winRate,
    sharpeRatio: mlEnhanced.summary.sharpeRatio - baseline.summary.sharpeRatio,
    maxDrawdown: baseline.summary.maxDrawdown - mlEnhanced.summary.maxDrawdown
  };

  return { baseline, mlEnhanced, improvement };
}
```

## Monitoring and Telemetry

### 1. Model Performance Tracking

```typescript
import { ModelRegistry } from './telemetry/ModelRegistry';

const registry = new ModelRegistry();

// Record model usage
registry.recordUsage({
  modelName: 'leaps-v1.2',
  requestType: 'strike_scoring',
  responseTime: 150,
  success: true,
  inputFeatures: features,
  outputScore: 0.85
});

// Get performance metrics
const metrics = await registry.getPerformanceMetrics();
const health = registry.getModelHealth('leaps-v1.2');
```

### 2. A/B Testing

```typescript
// Compare model versions
const comparison = registry.getModelComparison(
  'leaps-v1.2',
  'leaps-v2.0',
  '1d'
);

console.log('Model Comparison:', {
  responseTimeDiff: comparison.comparison.responseTimeDiff,
  errorRateDiff: comparison.comparison.errorRateDiff,
  scoreDiff: comparison.comparison.scoreDiff
});
```

## Testing

### Running ML Tests

```bash
# Run all ML tests
npm test test/ml/

# Run specific test file
npm test test/ml/mlEngine.test.ts

# Run with coverage
npm run test:coverage test/ml/
```

### Test Structure

```
test/ml/
├── mlEngine.test.ts          # Core ML engine tests
├── featureBuilder.test.ts    # Feature engineering tests
├── strikeOptimizer.test.ts   # Strike selection tests
├── entryExitModel.test.ts    # Entry/exit model tests
└── backtester.test.ts        # Backtesting tests
```

## Deployment

### 1. Local Development

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your API keys

# Run tests
npm test

# Start development server
npm run dev
```

### 2. Production Deployment

```bash
# Build the application
npm run build

# Start production server
npm start

# Docker deployment
docker build -t leaps-trading-ml .
docker run -p 3000:3000 leaps-trading-ml
```

### 3. ML Service Scaling

```yaml
# docker-compose.yml
version: '3.8'
services:
  ml-service:
    build: ./ml-service
    ports:
      - "8080:8080"
    environment:
      - MODEL_PATH=/models
      - GPU_ENABLED=true
    volumes:
      - ./models:/models
    deploy:
      replicas: 3
```

## Troubleshooting

### Common Issues

1. **ML Service Unavailable**
   - Check `ML_BASE_URL` configuration
   - Verify ML service health
   - Check circuit breaker status

2. **Feature Mismatch**
   - Ensure feature version compatibility
   - Validate input data structure
   - Check feature builder version

3. **Model Performance Degradation**
   - Monitor model health metrics
   - Check for data drift
   - Validate model versions

### Debug Mode

```typescript
// Enable debug logging
config.LOG_LEVEL = 'debug';

// Enable ML shadow mode
config.ML_SHADOW_MODE = true;

// Validate ML responses
const response = await mlEngine.scoreStrike(request);
console.log('ML Response:', JSON.stringify(response, null, 2));
```

## Future Enhancements

### 1. Advanced ML Features

- **Reinforcement Learning**: Dynamic strategy adaptation
- **Ensemble Methods**: Multi-model voting systems
- **Online Learning**: Real-time model updates
- **Feature Store**: Centralized feature management

### 2. Model Management

- **AutoML**: Automated model selection
- **Model Drift Detection**: Automatic retraining triggers
- **A/B Testing Framework**: Statistical significance testing
- **Model Explainability**: SHAP, LIME integration

### 3. Performance Optimization

- **GPU Acceleration**: CUDA support for large models
- **Model Quantization**: Reduced precision for speed
- **Caching**: Intelligent result caching
- **Async Processing**: Non-blocking ML operations

## Support and Contributing

### Getting Help

- **Documentation**: Check this guide and API docs
- **Issues**: Report bugs via GitHub issues
- **Discussions**: Join community discussions
- **Support**: Contact the development team

### Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

### Code Standards

- Follow TypeScript best practices
- Maintain test coverage > 80%
- Use consistent logging patterns
- Document public APIs with JSDoc

---

**Note**: This ML service is designed to enhance, not replace, existing trading logic. Always maintain fallback mechanisms and validate ML recommendations against risk management rules.
