import { useSignals } from "@/hooks/useSignals";
import { Brain, Umbrella, Shield, BarChart3 } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/utils/formatters";

interface StrategyPerformanceData {
  name: string;
  type: string;
  activePositions: number;
  totalReturn: number;
  winRate: number;
  icon: React.ComponentType<any>;
  iconBg: string;
  iconColor: string;
}

export default function StrategyPerformance() {
  const { data: signals = [] } = useSignals();

  // Mock performance data - in production this would come from API
  const strategyData: StrategyPerformanceData[] = [
    {
      name: "Stock Replacement",
      type: "stock_replacement",
      activePositions: signals.filter(s => s.strategy === 'stock_replacement').length || 15,
      totalReturn: 42350,
      winRate: 78,
      icon: BarChart3,
      iconBg: "from-accent-blue/20 to-accent-purple/20",
      iconColor: "text-accent-blue",
    },
    {
      name: "Covered Calls",
      type: "covered_call",
      activePositions: signals.filter(s => s.strategy === 'covered_call').length || 8,
      totalReturn: 28920,
      winRate: 85,
      icon: Umbrella,
      iconBg: "from-success-green/20 to-accent-blue/20",
      iconColor: "text-success-green",
    },
    {
      name: "Protective Puts",
      type: "protective_put",
      activePositions: signals.filter(s => s.strategy === 'protective_put').length || 6,
      totalReturn: 15680,
      winRate: 72,
      icon: Shield,
      iconBg: "from-accent-purple/20 to-danger-red/20",
      iconColor: "text-accent-purple",
    },
    {
      name: "Iron Condors",
      type: "iron_condor",
      activePositions: signals.filter(s => s.strategy === 'iron_condor').length || 12,
      totalReturn: 31240,
      winRate: 69,
      icon: Brain,
      iconBg: "from-warning-orange/20 to-danger-red/20",
      iconColor: "text-warning-orange",
    },
  ];

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold">Strategy Performance</h3>
          <p className="text-sm text-gray-400 mt-1">Performance by strategy type</p>
        </div>
      </div>
      
      <div className="space-y-4">
        {strategyData.map((strategy, index) => {
          const Icon = strategy.icon;
          
          return (
            <div 
              key={index} 
              className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <div className={`w-10 h-10 bg-gradient-to-br ${strategy.iconBg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`${strategy.iconColor} w-5 h-5`} />
                </div>
                <div>
                  <div className="font-medium">{strategy.name}</div>
                  <div className="text-xs text-gray-400">
                    {strategy.activePositions} active position{strategy.activePositions !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-success-green font-bold">
                  {formatCurrency(strategy.totalReturn)}
                </div>
                <div className="text-xs text-gray-400">
                  Win Rate: {formatPercentage(strategy.winRate, 0)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
