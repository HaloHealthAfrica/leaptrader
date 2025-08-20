import { SimplifiedLeapsOrchestrator, SimplifiedLeapsConfig } from '../src/strategy/SimplifiedLeapsOrchestrator';
import { productionConfig, conservativeConfig, aggressiveConfig } from '../config/simplified-leaps-config';

/**
 * Example usage of the Simplified LEAPS Orchestrator
 * Focused on Long Calls and Protective Puts only
 */

async function main() {
  console.log('🚀 Simplified LEAPS Strategy Example');
  
  // Example 1: Production Configuration
  console.log('\n📊 Production Configuration Example');
  await runExample(productionConfig, 'Production');

  // Example 2: Conservative Configuration  
  console.log('\n🛡️ Conservative Configuration Example');
  await runExample(conservativeConfig, 'Conservative');

  // Example 3: Aggressive Configuration
  console.log('\n⚡ Aggressive Configuration Example');
  await runExample(aggressiveConfig, 'Aggressive');

  // Example 4: Custom Configuration
  console.log('\n⚙️ Custom Configuration Example');
  await customConfigurationExample();
}

async function runExample(config: SimplifiedLeapsConfig, configName: string) {
  // Mock data clients (replace with real implementations)
  const dataClients = {
    twelvedata: createMockDataClient(),
    alpaca: createMockDataClient(),
    tradier: createMockDataClient()
  };

  // Update config with mock data clients
  const orchestratorConfig = {
    ...config,
    dataClients
  };

  // Initialize orchestrator
  const orchestrator = new SimplifiedLeapsOrchestrator(orchestratorConfig);
  await orchestrator.initialize();

  // Define symbols to analyze (blue-chip stocks with good options liquidity)
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];

  try {
    // Generate recommendations
    console.log(`Analyzing ${symbols.length} symbols with ${configName} configuration...`);
    const recommendations = await orchestrator.generateRecommendations(symbols);

    console.log(`\n📈 ${configName} Configuration Results:`);
    console.log(`Generated ${recommendations.length} recommendations\n`);

    // Display recommendations
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec.symbol} - ${rec.primaryStrategy.toUpperCase()}`);
      console.log(`   Confidence: ${rec.confidence.toFixed(1)}/10`);
      console.log(`   Risk Level: ${rec.riskLevel.toUpperCase()}`);
      console.log(`   Time Horizon: ${rec.timeHorizon} days`);
      console.log(`   Capital Required: $${rec.totalCapitalRequired.toLocaleString()}`);
      console.log(`   Strategy: ${getStrategyDescription(rec)}`);
      console.log(`   Reasoning: ${rec.reasoning}`);
      console.log('');
    });

    // Show configuration summary
    console.log(`📋 Configuration Summary:`);
    console.log(`   Long Call Weight: ${(config.preferences.longCallWeight * 100).toFixed(0)}%`);
    console.log(`   Protection Level: ${config.preferences.protectionLevel}`);
    console.log(`   Max Position Size: ${(config.riskLimits.maxSinglePositionSize * 100).toFixed(0)}%`);
    console.log(`   Min Liquidity Score: ${config.riskLimits.minLiquidityScore}`);

  } catch (error) {
    console.error(`Error in ${configName} example:`, error);
  } finally {
    await orchestrator.stop();
  }
}

async function customConfigurationExample() {
  // Create custom configuration for specific preferences
  const customConfig: SimplifiedLeapsConfig = {
    dataClients: {
      twelvedata: createMockDataClient(),
      alpaca: createMockDataClient(),
      tradier: createMockDataClient()
    },
    preferences: {
      longCallWeight: 0.9, // Very bullish approach - 90% calls
      protectionLevel: 'aggressive', // Minimal protection
      timeHorizonPreference: 'long', // True LEAPS only
      maxPositionsPerSymbol: 1 // One best position per symbol
    },
    riskLimits: {
      maxSinglePositionSize: 0.25, // 25% max per position (higher risk)
      maxTotalAllocation: 0.85, // 85% total allocation
      minLiquidityScore: 4.0, // Lower liquidity requirement
      maxIVThreshold: 0.90 // Very high IV tolerance
    }
  };

  const orchestrator = new SimplifiedLeapsOrchestrator(customConfig);
  await orchestrator.initialize();

  // Focus on high-growth tech stocks
  const techSymbols = ['AAPL', 'GOOGL', 'NVDA', 'AMD', 'CRM'];

  try {
    console.log('Analyzing tech stocks with custom bullish configuration...');
    const recommendations = await orchestrator.generateRecommendations(techSymbols);

    console.log(`\n🎯 Custom Bullish Configuration Results:`);
    recommendations.forEach((rec, index) => {
      if (rec.callSignal) {
        console.log(`${index + 1}. ${rec.symbol} LONG CALL LEAPS`);
        console.log(`   Entry: BUY ${rec.callSignal.targetPrice} CALL`);
        console.log(`   Confidence: ${rec.callSignal.confidence.toFixed(1)}/10`);
        console.log(`   Expected Return: ${rec.callSignal.expectedReturn.toFixed(1)}%`);
        console.log(`   Time to Expiry: ${rec.callSignal.timeHorizon} days`);
        console.log(`   Reasoning: ${rec.callSignal.reasoning}`);
        console.log('');
      }
    });

  } catch (error) {
    console.error('Error in custom configuration example:', error);
  } finally {
    await orchestrator.stop();
  }
}

function getStrategyDescription(rec: any): string {
  switch (rec.primaryStrategy) {
    case 'long_call':
      return 'Long Call LEAPS for leveraged upside exposure';
    case 'protective_put':
      return 'Protective Put for downside protection';
    case 'both':
      return 'Collar strategy with calls and puts';
    default:
      return 'Unknown strategy';
  }
}

function createMockDataClient() {
  return {
    getQuote: async (symbol: string) => ({
      symbol,
      price: 150 + Math.random() * 100, // Mock price between $150-250
      volume: 1000000 + Math.random() * 2000000,
      timestamp: new Date()
    }),
    
    getHistoricalData: async (symbol: string, period: string = '6month', interval: string = '1day') => ({
      symbol,
      data: generateMockHistoricalData(180) // 6 months of daily data
    }),
    
    getOptionChain: async (symbol: string, expiration: Date) => ({
      symbol,
      expiration,
      calls: generateMockOptions('call', 150, expiration),
      puts: generateMockOptions('put', 150, expiration)
    }),
    
    getExpirationDates: async (symbol: string) => {
      // Generate LEAPS expiration dates (1-3 years out)
      const dates = [];
      const now = new Date();
      for (let i = 12; i <= 36; i += 3) { // Every 3 months, 1-3 years out
        const expDate = new Date(now);
        expDate.setMonth(expDate.getMonth() + i);
        dates.push(expDate.toISOString().split('T')[0]);
      }
      return dates;
    }
  };
}

function generateMockHistoricalData(days: number) {
  const data = [];
  let price = 150 + Math.random() * 50;
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    
    // Simple random walk with slight upward bias
    price += (Math.random() - 0.45) * 2;
    price = Math.max(50, Math.min(300, price)); // Keep within reasonable bounds
    
    data.push({
      date: date.toISOString().split('T')[0],
      open: price + (Math.random() - 0.5),
      high: price + Math.random() * 2,
      low: price - Math.random() * 2,
      close: price,
      volume: 1000000 + Math.random() * 2000000
    });
  }
  
  return data;
}

function generateMockOptions(type: 'call' | 'put', stockPrice: number, expiration: Date) {
  const options = [];
  const strikes = [];
  
  // Generate strikes around stock price
  for (let i = -10; i <= 10; i++) {
    strikes.push(stockPrice + (i * 5)); // $5 increments
  }
  
  strikes.forEach(strike => {
    const isCall = type === 'call';
    const moneyness = strike / stockPrice;
    
    // Calculate approximate option values (simplified Black-Scholes approximation)
    const timeToExpiry = (expiration.getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000);
    const intrinsicValue = Math.max(0, isCall ? stockPrice - strike : strike - stockPrice);
    const timeValue = Math.sqrt(timeToExpiry) * stockPrice * 0.3 * Math.exp(-Math.pow(moneyness - 1, 2) / 0.2);
    const optionPrice = intrinsicValue + timeValue;
    
    if (optionPrice > 0.50) { // Only include options worth at least $0.50
      options.push({
        strike,
        expiration,
        bid: Math.max(0.05, optionPrice - 0.15),
        ask: optionPrice + 0.15,
        last: optionPrice,
        volume: Math.floor(Math.random() * 500) + 50,
        openInterest: Math.floor(Math.random() * 5000) + 500,
        delta: isCall ? 
          Math.max(0.05, Math.min(0.95, 0.5 + (stockPrice - strike) / stockPrice * 2)) :
          Math.max(-0.95, Math.min(-0.05, -0.5 - (strike - stockPrice) / stockPrice * 2)),
        impliedVolatility: 0.20 + Math.random() * 0.30,
        optionType: type
      });
    }
  });
  
  return options;
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as runSimplifiedLeapsExample };