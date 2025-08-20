import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";

export function useMarketData() {
  return useQuery({
    queryKey: ['/api/market-status'],
    queryFn: () => api.getMarketStatus(),
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useQuote(symbol: string) {
  return useQuery({
    queryKey: ['/api/market-data', symbol],
    queryFn: () => api.getQuote(symbol),
    enabled: !!symbol,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useOptionChain(symbol: string, expiration?: string) {
  return useQuery({
    queryKey: ['/api/market-data', symbol, 'options', expiration],
    queryFn: () => api.getOptionChain(symbol, expiration),
    enabled: !!symbol,
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useAllMarketData() {
  return useQuery({
    queryKey: ['/api/market-data'],
    queryFn: () => api.getMarketData(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
