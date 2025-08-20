import { useQuery, useMutation } from "@tanstack/react-query";
import { api, queryClient } from "@/lib/queryClient";

export function usePortfolio() {
  return useQuery({
    queryKey: ['/api/portfolios'],
    queryFn: () => api.getPortfolios(),
    refetchInterval: 60000, // Refetch every minute
  });
}

export function usePortfolioDetails(portfolioId: string) {
  return useQuery({
    queryKey: ['/api/portfolios', portfolioId],
    queryFn: () => api.getPortfolio(portfolioId),
    enabled: !!portfolioId,
    refetchInterval: 60000,
  });
}

export function usePortfolioSummary(portfolioId: string) {
  return useQuery({
    queryKey: ['/api/portfolios', portfolioId, 'summary'],
    queryFn: () => api.getPortfolioSummary(portfolioId),
    enabled: !!portfolioId,
    refetchInterval: 60000,
  });
}

export function usePositions(portfolioId: string) {
  return useQuery({
    queryKey: ['/api/portfolios', portfolioId, 'positions'],
    queryFn: () => api.getPositions(portfolioId),
    enabled: !!portfolioId,
    refetchInterval: 30000, // Refetch every 30 seconds for positions
  });
}

export function useUpdatePortfolioValues() {
  return useMutation({
    mutationFn: (portfolioId: string) => api.updatePortfolioValues(portfolioId),
    onSuccess: () => {
      // Invalidate portfolio-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios'] });
    },
  });
}
