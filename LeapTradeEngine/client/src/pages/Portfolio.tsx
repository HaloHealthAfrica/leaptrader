import { useState } from "react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Target,
  RefreshCw,
  Plus,
  MoreVertical
} from "lucide-react";
import { formatCurrency, formatPercentage, formatDate, getSymbolAvatar } from "@/utils/formatters";

export default function Portfolio() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const { data: portfolios = [], isLoading } = usePortfolio();
  
  const mainPortfolio = portfolios[0];
  const portfolioId = mainPortfolio?.id;

  const { data: positions = [] } = useQuery({
    queryKey: ['/api/portfolios', portfolioId, 'positions'],
    queryFn: () => portfolioId ? api.getPositions(portfolioId) : [],
    enabled: !!portfolioId,
  });

  const { data: riskMetrics } = useQuery({
    queryKey: ['/api/portfolios', portfolioId, 'risk'],
    queryFn: () => portfolioId ? api.getRiskMetrics(portfolioId) : null,
    enabled: !!portfolioId,
  });

  if (isLoading || !mainPortfolio) {
    return (
      <div className="space-y-6">
        <div className="glass-card animate-pulse h-64"></div>
        <div className="glass-card animate-pulse h-96"></div>
      </div>
    );
  }

  const openPositions = positions.filter(p => !p.closeDate);
  const closedPositions = positions.filter(p => p.closeDate);
  
  const totalUnrealizedPnL = openPositions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
  const totalRealizedPnL = closedPositions.reduce((sum, pos) => sum + pos.realizedPnL, 0);

  return (
    <div className="space-y-8">
      {/* Portfolio Header */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">{mainPortfolio.name}</h2>
            <p className="text-gray-400">Portfolio Management & Performance Analytics</p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Update Values
            </Button>
            <Button size="sm" className="bg-success-green hover:bg-success-green/80">
              <Plus className="w-4 h-4 mr-2" />
              New Position
            </Button>
          </div>
        </div>

        {/* Portfolio Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-white/5 rounded-xl">
            <DollarSign className="w-8 h-8 text-accent-blue mx-auto mb-2" />
            <div className="text-2xl font-bold">{formatCurrency(mainPortfolio.totalValue)}</div>
            <div className="text-sm text-gray-400">Total Value</div>
            <div className={`text-sm mt-1 ${
              mainPortfolio.performance.dayChange >= 0 ? 'text-success-green' : 'text-danger-red'
            }`}>
              {mainPortfolio.performance.dayChange >= 0 ? '+' : ''}{formatCurrency(mainPortfolio.performance.dayChange)}
              ({formatPercentage(mainPortfolio.performance.dayChangePercent)})
            </div>
          </div>

          <div className="text-center p-4 bg-white/5 rounded-xl">
            <TrendingUp className="w-8 h-8 text-success-green mx-auto mb-2" />
            <div className="text-2xl font-bold">{formatCurrency(totalUnrealizedPnL)}</div>
            <div className="text-sm text-gray-400">Unrealized P&L</div>
            <div className="text-sm text-success-green mt-1">
              {openPositions.length} open positions
            </div>
          </div>

          <div className="text-center p-4 bg-white/5 rounded-xl">
            <Target className="w-8 h-8 text-accent-purple mx-auto mb-2" />
            <div className="text-2xl font-bold">{formatPercentage(mainPortfolio.performance.winRate, 1)}</div>
            <div className="text-sm text-gray-400">Win Rate</div>
            <div className="text-sm text-gray-400 mt-1">
              Sharpe: {mainPortfolio.performance.sharpeRatio.toFixed(2)}
            </div>
          </div>

          <div className="text-center p-4 bg-white/5 rounded-xl">
            <Calendar className="w-8 h-8 text-warning-orange mx-auto mb-2" />
            <div className="text-2xl font-bold">{formatCurrency(mainPortfolio.cashBalance)}</div>
            <div className="text-sm text-gray-400">Cash Balance</div>
            <div className="text-sm text-gray-400 mt-1">
              {((mainPortfolio.cashBalance / mainPortfolio.totalValue) * 100).toFixed(1)}% cash
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4 bg-trading-card">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="positions">Positions ({openPositions.length})</TabsTrigger>
          <TabsTrigger value="history">History ({closedPositions.length})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Holdings */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Top Holdings</CardTitle>
                <CardDescription>Largest positions by market value</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {openPositions
                    .sort((a, b) => b.marketValue - a.marketValue)
                    .slice(0, 5)
                    .map((position) => (
                      <div key={position.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={getSymbolAvatar(position.symbol)}>
                            {position.symbol.substring(0, 4)}
                          </div>
                          <div>
                            <div className="font-medium">{position.symbol}</div>
                            <div className="text-sm text-gray-400">
                              {position.quantity} shares • {position.side}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(position.marketValue)}</div>
                          <div className={`text-sm ${
                            position.unrealizedPnL >= 0 ? 'text-success-green' : 'text-danger-red'
                          }`}>
                            {position.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(position.unrealizedPnL)}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Chart Placeholder */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Performance Chart</CardTitle>
                <CardDescription>Portfolio value over time</CardDescription>
              </CardHeader>
              <CardContent className="h-64 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <TrendingUp className="w-12 h-12 mx-auto mb-2" />
                  <p>Performance Chart</p>
                  <p className="text-sm">Coming Soon</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="positions" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Open Positions</CardTitle>
              <CardDescription>Currently held positions and their performance</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-trading-border">
                    <TableHead>Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Entry Price</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>Market Value</TableHead>
                    <TableHead>P&L</TableHead>
                    <TableHead>Open Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openPositions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-400">
                        No open positions
                      </TableCell>
                    </TableRow>
                  ) : (
                    openPositions.map((position) => (
                      <TableRow key={position.id} className="border-trading-border hover:bg-white/5">
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <div className={getSymbolAvatar(position.symbol)}>
                              {position.symbol.substring(0, 4)}
                            </div>
                            <span className="font-medium">{position.symbol}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{position.type.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          {position.quantity} {position.side === 'short' && '(short)'}
                        </TableCell>
                        <TableCell>{formatCurrency(position.entryPrice)}</TableCell>
                        <TableCell>{formatCurrency(position.currentPrice)}</TableCell>
                        <TableCell>{formatCurrency(position.marketValue)}</TableCell>
                        <TableCell>
                          <div className={position.unrealizedPnL >= 0 ? 'text-success-green' : 'text-danger-red'}>
                            {position.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(position.unrealizedPnL)}
                            <div className="text-xs">
                              ({formatPercentage((position.unrealizedPnL / (position.entryPrice * position.quantity)) * 100)})
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(position.openDate)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Closed Positions</CardTitle>
              <CardDescription>Historical position performance</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-trading-border">
                    <TableHead>Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Entry Price</TableHead>
                    <TableHead>Exit Price</TableHead>
                    <TableHead>Realized P&L</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Close Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closedPositions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-400">
                        No closed positions
                      </TableCell>
                    </TableRow>
                  ) : (
                    closedPositions.map((position) => {
                      const duration = position.closeDate && position.openDate ? 
                        Math.floor((position.closeDate.getTime() - position.openDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                      
                      return (
                        <TableRow key={position.id} className="border-trading-border hover:bg-white/5">
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div className={getSymbolAvatar(position.symbol)}>
                                {position.symbol.substring(0, 4)}
                              </div>
                              <span className="font-medium">{position.symbol}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{position.type.toUpperCase()}</Badge>
                          </TableCell>
                          <TableCell>{position.quantity}</TableCell>
                          <TableCell>{formatCurrency(position.entryPrice)}</TableCell>
                          <TableCell>{formatCurrency(position.currentPrice)}</TableCell>
                          <TableCell>
                            <div className={position.realizedPnL >= 0 ? 'text-success-green' : 'text-danger-red'}>
                              {position.realizedPnL >= 0 ? '+' : ''}{formatCurrency(position.realizedPnL)}
                              <div className="text-xs">
                                ({formatPercentage((position.realizedPnL / (position.entryPrice * position.quantity)) * 100)})
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{duration}d</TableCell>
                          <TableCell>{position.closeDate ? formatDate(position.closeDate) : 'N/A'}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Return:</span>
                  <span className={`font-medium ${
                    mainPortfolio.performance.totalReturn >= 0 ? 'text-success-green' : 'text-danger-red'
                  }`}>
                    {formatCurrency(mainPortfolio.performance.totalReturn)} 
                    ({formatPercentage(mainPortfolio.performance.totalReturnPercent)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Drawdown:</span>
                  <span className="text-danger-red">{formatPercentage(mainPortfolio.performance.maxDrawdown)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Sharpe Ratio:</span>
                  <span className="font-medium">{mainPortfolio.performance.sharpeRatio.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Win Rate:</span>
                  <span className="text-success-green">{formatPercentage(mainPortfolio.performance.winRate, 1)}</span>
                </div>
              </CardContent>
            </Card>

            {riskMetrics && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Risk Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Portfolio Beta:</span>
                    <span className="font-medium">{riskMetrics.beta.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">VaR (95%):</span>
                    <span className="text-warning-orange">{formatCurrency(riskMetrics.var95)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Concentration Risk:</span>
                    <span className="font-medium">{riskMetrics.concentrationRisk.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Liquidity Risk:</span>
                    <span className="font-medium">{riskMetrics.liquidityRisk.toFixed(1)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
