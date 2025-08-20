import { OptionContract } from '../core/types';

/**
 * Build model-ready features for both online inference and offline backtests.
 * Keep it deterministic & versioned to match training pipelines.
 */
export class FeatureBuilder {
  static readonly VERSION = 'feat-v1.0';

  /** Underlying-level features (spot, momentum, vol context, etc.) */
  buildUnderlyingFeatures(params: {
    symbol: string;
    spot: number;
    ivRank?: number;
    rsi14?: number;
    atr14?: number;
    trendDays?: number; // e.g., price > SMA? positive streak?
  }): Record<string, number | string | boolean> {
    const { symbol, spot, ivRank = -1, rsi14 = -1, atr14 = -1, trendDays = 0 } = params;
    return {
      _spec: FeatureBuilder.VERSION,
      u_symbol: symbol,
      u_spot: spot,
      u_ivRank: ivRank,
      u_rsi14: rsi14,
      u_atr14: atr14,
      u_trendDays: trendDays,
    };
  }

  /** Contract-level features for strike selection ranking */
  buildContractFeatures(spot: number, c: OptionContract): Record<string, number | string | boolean> {
    const mid = ((c.bid ?? 0) + (c.ask ?? 0)) / 2 || 0;
    const dte = Math.ceil((new Date(c.expiration).getTime() - Date.now()) / 86400000);
    const spreadPct = (c.bid && c.ask) ? ((c.ask - c.bid) / ((c.ask + c.bid) / 2)) * 100 : 1000;
    const iv = c.iv ?? -1;
    const delta = Math.abs(c.greeks?.delta ?? 0);
    const extrinsic = Math.max(0, mid - (c.right === 'call' ? Math.max(0, spot - c.strike) : Math.max(0, c.strike - spot)));

    return {
      _spec: FeatureBuilder.VERSION,
      c_symbol: c.symbol,
      c_right: c.right,
      c_strike: c.strike,
      c_dte: dte,
      c_bid: c.bid ?? 0,
      c_ask: c.ask ?? 0,
      c_mid: mid,
      c_spreadPct: spreadPct,
      c_iv: iv,
      c_delta: delta,
      c_oi: c.openInterest ?? 0,
      c_vol: c.volume ?? 0,
      c_extrinsic: extrinsic,
      c_extrinsicPerDelta: delta ? extrinsic / delta : 0,
      c_moneyness: spot ? (c.strike / spot) : 0,
    };
  }

  /** Build combined features for a contract + underlying context */
  buildCombinedFeatures(
    underlying: { symbol: string; spot: number; ivRank?: number; rsi14?: number; atr14?: number; trendDays?: number },
    contract: OptionContract
  ): Record<string, number | string | boolean> {
    return {
      ...this.buildUnderlyingFeatures(underlying),
      ...this.buildContractFeatures(underlying.spot, contract)
    };
  }
}
