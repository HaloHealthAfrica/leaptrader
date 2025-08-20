import { useQuery, useMutation } from "@tanstack/react-query";
import { api, queryClient } from "@/lib/queryClient";

export function useSignals(params?: { status?: string; strategy?: string }) {
  return useQuery({
    queryKey: ['/api/signals', params],
    queryFn: () => api.getSignals(params),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useGenerateSignals() {
  return useMutation({
    mutationFn: () => api.generateSignals(),
    onSuccess: () => {
      // Invalidate signals queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/signals'] });
    },
  });
}

export function useUpdateSignal() {
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => 
      api.updateSignal(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/signals'] });
    },
  });
}

export function useExecuteSignal() {
  return useMutation({
    mutationFn: ({ signalId, portfolioId, quantity }: { 
      signalId: string; 
      portfolioId: string; 
      quantity: number; 
    }) => api.executeSignal(signalId, portfolioId, quantity),
    onSuccess: () => {
      // Invalidate both signals and orders when a signal is executed
      queryClient.invalidateQueries({ queryKey: ['/api/signals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios'] });
    },
  });
}
