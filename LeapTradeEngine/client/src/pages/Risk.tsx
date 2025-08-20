import { useState } from "react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  AlertTriangle, 
  TrendingDown, 
  Activity, 
  RefreshCw,
  Target,
  BarChart3,
  Zap
} from "lucide-react";
import { formatCurrency, formatPercentage } from "@/utils/formatters";
import { useToast } from "@/hooks/use-toast";

export default function Risk() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const { data: portfolios = [] } = usePortfolio();
  const { toast } = useToast();
  
  const mainPortfolio = portfolios[0];
  const portfolioId = mainPortfolio?.id;

  const { data: riskMetrics, isLoading, refetch } = useQuery({
    queryKey: ['/api/portfolios', portfolioId, 'risk'],
    queryFn: () => portfolioId ? api.getRiskMetrics(portfolioId) : null,
    enabled: !!portfolioId,
  });

  const calculateRiskMutation = useMutation({
    mutationFn: () => api.calculateRiskMetrics(portfolioId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios', portfolioId, 'risk'] });
      toast({
        title: "Risk Metrics Updated",
        description: "Risk calculations have been refreshed with latest data.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to calculate risk metrics. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading || !riskMetrics) {
    return (
      <div className="space-y-6">
        <div className="glass-card animate-pulse h-64"></div>
        <div className="glass-card animate-pulse h-96"></div>
      </div>
    );
  }

  const getRiskLevel = (score: number) => {
    if (score <= 3) return { level: "Low", color: "success-green", bgColor: "bg-success-green/20" };
    if (score <= 6) return { level: "Moderate", color: "warning-orange", bgColor: "bg-warning-orange/20" };
    return { level: "High", color: "danger-red", bgColor: "bg-danger-red/20" };
  };

  const overallRiskScore = (riskMetrics.concentrationRisk + riskMetrics.liquidityRisk + Math.abs(riskMetrics.beta - 1) * 5) / 3;
  const riskLevel = getRiskLevel(overallRiskScore);

  const riskFactors = [
    {
      name: "Market Risk (Beta)",
      value: riskMetrics.beta,
      benchmark: 1.0,
      description: "Portfolio sensitivity to market movements",
      icon: TrendingDown,
      status: Math.abs(riskMetrics.beta - 1) < 0.2 ? "good" : Math.abs(riskMetrics.beta - 1) < 0.5 ? "moderate" : "high"
    },
    {
      name: "Concentration Risk",
      value: riskMetrics.concentrationRisk,
      benchmark: 5.0,
      description: "Risk from concentrated positions",
      icon: Target,
      status: riskMetrics.concentrationRisk < 3 ? "good" : riskMetrics.concentrationRisk < 6 ? "moderate" : "high"
    },
    {
      name: "Liquidity Risk",
      value: riskMetrics.liquidityRisk,
      benchmark: 5.0,
      description: "Risk from illiquid positions",
      icon: Activity,
      status: riskMetrics.liquidityRisk < 3 ? "good" : riskMetrics.liquidityRisk < 6 ? "moderate" : "high"
    },
    {
      name: "Correlation Risk",
      value: riskMetrics.correlationRisk,
      benchmark: 5.0,
      description: "Risk from correlated positions",
      icon: BarChart3,
      status: riskMetrics.correlationRisk < 3 ? "good" : riskMetrics.correlationRisk < 6 ? "moderate" : "high"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Risk Overview */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Risk Management</h2>
            <p className="text-gray-400">Portfolio risk assessment and monitoring</p>
          </div>
          <Button 
            onClick={() => calculateRiskMutation.mutate()}
            disabled={calculateRiskMutation.isPending}
            className="bg-accent-blue hover:bg-accent-blue/80"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${calculateRiskMutation.isPending ? 'animate-spin' : ''}`} />
            Recalculate Risk
          </Button>
        </div>

        {/* Risk Score Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className={`text-center p-6 rounded-xl ${riskLevel.bgColor}`}>
            <Shield className={`w-8 h-8 text-${riskLevel.color} mx-auto mb-2`} />
            <div className="text-2xl font-bold">{overallRiskScore.toFixed(1)}/10</div>
            <div className="text-sm text-gray-400">Overall Risk Score</div>
            <div className={`text-sm mt-1 text-${riskLevel.color} font-medium`}>
              {riskLevel.level} Risk
            </div>
          </div>

          <div className="text-center p-6 bg-white/5 rounded-xl">
            <AlertTriangle className="w-8 h-8 text-warning-orange mx-auto mb-2" />
            <div className="text-2xl font-bold">{formatCurrency(riskMetrics.var95)}</div>
            <div className="text-sm text-gray-400">Value at Risk (95%)</div>
            <div className="text-sm text-warning-orange mt-1">
              1-day potential loss
            </div>
          </div>

          <div className="text-center p-6 bg-white/5 rounded-xl">
            <Zap className="w-8 h-8 text-accent-purple mx-auto mb-2" />
            <div className="text-2xl font-bold">{formatCurrency(riskMetrics.expectedShortfall)}</div>
            <div className="text-sm text-gray-400">Expected Shortfall</div>
            <div className="text-sm text-gray-400 mt-1">
              Tail risk measure
            </div>
          </div>

          <div className="text-center p-6 bg-white/5 rounded-xl">
            <Activity className="w-8 h-8 text-success-green mx-auto mb-2" />
            <div className="text-2xl font-bold">{riskMetrics.greeksExposure.totalDelta.toFixed(1)}</div>
            <div className="text-sm text-gray-400">Net Delta Exposure</div>
            <div className="text-sm text-gray-400 mt-1">
              Directional risk
            </div>
          </div>
        </div>

        {/* Risk Alerts */}
        {overallRiskScore > 7 && (
          <Alert className="mb-6 border-danger-red/30 bg-danger-red/10">
            <AlertTriangle className="h-4 w-4 text-danger-red" />
            <AlertDescription className="text-danger-red">
              <strong>High Risk Alert:</strong> Portfolio risk score is elevated. Consider reducing position sizes or increasing diversification.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Risk Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4 bg-trading-card">
          <TabsTrigger value="overview">Risk Factors</TabsTrigger>
          <TabsTrigger value="greeks">Greeks Exposure</TabsTrigger>
          <TabsTrigger value="stress">Stress Tests</TabsTrigger>
          <TabsTrigger value="limits">Risk Limits</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Risk Factor Analysis</CardTitle>
                <CardDescription>Detailed breakdown of portfolio risk components</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {riskFactors.map((factor, index) => {
                  const Icon = factor.icon;
                  const statusColor = factor.status === 'good' ? 'success-green' : 
                                    factor.status === 'moderate' ? 'warning-orange' : 'danger-red';
                  
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Icon className={`w-4 h-4 text-${statusColor}`} />
                          <span className="font-medium">{factor.name}</span>
                        </div>
                        <span className={`font-bold text-${statusColor}`}>
                          {factor.value.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`bg-${statusColor} h-2 rounded-full`}
                          style={{ width: `${Math.min(100, (factor.value / (factor.benchmark * 2)) * 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-400">{factor.description}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Risk Decomposition</CardTitle>
                <CardDescription>Sources of portfolio risk</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Systematic Risk:</span>
                    <span className="font-medium">65%</span>
                  </div>
                  <Progress value={65} className="h-2" />
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Idiosyncratic Risk:</span>
                    <span className="font-medium">25%</span>
                  </div>
                  <Progress value={25} className="h-2" />
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Model Risk:</span>
                    <span className="font-medium">10%</span>
                  </div>
                  <Progress value={10} className="h-2" />
                </div>

                <div className="mt-6 pt-4 border-t border-gray-700">
                  <h4 className="font-medium mb-3">Risk Attribution by Strategy</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Stock Replacement:</span>
                      <span>45%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Covered Calls:</span>
                      <span>25%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Protective Puts:</span>
                      <span>20%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Iron Condors:</span>
                      <span>10%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="greeks" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Greeks Exposure</CardTitle>
              <CardDescription>Options risk sensitivities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-white/5 rounded-xl">
                  <div className="text-2xl font-bold text-accent-blue">
                    {riskMetrics.greeksExposure.totalDelta.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-400">Total Delta</div>
                  <div className="text-xs text-gray-500 mt-1">Price sensitivity</div>
                </div>

                <div className="text-center p-4 bg-white/5 rounded-xl">
                  <div className="text-2xl font-bold text-accent-purple">
                    {riskMetrics.greeksExposure.totalGamma.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-400">Total Gamma</div>
                  <div className="text-xs text-gray-500 mt-1">Delta sensitivity</div>
                </div>

                <div className="text-center p-4 bg-white/5 rounded-xl">
                  <div className="text-2xl font-bold text-danger-red">
                    {riskMetrics.greeksExposure.totalTheta.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-400">Total Theta</div>
                  <div className="text-xs text-gray-500 mt-1">Time decay</div>
                </div>

                <div className="text-center p-4 bg-white/5 rounded-xl">
                  <div className="text-2xl font-bold text-warning-orange">
                    {riskMetrics.greeksExposure.totalVega.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-400">Total Vega</div>
                  <div className="text-xs text-gray-500 mt-1">Volatility sensitivity</div>
                </div>
              </div>

              <div className="mt-8">
                <h4 className="font-medium mb-4">Greeks Analysis</h4>
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Delta Exposure</span>
                      <span className={`font-bold ${
                        Math.abs(riskMetrics.greeksExposure.totalDelta) < 50 ? 'text-success-green' : 'text-warning-orange'
                      }`}>
                        {Math.abs(riskMetrics.greeksExposure.totalDelta) < 50 ? 'Balanced' : 'Directional'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Current delta exposure indicates {riskMetrics.greeksExposure.totalDelta > 0 ? 'bullish' : 'bearish'} portfolio bias.
                    </p>
                  </div>

                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Time Decay Risk</span>
                      <span className={`font-bold ${
                        riskMetrics.greeksExposure.totalTheta > -100 ? 'text-success-green' : 'text-danger-red'
                      }`}>
                        {riskMetrics.greeksExposure.totalTheta > -100 ? 'Low' : 'High'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Daily theta decay of {formatCurrency(riskMetrics.greeksExposure.totalTheta)} if no other factors change.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stress" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Stress Test Results</CardTitle>
              <CardDescription>Portfolio performance under adverse scenarios</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <TrendingDown className="w-8 h-8 text-danger-red mx-auto mb-2" />
                    <div className="text-xl font-bold text-danger-red">
                      {formatCurrency(riskMetrics.stressTests.market10Down)}
                    </div>
                    <div className="text-sm text-gray-400">Market -10%</div>
                  </div>

                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <TrendingDown className="w-8 h-8 text-danger-red mx-auto mb-2" />
                    <div className="text-xl font-bold text-danger-red">
                      {formatCurrency(riskMetrics.stressTests.market20Down)}
                    </div>
                    <div className="text-sm text-gray-400">Market -20%</div>
                  </div>

                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <Activity className="w-8 h-8 text-warning-orange mx-auto mb-2" />
                    <div className="text-xl font-bold text-warning-orange">
                      {formatCurrency(riskMetrics.stressTests.volatilityShock)}
                    </div>
                    <div className="text-sm text-gray-400">Volatility Shock</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Scenario Analysis</h4>
                  
                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Black Monday (1987)</span>
                      <span className="text-danger-red font-bold">-22.6%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-danger-red h-2 rounded-full" style={{ width: '22.6%' }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Historical worst single-day market drop</p>
                  </div>

                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">COVID-19 Crash (2020)</span>
                      <span className="text-danger-red font-bold">-34.0%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-danger-red h-2 rounded-full" style={{ width: '34%' }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Peak-to-trough decline in 2020</p>
                  </div>

                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Dot-com Crash (2000-2002)</span>
                      <span className="text-danger-red font-bold">-78.0%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-danger-red h-2 rounded-full" style={{ width: '78%' }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">NASDAQ peak-to-trough decline</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="limits" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Risk Limits & Controls</CardTitle>
              <CardDescription>Portfolio risk management guidelines and alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-4">Position Limits</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Max Position Size:</span>
                        <span className="font-medium">10%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Max Sector Exposure:</span>
                        <span className="font-medium">25%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Max Strategy Exposure:</span>
                        <span className="font-medium">40%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Max Leverage:</span>
                        <span className="font-medium">2.0x</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-4">Risk Thresholds</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Max VaR (1-day):</span>
                        <span className="font-medium">2%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Max Drawdown:</span>
                        <span className="font-medium">15%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Beta Range:</span>
                        <span className="font-medium">0.5 - 1.5</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Min Liquidity Score:</span>
                        <span className="font-medium">5.0</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <h4 className="font-medium mb-4">Active Alerts</h4>
                  <div className="space-y-3">
                    <Alert className="border-warning-orange/30 bg-warning-orange/10">
                      <AlertTriangle className="h-4 w-4 text-warning-orange" />
                      <AlertDescription className="text-warning-orange">
                        Concentration risk is elevated. Consider reducing position sizes in top holdings.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
