import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
    mutations: {
      onError: (error) => {
        console.error("Mutation error:", error);
      },
    },
  },
});

// Helper function for API requests
export async function apiRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Network error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Specialized API functions
export const api = {
  // Market Data
  getMarketData: () => apiRequest("/api/market-data"),
  getQuote: (symbol: string) => apiRequest(`/api/market-data/${symbol}`),
  getOptionChain: (symbol: string, expiration?: string) => 
    apiRequest(`/api/market-data/${symbol}/options${expiration ? `?expiration=${expiration}` : ""}`),
  getMarketStatus: () => apiRequest("/api/market-status"),

  // Portfolios
  getPortfolios: () => apiRequest("/api/portfolios"),
  getPortfolio: (id: string) => apiRequest(`/api/portfolios/${id}`),
  getPortfolioSummary: (id: string) => apiRequest(`/api/portfolios/${id}/summary`),
  updatePortfolioValues: (id: string) => 
    apiRequest(`/api/portfolios/${id}/update-values`, { method: "POST" }),
  
  // Positions
  getPositions: (portfolioId: string) => apiRequest(`/api/portfolios/${portfolioId}/positions`),
  
  // Trading Signals
  getSignals: (params?: { status?: string; strategy?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.strategy) searchParams.set("strategy", params.strategy);
    return apiRequest(`/api/signals?${searchParams}`);
  },
  generateSignals: () => apiRequest("/api/signals/generate", { method: "POST" }),
  updateSignal: (id: string, updates: any) => 
    apiRequest(`/api/signals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
  executeSignal: (signalId: string, portfolioId: string, quantity: number) =>
    apiRequest(`/api/signals/${signalId}/execute`, {
      method: "POST",
      body: JSON.stringify({ portfolioId, quantity }),
    }),

  // Orders
  getOrders: (params?: { portfolioId?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.portfolioId) searchParams.set("portfolioId", params.portfolioId);
    if (params?.status) searchParams.set("status", params.status);
    return apiRequest(`/api/orders?${searchParams}`);
  },
  createOrder: (orderData: any) => 
    apiRequest("/api/orders", {
      method: "POST",
      body: JSON.stringify(orderData),
    }),

  // Risk Management
  getRiskMetrics: (portfolioId: string) => apiRequest(`/api/portfolios/${portfolioId}/risk`),
  calculateRiskMetrics: (portfolioId: string) => 
    apiRequest(`/api/portfolios/${portfolioId}/risk/calculate`, { method: "POST" }),

  // Strategies
  getStrategies: (params?: { type?: string; enabled?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set("type", params.type);
    if (params?.enabled !== undefined) searchParams.set("enabled", params.enabled.toString());
    return apiRequest(`/api/strategies?${searchParams}`);
  },
  createStrategy: (strategyData: any) => 
    apiRequest("/api/strategies", {
      method: "POST",
      body: JSON.stringify(strategyData),
    }),
  updateStrategy: (id: string, updates: any) =>
    apiRequest(`/api/strategies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  // System
  getSystemStatus: () => apiRequest("/api/system/status"),
  initializeSystem: () => apiRequest("/api/initialize", { method: "POST" }),
};

export default queryClient;
