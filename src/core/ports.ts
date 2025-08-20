import { LeapsPick, OptionContract } from './types';

export interface MLEngine {
  /** Score option candidates for strike selection (0..1). Higher is better. */
  scoreStrike(input: StrikeScoringRequest): Promise<StrikeScoringResponse>;

  /** Suggest entry/exit thresholds; returns target SL/TP modifiers and confidence. */
  scoreEntryExit(input: EntryExitRequest): Promise<EntryExitResponse>;

  /** Optional: run a remote backtest (when the ML service hosts the engine). */
  runBacktest?(input: BacktestRequest): Promise<BacktestResponse>;
}

export interface SignalTracker {
  /** Persist a candidate or executed order + metadata for analytics */
  record(event: {
    type: 'CANDIDATE' | 'ORDER_PLACED' | 'ORDER_REJECTED' | 'ORDER_FILLED';
    timestamp: string;
    underlying: string;
    contract: OptionContract;
    meta?: Record<string, unknown>;
  }): Promise<void>;
}

export interface DashboardPublisher {
  /** Push updates to your dashboard/socket/topic */
  publish(topic: string, payload: unknown): Promise<void>;
}

/** ---- ML DTOs ---- */

export interface StrikeCandidate {
  contract: OptionContract;
  // opaque features can be included for repeatability/debug
  features?: Record<string, number | string | boolean>;
}

export interface StrikeScoringRequest {
  model: string;          // e.g., "leaps-v1.2"
  asOf: string;           // ISO timestamp
  underlyingSpot: number;
  selectionContext: {
    side: 'long_call' | 'long_put';
    deltaRange: [number, number];
    dteRange: [number, number];
    ivRank?: number; // optional
  };
  candidates: StrikeCandidate[];
}

export interface ScoredStrike {
  symbol: string;                  // candidate contract symbol
  score: number;                   // 0..1
  reasons?: string[];              // interpretability; small list
}

export interface StrikeScoringResponse {
  model: string;
  version: string;
  scored: ScoredStrike[];          // parallel to candidates by symbol
}

export interface EntryExitRequest {
  model: string;
  asOf: string;
  underlying: string;
  side: 'long_call' | 'long_put';
  features: Record<string, number | string | boolean>;
}

export interface EntryExitResponse {
  model: string;
  version: string;
  slPctAdj: number;    // e.g., -0.05 to tighten SL by 5%
  tpPctAdj: number;    // e.g., +0.15 to extend TP by 15%
  confidence: number;  // 0..1
  reasons?: string[];
}

/** Backtest DTOs (optional to run remotely) */
export interface BacktestRequest {
  model: string;
  symbols: string[];
  start: string; // ISO
  end: string;   // ISO
  strategy: 'long_call_leaps' | 'long_put_leaps';
  params?: Record<string, unknown>;
}

export interface BacktestResponse {
  model: string;
  metrics: {
    trades: number;
    winRate: number;
    avgRR: number;
    pnl: number;
    maxDD: number;
    sharpe?: number;
    sortino?: number;
  };
  bySymbol?: Array<{ symbol: string; pnl: number; trades: number }>;
}
