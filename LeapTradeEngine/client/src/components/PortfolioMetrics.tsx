import { Wallet, TrendingUp, Target, Shield, ArrowUp, ArrowDown } from "lucide-react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useSignals } from "@/hooks/useSignals";
import { formatCurrency, formatPercentage } from "@/utils/formatters";

export default function PortfolioMetrics() {
  const { data: portfolios = [] } = usePortfolio();
  const { data: activeSignals = [] } = useSignals({ status: 'active' });
  
  const mainPortfolio = portfolios[0];
  
  if (!mainPortfolio) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card animate-pulse">
            <div className="h-24 bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const totalValue = mainPortfolio.totalValue ?? 0;
  const dayChange = mainPortfolio.performance?.dayChange ?? 0;
  const dayChangePercent = mainPortfolio.performance?.dayChangePercent ?? 0;
  const winRate = mainPortfolio.performance?.winRate ?? 0;
  
  // Count profitable vs monitoring signals
  const profitableSignals = activeSignals.filter(s => 
    s.expectedReturn !== undefined && s.expectedReturn > 0
  ).length;
  const monitoringSignals = activeSignals.length - profitableSignals;

  const metrics = [
    {
      title: "Portfolio Value",
      value: formatCurrency(totalValue),
      change: dayChange,
      changePercent: dayChangePercent,
      icon: Wallet,
      iconBg: "from-accent-blue/20 to-accent-purple/20",
      iconColor: "text-accent-blue",
    },
    {
      title: "Active LEAPS",
      value: activeSignals.length.toString(),
      subtitle: `${profitableSignals} profitable • ${monitoringSignals} monitoring`,
      icon: TrendingUp,
      iconBg: "from-success-green/20 to-accent-blue/20",
      iconColor: "text-success-green",
    },
    {
      title: "Win Rate",
      value: formatPercentage(winRate, 1),
      change: 2.1, // Mock change for demo
      changePercent: null,
      icon: Target,
      iconBg: "from-success-green/20 to-warning-orange/20",
      iconColor: "text-success-green",
    },
    {
      title: "Risk Score",
      value: "6.2",
      subtitle: "Low Risk",
      icon: Shield,
      iconBg: "from-accent-purple/20 to-danger-red/20",
      iconColor: "text-accent-purple",
      riskLevel: "low",
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        const isPositive = metric.change ? metric.change > 0 : null;
        
        return (
          <div key={index} className="glass-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 font-medium">{metric.title}</p>
                <p className="text-3xl font-bold mt-1">{metric.value}</p>
                
                {metric.change !== undefined && metric.change !== null && (
                  <div className="flex items-center mt-2 text-sm">
                    {isPositive ? (
                      <ArrowUp className="w-4 h-4 text-success-green mr-1" />
                    ) : (
                      <ArrowDown className="w-4 h-4 text-danger-red mr-1" />
                    )}
                    <span className={isPositive ? 'text-success-green' : 'text-danger-red'}>
                      {isPositive ? '+' : ''}{formatCurrency(metric.change)}
                      {metric.changePercent && ` (${formatPercentage(metric.changePercent)})`}
                    </span>
                    <span className="text-gray-400 ml-2">today</span>
                  </div>
                )}
                
                {metric.subtitle && (
                  <div className="mt-2 text-sm">
                    {metric.riskLevel ? (
                      <div className="flex items-center">
                        <div className={`w-2 h-2 bg-success-green rounded-full mr-2`}></div>
                        <span className="text-success-green">{metric.subtitle}</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 text-gray-400">
                        {metric.subtitle.split('•').map((part, i) => (
                          <span key={i} className={i === 0 ? 'text-success-green' : 'text-warning-orange'}>
                            {part.trim()}
                            {i === 0 && metric.subtitle.includes('•') && <span className="text-gray-400 mx-1">•</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className={`w-14 h-14 bg-gradient-to-br ${metric.iconBg} rounded-2xl flex items-center justify-center`}>
                <Icon className={`${metric.iconColor} text-xl w-6 h-6`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
