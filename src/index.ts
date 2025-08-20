/**
 * LeapTrader Main Module Exports
 * Central entry point for the LeapTrader system
 */

// Configuration
export { CONFIG, validateConfig, getDataProviderConfig, getMLModelConfig } from './config';

// Core types and interfaces
export type { 
  MLEngine, StrikeScoringRequest, StrikeScoringResponse,
  EntryExitRequest, EntryExitResponse
} from './core';

// Data providers and routing
export { OptionsDataRouter } from './data';
export type { OptionsDataProvider } from './data';

// Machine learning
export { MLEngineCore } from './ml/engine/mlEngine';
export { ModelManager } from './ml/engine/modelManager';
export type { ModelMeta } from './ml/engine/modelManager';

// Features
export { FeatureBuilder } from './features/FeatureBuilder';

// Utilities
export { Logger } from './utils/logger';

// Backtesting
export { Backtester } from './backtest/Backtester';
export type { BacktestParams, BacktestResult } from './backtest/Backtester';

// Agents (code review, etc.)
export * from './agents/CodeReviewAgent';