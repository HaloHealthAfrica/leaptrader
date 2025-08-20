import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import PortfolioChart from "@/components/charts/portfolio-chart";
import AllocationChart from "@/components/charts/allocation-chart";
import SignalsTable from "@/components/signals-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  Shield, 
  Zap,
  ArrowUpRight,
  FolderSync,
  Plus,
  Bell
} from "lucide-react";

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState("dashboard");

  // Fetch portfolio data
  const { data: portfolios } = useQuery({
    queryKey: ['/api/portfolios/demo-user-1'],
  });

  const portfolio = portfolios?.[0];

  // Fetch active signals
  const { data: activeSignals } = useQuery({
    queryKey: ['/api/signals/active'],
  });

  // Fetch strategy performance
  const { data: strategyPerformance } = useQuery({
    queryKey: ['/api/strategy-performance/demo-portfolio-1'],
  });

  // Fetch risk metrics
  const { data: riskMetrics } = useQuery({
    queryKey: ['/api/risk-metrics/demo-portfolio-1'],
  });

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numValue);
  };

  const formatPercentage = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return `${numValue.toFixed(1)}%`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Navigation activeSection={activeSection} onSectionChange={setActiveSection} />
      
      <main className="ml-72 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/10">
          <div className="px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <h2 className="text-2xl font-bold text-white">Dashboard</h2>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-400">Market Open</span>
                  </div>
                  <div className="text-gray-400">|</div>
                  <div className="text-gray-300">
                    {new Date().toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true,
                    })} EST
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <Button className="bg-blue-600/20 text-blue-400 border-blue-500/30 hover:bg-blue-600/30">
                  <FolderSync className="h-4 w-4 mr-2" />
                  FolderSync Data
                </Button>
                <Button className="bg-green-600/20 text-green-400 border-green-500/30 hover:bg-green-600/30">
                  <Plus className="h-4 w-4 mr-2" />
                  New Signal
                </Button>
                <div className="flex items-center space-x-2 text-sm">
                  <Bell className="h-5 w-5 text-gray-400" />
                  <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">3</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 space-y-8">
          {/* Hero Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="glass-card border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 font-medium">Portfolio Value</p>
                    <p className="text-3xl font-bold mt-1 text-white">
                      {portfolio ? formatCurrency(portfolio.totalValue) : '$0'}
                    </p>
                    <div className="flex items-center mt-2 text-sm">
                      <ArrowUpRight className="h-4 w-4 text-green-400 mr-1" />
                      <span className="text-green-400">+$47,832 (1.7%)</span>
                      <span className="text-gray-400 ml-2">today</span>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center">
                    <DollarSign className="h-7 w-7 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="glass-card border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 font-medium">Active Positions</p>
                    <p className="text-3xl font-bold mt-1 text-white">
                      {activeSignals?.length || 0}
                    </p>
                    <div className="flex items-center mt-2 text-sm">
                      <span className="text-green-400">
                        {activeSignals?.filter(s => parseFloat(s.pnl || "0") > 0).length || 0} profitable
                      </span>
                      <span className="text-gray-400 mx-1">•</span>
                      <span className="text-orange-400">
                        {activeSignals?.filter(s => s.status === "monitoring").length || 0} monitoring
                      </span>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center">
                    <TrendingUp className="h-7 w-7 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="glass-card border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 font-medium">Win Rate</p>
                    <p className="text-3xl font-bold mt-1 text-white">87.3%</p>
                    <div className="flex items-center mt-2 text-sm">
                      <ArrowUpRight className="h-4 w-4 text-green-400 mr-1" />
                      <span className="text-green-400">+2.1%</span>
                      <span className="text-gray-400 ml-2">vs last month</span>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-green-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center">
                    <Target className="h-7 w-7 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="glass-card border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 font-medium">Risk Score</p>
                    <p className="text-3xl font-bold mt-1 text-white">
                      {portfolio?.riskScore || '6.2'}
                    </p>
                    <div className="flex items-center mt-2 text-sm">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                      <span className="text-green-400">Low Risk</span>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-red-500/20 rounded-2xl flex items-center justify-center">
                    <Shield className="h-7 w-7 text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <PortfolioChart />
            </div>
            <AllocationChart />
          </div>

          {/* Active Signals */}
          <SignalsTable signals={activeSignals || []} />

          {/* Strategy Performance & Risk */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">Simplified Strategy Performance</CardTitle>
                <p className="text-sm text-gray-400">Long Calls & Protective Puts performance</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {strategyPerformance?.map((strategy, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-center">
                        <Zap className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{strategy.strategy}</div>
                        <div className="text-xs text-gray-400">{strategy.totalPositions} positions</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold">{formatCurrency(strategy.totalPnl)}</div>
                      <div className="text-xs text-gray-400">Win Rate: {formatPercentage(strategy.winRate)}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">Risk Analytics</CardTitle>
                <p className="text-sm text-gray-400">Portfolio risk assessment</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <span className="font-medium text-white">Portfolio Beta</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white">{riskMetrics?.portfolioBeta || '1.15'}</div>
                    <div className="text-xs text-green-400">Normal</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <span className="font-medium text-white">Max Drawdown</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white">{formatPercentage(riskMetrics?.maxDrawdown || '-8.2')}</div>
                    <div className="text-xs text-green-400">Good</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <span className="font-medium text-white">Sharpe Ratio</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white">{riskMetrics?.sharpeRatio || '2.34'}</div>
                    <div className="text-xs text-green-400">Excellent</div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">Overall Risk Score</span>
                    <span className="text-2xl font-bold text-green-400">
                      {portfolio?.riskScore || '6.2'}/10
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full" 
                      style={{ width: `${(parseFloat(portfolio?.riskScore || '6.2') / 10) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Risk level: Low to Moderate</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
