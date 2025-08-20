import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import { Settings, TrendingUp, Play, Pause } from "lucide-react";

export default function Strategies() {
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  
  const { data: strategies = [], isLoading } = useQuery({
    queryKey: ['/api/strategies'],
    queryFn: () => api.getStrategies(),
  });

  const strategyIcons = {
    long_call_leaps: "🚀",
    protective_put: "🛡️",
  };

  const strategyDescriptions = {
    long_call_leaps: "Use LEAP call options for leveraged long exposure with controlled risk and reduced capital requirements.",
    protective_put: "Protect portfolio positions with strategic put purchases to limit downside risk while maintaining upside potential.",
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="glass-card animate-pulse">
            <CardContent className="h-32 bg-gray-700 rounded"></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Strategy Overview */}
      <div className="glass-card">
        <h2 className="text-2xl font-bold mb-2">Simplified LEAPS Strategies</h2>
        <p className="text-gray-400 mb-6">
          Focused on two core strategies: Long Call LEAPS for growth exposure and Protective Puts for downside protection. 
          Clean, effective approach to options trading with sophisticated risk management.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {strategies.map((strategy: any) => (
            <Card 
              key={strategy.id} 
              className={`glass-card cursor-pointer transition-all hover:bg-white/10 ${
                selectedStrategy === strategy.id ? 'ring-2 ring-accent-blue' : ''
              }`}
              onClick={() => setSelectedStrategy(strategy.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="text-2xl">
                    {strategyIcons[strategy.type as keyof typeof strategyIcons]}
                  </div>
                  <Switch checked={strategy.enabled} />
                </div>
                <CardTitle className="text-lg">{strategy.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm mb-3">
                  {strategyDescriptions[strategy.type as keyof typeof strategyDescriptions]}
                </CardDescription>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Active Positions:</span>
                    <span className="font-medium">
                      {Math.floor(Math.random() * 20) + 5}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Success Rate:</span>
                    <span className="font-medium text-success-green">
                      {Math.floor(Math.random() * 30 + 60)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Strategy Configuration */}
      {selectedStrategy && (
        <div className="glass-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">Strategy Configuration</h3>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Edit Parameters
              </Button>
              <Button variant="outline" size="sm">
                <TrendingUp className="w-4 h-4 mr-2" />
                View Performance
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Risk Parameters</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Position Size:</span>
                  <span>10%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Stop Loss:</span>
                  <span>15%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Profit Target:</span>
                  <span>25%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Drawdown:</span>
                  <span>10%</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Screening Criteria</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Min Market Cap:</span>
                  <span>$10B</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Min Volume:</span>
                  <span>1M shares</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Min Days to Exp:</span>
                  <span>300 days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">IV Range:</span>
                  <span>15% - 80%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Performance */}
      <div className="glass-card">
        <h3 className="text-xl font-bold mb-6">Recent Strategy Signals</h3>
        
        <div className="space-y-4">
          {[
            {
              symbol: "AAPL",
              strategy: "Long Call LEAPS",
              signal: "BUY",
              confidence: 8.4,
              expectedReturn: 24.8,
              status: "Active"
            },
            {
              symbol: "MSFT", 
              strategy: "Long Call LEAPS",
              signal: "BUY",
              confidence: 7.9,
              expectedReturn: 19.5,
              status: "Active"
            },
            {
              symbol: "GOOGL",
              strategy: "Protective Put", 
              signal: "BUY",
              confidence: 7.2,
              expectedReturn: 15.3,
              status: "Active"
            },
            {
              symbol: "NVDA",
              strategy: "Long Call LEAPS",
              signal: "BUY",
              confidence: 8.7,
              expectedReturn: 31.2,
              status: "Monitoring"
            }
          ].map((signal, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gradient-to-br from-accent-blue to-accent-purple rounded-lg flex items-center justify-center font-bold text-sm">
                  {signal.symbol}
                </div>
                <div>
                  <div className="font-medium">{signal.strategy}</div>
                  <div className="text-sm text-gray-400">{signal.symbol}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <div className={`font-medium ${
                    signal.signal === 'BUY' ? 'text-success-green' : 
                    signal.signal === 'SELL' ? 'text-danger-red' : 'text-warning-orange'
                  }`}>
                    {signal.signal}
                  </div>
                  <div className="text-xs text-gray-400">Action</div>
                </div>
                
                <div className="text-center">
                  <div className="font-medium">{signal.confidence}/10</div>
                  <div className="text-xs text-gray-400">Confidence</div>
                </div>
                
                <div className="text-center">
                  <div className={`font-medium ${
                    signal.expectedReturn > 0 ? 'text-success-green' : 'text-danger-red'
                  }`}>
                    {signal.expectedReturn > 0 ? '+' : ''}{signal.expectedReturn}%
                  </div>
                  <div className="text-xs text-gray-400">Expected Return</div>
                </div>
                
                <Badge className={
                  signal.status === 'Active' ? 'status-badge-active' : 'status-badge-monitoring'
                }>
                  {signal.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
