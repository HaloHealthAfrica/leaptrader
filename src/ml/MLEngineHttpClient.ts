import axios, { AxiosInstance } from 'axios';
import { Logger } from '../utils/logger';
import { CircuitBreaker } from '../utils/circuitBreaker';
import { CONFIG } from '../config';
import {
  MLEngine, StrikeScoringRequest, StrikeScoringResponse,
  EntryExitRequest, EntryExitResponse, BacktestRequest, BacktestResponse
} from '../core/ports';

export class MLEngineHttpClient implements MLEngine {
  private readonly http: AxiosInstance;
  private readonly log = new Logger('ml-client');
  private readonly breaker = new CircuitBreaker({
    name: 'ml-engine',
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    successThreshold: 3,
    timeoutMs: 10000
  });

  constructor(private baseUrl: string, private apiKey?: string) {
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
      headers: {
        'User-Agent': 'LEAPS-APP/1.0',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
      }
    });

    this.http.interceptors.response.use(r => r, async err => {
      const status = err?.response?.status;
      if (status === 429) {
        const ra = Number(err.response.headers['retry-after']) || 2;
        this.log.warn(`ML 429; retry in ${ra}s`);
        await new Promise(res => setTimeout(res, ra * 1000));
        return this.http(err.config);
      }
      if (status >= 500 || err.code === 'ECONNABORTED') {
        const cfg = err.config; cfg.__retryCount = (cfg.__retryCount || 0) + 1;
        if (cfg.__retryCount <= 3) {
          const delay = Math.min(16000, (1 << cfg.__retryCount) * 500 + Math.random() * 300);
          this.log.warn(`Retrying ML (attempt ${cfg.__retryCount}) in ${delay}ms`);
          await new Promise(res => setTimeout(res, delay));
          return this.http(cfg);
        }
      }
      return Promise.reject(err);
    });
  }

  async scoreStrike(req: StrikeScoringRequest): Promise<StrikeScoringResponse> {
    return this.breaker.execute(async () => {
      const { data } = await this.http.post<StrikeScoringResponse>('/v1/score/strike', req);
      return data;
    });
  }

  async scoreEntryExit(req: EntryExitRequest): Promise<EntryExitResponse> {
    return this.breaker.execute(async () => {
      const { data } = await this.http.post<EntryExitResponse>('/v1/score/entry_exit', req);
      return data;
    });
  }

  async runBacktest(req: BacktestRequest): Promise<BacktestResponse> {
    return this.breaker.execute(async () => {
      const { data } = await this.http.post<BacktestResponse>('/v1/backtest/run', req);
      return data;
    });
  }
}
